// 전투: 기본 공격, 특수 기술(데이터 기반), 투사체, 적 공격, 효과 연출
import Phaser from 'phaser';
import { store } from '../ctx.ts';
import type { WorldScene } from '../scenes/WorldScene.ts';
import type { Player } from '../entities/Player.ts';
import type { Monster } from '../entities/Monster.ts';
import { SKILLS } from '../../data/mounts.ts';
import type { SkillDef, FxKind } from '../../data/types.ts';
import { audio } from '../../systems/audio.ts';
import { txt } from '../../ui/widgets.ts';
import { overlaps, type Rect } from '../world/Level.ts';
import { RANGED, ULTS, ULT_GAIN } from '../../data/beastSkills.ts';
import type { MountId } from '../../data/types.ts';

interface Proj {
  spr: Phaser.GameObjects.Image;
  vx: number; vy: number; g: number; life: number; dmg: number; hostile: boolean; pierce: boolean; r: number;
  hit: Set<Monster>; kind?: 'wave' | 'orb' | 'ground';
  homing?: number; target?: Monster | null; explode?: number; chain?: number; spin?: number; gain?: number; rainbow?: boolean;
}

const FX_TEX: Partial<Record<FxKind, string>> = { feather: 'fx_feather', fire: 'fx_fire', water: 'fx_water', light: 'fx_light' };
const RING_TEX: Partial<Record<FxKind, string>> = { howl: 'fx_ring_white', shock: 'fx_ring_gold', fire: 'fx_ring_fire', water: 'fx_ring_blue', light: 'fx_ring_gold', spirit: 'fx_ring_blue', heal: 'fx_ring_gold' };

