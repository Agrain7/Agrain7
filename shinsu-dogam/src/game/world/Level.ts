// 스테이지 데이터 → 충돌 지형 + 2D 일러스트 배치
import Phaser from 'phaser';
import type { StageMap } from '../../data/maps/wolha.ts';
import { txt } from '../../ui/widgets.ts';
import { isTouchDevice } from '../config.ts';
import { store } from '../ctx.ts';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Chest { id: string; x: number; y: number; loot: Record<string, number>; sprite: Phaser.GameObjects.Image; opened: boolean }
export interface Pickup { id: string; type: string; x: number; y: number; sprite: Phaser.GameObjects.Image; taken: boolean; persistent: boolean }
export interface Checkpoint { x: number; y: number; sprite: Phaser.GameObjects.Image; lit: boolean }

export class Level {
  solids: Phaser.Physics.Arcade.StaticGroup;
  oneways: Phaser.Physics.Arcade.StaticGroup;
  hazards: Rect[] = [];
  updrafts: Rect[] = [];
  chests: Chest[] = [];
  pickups: Pickup[] = [];
  checkpoints: Checkpoint[] = [];
  goal: Rect;
  shrine?: Rect & { sprite: Phaser.GameObjects.Image };
  bossWall?: Phaser.GameObjects.Zone;
  private bossWallFx?: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene, public map: StageMap) {
    const s = scene;
    this.solids = s.physics.add.staticGroup();
    this.oneways = s.physics.add.staticGroup();
    const st = store.state;
    const rec = st.data.stages[map.id];

    // 장식 (지형 뒤) — 시작 지점에는 참고 화면처럼 큰 벚나무 + 깃발·등롱
    const g0 = map.ground.find((g) => map.spawn.x >= g.x0 && map.spawn.x <= g.x1);
    if (g0) {
      this.addDecor({ type: 'tree', x: Math.max(g0.x0 + 60, map.spawn.x - 70), y: g0.top, s: 1.35 });
      this.addDecor({ type: 'lantern', x: map.spawn.x + 150, y: g0.top });
    }
    for (const d of map.decor) this.addDecor(d);

    // 지면
    for (const g of map.ground) {
      const w = g.x1 - g.x0, h = map.height - g.top + 200;
      this.addSolid(g.x0, g.top, w, h);
      const style = g.style ?? 'grass';
      s.add.tileSprite(g.x0, g.top + 18, w, h, `ground_${style}`).setOrigin(0).setDepth(-10);
      // 돌다리 윗부분: 참고 화면의 돌다리를 그대로 (이끼 낀 판석·큰 돌)
      if (style === 'grass' && s.textures.exists('scn_bridge_top')) s.add.tileSprite(g.x0, g.top - 4, w, 112, 'scn_bridge_top').setOrigin(0).setDepth(-9.4);
      s.add.tileSprite(g.x0 - 6, g.top - 22, w + 12, 48, `top_${style}`).setOrigin(0).setDepth(-9);
      // 돌다리 아치 (참고 화면처럼 다리 아래로 먼 풍경이 비침)
      if (style === 'grass' && w > 520) {
        for (let ax = g.x0 + 170; ax + 270 < g.x1 - 40; ax += 620) { const a = s.add.image(ax, g.top + 92, 'bridge_arch').setOrigin(0).setDepth(-9.7); if (map.sky === 'night') a.setTint(0x7880b4); }
      }
      // 절벽 가장자리 그림자
      const edge = s.add.graphics().setDepth(-9.5);
      edge.fillStyle(0x000000, 0.25);
      edge.fillRect(g.x0, g.top + 18, 10, h);
      edge.fillRect(g.x1 - 10, g.top + 18, 10, h);
    }
    for (const b of map.blocks) {
      this.addSolid(b.x, b.y, b.w, b.h);
      const style = b.style ?? 'stone';
      s.add.tileSprite(b.x, b.y + 10, b.w, b.h - 10, `ground_${style}`).setOrigin(0).setDepth(-10);
      s.add.tileSprite(b.x - 4, b.y - 22, b.w + 8, 48, `top_${style}`).setOrigin(0).setDepth(-9);
      const gfx = s.add.graphics().setDepth(-9.5);
      gfx.lineStyle(2, 0x1d1a2b, 0.6);
      gfx.strokeRect(b.x, b.y + 10, b.w, b.h - 10);
    }
    for (const p of map.platforms) {
      const z = s.add.zone(p.x + p.w / 2, p.y + 8, p.w, 16);
      s.physics.add.existing(z, true);
      const body = z.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.oneways.add(z);
      s.add.tileSprite(p.x, p.y - 6, p.w, 40, `plat_${p.style}`).setOrigin(0).setDepth(-8);
      if (p.style === 'bridge' || p.style === 'wood') {
        // 받침 기둥
        const gfx = s.add.graphics().setDepth(-11);
        gfx.fillStyle(p.style === 'wood' ? 0x5b3a24 : 0x6f6a64, 1);
        if (p.style === 'wood') {
          gfx.fillRect(p.x + 10, p.y + 16, 6, 40);
          gfx.fillRect(p.x + p.w - 16, p.y + 16, 6, 40);
        }
      }
    }
    // 위험물 (가시덤불)
    for (const h of map.hazards) {
      this.hazards.push(h);
      s.add.tileSprite(h.x, h.y - 4, h.w, h.h + 4, 'thorns').setOrigin(0).setDepth(-7);
    }
    // 상승 기류
    for (const u of map.updrafts) {
      this.updrafts.push(u);
      const glowR = s.add.rectangle(u.x, u.y, u.w, u.h, 0xbfe9ff, 0.12).setOrigin(0).setDepth(-6);
      s.tweens.add({ targets: glowR, alpha: 0.22, yoyo: true, repeat: -1, duration: 900 });
      s.add.particles(0, 0, 'wisp', {
        x: { min: u.x, max: u.x + u.w }, y: u.y + u.h, speedY: { min: -260, max: -160 }, lifespan: (u.h / 200) * 1000,
        scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.9, end: 0 }, frequency: 70, blendMode: 'ADD',
      }).setDepth(-5);
    }
    // 체크포인트 (석등)
    for (const c of map.checkpoints) {
      const spr = s.add.image(c.x, c.y + 4, 'lantern_off').setOrigin(0.5, 1).setDepth(-6);
      this.checkpoints.push({ x: c.x, y: c.y, sprite: spr, lit: false });
    }
    // 보물 상자
    for (const c of map.chests) {
      const opened = !!rec?.chests.includes(c.id);
      const spr = s.add.image(c.x, c.y + 2, opened ? 'chest_open' : 'chest').setOrigin(0.5, 1).setDepth(-4);
      if (!opened) s.tweens.add({ targets: spr, scaleY: 1.04, yoyo: true, repeat: -1, duration: 700 });
      this.chests.push({ ...c, sprite: spr, opened });
    }
    // 수집품
    for (const p of map.pickups) {
      const persistent = p.type !== 'coin';
      if (persistent && rec?.pickups.includes(p.id)) continue;
      const key = p.type === 'coin' ? 'coin' : p.type === 'pearl_shard' ? 'pearl' : p.type === 'lore_page' ? 'lore' : 'petal';
      const spr = s.add.image(p.x, p.y, key).setDepth(-3);
      if (p.type === 'pearl_shard') spr.setScale(0.9);
      s.tweens.add({ targets: spr, y: p.y - 6, yoyo: true, repeat: -1, duration: 800 + Math.random() * 300, ease: 'Sine.inOut' });
      this.pickups.push({ id: p.id, type: p.type, x: p.x, y: p.y, sprite: spr, taken: false, persistent });
    }
    // 표지판
    const touch = isTouchDevice();
    for (const sg of map.signs) {
      const text = !touch && sg.pc ? sg.pc : sg.text;
      const post = s.add.graphics().setDepth(-5);
      post.fillStyle(0x5b3a24, 1);
      post.fillRect(sg.x - 4, sg.y - 60, 8, 60);
      const t = txt(s, sg.x, sg.y - 92, text, 17, '#3a2416', { align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5).setDepth(-4);
      const pad = 10;
      const bg = s.add.rectangle(sg.x, sg.y - 92, t.width + pad * 2, t.height + pad * 1.4, 0xefdcb4).setStrokeStyle(3, 0x6b4a2a).setDepth(-4.5);
      void bg;
    }
    // 골
    const gx = map.goal.x, gy = map.goal.y;
    s.add.image(gx, gy + 4, 'goal').setOrigin(0.5, 1).setDepth(-6);
    this.goal = { x: gx - 70, y: gy - 260, w: 140, h: 260 };
    // 용신 사당
    if (map.shrine) {
      const spr = s.add.image(map.shrine.x, map.shrine.y + 4, 'shrine').setOrigin(0.5, 1).setDepth(-6);
      this.shrine = { x: map.shrine.x - 90, y: map.shrine.y - 200, w: 180, h: 200, sprite: spr };
      if (!store.state.owns('cheongryong')) {
        s.add.particles(map.shrine.x, map.shrine.y - 120, 'wisp', { speed: 30, lifespan: 1500, scale: { start: 1, end: 0 }, frequency: 120, blendMode: 'ADD' }).setDepth(-5);
      }
    }
  }

  addSolid(x: number, y: number, w: number, h: number) {
    const z = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
    this.scene.physics.add.existing(z, true);
    this.solids.add(z);
    return z;
  }

  private addDecor(d: StageMap['decor'][number]) {
    const s = this.scene;
    const sc = d.s ?? 1;
    switch (d.type) {
      case 'pavilion': {
        const ref = s.textures.exists('scn_pavilion');
        s.add.image(d.x, d.y + 6, ref ? 'scn_pavilion' : 'pavilion').setOrigin(0.5, 1).setScale(sc * (ref ? 0.95 : 1)).setDepth(-12);
        break;
      }
      case 'lantern': s.add.image(d.x, d.y + 4, 'lantern_on').setOrigin(0.5, 1).setScale(0.9 * sc).setDepth(-12); break;
      case 'tree': {
        s.add.image(d.x, d.y + 8, Math.round(d.x / 100) % 2 ? 'tree_cherry' : 'tree_plum').setOrigin(0.5, 1).setScale(sc).setDepth(-13);
        // 가지에 매단 깃발과 등롱 (바람에 흔들림)
        const refBan = s.textures.exists('scn_banner_red');
        const ban = refBan
          ? s.add.image(d.x - 78 * sc, d.y - 240 * sc, Math.round(d.x / 100) % 2 ? 'scn_banner_red' : 'scn_banner_pink').setOrigin(0.5, 0).setScale(0.85 * sc).setDepth(-12.5)
          : s.add.image(d.x - 78 * sc, d.y - 236 * sc, 'banner').setOrigin(0.5, 0).setScale(0.62 * sc).setDepth(-12.5);
        s.tweens.add({ targets: ban, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 1700 + (d.x % 7) * 90, ease: 'Sine.inOut' });
        const lan = s.add.image(d.x + 64 * sc, d.y - 214 * sc, 'hang_lantern').setOrigin(0.5, 0).setScale(0.62 * sc).setDepth(-12.5);
        s.tweens.add({ targets: lan, angle: { from: 5, to: -5 }, yoyo: true, repeat: -1, duration: 1500 + (d.x % 5) * 110, ease: 'Sine.inOut' });
        break;
      }
      case 'pine': s.add.image(d.x, d.y + 8, 'pine').setOrigin(0.5, 1).setScale(sc).setDepth(-13); break;
      case 'rock': s.add.image(d.x, d.y + 10, 'rock').setOrigin(0.5, 1).setScale(sc).setDepth(-12); break;
      case 'grass': s.add.image(d.x, d.y + 6, 'grass').setOrigin(0.5, 1).setScale(sc).setDepth(-2); break;
      case 'arch': s.add.image(d.x, d.y + 20, 'arch').setOrigin(0.5, 0).setScale(sc).setDepth(-11); break;
      case 'shrine': s.add.image(d.x, d.y + 4, 'shrine').setOrigin(0.5, 1).setScale(sc).setDepth(-12); break;
      case 'waterfall': break;
    }
  }

  /** 보스 아레나 벽 */
  closeArena(x: number) {
    if (this.bossWall) return;
    this.bossWall = this.addSolid(x - 20, 0, 40, this.map.height);
    const fx = this.scene.add.rectangle(x, this.map.height / 2, 30, this.map.height, 0x7a3aa0, 0.35).setDepth(-2);
    this.scene.tweens.add({ targets: fx, alpha: 0.6, yoyo: true, repeat: -1, duration: 600 });
    this.bossWallFx = fx;
  }

  /** 보스전 초기화 시 아레나 벽 제거 */
  openArena() {
    if (this.bossWall) {
      this.solids.remove(this.bossWall, true, true);
      this.bossWall = undefined;
    }
    this.bossWallFx?.destroy();
    this.bossWallFx = undefined;
  }
}

export function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
