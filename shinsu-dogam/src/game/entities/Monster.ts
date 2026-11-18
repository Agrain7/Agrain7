// 몬스터 공통 + 종류별 간단 AI
import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene.ts';
import type { MonsterDef } from '../../data/types.ts';
import { scaleMonster } from '../../data/monsters.ts';
import { ensureMonster, monsterArtHeight, monsterBox, monsterScale } from '../textures.ts';
import { GRAVITY, MAX_FALL } from '../config.ts';

export class Monster {
  zone: Phaser.GameObjects.Zone;
  body: Phaser.Physics.Arcade.Body;
  spr: Phaser.GameObjects.Sprite;
  hpBar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  atk: number;
  exp: number;
  facing = -1;
  dead = false;
  state = 'idle';
  stateT = 0;
  cd = 1;
  hurtT = 0;
  flashT = 0;
  homeX: number;
  homeY: number;
  key: string;
  boss = false;
  artH = 0;
  /** 떠다니는 요괴 아래 요기 고리 */
  aura?: Phaser.GameObjects.Image;

  constructor(public scene: WorldScene, public def: MonsterDef, x: number, y: number, tier: number) {
    const s = scaleMonster(def, tier);
    this.hp = this.maxHp = s.hp;
    this.atk = s.atk;
    this.exp = s.exp;
    this.homeX = x;
    this.homeY = y;
    this.key = ensureMonster(scene, def.id);
    this.zone = scene.add.zone(x, y - def.body.h / 2, def.body.w, def.body.h);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(!def.flying);
    this.body.setGravityY(def.flying ? 0 : GRAVITY);
    this.body.setMaxVelocity(1600, MAX_FALL);
    const box = monsterBox(def.id);
    this.spr = scene.add.sprite(x, y, this.key, def.flying ? 'fly_0' : 'idle_0').setOrigin(box.ox / box.w, box.oy / box.h).setScale(monsterScale(def.id)).setDepth(8);
    this.artH = monsterArtHeight(def.id);
    if (def.ai === 'caster') {
      this.aura = scene.add.image(x, y, 'fx_ring_dark').setDepth(7.9).setScale(0.55, 0.18).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: this.aura, alpha: { from: 0.45, to: 0.85 }, yoyo: true, repeat: -1, duration: 700 });
    }
    this.hpBar = scene.add.graphics().setDepth(9);
    this.play(def.flying ? 'fly' : 'idle');
    this.cd = 0.5 + Math.random();
  }

  get x() { return this.body.center.x; }
  get y() { return this.body.center.y; }
  rect() { return { x: this.body.x, y: this.body.y, w: this.body.width, h: this.body.height }; }

  play(anim: string) {
    const k = `${this.key}:${anim}`;
    if (this.scene.anims.exists(k)) this.spr.anims.play(k, true);
  }

  hurt(dmg: number, kx: number, ky = -160) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashT = 0.1;
    this.hurtT = 0.25;
    if (!this.def.knockbackImmune) {
      this.body.setVelocity(kx, this.def.flying ? ky * 0.3 : ky);
      if (this.state === 'charge' || this.state === 'swoop') { this.state = 'recover'; this.stateT = 0.6; }
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.hpBar.destroy();
    this.aura?.destroy();
    this.body.enable = false;
    this.scene.onMonsterDefeated(this);
    this.scene.tweens.add({
      targets: this.spr, alpha: 0, scaleY: 0.2, scaleX: 1.3, y: this.spr.y - 10, duration: 380,
      onComplete: () => { this.spr.destroy(); this.zone.destroy(); },
    });
  }

  update(dt: number) {
    if (this.dead) return;
    const p = this.scene.player;
    const b = this.body;
    this.stateT -= dt;
    this.cd -= dt;
    this.hurtT -= dt;
    this.flashT -= dt;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.abs(dx);
    const grounded = b.blocked.down;
    if (this.hurtT > 0 && !this.def.knockbackImmune) {
      if (grounded) b.setVelocityX(b.velocity.x * 0.9);
    } else {
      switch (this.def.ai) {
        case 'charger': this.aiCharger(dt, dx, dy, dist, grounded); break;
        case 'hopper': this.aiHopper(dt, dx, dist, grounded); break;
        case 'caster': this.aiCaster(dt, dx, dist); break;
        case 'flyer': this.aiFlyer(dt, dx, dy, dist); break;
        case 'golem': this.aiGolem(dt, dx, dist, grounded); break;
        default: break;
      }
    }
    // 낙사 방지 (지형 끝에서 돌아서기)
    if (!this.def.flying && grounded && this.state !== 'charge') {
      const ahead = this.x + Math.sign(b.velocity.x || this.facing) * (b.width / 2 + 8);
      if (!this.scene.groundAt(ahead, b.bottom + 6)) {
        b.setVelocityX(0);
        this.facing *= -1;
      }
    }
    // 접촉 피해
    const pr = p.rect(), mr = this.rect();
    if (pr.x < mr.x + mr.w && pr.x + pr.w > mr.x && pr.y < mr.y + mr.h && pr.y + pr.h > mr.y) {
      if (p.dashT > 0 && p.dashDamage > 0) { /* 공격 돌진 중 */ }
      else p.hurt(this.atk, this.x);
    }
    // 그리기
    this.spr.setPosition(b.center.x, b.bottom + (this.def.ai === 'caster' ? 0 : 2));
    if (this.def.flying || this.def.ai === 'caster') this.spr.y = b.bottom + 4;
    this.aura?.setPosition(b.center.x, b.bottom + 10);
    this.spr.setFlipX(this.facing < 0);
    if (this.flashT > 0) this.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if (b.y > this.scene.level.map.height + 200) this.die();
    this.drawHp();
  }

  drawHp() {
    const g = this.hpBar;
    g.clear();
    const w = Math.max(50, this.body.width * 0.9);
    const top = Math.min(this.body.top, this.spr.y - this.artH);
    const x = this.x - w / 2, y = top - 14;
    g.fillStyle(0x1d1a2b, 0.8);
    g.fillRoundedRect(x - 2, y - 2, w + 4, 10, 4);
    g.fillStyle(this.def.elite ? 0xe2b14c : 0xd63c34, 1);
    g.fillRoundedRect(x, y, Math.max(0, w * (this.hp / this.maxHp)), 6, 3);
  }

  // ---------------- AI ----------------
  private aiCharger(_dt: number, dx: number, dy: number, dist: number, grounded: boolean) {
    const b = this.body;
    if (this.state === 'windup') {
      b.setVelocityX(0);
      this.spr.x += Math.sin(this.scene.time.now / 20) * 2;
      if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 1.1; this.play('attack'); }
      return;
    }
    if (this.state === 'charge') {
      b.setVelocityX(this.facing * 360);
      if (this.stateT <= 0 || b.blocked.left || b.blocked.right || !this.scene.groundAt(this.x + this.facing * (b.width / 2 + 10), b.bottom + 6)) {
        this.state = 'recover'; this.stateT = 1.0; b.setVelocityX(0); this.play('idle');
      }
      return;
    }
    if (this.state === 'recover') { b.setVelocityX(0); if (this.stateT <= 0) this.state = 'idle'; return; }
    if (dist < 380 && Math.abs(dy) < 90 && grounded && this.cd <= 0) {
      this.facing = Math.sign(dx) || this.facing;
      this.state = 'windup'; this.stateT = 0.45; this.cd = 2.2;
      this.scene.combat.alert(this);
      return;
    }
    // 순찰
    if (Math.abs(this.x - this.homeX) > 150) this.facing = Math.sign(this.homeX - this.x);
    b.setVelocityX(this.facing * this.def.speed);
    this.play('run');
    this.spr.anims.timeScale = 0.6;
  }

  private aiHopper(_dt: number, dx: number, dist: number, grounded: boolean) {
    const b = this.body;
    if (grounded) {
      b.setVelocityX(b.velocity.x * 0.8);
      this.play('idle');
      if (this.cd <= 0 && dist < 520) {
        this.facing = Math.sign(dx) || this.facing;
        b.setVelocity(this.facing * (140 + Math.random() * 60), -560);
        this.cd = 1.1 + Math.random() * 0.7;
        this.play('jump');
      } else if (this.cd <= 0) {
        this.facing = Math.abs(this.x - this.homeX) > 120 ? Math.sign(this.homeX - this.x) : -this.facing;
        b.setVelocity(this.facing * 90, -380);
        this.cd = 1.6;
        this.play('jump');
      }
    }
  }

  private aiCaster(_dt: number, dx: number, dist: number) {
    const b = this.body;
    b.setAllowGravity(false);
    const hoverY = this.homeY - 70 + Math.sin(this.scene.time.now / 400) * 12;
    b.setVelocityY((hoverY - this.body.bottom) * 3);
    this.facing = Math.sign(dx) || this.facing;
    // 거리 유지
    const want = dist < 240 ? -1 : dist > 420 && dist < 700 ? 1 : 0;
    const tx = Phaser.Math.Clamp(this.x + want * Math.sign(dx) * 120, this.homeX - 220, this.homeX + 220);
    b.setVelocityX((tx - this.x) * 1.4);
    if (this.cd <= 0 && dist < 640) {
      this.cd = 2.4;
      this.play('attack');
      this.scene.time.delayedCall(260, () => {
        if (this.dead) return;
        this.scene.combat.enemyShot(this.x + this.facing * 30, this.y - 20, this.scene.player.x, this.scene.player.y - 10, 300, 'fx_dark', this.atk);
        this.play('idle');
      });
    }
  }

  private aiFlyer(_dt: number, dx: number, dy: number, dist: number) {
    const b = this.body;
    const t = this.scene.time.now / 1000;
    if (this.state === 'swoop') {
      if (this.stateT <= 0) { this.state = 'return'; }
      return;
    }
    if (this.state === 'return') {
      const tx = this.homeX, ty = this.homeY - 20;
      b.setVelocity((tx - this.x) * 1.6, (ty - this.y) * 1.6);
      if (Math.abs(tx - this.x) < 30 && Math.abs(ty - this.y) < 30) this.state = 'idle';
      return;
    }
    b.setVelocity(Math.cos(t * 1.4 + this.homeX) * 90, Math.sin(t * 2.2 + this.homeX) * 70 + (this.homeY - this.y) * 0.8);
    this.facing = Math.sign(dx) || this.facing;
    if (this.cd <= 0 && dist < 340 && Math.abs(dy) < 360) {
      const ang = Math.atan2(dy, dx);
      b.setVelocity(Math.cos(ang) * 380, Math.sin(ang) * 380);
      this.state = 'swoop';
      this.stateT = 0.8;
      this.cd = 2.6;
    }
    this.play('fly');
  }

  private aiGolem(_dt: number, dx: number, dist: number, grounded: boolean) {
    const b = this.body;
    if (this.state === 'slam') {
      b.setVelocityX(0);
      if (this.stateT <= 0) {
        this.state = 'idle';
        this.scene.combat.groundShock(this.x + this.facing * 40, b.bottom, 150, this.atk * 1.2);
        this.play('idle');
      }
      return;
    }
    if (!grounded) return;
    this.facing = Math.sign(dx) || this.facing;
    if (dist < 130 && this.cd <= 0) {
      this.state = 'slam'; this.stateT = 0.7; this.cd = 2.6;
      this.play('attack');
      this.scene.combat.alert(this);
      return;
    }
    if (dist > 220 && dist < 560 && this.cd <= 0) {
      this.cd = 3.2;
      this.scene.combat.enemyLob(this.x, this.y - 40, this.scene.player.x, this.atk);
      return;
    }
    if (dist < 600) {
      b.setVelocityX(this.facing * this.def.speed);
      this.play('run');
    } else {
      b.setVelocityX(0);
      this.play('idle');
    }
  }

  destroy() {
    this.aura?.destroy();
    this.spr.destroy();
    this.zone.destroy();
    this.hpBar.destroy();
  }
}