/** 0xRRGGBB → [r, g, b] */
function hexRgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

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
  /** 떠오르는 숫자·글자: 글자 객체를 다시 쓴다 (매번 새로 만들면 휴대폰에서 멈칫) */
  private floatPool = new Map<number, Phaser.GameObjects.Text[]>();
  floatText(x: number, y: number, s: string, color = '#fff3a0', size = 22) {
    const pool = this.floatPool.get(size) ?? [];
    this.floatPool.set(size, pool);
    let t = pool.pop();
    if (t && t.active) {
      t.setText(s).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
    } else {
      t = txt(this.scene, x, y, s, size, color, { stroke: '#1d1a2b', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    }
    const tt = t;
    this.scene.tweens.add({ targets: tt, y: y - 46, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => { tt.setVisible(false); if (pool.length < 24) pool.push(tt); else tt.destroy(); } });
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
    if (p.ultT <= 0) p.ult = Math.min(100, p.ult + ULT_GAIN.melee);
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
    p.atkAnimT = 0.26;
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

  /** 공격 버튼: 앞쪽 가까이에 적이 있으면 근접, 없으면 영물 고유 원거리 공격 (가까운 적 자동 조준) */
  smartAttack(p: Player) {
    const reach = (p.attackSkill.range ?? 70) + p.body.width / 2 + 40;
    const near = this.aliveMonsters().some((m) => (m.x - p.x) * p.facing > -30 && Math.abs(m.x - p.x) < reach && Math.abs(m.y - p.y) < 110);
    if (near) this.basic(p);
    else this.ranged(p);
  }

  private nearestTarget(p: Player, maxD = 950): Monster | null {
    let best: Monster | null = null, bd = Infinity;
    for (const m of this.aliveMonsters()) {
      const dx = m.x - p.x, dy = m.y - p.y;
      if (dx * p.facing < -40 || Math.abs(dy) > 420) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd && d < maxD) { bd = d; best = m; }
    }
    return best;
  }

  ranged(p: Player) {
    const id = p.def.id as MountId;
    const R = RANGED[id];
    const stage = p.st.stage;
    p.attackCD = R.cd;
    p.attackT = 0.22;
    p.atkAnimT = 0.26;
    const n = R.count[stage];
    const tgt = this.nearestTarget(p);
    const info = p.info;
    const mx = p.x + p.facing * info.w * info.scale * 0.42;
    const my = R.ground ? p.bottom - 30 : p.bottom - info.h * info.scale * 0.6;
    let base = p.facing > 0 ? 0 : Math.PI;
    if (tgt && !R.ground && !R.gravity) base = Math.atan2(tgt.y - my, tgt.x - mx);
    const power = R.power * (1 + stage * 0.15);
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base - R.spread / 2 + (R.spread * i) / (n - 1);
      let vx = Math.cos(a) * R.speed, vy = Math.sin(a) * R.speed;
      if (R.gravity) {
        // 목표까지 포물선으로 던진다
        const tx = tgt ? tgt.x : mx + p.facing * 420;
        const T = Phaser.Math.Clamp(Math.abs(tx - mx) / R.speed, 0.35, 0.9);
        vx = (tx - mx) / T + (i - (n - 1) / 2) * 60;
        vy = -0.5 * R.gravity * T + ((tgt ? tgt.y : my) - my) / T;
      }
      const spr = this.scene.add.image(mx, my, R.tex).setDepth(12).setBlendMode(Phaser.BlendModes.ADD).setScale(R.scale ?? 1);
      if (R.tint) spr.setTint(R.tint);
      if (R.ground) spr.setOrigin(0.5, 1).setFlipX(p.facing < 0);
      spr.setRotation(R.ground ? 0 : Math.atan2(vy, vx));
      if (id === 'wolf' && p.facing < 0) spr.setFlipY(true);
      this.projs.push({
        spr, vx, vy, g: R.gravity ?? 0, life: R.life ?? 1.4, dmg: p.atk * power, hostile: false, pierce: !!R.pierce, r: 20 * (R.scale ?? 1),
        hit: new Set(), kind: R.ground ? 'ground' : undefined, homing: R.homing, target: tgt, explode: R.explode, chain: R.chain?.[stage] ?? 0,
        spin: id === 'hyeonmu' || id === 'girin' ? 6 : 0, gain: ULT_GAIN.ranged, rainbow: id === 'bonghwang',
      });
    }
    audio.play(id === 'cheongryong' ? 'skill' : 'attack');
  }

  /** 필살기 */
  ultimate(p: Player) {
    const id = p.def.id as MountId;
    const U = ULTS[id];
    p.ult = 0;
    p.ultT = 2.2;
    store.state.data.stats.ults = (store.state.data.stats.ults ?? 0) + 1;
    p.atkAnimT = 0.3;
    // 글자·화면 멈춤 없이 효과만 (사용자 요청) — 기운이 모이는 고리 후 바로 발동
    this.ring(p.x, p.y, 'fx_ring_gold', 1.6, 260);
    this.scene.cameras.main.flash(120, ...hexRgb(U.color));
    audio.play('evolve');
    this.scene.time.delayedCall(140, () => this.runUltimate(p, id));
  }

  private onScreen(pad = 120): Monster[] {
    const v = this.scene.cameras.main.worldView;
    return this.aliveMonsters().filter((m) => m.x > v.x - pad && m.x < v.right + pad && m.y > v.y - pad && m.y < v.bottom + pad);
  }

  private ultHit(p: Player, m: Monster, power: number, kdir: number, knock = 300) {
    if (m.dead) return;
    const raw = p.atk * power * Phaser.Math.FloatBetween(0.95, 1.1);
    const dmg = Math.max(1, Math.round(raw - m.def.def));
    m.hurt(dmg, kdir * knock, -260);
    this.floatText(m.x + Phaser.Math.Between(-14, 14), m.body.top - 10, `${dmg}`, '#ffd76a', 28);
    this.hitFx(m.x, m.y);
  }

  private runUltimate(p: Player, id: MountId) {
    const sc = this.scene;
    const cam = sc.cameras.main;
    const v = cam.worldView;
    const U = ULTS[id];
    const targets = () => this.onScreen();
    const groundAt = (x: number) => sc.groundY(x) ?? p.bottom;
    cam.flash(140, (U.color >> 16) & 255, (U.color >> 8) & 255, U.color & 255);
    switch (id) {
      case 'wolf': {
        const moon = sc.add.image(p.x + p.facing * 200, v.y + 160, 'moon_ult').setDepth(5).setAlpha(0).setScale(0.6);
        sc.tweens.add({ targets: moon, alpha: 0.9, scale: 1, duration: 300, yoyo: true, hold: 900, onComplete: () => moon.destroy() });
        p.startDash(p.facing, 0.42, 1500, 2.2);
        for (let k = 0; k < 5; k++) sc.time.delayedCall(120 + k * 110, () => {
          for (const m of targets()) {
            const s = sc.add.image(m.x, m.y - 10, 'fx_crescent').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setRotation(Phaser.Math.FloatBetween(-1, 1)).setScale(1.4);
            sc.tweens.add({ targets: s, alpha: 0, scale: 2, duration: 220, onComplete: () => s.destroy() });
            this.ultHit(p, m, 1.1, Math.sign(m.x - p.x) || 1, 80);
          }
          audio.play('attack');
        });
        const big = sc.add.image(p.x, p.y - 20, 'fx_crescent').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setScale(3.4).setFlipX(p.facing < 0);
        this.projs.push({ spr: big, vx: p.facing * 1100, vy: 0, g: 0, life: 1.1, dmg: p.atk * 2.6, hostile: false, pierce: true, r: 120, hit: new Set() });
        cam.shake(500, 0.01);
        break;
      }
      case 'hawk': {
        p.body.setVelocityY(-950);
        for (let k = 0; k < 40; k++) sc.time.delayedCall(250 + k * 30, () => {
          const x = v.x + Phaser.Math.Between(0, v.width), y = v.y - 30;
          const tx = x + p.facing * 160, ty = v.bottom;
          const a = Math.atan2(ty - y, tx - x);
          const spr = sc.add.image(x, y, 'fx_feather').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setRotation(a).setScale(1.4);
          this.projs.push({ spr, vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100, g: 0, life: 1.2, dmg: p.atk * 0.9, hostile: false, pierce: true, r: 26, hit: new Set(), homing: 1.5, target: targets()[k % Math.max(1, targets().length)] ?? null });
        });
        break;
      }
      case 'cheongryong': {
        const dark = sc.add.rectangle(v.x, v.y, v.width, v.height, 0x0a1428, 0).setOrigin(0).setDepth(4);
        sc.tweens.add({ targets: dark, fillAlpha: 0.45, duration: 250, yoyo: true, hold: 1700, onComplete: () => dark.destroy() });
        for (let c = 0; c < 3; c++) {
          const cl = sc.add.image(v.x + 220 + c * 420, v.y + 70, 'fx_storm').setDepth(6).setAlpha(0);
          sc.tweens.add({ targets: cl, alpha: 1, duration: 300, yoyo: true, hold: 1600, onComplete: () => cl.destroy() });
        }
        const rain = sc.add.particles(0, 0, 'fx_rain', { x: { min: v.x, max: v.right + 200 }, y: v.y - 40, speedY: { min: 1100, max: 1400 }, speedX: -160, rotate: 8, lifespan: 650, alpha: 0.7, quantity: 3, frequency: 25 }).setDepth(7);
        sc.time.delayedCall(2000, () => rain.destroy());
        for (let k = 0; k < 12; k++) sc.time.delayedCall(250 + k * 130, () => {
          const ts = targets();
          const m = ts.length ? ts[k % ts.length] : null;
          const x = m ? m.x : p.x + p.facing * Phaser.Math.Between(120, 600);
          this.bolt(x, m ? m.body.bottom : groundAt(x));
          audio.play('thunder');
          if (m) this.ultHit(p, m, 1.5, Math.sign(m.x - p.x) || 1, 120);
          for (const o of ts) if (o !== m && Math.abs(o.x - x) < 70) this.ultHit(p, o, 0.8, 1, 60);
        });
        break;
      }
      case 'jujak': {
        p.body.setVelocityY(-700);
        for (let k = 0; k < 7; k++) sc.time.delayedCall(250 + k * 190, () => {
          const ts = targets();
          const m = ts.length ? ts[k % ts.length] : null;
          const x = m ? m.x : p.x + p.facing * (150 + k * 110);
          const gy = m ? m.body.bottom : groundAt(x);
          const met = sc.add.image(x - 260, v.y - 60, 'fx_fire').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setRotation(Math.atan2(gy - v.y, 260));
          sc.tweens.add({
            targets: met, x, y: gy, duration: 300, ease: 'Quad.in',
            onComplete: () => {
              met.destroy();
              this.ring(x, gy, 'fx_ring_fire', 1.5, 420);
              this.sparks(x, gy - 20, 18);
              cam.shake(160, 0.008);
              audio.play('thunder');
              for (const o of targets()) if (Phaser.Math.Distance.Between(o.x, o.y, x, gy) < 170) this.ultHit(p, o, 1.9, Math.sign(o.x - x) || 1, 340);
              const fire = sc.add.particles(x, gy, 'fx_fire', { speedY: { min: -120, max: -60 }, speedX: { min: -30, max: 30 }, lifespan: 600, scale: { start: 0.6, end: 0 }, alpha: { start: 0.8, end: 0 }, frequency: 50, blendMode: 'ADD' }).setDepth(12);
              sc.time.delayedCall(1300, () => fire.destroy());
            },
          });
        });
        break;
      }
      case 'baekho': {
        for (let r = 0; r < 3; r++) sc.time.delayedCall(r * 220, () => {
          this.ring(p.x, p.y, 'fx_ring_gold', (260 + r * 130) / 115, 450);
          cam.shake(220, 0.012);
          audio.play('boss');
          for (const m of targets()) if (Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y) < 260 + r * 130) this.ultHit(p, m, 1.2, Math.sign(m.x - p.x) || 1, 420);
        });
        for (let k = 0; k < 11; k++) sc.time.delayedCall(300 + k * 70, () => {
          const x = p.x + p.facing * (90 + k * 70);
          const gy = groundAt(x);
          const sp = sc.add.image(x, gy + 160, 'fx_spike').setOrigin(0.5, 1).setDepth(11).setScale(0.9 + (k % 3) * 0.15);
          sc.tweens.add({ targets: sp, y: gy + 20, duration: 110, ease: 'Back.out', yoyo: true, hold: 500, onComplete: () => sp.destroy() });
          this.dust(x, gy, 6);
          for (const m of targets()) if (Math.abs(m.x - x) < 55 && Math.abs(m.body.bottom - gy) < 160) this.ultHit(p, m, 1.5, p.facing, 200);
        });
        break;
      }
      case 'hyeonmu': {
        p.shieldT = 5; p.shieldAmt = 0.7;
        const gy = groundAt(p.x);
        const wv = sc.add.image(p.x, gy + 10, 'fx_wave').setOrigin(p.facing > 0 ? 0.3 : 0.7, 1).setDepth(13).setFlipX(p.facing < 0).setScale(0.4, 0.2).setAlpha(0.95);
        sc.tweens.add({ targets: wv, scaleX: 1.6, scaleY: 1.6, duration: 300 });
        sc.tweens.add({ targets: wv, x: p.x + p.facing * 1300, duration: 1400, ease: 'Sine.in', onComplete: () => wv.destroy() });
        sc.tweens.add({ targets: wv, alpha: 0, delay: 1100, duration: 300 });
        const hitSet = new Set<Monster>();
        const ev = sc.time.addEvent({ delay: 40, repeat: 36, callback: () => {
          for (const m of targets()) if (!hitSet.has(m) && Math.abs(m.x - wv.x) < 160 && m.y > wv.y - 380) { hitSet.add(m); this.ultHit(p, m, 2.6, p.facing, 700); }
        } });
        void ev;
        cam.shake(900, 0.006);
        break;
      }
      case 'girin': {
        const before = p.hp;
        p.heal(p.maxHp);
        this.floatText(p.x, p.body.top - 30, `+${p.hp - before}`, '#7dff9a', 28);
        const ts = targets();
        const xs = ts.map((m) => m.x);
        for (let k = 0; k < 4; k++) xs.push(p.x + p.facing * (200 + k * 160));
        xs.forEach((x, k) => sc.time.delayedCall(k * 90, () => {
          const gy = groundAt(x);
          const pl = sc.add.image(x, gy, 'fx_pillar').setOrigin(0.5, 1).setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2, 1.4);
          sc.tweens.add({ targets: pl, scaleX: 1.1, duration: 140, yoyo: true, hold: 420, onComplete: () => pl.destroy() });
          this.sparks(x, gy - 40, 10);
          for (const m of targets()) if (Math.abs(m.x - x) < 60) this.ultHit(p, m, 1.6, 1, 60);
        }));
        audio.play('levelup');
        break;
      }
      case 'haetae': {
        p.shieldT = 3; p.shieldAmt = 0.6;
        for (let k = 0; k < 8; k++) sc.time.delayedCall(k * 120, () => {
          const x = p.x + p.facing * (110 + k * 95);
          const gy = groundAt(x);
          const col = sc.add.image(x, gy + 10, 'fx_column').setOrigin(0.5, 1).setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 0.1);
          sc.tweens.add({ targets: col, scaleY: 1.3, duration: 140, ease: 'Back.out', yoyo: true, hold: 380, onComplete: () => col.destroy() });
          cam.shake(120, 0.006);
          audio.play('hit');
          for (const m of targets()) if (Math.abs(m.x - x) < 70 && m.body.bottom > gy - 320) this.ultHit(p, m, 1.9, p.facing, 260);
        });
        break;
      }
      case 'bonghwang': {
        p.invuln = Math.max(p.invuln, 3);
        const before = p.hp;
        p.heal(p.maxHp * 0.5);
        this.floatText(p.x, p.body.top - 30, `+${p.hp - before}`, '#7dff9a', 28);
        const ring = sc.add.image(p.x, p.y, 'fx_ring_gold').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
        sc.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
        const cols = [0xff5a5a, 0xffb84a, 0xfff06a, 0x5ad07a, 0x5ab4ff];
        const g = sc.add.graphics().setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        let tick = 0;
        sc.time.addEvent({ delay: 60, repeat: 14, callback: () => {
          g.clear();
          tick++;
          targets().forEach((m, i) => {
            g.lineStyle(10 - (tick % 3) * 2, cols[(i + tick) % cols.length], 0.85);
            g.lineBetween(p.x, p.y - 30, m.x, m.y);
            if (tick % 3 === 0) this.ultHit(p, m, 0.7, Math.sign(m.x - p.x) || 1, 80);
          });
          if (tick >= 15) g.destroy();
        } });
        sc.add.particles(p.x, p.y, 'petal', { speed: { min: 100, max: 320 }, lifespan: 1400, rotate: { min: 0, max: 360 }, quantity: 40, emitting: false }).setDepth(13).explode(40);
        break;
      }
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
      if (pr.homing && pr.target && !pr.target.dead) {
        const want = Math.atan2(pr.target.y - pr.spr.y, pr.target.x - pr.spr.x);
        const cur = Math.atan2(pr.vy, pr.vx);
        const sp = Math.hypot(pr.vx, pr.vy);
        const na = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -pr.homing * dt, pr.homing * dt);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        if (!pr.spin) pr.spr.setRotation(na);
      }
      pr.vy += pr.g * dt;
      pr.spr.x += pr.vx * dt;
      pr.spr.y += pr.vy * dt;
      if (pr.kind === 'ground') {
        const gy = this.scene.groundY(pr.spr.x);
        if (gy === null || Math.abs(gy - pr.spr.y) > 140) pr.life = 0;
        else { pr.spr.y = gy + 4; if (Math.random() < 0.5) this.dust(pr.spr.x, gy, 1); }
      }
      if (pr.spin) pr.spr.rotation += dt * pr.spin;
      else if (pr.g) pr.spr.rotation = Math.atan2(pr.vy, pr.vx);
      if (pr.rainbow) pr.spr.setTint([0xff7a7a, 0xffc06a, 0xfff07a, 0x7ae08a, 0x7ac4ff][Math.floor(this.scene.time.now / 90) % 5]);
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
            if (pr.gain && p.ultT <= 0) p.ult = Math.min(100, p.ult + pr.gain);
            this.floatText(m.x, m.body.top - 6, `${dmg}`);
            this.hitFx(pr.spr.x, pr.spr.y);
            audio.play('hit');
            if (pr.explode) this.explodeAt(p, pr.spr.x, pr.spr.y, pr.explode, pr.dmg * 0.6, m);
            if (pr.chain && pr.chain > 0) {
              const next = this.aliveMonsters().filter((o) => !pr.hit.has(o) && Phaser.Math.Distance.Between(o.x, o.y, m.x, m.y) < 260).sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, m.x, m.y) - Phaser.Math.Distance.Between(b.x, b.y, m.x, m.y))[0];
              if (next) {
                pr.chain--;
                this.zap(m.x, m.y, next.x, next.y);
                pr.target = next;
                const sp = Math.hypot(pr.vx, pr.vy);
                const a = Math.atan2(next.y - pr.spr.y, next.x - pr.spr.x);
                pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
                pr.homing = 8;
                pr.life = Math.max(pr.life, 0.6);
                break;
              }
            }
            if (!pr.pierce) { pr.life = 0; break; }
          }
        }
      }
      if (pr.kind !== 'wave' && pr.kind !== 'ground' && this.scene.solidAt(pr.spr.x, pr.spr.y)) {
        if (pr.explode && !pr.hostile && pr.life > 0) this.explodeAt(p, pr.spr.x, pr.spr.y, pr.explode, pr.dmg * 0.6, null);
        if (pr.kind === 'orb') { this.ring(pr.spr.x, pr.spr.y, 'fx_ring_dark', 0.5); this.dust(pr.spr.x, pr.spr.y, 6); }
        pr.life = 0;
      }
      if (pr.life <= 0) pr.spr.destroy();
    }
    this.projs = this.projs.filter((x) => x.life > 0);
  }

  private explodeAt(p: Player, x: number, y: number, r: number, dmg: number, skip: Monster | null) {
    this.ring(x, y, 'fx_ring_fire', (r * 2) / 230, 300);
    this.sparks(x, y, 10);
    for (const m of this.aliveMonsters()) {
      if (m === skip) continue;
      if (Phaser.Math.Distance.Between(m.x, m.y, x, y) < r + m.body.width / 2) {
        const d = Math.max(1, Math.round(dmg - m.def.def));
        m.hurt(d, Math.sign(m.x - x) * 200);
        this.floatText(m.x, m.body.top - 6, `${d}`);
      }
    }
    void p;
  }

  private zap(x0: number, y0: number, x1: number, y1: number) {
    const g = this.scene.add.graphics().setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(4, 0xbff4ff, 1);
    g.beginPath();
    g.moveTo(x0, y0);
    for (let k = 1; k < 6; k++) g.lineTo(x0 + ((x1 - x0) * k) / 6 + Phaser.Math.Between(-12, 12), y0 + ((y1 - y0) * k) / 6 + Phaser.Math.Between(-12, 12));
    g.lineTo(x1, y1);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }

  destroy() {
    for (const pr of this.projs) pr.spr.destroy();
    this.projs = [];
    this.beam?.spr.destroy();
    this.beam = null;
  }
}
