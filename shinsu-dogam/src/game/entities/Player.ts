// 영물 + 라이더 조작 (이동 물리는 영물·성장 단계별 MovementProfile 데이터로 결정)
import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene.ts';
import { MOUNTS, SKILLS } from '../../data/mounts.ts';
import type { MountDef, MovementProfile, StageDef, SkillDef } from '../../data/types.ts';
import { MOUNT_ART, artKey, type MountArtInfo } from '../../data/mountArt.ts';
import { COSMETICS } from '../../data/cosmetics.ts';
import { ensureMount, ensureRider, type MountTex } from '../textures.ts';
import { controls } from '../controls.ts';
import { store } from '../ctx.ts';
import { GRAVITY, MAX_FALL } from '../config.ts';
import { audio } from '../../systems/audio.ts';
import { overlaps } from '../world/Level.ts';

const approach = (v: number, t: number, d: number) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export class Player {
  zone: Phaser.GameObjects.Zone;
  body: Phaser.Physics.Arcade.Body;
  vis: Phaser.GameObjects.Container;
  mountSpr!: Phaser.GameObjects.Sprite;
  riderSpr!: Phaser.GameObjects.Sprite;
  decorSpr?: Phaser.GameObjects.Image;
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
  squash = 1;
  lastX = 0;
  private afterT = 0;
  private trailT = 0;
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
      .setOrigin(0.5, (this.mt.padTop + info.h) / this.mt.fh)
      .setScale(info.scale);
    this.riderKey = ensureRider(this.scene, store.state.data.cosmetics.outfit);
    this.riderSpr = this.scene.add.sprite(0, 0, this.riderKey, 'idle_0').setOrigin(54 / 120, 104 / 130);
    const visH = info.h * info.scale;
    this.riderSpr.setScale(Phaser.Math.Clamp(visH / 150, 0.56, 0.86));
    this.vis.add([this.mountSpr, this.riderSpr]);
    const decor = store.state.data.cosmetics.decor[0];
    this.decorSpr = undefined;
    if (decor) {
      const icon = decor === 'decor_knot' ? 'icon_knot' : decor === 'decor_jade' ? 'icon_jade' : 'icon_bell';
      this.decorSpr = this.scene.add.image(0, 0, icon).setScale(0.42);
      this.vis.add(this.decorSpr);
    }
    // 이동 효과 (꾸미기)
    this.trail?.destroy();
    this.trail = undefined;
    const trail = store.state.data.cosmetics.trail;
    if (trail && COSMETICS[trail]) {
      const key = trail === 'trail_petal' ? 'petal' : trail === 'trail_cloud' ? 'fx_dust' : 'wisp';
      this.trail = this.scene.add.particles(0, 0, key, {
        lifespan: trail === 'trail_cloud' ? 900 : 1200, speedX: { min: -40, max: 40 }, speedY: { min: -30, max: 10 },
        scale: { start: trail === 'trail_cloud' ? 1.2 : 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 },
        emitting: false, tint: trail === 'trail_footprint' ? 0x9be3ff : 0xffffff,
      }).setDepth(9);
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
    this.invuln -= dt; this.hurtT -= dt; this.shieldT -= dt; this.flashT -= dt;
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
        this.scene.combat.ring(this.x, this.bottom, mv.glide ? 'fx_ring_white' : 'fx_ring_gold', 0.35);
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

    // 공격
    if (c.pressed.attack && this.attackCD <= 0) this.scene.combat.basic(this);
    if (c.pressed.special && this.specialCD <= 0) this.scene.combat.special(this);
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
    this.hurtT = 0.3;
    this.flashT = 0.12;
    const dir = Math.sign(this.x - fromX) || -this.facing;
    if (!(this.shieldT > 0 && this.def.id === 'haetae')) {
      this.body.setVelocity(dir * 380, -360);
      this.flying = false;
    }
    this.dashT = 0;
    this.diving = null;
    audio.play('hurt');
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
    let manim: 'idle' | 'run' | 'fly' | null = 'idle';
    let rframe: string | null = null;
    const bird = info.motion === 'bird';
    const serp = info.motion === 'serpent';
    let ranim = 'idle';
    if (this.flying || (this.gliding && (bird || serp))) { manim = 'fly'; ranim = 'fly'; }
    else if (!this.grounded) {
      if (bird || serp) { manim = 'fly'; }
      else { manim = null; rframe = vy < 0 ? 'run_1' : 'run_4'; }
      ranim = 'fly';
    } else if (Math.abs(vx) > 40 || this.dashT > 0) { manim = 'run'; ranim = 'run'; }
    if (this.attackT > 0) ranim = 'attack';
    if (this.castT > 0) ranim = 'cast';
    if (this.hurtT > 0) ranim = 'hit';
    if (manim) {
      this.mountSpr.anims.play(`${key}:${manim}`, true);
      const sp = manim === 'run' ? Phaser.Math.Clamp(Math.abs(vx) / this.mv.runSpeed, 0.5, 1.6) : this.gliding && !this.flying ? 0.45 : 1;
      this.mountSpr.anims.timeScale = this.dashT > 0 ? 2 : sp;
    } else {
      this.mountSpr.anims.stop();
      this.mountSpr.setFrame(rframe!);
    }
    this.riderSpr.anims.play(`${this.riderKey}:${ranim}`, true);
    // 위치·방향
    const flip = this.facing < 0;
    this.mountSpr.setFlipX(flip);
    this.riderSpr.setFlipX(flip);
    const sc = info.scale;
    const seatX = (info.seat[0] - 0.5) * info.w * sc * this.facing;
    const seatY = -(1 - info.seat[1]) * info.h * sc;
    this.riderSpr.setPosition(seatX, seatY + (manim === 'run' ? Math.sin(this.scene.time.now / 60) * 1.5 : 0));
    if (this.decorSpr) {
      this.decorSpr.setPosition(seatX + 0.2 * info.w * sc * this.facing, seatY + 0.18 * info.h * sc);
      this.decorSpr.setRotation(Math.sin(this.scene.time.now / 160) * 0.25);
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
    const lunge = this.attackT > 0 ? Math.sin((1 - this.attackT / 0.25) * Math.PI) * 10 * this.facing : 0;
    this.vis.setPosition(b.center.x + lunge, b.bottom + 3);
    // 피격 깜빡임
    this.vis.setAlpha(this.invuln > 0 && this.dashT <= 0 ? (Math.floor(this.invuln * 18) % 2 ? 0.35 : 1) : 1);
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
    if (this.trail && Math.abs(vx) > 80) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = store.state.data.cosmetics.trail === 'trail_footprint' ? 0.12 : 0.05;
        this.trail.emitParticleAt(b.center.x - this.facing * 30, b.bottom - (store.state.data.cosmetics.trail === 'trail_footprint' ? 2 : 20));
      }
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
