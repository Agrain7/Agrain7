// 전투: 기본 공격, 특수 기술(데이터 기반), 투사체, 적 공격, 효과 연출
import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene.ts';
import type { Player } from '../entities/Player.ts';
import type { Monster } from '../entities/Monster.ts';
import { SKILLS } from '../../data/mounts.ts';
import type { SkillDef, FxKind } from '../../data/types.ts';
import { audio } from '../../systems/audio.ts';
import { txt } from '../../ui/widgets.ts';
import { overlaps, type Rect } from '../world/Level.ts';

interface Proj {
  spr: Phaser.GameObjects.Image;
  vx: number; vy: number; g: number; life: number; dmg: number; hostile: boolean; pierce: boolean; r: number;
  hit: Set<Monster>; kind?: 'wave' | 'orb';
}

const FX_TEX: Partial<Record<FxKind, string>> = { feather: 'fx_feather', fire: 'fx_fire', water: 'fx_water', light: 'fx_light' };
const RING_TEX: Partial<Record<FxKind, string>> = { howl: 'fx_ring_white', shock: 'fx_ring_gold', fire: 'fx_ring_fire', water: 'fx_ring_blue', light: 'fx_ring_gold', spirit: 'fx_ring_blue', heal: 'fx_ring_gold' };

export class Combat {
  projs: Proj[] = [];
  private dustEm: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkEm: Phaser.GameObjects.Particles.ParticleEmitter;
  private beam: { t: number; tick: number; sk: SkillDef; spr: Phaser.GameObjects.Image } | null = null;

