// 보스: 흑운 산군 — 돌진(벽에 부딪히면 기절), 도약 내려찍기(지면 충격파), 어둠의 비, 2페이즈 비행 요괴 소환
import Phaser from 'phaser';
import { Monster } from './Monster.ts';
import type { WorldScene } from '../scenes/WorldScene.ts';
import { MONSTERS } from '../../data/monsters.ts';
import { audio } from '../../systems/audio.ts';

type BState = 'intro' | 'idle' | 'walk' | 'windup' | 'charge' | 'stun' | 'leap' | 'roar' | 'dying';

export class Boss extends Monster {
  bstate: BState = 'intro';
  phase = 1;
  arena: [number, number];
  private pattern = 0;
  private leapTarget = 0;

  constructor(scene: WorldScene, x: number, y: number, arena: [number, number]) {
    super(scene, MONSTERS.boss, x, y, 4);
    this.boss = true;
    this.arena = arena;
    this.hpBar.setVisible(false);
    this.facing = -1;
    this.bstate = 'intro';
    this.stateT = 2.2;
    this.play('cast');
  }

  hurt(dmg: number, kx: number, ky = 0) {
    if (this.bstate === 'intro' || this.bstate === 'dying') return;
    const mult = this.bstate === 'stun' ? 1.5 : 1;
    super.hurt(Math.round(dmg * mult), kx, ky);
    if (this.phase === 1 && this.hp < this.maxHp * 0.5 && !this.dead) {
      this.phase = 2;
      this.bstate = 'roar';
      this.stateT = 1.4;
      this.play('cast');
      this.scene.hudMsg('흑운 산군이 분노했다!', '#ff8a7a');
      audio.play('boss');
      this.scene.cameras.main.shake(400, 0.01);
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.bstate = 'dying';
    this.body.enable = false;
    this.play('fall');
    this.scene.onBossDefeated(this);
  }

  update(dt: number) {
    if (this.dead) {
      this.spr.setPosition(this.body.center.x, this.body.bottom + 2);
      return;
    }
    const p = this.scene.player;
    const b = this.body;
    this.stateT -= dt;
    this.flashT -= dt;
    const dx = p.x - this.x;
    const speedMul = this.phase === 2 ? 1.3 : 1;
    switch (this.bstate) {
      case 'intro':
        b.setVelocityX(0);
        if (this.stateT <= 0) this.next();
        break;
      case 'idle':
        b.setVelocityX(0);
        this.play('idle');
        this.facing = Math.sign(dx) || this.facing;
        if (this.stateT <= 0) this.next();
        break;
      case 'walk':
        this.facing = Math.sign(dx) || this.facing;
        b.setVelocityX(this.facing * 120 * speedMul);
        this.play('run');
        if (this.stateT <= 0 || Math.abs(dx) < 140) this.next();
        break;
      case 'windup':
        b.setVelocityX(0);
        this.spr.x += Math.sin(this.scene.time.now / 18) * 3;
        if (this.stateT <= 0) {
          this.bstate = 'charge';
          this.stateT = 2.4;
          this.play('run');
          this.spr.anims.timeScale = 1.8;
        }
        break;
      case 'charge':
        b.setVelocityX(this.facing * 560 * speedMul);
        if (this.x < this.arena[0] + 110 || this.x > this.arena[1] - 110 || this.stateT <= 0) {
          b.setVelocityX(0);
          this.spr.anims.timeScale = 1;
          this.scene.cameras.main.shake(300, 0.012);
          audio.play('thunder');
          this.scene.combat.groundShock(this.x + this.facing * 80, b.bottom, 110, this.atk);
          this.bstate = 'stun';
          this.stateT = this.phase === 2 ? 1.1 : 1.6;
          this.play('fall');
          this.scene.hudMsg('기절! 지금 공격하자!', '#fff3a0');
        }
        break;
      case 'stun':
        b.setVelocityX(0);
        if (this.stateT <= 0) { this.bstate = 'idle'; this.stateT = 0.5; }
        break;
      case 'leap':
        if (b.blocked.down && this.stateT < 0.9) {
          b.setVelocityX(0);
          this.scene.cameras.main.shake(260, 0.012);
          audio.play('thunder');
          // 양쪽으로 퍼지는 지면 충격파 (점프로 피하기)
          this.scene.combat.shockWave(this.x, b.bottom, -1, this.atk);
          this.scene.combat.shockWave(this.x, b.bottom, 1, this.atk);
          this.bstate = 'idle';
          this.stateT = 0.9;
          this.play('idle');
        } else {
          b.setVelocityX((this.leapTarget - this.x) * 1.6);
        }
        break;
      case 'roar':
        b.setVelocityX(0);
        if (this.stateT <= 0) {
          this.darkRain();
          this.bstate = 'idle';
          this.stateT = 1.0;
        }
        break;
      default:
        break;
    }
    this.spr.setPosition(b.center.x, b.bottom + 2);
    this.spr.setFlipX(this.facing < 0);
    if (this.flashT > 0) this.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.spr.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    // 접촉 피해
    const pr = p.rect(), mr = this.rect();
    if (this.bstate !== 'stun' && pr.x < mr.x + mr.w && pr.x + pr.w > mr.x && pr.y < mr.y + mr.h && pr.y + pr.h > mr.y) {
      if (!(p.dashT > 0 && p.dashDamage > 0)) p.hurt(this.atk * (this.bstate === 'charge' ? 1.4 : 1), this.x);
    }
  }

  private next() {
    const seq = this.phase === 1 ? ['walk', 'charge', 'leap', 'walk', 'roar', 'charge'] : ['charge', 'leap', 'roar', 'charge', 'leap', 'summon'];
    const s = seq[this.pattern++ % seq.length];
    const p = this.scene.player;
    this.facing = Math.sign(p.x - this.x) || this.facing;
    if (s === 'walk') { this.bstate = 'walk'; this.stateT = 1.6; }
    else if (s === 'charge') { this.bstate = 'windup'; this.stateT = this.phase === 2 ? 0.5 : 0.75; this.play('attack'); this.scene.combat.alert(this); }
    else if (s === 'leap') {
      this.bstate = 'leap';
      this.stateT = 1.4;
      this.leapTarget = Phaser.Math.Clamp(p.x, this.arena[0] + 120, this.arena[1] - 120);
      this.body.setVelocityY(-900);
      this.play('attack');
    } else if (s === 'roar') { this.bstate = 'roar'; this.stateT = 0.9; this.play('cast'); audio.play('boss'); }
    else if (s === 'summon') {
      this.bstate = 'roar';
      this.stateT = 0.9;
      this.play('cast');
      this.scene.spawnMonster('bat', this.x - 200, this.y - 260);
      this.scene.spawnMonster('bat', this.x + 200, this.y - 280);
    }
  }

  private darkRain() {
    const p = this.scene.player;
    const n = this.phase === 2 ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(p.x + (i - n / 2) * 120 + Phaser.Math.Between(-40, 40), this.arena[0] + 40, this.arena[1] - 40);
      this.scene.combat.fallingOrb(x, i * 140 + 300, this.atk);
    }
  }
}
