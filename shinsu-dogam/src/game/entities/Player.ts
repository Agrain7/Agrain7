// 영물 + 라이더 조작 (이동 물리는 영물·성장 단계별 MovementProfile 데이터로 결정)
import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene.ts';
import { MOUNTS, SKILLS } from '../../data/mounts.ts';
import type { MountDef, MovementProfile, StageDef, SkillDef } from '../../data/types.ts';
import { MOUNT_ART, artKey, type MountArtInfo } from '../../data/mountArt.ts';
import { COSMETICS } from '../../data/cosmetics.ts';
import { ensureMount, ensureRider, riderMeta, type MountTex } from '../textures.ts';
import { controls } from '../controls.ts';
import { store } from '../ctx.ts';
import { GRAVITY, MAX_FALL } from '../config.ts';
import { audio } from '../../systems/audio.ts';
import { overlaps } from '../world/Level.ts';
import { ULT_GAIN } from '../../data/beastSkills.ts';
import { PLAYTEST_GIFT_ID } from '../../systems/playtestGift.ts';

const approach = (v: number, t: number, d: number) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export class Player {
  zone: Phaser.GameObjects.Zone;
  body: Phaser.Physics.Arcade.Body;
  vis: Phaser.GameObjects.Container;
  mountSpr!: Phaser.GameObjects.Sprite;
  riderSpr!: Phaser.GameObjects.Sprite;
  /** 목에 단 장식들 (매듭·옥·방울 — 여러 개 동시에) */
  decorSprs: Phaser.GameObjects.Image[] = [];
  /** 근두운 (네발 영물·현무가 날 때) */
  flyCloud?: Phaser.GameObjects.Image;
  shieldSpr: Phaser.GameObjects.Image;
  trail?: Phaser.GameObjects.Particles.ParticleEmitter;
  def!: MountDef;
  st!: StageDef;
  mv!: MovementProfile;
  info!: MountArtInfo;
  mt!: MountTex;
  riderKey = '';
  facing = 1;
  hp = 100;
  maxHp = 100;
  atk = 10;
  defense = 0;
  // 상태
  grounded = false;
  wasGrounded = false;
  coyote = 0;
  jumpBuf = 0;
  airJumps = 0;
  jumpCut = false;
  gliding = false;
  glideT = 0;
  flying = false;
  dashT = 0;
  dashCD = 0;
  dashDir = 1;
  dashDamage = 0;
  dashHits = new Set<unknown>();
  attackCD = 0;
  specialCD = 0;
  attackT = 0;
  castT = 0;
  invuln = 0;
  hurtT = 0;
  shieldT = 0;
  shieldAmt = 0;
  diving: SkillDef | null = null;
  inUpdraft = false;
  locked = false;
  /** 필살기 게이지 0..100 */
  ult = PLAYTEST_GIFT_ID ? 100 : 40;
  /** 필살기 연출 중 (조작 잠금 + 무적) */
  ultT = 0;
  /** 공격 모션 재생 시간 */
  atkAnimT = 0;
  /** 피격 깜빡임 (필살기·돌진 무적은 깜빡이지 않음) */
  blinkT = 0;
  squash = 1;
  lastX = 0;
  private afterT = 0;
  private trailT = 0;
  private pawFlip = false;
  private flashT = 0;

  constructor(private scene: WorldScene, x: number, y: number) {
    this.zone = scene.add.zone(x, y, 60, 50);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(true);
    this.body.setGravityY(GRAVITY);
    this.body.setMaxVelocity(2400, MAX_FALL);
    this.body.setCollideWorldBounds(false);
    this.vis = scene.add.container(x, y).setDepth(10);
    this.shieldSpr = scene.add.image(x, y, 'fx_shield').setDepth(11).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.lastX = x;
    this.rebuild(true);
  }

  get x() { return this.body.center.x; }
  get y() { return this.body.center.y; }
  get bottom() { return this.body.bottom; }
  rect() { return { x: this.body.x, y: this.body.y, w: this.body.width, h: this.body.height }; }

  /** 영물 교체·진화·스킨 변경 시 외형과 능력을 다시 구성 */
  rebuild(first = false) {
    const ms = store.state.active;
    const ratio = first ? 1 : this.hp / this.maxHp;
    this.def = MOUNTS[ms.id];
    this.st = this.def.stages[ms.stage];
    this.mv = this.st.movement;
    this.info = MOUNT_ART[artKey(ms.id, ms.stage)];
    this.mt = ensureMount(this.scene, ms.id, ms.stage, ms.skin);
    const s = store.state.stats(ms.id);
    this.maxHp = s.maxHp;
    this.atk = s.atk;
    this.defense = s.def;
    this.hp = Math.max(1, Math.round(this.maxHp * ratio));
    // 충돌 상자 (바닥 위치 유지)
    const bottom = this.body.bottom;
    const cx = this.body.center.x;
    this.zone.setSize(this.st.body.w, this.st.body.h);
    this.body.setSize(this.st.body.w, this.st.body.h);
    this.body.reset(cx - this.st.body.w / 2 + this.st.body.w / 2, bottom - this.st.body.h / 2);
    // 외형
    this.vis.removeAll(true);
    const info = this.info;
    this.mountSpr = this.scene.add.sprite(0, 0, this.mt.key, 'idle_0')
      .setOrigin(this.mt.originX, this.mt.originY)
      .setScale(this.mt.scale);
    this.riderKey = ensureRider(this.scene, store.state.data.cosmetics.outfit);
    const rm = riderMeta(this.riderKey);
    this.riderSpr = this.scene.add.sprite(0, 0, this.riderKey, 'idle_0').setOrigin(rm.ox, rm.oy);
    const visH = info.h * info.scale;
    this.riderSpr.setScale(Phaser.Math.Clamp(visH / 150, 0.56, 0.86) * rm.scaleMul);
    // 근두운: 네발 영물·현무는 날 때 구름을 타고 난다
    this.flyCloud = (info.motion === 'quad' || info.motion === 'shell') && this.mv.flight
      ? this.scene.add.image(0, 0, 'fly_cloud').setVisible(false).setScale((info.w * info.scale * 1.15) / 220)
      : undefined;
    this.vis.add([...(this.flyCloud ? [this.flyCloud] : []), this.mountSpr, this.riderSpr]);
    // 장식: 목에 매달려 흔들림 (장착한 것 모두)
    this.decorSprs = [];
    const ornScale = Phaser.Math.Clamp(visH / 150, 0.7, 1.15) * 0.95;
    for (const d of store.state.data.cosmetics.decor) {
      const key = d === 'decor_knot' ? 'orn_knot' : d === 'decor_jade' ? 'orn_jade' : d === 'decor_bell' ? 'orn_bell' : null;
      if (!key || !COSMETICS[d]) continue;
      const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.02).setScale(ornScale);
      this.decorSprs.push(img);
      this.vis.add(img);
    }
    // 이동 효과 (꾸미기) — 진짜로 보이게: 발자국은 땅에 찍히고, 구름·꽃잎은 뒤로 흩날린다
    this.trail?.destroy();
    this.trail = undefined;
    const trail = store.state.data.cosmetics.trail;
    if (trail === 'trail_footprint') {
      this.trail = this.scene.add.particles(0, 0, 'fx_paw', {
        lifespan: 2400, speed: 0, scaleX: 0.95, scaleY: 0.55, alpha: { start: 1, end: 0 }, emitting: false,
      }).setDepth(-8.5);
    } else if (trail === 'trail_cloud') {
      this.trail = this.scene.add.particles(0, 0, 'fx_cloudpuff', {
        lifespan: 1200, speedX: { min: -30, max: 30 }, speedY: { min: -26, max: -6 }, scale: { start: 0.45, end: 1.05 }, alpha: { start: 0.95, end: 0 }, emitting: false,
      }).setDepth(9.5);
    } else if (trail === 'trail_petal') {
      this.trail = this.scene.add.particles(0, 0, 'petal', {
        lifespan: 1800, speedX: { min: -80, max: 80 }, speedY: { min: -110, max: -20 }, gravityY: 90, scale: { min: 1.2, max: 1.9 }, tint: [0xffffff, 0xffd6e2, 0xff9ab8],
        rotate: { start: 0, end: 540 }, alpha: { start: 1, end: 0 }, emitting: false,
      }).setDepth(10.5);
    }
    this.flying = false;
    this.diving = null;
    this.dashT = 0;
    this.body.setAllowGravity(true);
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + Math.round(amount));
  }

  update(dt: number) {
    const c = controls;
    const b = this.body;
    const mv = this.mv;
    // 타이머
    this.dashCD -= dt; this.attackCD -= dt; this.specialCD -= dt; this.attackT -= dt; this.castT -= dt;
    this.invuln -= dt; this.hurtT -= dt; this.shieldT -= dt; this.flashT -= dt; this.atkAnimT -= dt; this.blinkT -= dt;
    if (this.ultT > 0) { this.ultT -= dt; this.invuln = Math.max(this.invuln, 0.2); }
    this.grounded = b.blocked.down || b.touching.down;
    if (this.grounded) {
      this.coyote = 0.1;
      this.airJumps = mv.airJumps;
      this.glideT = 0;
      this.jumpCut = false;
      if (this.flying) this.flying = false;
      if (!this.wasGrounded) this.onLand();
    } else this.coyote -= dt;
    const jumpHeld = c.held.jump || c.held.up;
    if (c.pressed.jump || (c.pressed.up && !this.flying)) this.jumpBuf = 0.13;
    else this.jumpBuf -= dt;

    // 상승 기류
    this.inUpdraft = this.scene.level.updrafts.some((u) => overlaps(this.rect(), u));

    if (this.scene.freezeT > 0) {
      // 필살기 컷인 동안 멈춤
      b.setVelocity(0, 0);
      b.setAllowGravity(false);
      this.wasGrounded = this.grounded;
      this.updateVisual(dt);
      return;
    }
    if (this.locked) {
      b.setVelocityX(approach(b.velocity.x, 0, 3000 * dt));
      this.wasGrounded = this.grounded;
      this.updateVisual(dt);
      return;
    }

    // 급강하
    if (this.diving) {
      b.setAllowGravity(false);
      b.setVelocity(this.facing * (this.diving.speed ?? 1000) * 0.35, this.diving.speed ?? 1000);
      if (this.grounded) {
        this.scene.combat.diveImpact(this, this.diving);
        this.diving = null;
        b.setAllowGravity(true);
      }
      this.wasGrounded = this.grounded;
      this.updateVisual(dt);
      return;
    }

    // 돌진 / 회피
    if (c.pressed.dash && this.dashCD <= 0 && (this.grounded || mv.dash.air) && this.dashT <= 0) {
      this.startDash(c.axis || this.facing, mv.dash.time, mv.dash.speed, mv.dash.damage ?? 0);
      this.dashCD = mv.dash.cooldown;
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      b.setAllowGravity(false);
      b.setVelocity(this.dashDir * (this.dashSpeed ?? mv.dash.speed), 0);
      if (this.dashDamage > 0) this.scene.combat.dashHits(this);
      this.afterT -= dt;
      if (this.afterT <= 0) {
        this.afterT = 0.035;
        this.scene.combat.afterimage(this);
      }
      if (this.dashT <= 0) {
        b.setAllowGravity(!this.flying);
        b.setVelocityX(this.dashDir * mv.runSpeed);
        this.dashSpeed = undefined;
      }
      this.wasGrounded = this.grounded;
      this.updateVisual(dt);
      return;
    }

    // 좌우 이동
    const ax = c.axis;
    if (ax && this.attackT <= 0.1) this.facing = ax;
    else if (ax) this.facing = ax;
    let maxV = mv.runSpeed;
    if (this.gliding && mv.glide) maxV *= mv.glide.speedBonus;
    if (this.flying && mv.flight) maxV = mv.flight.speed;
    const accel = this.grounded ? (ax ? mv.accel : mv.decel) : mv.airAccel * (this.flying ? 1.4 : 1);
    b.setVelocityX(approach(b.velocity.x, ax * maxV, accel * dt));

    // 비행 (자유 비행 능력)
    if (mv.flight && !this.grounded && !this.flying && this.jumpBuf > 0 && this.coyote <= 0 && this.airJumps <= 0) {
      this.flying = true;
      this.jumpBuf = 0;
      audio.play('skill');
      this.scene.combat.ring(this.x, this.y, 'fx_ring_blue', 0.5);
    }
    if (this.flying && mv.flight) {
      b.setAllowGravity(false);
      const up = jumpHeld, down = c.held.down;
      const tv = up ? -mv.flight.vertSpeed : down ? mv.flight.vertSpeed * 1.2 : 30;
      b.setVelocityY(approach(b.velocity.y, tv, 2000 * dt));
      if (this.y < 40) b.setVelocityY(Math.max(0, b.velocity.y));
    } else {
      b.setAllowGravity(true);
      // 점프
      if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
        b.setVelocityY(-mv.jumpVelocity);
        this.jumpBuf = 0;
        this.coyote = 0;
        this.jumpCut = false;
        this.squash = 0.82;
        audio.play('jump');
        this.scene.combat.dust(this.x, this.bottom, 3);
      } else if (this.jumpBuf > 0 && this.airJumps > 0) {
        b.setVelocityY(-(mv.airJumpVelocity ?? mv.jumpVelocity * 0.85));
        this.airJumps--;
        this.jumpBuf = 0;
        this.jumpCut = false;
        this.squash = 0.85;
        audio.play('jump');
        const ringKey = this.def.id === 'hyeonmu' ? 'fx_ring_blue' : mv.glide ? 'fx_ring_white' : 'fx_ring_gold';
        this.scene.combat.ring(this.x, this.bottom, ringKey, 0.35);
        if (this.def.id === 'hyeonmu') this.scene.combat.ring(this.x, this.bottom + 6, 'fx_water', 0.9, 300);
      }
      // 가변 점프 높이
      if (!jumpHeld && b.velocity.y < -250 && !this.jumpCut) {
        b.setVelocityY(b.velocity.y * 0.55);
        this.jumpCut = true;
      }
      // 활공
      const canGlide = !!mv.glide && (mv.glide.maxTime === undefined || this.glideT < mv.glide.maxTime);
      this.gliding = canGlide && !this.grounded && jumpHeld && b.velocity.y > 0;
      if (this.gliding && mv.glide) {
        this.glideT += dt;
        b.setVelocityY(Math.min(b.velocity.y, mv.glide.fallSpeed));
      }
      // 상승 기류: 점프 키(또는 활공)로 떠오름
      if (this.inUpdraft) {
        if (jumpHeld || this.gliding) b.setVelocityY(approach(b.velocity.y, -420, 2600 * dt));
        else b.setVelocityY(Math.min(b.velocity.y, 160));
      }
    }

    // 공격: 누르고 있으면 자동 연속 공격, 가까우면 근접 / 멀면 원거리 (자동 조준)
    if (c.held.attack && this.attackCD <= 0) this.scene.combat.smartAttack(this);
    if (c.pressed.special && this.specialCD <= 0) this.scene.combat.special(this);
    if (c.pressed.ult) {
      if (this.ult >= 100) this.scene.combat.ultimate(this);
    }
    if (c.pressed.down && this.grounded && !this.flying) {
      // 아래 + 점프로 구름 발판 아래로 내려가기는 추후
    }

    this.wasGrounded = this.grounded;
    this.updateVisual(dt);
  }

  private dashSpeed?: number;
  startDash(dir: number, time: number, speed: number, damage: number) {
    this.dashDir = dir;
    this.facing = dir;
    this.dashT = time;
    this.dashSpeed = speed;
    this.dashDamage = damage;
    this.dashHits.clear();
    this.invuln = Math.max(this.invuln, time + 0.08);
    audio.play('dash');
    this.scene.combat.dust(this.x, this.bottom, 4);
  }

  private onLand() {
    this.squash = 1.16;
    audio.play('land');
    this.scene.combat.dust(this.x, this.bottom, 5);
  }

  hurt(dmg: number, fromX: number) {
    if (this.invuln > 0 || this.locked) return false;
    let d = dmg;
    if (this.shieldT > 0) d *= 1 - this.shieldAmt;
    d = Math.max(1, Math.round(d - this.defense * 0.5));
    this.hp -= d;
    this.invuln = 1.0;
    this.blinkT = 1.0;
    this.hurtT = 0.3;
    this.flashT = 0.12;
    const dir = Math.sign(this.x - fromX) || -this.facing;
    if (!(this.shieldT > 0 && this.def.id === 'haetae')) {
      this.body.setVelocity(dir * 260, -330);
      this.flying = false;
    }
    this.dashT = 0;
    this.diving = null;
    audio.play('hurt');
    this.ult = Math.min(100, this.ult + ULT_GAIN.hurt);
    this.scene.cameras.main.shake(120, 0.006);
    this.scene.combat.floatText(this.x, this.body.top - 10, `-${d}`, '#ff6b5e');
    return true;
  }

  private updateVisual(dt: number) {
    const b = this.body;
    const info = this.info;
    const vx = b.velocity.x, vy = b.velocity.y;
    // 애니메이션 선택
    const key = this.mt.key;
    let manim: 'idle' | 'run' | 'fly' | 'atk' = 'idle';
    let ranim = 'idle';
    if (this.atkAnimT > 0) { manim = 'atk'; ranim = 'attack'; }
    else if (this.flying && this.flyCloud) { manim = Math.abs(vx) > 60 ? 'run' : 'idle'; ranim = 'fly'; } // 근두운 위: 서서/달리듯
    else if (this.flying || !this.grounded) { manim = 'fly'; ranim = 'fly'; }
    else if (Math.abs(vx) > 40 || this.dashT > 0) { manim = 'run'; ranim = 'run'; }
    if (this.attackT > 0) ranim = 'attack';
    if (this.castT > 0 || this.ultT > 0) ranim = 'cast';
    if (this.hurtT > 0) ranim = 'hit';
    const akey = `${key}:${manim}`;
    if (this.mountSpr.anims.currentAnim?.key !== akey || (manim === 'atk' && !this.mountSpr.anims.isPlaying && this.atkAnimT > 0.2)) this.mountSpr.anims.play(akey, manim !== 'atk');
    let sp = 1;
    if (manim === 'run') sp = this.flying ? 0.45 : Phaser.Math.Clamp(Math.abs(vx) / this.mv.runSpeed, 0.5, 1.6);
    else if (manim === 'fly') sp = this.gliding && !this.flying ? 0.5 : this.flying ? (vy < -80 ? 1.5 : 1) : info.motion === 'bird' || info.motion === 'serpent' ? 1.1 : 0.6;
    this.mountSpr.anims.timeScale = this.dashT > 0 ? 2 : sp;
    this.riderSpr.anims.play(`${this.riderKey}:${ranim}`, true);
    // 위치·방향
    const flip = this.facing < 0;
    this.mountSpr.setFlipX(flip);
    this.riderSpr.setFlipX(flip);
    // 좌우 반전은 그림 가운데 기준이라, 안장(원점)이 가운데가 아닌 라이더는 원점도 거울처럼 옮긴다
    // (안 그러면 왼쪽을 볼 때 라이더가 앞으로 밀려 영물 얼굴을 가린다)
    const rm = riderMeta(this.riderKey);
    const wantOx = flip ? 1 - rm.ox : rm.ox;
    if (Math.abs(this.riderSpr.originX - wantOx) > 1e-4) this.riderSpr.setOrigin(wantOx, rm.oy);
    const sc = info.scale;
    const so = this.mt.seat[this.mountSpr.frame.name] ?? [0, 0];
    let seatX = (info.seat[0] - 0.5 + so[0]) * info.w * sc * this.facing;
    let seatY = -(1 - info.seat[1] - so[1]) * info.h * sc;
    if (this.mt.seatPx) { seatX = this.mt.seatPx[0] * this.mt.scale * this.facing; seatY = this.mt.seatPx[1] * this.mt.scale; }
    this.riderSpr.setPosition(seatX, seatY);
    // 장식: 안장 앞쪽(목) 아래로 매달려 흔들림
    const now = this.scene.time.now;
    const swingAmp = Math.abs(vx) > 40 ? 0.45 : 0.18;
    this.decorSprs.forEach((d, k) => {
      d.setPosition(seatX + (0.17 + k * 0.05) * info.w * sc * this.facing, seatY + (0.12 + k * 0.02) * info.h * sc);
      d.setRotation(Math.sin(now / 150 + k * 1.3) * swingAmp - (Math.abs(vx) > 40 ? 0.3 * this.facing : 0));
    });
    // 근두운
    if (this.flyCloud) {
      const on = this.flying;
      this.flyCloud.setVisible(on);
      if (on) this.flyCloud.setPosition(0, 4 + Math.sin(now / 260) * 4).setFlipX(this.facing < 0);
    }
    // 기울기
    let tilt = 0;
    if (!this.grounded && this.dashT <= 0) tilt = Phaser.Math.Clamp(vy / (this.flying ? 1800 : 2600), -0.22, 0.22) * this.facing;
    if (this.diving) tilt = 0.5 * this.facing;
    this.vis.rotation = Phaser.Math.Linear(this.vis.rotation, tilt, Math.min(1, dt * 10));
    // 늘이고 누르기
    this.squash = Phaser.Math.Linear(this.squash, 1, Math.min(1, dt * 9));
    const stretch = this.dashT > 0 ? 1.12 : 1;
    this.vis.setScale(stretch * (2 - this.squash) * (this.facing < 0 ? 1 : 1), this.squash);
    // 공격 돌출
    this.vis.setPosition(b.center.x, b.bottom + 3);
    // 피격 깜빡임
    this.vis.setAlpha(this.blinkT > 0 && this.dashT <= 0 ? (Math.floor(this.blinkT * 18) % 2 ? 0.35 : 1) : 1);
    if (this.flashT > 0) { this.mountSpr.setTint(0xff7a6a); this.riderSpr.setTint(0xff7a6a); }
    else { this.mountSpr.clearTint(); this.riderSpr.clearTint(); }
    // 보호막
    this.shieldSpr.setVisible(this.shieldT > 0);
    if (this.shieldT > 0) {
      this.shieldSpr.setPosition(b.center.x, b.center.y - 20);
      this.shieldSpr.setScale((Math.max(b.width, b.height) + 80) / 200);
      this.shieldSpr.setAlpha(0.6 + Math.sin(this.scene.time.now / 90) * 0.2);
    }
    // 꾸미기 이동 효과
    const tr = store.state.data.cosmetics.trail;
    if (this.trail && (Math.abs(vx) > 60 || this.flying)) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        if (tr === 'trail_footprint') {
          // 땅에 닿아 달릴 때만, 앞발·뒷발 번갈아 찍힘
          if (this.grounded) {
            this.trailT = 0.15;
            this.pawFlip = !this.pawFlip;
            this.trail.emitParticleAt(b.center.x - this.facing * (this.pawFlip ? 18 : 40), b.bottom - (this.pawFlip ? 6 : 2));
          }
        } else if (tr === 'trail_cloud') {
          this.trailT = 0.07;
          this.trail.emitParticleAt(b.center.x - this.facing * (b.width / 2 + 6), b.bottom - b.height * 0.35);
        } else {
          this.trailT = 0.06;
          this.trail.emitParticleAt(b.center.x - this.facing * 20 + Phaser.Math.Between(-20, 20), b.top + Phaser.Math.Between(-10, 20), 3);
        }
      }
    }
    // 금방울: 달릴 때 반짝임
    if (this.decorSprs.length && Math.abs(vx) > 60 && store.state.data.cosmetics.decor.includes('decor_bell') && Math.random() < dt * 6) {
      const bell = this.decorSprs[store.state.data.cosmetics.decor.indexOf('decor_bell')];
      if (bell) this.scene.combat.sparks(this.vis.x + bell.x, this.vis.y + bell.y + 10, 1);
    }
  }

  get attackSkill(): SkillDef {
    return SKILLS[this.st.attack];
  }
  get specialSkill(): SkillDef {
    return SKILLS[this.st.special];
  }

  destroy() {
    this.vis.destroy();
    this.zone.destroy();
    this.shieldSpr.destroy();
    this.trail?.destroy();
  }
}