  constructor(private scene: WorldScene) {
    this.dustEm = scene.add.particles(0, 0, 'fx_dust', {
      emitting: false, lifespan: 420, speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, scale: { start: 0.7, end: 0.1 }, alpha: { start: 0.75, end: 0 },
    }).setDepth(12);
    this.sparkEm = scene.add.particles(0, 0, 'wisp_gold', {
      emitting: false, lifespan: 500, speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 }, blendMode: 'ADD',
    }).setDepth(13);
  }

  // ---------------- 연출 ----------------
  dust(x: number, y: number, n: number) {
    this.dustEm.explode(n, x, y);
  }
  sparks(x: number, y: number, n: number) {
    this.sparkEm.explode(n, x, y);
  }
  ring(x: number, y: number, key: string, toScale: number, dur = 380) {
    const r = this.scene.add.image(x, y, key).setScale(0.1).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: r, scale: toScale, alpha: 0, duration: dur, onComplete: () => r.destroy() });
  }
  floatText(x: number, y: number, s: string, color = '#fff3a0', size = 22) {
    const t = txt(this.scene, x, y, s, size, color, { stroke: '#1d1a2b', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }
  alert(m: Monster) {
    const t = txt(this.scene, m.x, m.body.top - 40, '!', 34, '#ff5a3a', { stroke: '#1d1a2b', strokeThickness: 6, fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 250, duration: 300, onComplete: () => t.destroy() });
  }
  afterimage(p: Player) {
    const s = p.mountSpr;
    const m = s.getWorldTransformMatrix();
    const img = this.scene.add.image(m.tx, m.ty, s.texture.key, s.frame.name)
      .setOrigin(s.originX, s.originY).setScale(s.scaleX * p.vis.scaleX, s.scaleY * p.vis.scaleY).setFlipX(s.flipX)
      .setAlpha(0.45).setTint(0x9fd8ff).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }
  private hitFx(x: number, y: number) {
    const s = this.scene.add.image(x, y, 'fx_spark').setScale(0.4).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: s, scale: 1, alpha: 0, duration: 200, onComplete: () => s.destroy() });
  }

  // ---------------- 피해 ----------------
  damageMonster(p: Player, m: Monster, power: number, kdir: number, knock = 180) {
    if (m.dead) return;
    const raw = p.atk * power * Phaser.Math.FloatBetween(0.9, 1.1);
    const dmg = Math.max(1, Math.round(raw - m.def.def));
    m.hurt(dmg, kdir * knock);
    this.floatText(m.x + Phaser.Math.Between(-10, 10), m.body.top - 6, `${dmg}`, m.boss ? '#ffd76a' : '#fff3a0');
    this.hitFx(m.x - kdir * 10, m.y);
    audio.play('hit');
  }

  private aliveMonsters() {
    return this.scene.monsters.filter((m) => !m.dead);
  }

  // ---------------- 플레이어 공격 ----------------
  basic(p: Player) {
    const sk = p.attackSkill;
    p.attackCD = sk.cooldown;
    p.attackT = 0.25;
    audio.play('attack');
    this.scene.time.delayedCall(60, () => this.melee(p, sk, sk.fx === 'bite' || sk.fx === 'peck' || sk.fx === 'horn' ? 'fx_slash' : 'fx_claw'));
  }

  private meleeBox(p: Player, range: number): Rect {
    const b = p.body;
    return { x: p.facing > 0 ? b.right - 16 : b.left - range + 16, y: b.top - 30, w: range, h: b.height + 50 };
  }

  private melee(p: Player, sk: SkillDef, fxKey: string) {
    const r = this.meleeBox(p, sk.range ?? 70);
    const fx = this.scene.add.image(r.x + r.w / 2, r.y + r.h / 2, fxKey).setDepth(12).setFlipX(p.facing < 0).setBlendMode(Phaser.BlendModes.ADD);
    fx.setScale((sk.range ?? 70) / 110);
    if (sk.fx === 'slash') fx.setTint(0xbfe9ff);
    this.scene.tweens.add({ targets: fx, alpha: 0, scale: fx.scale * 1.2, duration: 180, onComplete: () => fx.destroy() });
    for (const m of this.aliveMonsters()) {
      if (overlaps(r, m.rect())) this.damageMonster(p, m, sk.power, p.facing, sk.knockback ?? 180);
    }
  }

  special(p: Player) {
    let sk = p.specialSkill;
    if (!p.grounded && sk.airAlt && SKILLS[sk.airAlt]) sk = SKILLS[sk.airAlt];
    if (sk.kind === 'dive' && p.grounded) {
      if (sk.id === 'skyDive') sk = SKILLS.galeFeathers;
      else {
        // 지상에서: 높이 도약 후 내려찍기
        p.specialCD = sk.cooldown;
        p.body.setVelocityY(-950);
        audio.play('jump');
        const dive = sk;
        this.scene.time.delayedCall(330, () => { if (!p.grounded) p.diving = dive; });
        return;
      }
    }
    p.specialCD = sk.cooldown;
    p.castT = 0.4;
    audio.play('skill');
    const cx = p.x, cy = p.y - 10;
    switch (sk.kind) {
      case 'melee':
        this.melee(p, sk, 'fx_slash');
        this.scene.time.delayedCall(120, () => this.melee(p, sk, 'fx_claw'));
        break;
      case 'projectile': {
        const n = sk.count ?? 1, spread = sk.spread ?? 0;
        for (let i = 0; i < n; i++) {
          const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
          const vx = Math.cos(a) * (sk.speed ?? 700) * p.facing, vy = Math.sin(a) * (sk.speed ?? 700);
          this.shoot(cx + p.facing * 40, cy - 10, vx, vy, FX_TEX[sk.fx] ?? 'fx_light', p.atk * sk.power, false, sk.fx === 'light');
        }
        break;
      }
      case 'lightning': {
        const targets = this.aliveMonsters()
          .filter((m) => (m.x - p.x) * p.facing > -60 && Math.abs(m.x - p.x) < (sk.range ?? 500) && Math.abs(m.y - p.y) < 420)
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))
          .slice(0, sk.count ?? 1);
        if (!targets.length) {
          // 대상이 없으면 앞쪽에 번개
          this.bolt(p.x + p.facing * 220, this.scene.groundY(p.x + p.facing * 220) ?? p.bottom);
        }
        targets.forEach((m, i) => this.scene.time.delayedCall(i * 90, () => {
          this.bolt(m.x, m.body.bottom);
          this.damageMonster(p, m, sk.power, Math.sign(m.x - p.x) || 1, 120);
        }));
        audio.play('thunder');
        break;
      }
      case 'aoe':
        this.ring(cx, cy, RING_TEX[sk.fx] ?? 'fx_ring_white', ((sk.radius ?? 180) * 2) / 230, 420);
        this.sparks(cx, cy, 16);
        for (const m of this.aliveMonsters()) {
          const d = Phaser.Math.Distance.Between(cx, cy, m.x, m.y);
          if (d < (sk.radius ?? 180) + m.body.width / 2) this.damageMonster(p, m, sk.power, Math.sign(m.x - cx) || 1, sk.knockback ?? 300);
        }
        if (sk.amount && sk.duration) { p.shieldT = sk.duration; p.shieldAmt = sk.amount; }
        if (sk.amount && !sk.duration) this.healFx(p, sk.amount);
        this.scene.cameras.main.shake(140, 0.004);
        break;
      case 'beam': {
        this.beam?.spr.destroy();
        const spr = this.scene.add.image(0, 0, 'fx_breath').setOrigin(0, 0.5).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.beam = { t: sk.duration ?? 1, tick: 0, sk, spr };
        break;
      }
      case 'dashStrike':
        p.startDash(p.facing, sk.duration ?? 0.3, (sk.range ?? 300) / (sk.duration ?? 0.3), sk.power);
        this.ring(cx, cy, RING_TEX[sk.fx] ?? 'fx_ring_blue', 0.6);
        break;
      case 'dive':
        p.diving = sk;
        break;
      case 'shield':
        p.shieldT = sk.duration ?? 3;
        p.shieldAmt = sk.amount ?? 0.5;
        this.ring(cx, cy, 'fx_ring_blue', 1);
        break;
      case 'heal':
        this.healFx(p, sk.amount ?? 0.2);
        if (sk.radius) {
          this.ring(cx, cy, 'fx_ring_gold', (sk.radius * 2) / 230);
          for (const m of this.aliveMonsters()) {
            if (Phaser.Math.Distance.Between(cx, cy, m.x, m.y) < sk.radius) this.damageMonster(p, m, sk.power, Math.sign(m.x - cx) || 1, 200);
          }
        }
        break;
    }
  }

  private healFx(p: Player, amount: number) {
    const before = p.hp;
    p.heal(p.maxHp * amount);
    this.floatText(p.x, p.body.top - 20, `+${p.hp - before}`, '#7dff9a');
    for (let i = 0; i < 6; i++) {
      const s = this.scene.add.image(p.x + Phaser.Math.Between(-30, 30), p.y + Phaser.Math.Between(-10, 20), 'fx_plus').setDepth(13);
      this.scene.tweens.add({ targets: s, y: s.y - 60, alpha: 0, duration: 700, delay: i * 60, onComplete: () => s.destroy() });
    }
  }

  bolt(x: number, groundY: number) {
    const b = this.scene.add.image(x, groundY, 'fx_bolt').setOrigin(0.5, 1).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
    b.setScale(1, Math.min(1.4, (groundY - this.scene.cameras.main.worldView.y + 40) / 520));
    this.ring(x, groundY, 'fx_ring_blue', 0.5);
    this.scene.tweens.add({ targets: b, alpha: 0, duration: 260, delay: 60, onComplete: () => b.destroy() });
    this.scene.cameras.main.flash(60, 180, 230, 255, false);
  }

  dashHits(p: Player) {
    const r = { x: p.body.x - 20, y: p.body.y - 20, w: p.body.width + 40, h: p.body.height + 40 };
    for (const m of this.aliveMonsters()) {
      if (p.dashHits.has(m)) continue;
      if (overlaps(r, m.rect())) {
        p.dashHits.add(m);
        this.damageMonster(p, m, p.dashDamage, p.dashDir, 260);
      }
    }
  }

  diveImpact(p: Player, sk: SkillDef) {
    const x = p.x, y = p.bottom;
    this.ring(x, y, 'fx_ring_gold', ((sk.radius ?? 150) * 2) / 230);
    this.dust(x, y, 14);
    this.scene.cameras.main.shake(180, 0.008);
    audio.play('thunder');
    for (const m of this.aliveMonsters()) {
      if (Math.abs(m.x - x) < (sk.radius ?? 150) && Math.abs(m.body.bottom - y) < 120) this.damageMonster(p, m, sk.power, Math.sign(m.x - x) || 1, 320);
    }
  }

  shoot(x: number, y: number, vx: number, vy: number, key: string, dmg: number, hostile: boolean, pierce = false, g = 0) {
    const spr = this.scene.add.image(x, y, key).setDepth(12);
    if (key === 'fx_feather' || key === 'fx_fire') spr.setRotation(Math.atan2(vy, vx));
    if (key === 'fx_fire' && vx < 0) spr.setRotation(Math.atan2(vy, vx));
    if (!hostile) spr.setBlendMode(Phaser.BlendModes.ADD);
    this.projs.push({ spr, vx, vy, g, life: 1.6, dmg, hostile, pierce, r: hostile ? 16 : 18, hit: new Set() });
  }

  // ---------------- 적 공격 ----------------
  enemyShot(x: number, y: number, tx: number, ty: number, speed: number, key: string, dmg: number) {
    const a = Math.atan2(ty - y, tx - x);
    this.shoot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, key, dmg, true);
  }
  enemyLob(x: number, y: number, tx: number, dmg: number) {
    const t = 1.0;
    this.shoot(x, y, (tx - x) / t, -620, 'fx_rock', dmg, true, false, 1240);
  }
  groundShock(x: number, y: number, radius: number, dmg: number) {
    this.ring(x, y, 'fx_ring_dark', (radius * 2) / 230);
    this.dust(x, y, 12);
    const p = this.scene.player;
    if (Math.abs(p.x - x) < radius && p.bottom > y - 70) p.hurt(dmg, x);
  }
  shockWave(x: number, y: number, dir: number, dmg: number) {
    const spr = this.scene.add.image(x, y - 26, 'fx_dark').setScale(1.4, 2).setDepth(12);
    this.projs.push({ spr, vx: dir * 430, vy: 0, g: 0, life: 2.2, dmg, hostile: true, pierce: true, r: 26, hit: new Set(), kind: 'wave' });
  }
  fallingOrb(x: number, delay: number, dmg: number) {
    const gy = this.scene.groundY(x) ?? this.scene.level.map.height - 220;
    const warn = this.scene.add.ellipse(x, gy, 70, 16, 0xff3030, 0.45).setDepth(6);
    this.scene.tweens.add({ targets: warn, alpha: 0.9, yoyo: true, repeat: 3, duration: 120 + delay / 8 });
    this.scene.time.delayedCall(delay + 450, () => {
      warn.destroy();
      const top = this.scene.cameras.main.worldView.y - 40;
      const spr = this.scene.add.image(x, top, 'fx_dark').setDepth(12).setScale(1.3);
      this.projs.push({ spr, vx: 0, vy: 950, g: 0, life: 2.5, dmg, hostile: true, pierce: false, r: 22, hit: new Set(), kind: 'orb' });
    });
  }

  // ---------------- 갱신 ----------------
  update(dt: number) {
    const p = this.scene.player;
    // 숨결
    if (this.beam) {
      const bm = this.beam;
      bm.t -= dt;
      bm.tick -= dt;
      const info = p.info;
      const mx = p.x + p.facing * info.w * info.scale * 0.42;
      const my = p.bottom - info.h * info.scale * 0.62;
      bm.spr.setPosition(mx, my).setFlipX(p.facing < 0).setOrigin(p.facing > 0 ? 0 : 1, 0.5);
      bm.spr.setAlpha(0.75 + Math.sin(this.scene.time.now / 40) * 0.2);
      if (bm.tick <= 0) {
        bm.tick = 0.12;
        const r: Rect = { x: p.facing > 0 ? mx : mx - (bm.sk.range ?? 300), y: my - 60, w: bm.sk.range ?? 300, h: 120 };
        for (const m of this.aliveMonsters()) if (overlaps(r, m.rect())) this.damageMonster(p, m, bm.sk.power, p.facing, 60);
      }
      if (bm.t <= 0) {
        bm.spr.destroy();
        this.beam = null;
      }
    }
    // 투사체
    for (const pr of this.projs) {
      pr.life -= dt;
      pr.vy += pr.g * dt;
      pr.spr.x += pr.vx * dt;
      pr.spr.y += pr.vy * dt;
      if (pr.g) pr.spr.rotation += dt * 6;
      const box: Rect = { x: pr.spr.x - pr.r, y: pr.spr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
      if (pr.kind === 'wave') {
        pr.spr.setScale(1.4 + Math.sin(this.scene.time.now / 50) * 0.2, 2);
        if (this.scene.level.bossWall && Math.abs(pr.spr.x - this.scene.level.bossWall.x) < 30) pr.life = 0;
        if (pr.spr.x > this.scene.level.map.width - 60) pr.life = 0;
      }
      if (pr.hostile) {
        if (overlaps(box, p.rect())) {
          if (p.hurt(pr.dmg, pr.spr.x) && !pr.pierce) pr.life = 0;
          else if (!pr.pierce) pr.life = 0;
        }
      } else {
        for (const m of this.aliveMonsters()) {
          if (pr.hit.has(m)) continue;
          if (overlaps(box, m.rect())) {
            pr.hit.add(m);
            const dmg = Math.max(1, Math.round(pr.dmg * Phaser.Math.FloatBetween(0.9, 1.1) - m.def.def));
            m.hurt(dmg, Math.sign(pr.vx) * 140);
            this.floatText(m.x, m.body.top - 6, `${dmg}`);
            this.hitFx(pr.spr.x, pr.spr.y);
            audio.play('hit');
            if (!pr.pierce) { pr.life = 0; break; }
          }
        }
      }
      if (pr.kind !== 'wave' && this.scene.solidAt(pr.spr.x, pr.spr.y)) {
        if (pr.kind === 'orb') { this.ring(pr.spr.x, pr.spr.y, 'fx_ring_dark', 0.5); this.dust(pr.spr.x, pr.spr.y, 6); }
        pr.life = 0;
      }
      if (pr.life <= 0) pr.spr.destroy();
    }
    this.projs = this.projs.filter((x) => x.life > 0);
  }

  destroy() {
    for (const pr of this.projs) pr.spr.destroy();
    this.projs = [];
    this.beam?.spr.destroy();
    this.beam = null;
  }
}
