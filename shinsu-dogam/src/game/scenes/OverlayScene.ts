// 획득·진화·구간 돌파·기절·보스 연출 (overlayQueue 순서대로 표시, 표시 중에는 월드 일시정지)
import Phaser from 'phaser';
import { overlayQueue, type OverlayItem } from '../overlayQueue.ts';
import type { WorldScene } from './WorldScene.ts';
import { txt, panel, button } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { MOUNTS, SKILLS } from '../../data/mounts.ts';
import type { MountId } from '../../data/types.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { ensurePortrait } from '../textures.ts';
import { GAME_W, GAME_H, COLORS, AUTOTEST } from '../config.ts';
import { audio } from '../../systems/audio.ts';
import { controls } from '../controls.ts';

export class OverlayScene extends Phaser.Scene {
  private busy = false;
  /** 이 연출 때문에 월드를 멈췄는가 */
  private pausedWorld = false;
  private layer!: Phaser.GameObjects.Container;
  private unsub: (() => void) | null = null;

  constructor() {
    super('Overlay');
  }

  create() {
    this.busy = false;
    this.layer = this.add.container(0, 0);
    this.unsub = overlayQueue.onPush(() => this.pump());
    this.events.once('shutdown', () => this.unsub?.());
    this.pump();
  }

  private get world() {
    return this.scene.get('World') as WorldScene;
  }

  private pump() {
    if (this.busy) return;
    const item = overlayQueue.shift();
    if (!item) return;
    this.busy = true;
    if (this.scene.isActive('World')) {
      this.scene.pause('World');
      this.scene.pause('Hud');
      this.pausedWorld = true;
    }
    controls.reset();
    this.show(item);
  }

  private done(resume = true) {
    this.layer.removeAll(true);
    this.busy = false;
    if (overlayQueue.length) return this.pump();
    if (resume && this.pausedWorld) {
      this.pausedWorld = false;
      this.scene.resume('World');
      this.scene.resume('Hud');
    }
  }

  private dim(alpha = 0.6) {
    const r = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0912, alpha).setOrigin(0).setInteractive();
    this.layer.add(r);
    return r;
  }

  private rays() {
    const rays = this.add.graphics({ x: GAME_W / 2, y: GAME_H / 2 - 40 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rays.fillStyle(0xffe6a6, 0.08);
      rays.slice(0, 0, 600, a, a + 0.12, false);
      rays.fillPath();
    }
    this.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 30000, repeat: -1 });
    this.layer.add(rays);
  }

  private beastImage(mount: string, stage: number, y: number, maxW = 420, maxH = 260) {
    const key = ensurePortrait(this, mount, stage, 'normal', store.state.data.mounts[mount as keyof typeof MOUNTS]?.skin);
    const info = MOUNT_ART[artKey(mount, stage)];
    const img = this.add.image(GAME_W / 2, y, key).setOrigin(0.5, 1);
    img.setScale(Math.min(2, maxW / info.w, maxH / info.h));
    this.layer.add(img);
    return img;
  }

  private show(item: OverlayItem) {
    const st = store.state;
    const cx = GAME_W / 2;
    switch (item.type) {
      case 'acquire': {
        this.dim(0.72);
        this.rays();
        const def = MOUNTS[item.mount];
        audio.play('evolve');
        const img = this.beastImage(item.mount, 0, GAME_H / 2 + 60);
        const sc = img.scale;
        img.setScale(0.1).setAlpha(0);
        this.tweens.add({ targets: img, scale: sc, alpha: 1, duration: 700, ease: 'Back.out' });
        this.layer.add(txt(this, cx, 90, '새로운 영물과 마음이 통했다!', 26, '#ffe6a6', { title: true, stroke: '#1d1a2b', strokeThickness: 6 }).setOrigin(0.5));
        this.layer.add(txt(this, cx, 140, `${def.name} (${def.hanja})`, 48, '#f6ead0', { title: true, stroke: '#1d1a2b', strokeThickness: 8 }).setOrigin(0.5));
        this.layer.add(txt(this, cx, GAME_H / 2 + 86, `${def.title} · 도감에 기록되었습니다`, 20, '#e2b14c').setOrigin(0.5));
        this.layer.add(txt(this, cx, GAME_H / 2 + 120, def.stages[0].abilities.join(' · '), 18, '#e8dcc4').setOrigin(0.5));
        const inWorld = this.pausedWorld;
        if (inWorld) {
          this.layer.add(button(this, cx - 130, GAME_H - 110, 230, 60, '함께 달리기', () => {
            st.setActive(item.mount);
            this.world.player?.rebuild();
            st.save();
            this.done();
          }, 'primary', 22));
        }
        this.layer.add(button(this, inWorld ? cx + 130 : cx, GAME_H - 110, 200, 60, '계속', () => this.done(), inWorld ? 'normal' : 'primary', 22));
        st.save();
        break;
      }
      case 'evolvePrompt': {
        this.dim(0.6);
        const def = MOUNTS[item.mount];
        const c = st.canEvolve(item.mount);
        this.layer.add(panel(this, cx - 300, 150, 600, 380));
        this.beastImage(item.mount, st.data.mounts[item.mount]!.stage, 360, 300, 170);
        this.layer.add(txt(this, cx, 190, `${def.name}이(가) 진화할 수 있어요!`, 28, COLORS.text, { title: true }).setOrigin(0.5));
        this.layer.add(txt(this, cx, 392, `${def.stages[item.stage].name}(으)로 진화 · 영기석 ${c.cost?.spiritStone} · 금화 ${c.cost?.gold}`, 19, '#5a3a2a').setOrigin(0.5));
        this.layer.add(txt(this, cx, 422, `새 능력: ${def.stages[item.stage].abilities.join(', ')}`, 16, '#5a4a3a', { wordWrap: { width: 540 }, align: 'center' }).setOrigin(0.5, 0));
        this.layer.add(button(this, cx - 120, 490, 200, 56, '지금 진화', () => {
          this.layer.removeAll(true);
          if (st.evolve(item.mount)) this.show({ type: 'evolve', mount: item.mount, stage: item.stage });
          else this.done();
        }, 'primary', 22));
        this.layer.add(button(this, cx + 120, 490, 200, 56, '나중에', () => this.done(), 'normal', 20));
        break;
      }
      case 'evolve': {
        this.dim(0.78);
        this.rays();
        const def = MOUNTS[item.mount];
        audio.play('evolve');
        const old = this.beastImage(item.mount, item.stage - 1, GAME_H / 2 + 80);
        const flash = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0).setOrigin(0);
        this.layer.add(flash);
        this.tweens.add({ targets: old, scale: old.scale * 1.08, yoyo: true, repeat: 3, duration: 160 });
        this.time.delayedCall(800, () => {
          this.tweens.add({ targets: flash, alpha: 1, duration: 250, yoyo: true, hold: 120 });
          this.time.delayedCall(260, () => {
            old.destroy();
            const img = this.beastImage(item.mount, item.stage, GAME_H / 2 + 80);
            const s = img.scale;
            img.setScale(s * 0.85);
            this.tweens.add({ targets: img, scale: s, duration: 500, ease: 'Back.out' });
            this.add.particles(cx, GAME_H / 2 - 40, 'wisp_gold', { speed: { min: 80, max: 300 }, lifespan: 1200, scale: { start: 1, end: 0 }, quantity: 40, emitting: false, blendMode: 'ADD' }).explode(40);
            const stg = def.stages[item.stage];
            this.layer.add(txt(this, cx, 110, `${def.name} — ${stg.name}(으)로 진화!`, 40, '#f6ead0', { title: true, stroke: '#1d1a2b', strokeThickness: 8 }).setOrigin(0.5));
            this.layer.add(txt(this, cx, GAME_H / 2 + 110, `새 능력: ${stg.abilities.join(' · ')}`, 20, '#ffe6a6', { stroke: '#1d1a2b', strokeThickness: 4 }).setOrigin(0.5));
            this.layer.add(txt(this, cx, GAME_H / 2 + 142, `기본 공격: ${SKILLS[stg.attack].name} · 특수 기술: ${SKILLS[stg.special].name}`, 18, '#e8dcc4').setOrigin(0.5));
            if (stg.movement.flight) this.layer.add(txt(this, cx, GAME_H / 2 + 174, '공중에서 점프를 한 번 더 누르면 자유 비행! (점프 유지 = 상승, 아래 = 하강)', 18, '#bfe9ff', { stroke: '#1d1a2b', strokeThickness: 4 }).setOrigin(0.5));
            this.layer.add(button(this, cx, GAME_H - 80, 200, 58, '확인', () => this.done(), 'primary', 22));
          });
        });
        st.save();
        break;
      }
      case 'clear': {
        this.dim(0.55);
        this.layer.add(panel(this, cx - 320, 110, 640, 460));
        const seal = this.add.rectangle(cx + 230, 160, 86, 86, 0xb8322b).setStrokeStyle(3, 0x6e1b18).setAngle(-8);
        this.layer.add(seal);
        this.layer.add(txt(this, seal.x, seal.y, '돌파', 28, '#f6e7c8', { title: true }).setOrigin(0.5).setAngle(-8));
        this.layer.add(txt(this, cx, 160, `${item.region ?? '월하산맥'} ${item.stageId} 돌파!`, 38, COLORS.text, { title: true }).setOrigin(0.5));
        // 별 ★★★ (돌파 · 보물 상자 모두 · 쓰러지지 않고)
        const stars = item.stars ?? 1;
        for (let k = 0; k < 3; k++) {
          const on = k < stars;
          const sTxt = txt(this, cx - 54 + k * 54, 206, '★', 44, on ? '#ffcf4a' : '#8a8090', { stroke: '#5a3a10', strokeThickness: on ? 4 : 2 }).setOrigin(0.5).setScale(0.2);
          this.layer.add(sTxt);
          this.tweens.add({ targets: sTxt, scale: 1, duration: 260, delay: 250 + k * 220, ease: 'Back.out' });
        }
        this.layer.add(txt(this, cx, 240, '★ 돌파 · ★ 보물 상자 모두 · ★ 쓰러지지 않고', 15, '#7a5a3a').setOrigin(0.5));
        const lines = [
          `소요 시간  ${item.time.toFixed(1)}초`,
          `처치한 몬스터  ${item.defeats}`,
          `보물 상자  ${item.chests}`,
          `영물 경험치  +${item.exp}${item.first ? '' : ' (재도전)'}`,
          `금화  +${item.gold}`,
        ];
        lines.forEach((l, i) => this.layer.add(txt(this, cx - 200, 268 + i * 44, l, 22, '#3a2a2a')));
        const w = this.world;
        if (item.next) this.layer.add(button(this, cx - 120, 520, 220, 60, '다음 구간 ▶', () => { this.layer.removeAll(true); this.busy = false; this.pausedWorld = false; w.afterClear(true); }, 'primary', 22));
        this.layer.add(button(this, item.next ? cx + 120 : cx, 520, 200, 60, '지도로', () => { this.layer.removeAll(true); this.busy = false; this.pausedWorld = false; w.afterClear(false); }, item.next ? 'normal' : 'primary', 22));
        if (AUTOTEST) this.time.delayedCall(800, () => { this.layer.removeAll(true); this.busy = false; this.pausedWorld = false; w.afterClear(false); });
        break;
      }
      case 'faint': {
        this.dim(0.7);
        this.layer.add(txt(this, cx, GAME_H / 2 - 20, '기절했다…', 44, '#f6ead0', { title: true }).setOrigin(0.5));
        this.layer.add(txt(this, cx, GAME_H / 2 + 36, '마지막으로 밝힌 석등에서 다시 시작합니다', 20, '#e8dcc4').setOrigin(0.5));
        this.time.delayedCall(1500, () => {
          this.done();
          this.world.revive(true);
        });
        break;
      }
      case 'boss': {
        const g = this.add.graphics();
        g.fillStyle(0x0b0912, 0.75);
        g.fillRect(0, GAME_H / 2 - 90, GAME_W, 180);
        this.layer.add(g);
        this.layer.add(txt(this, cx, GAME_H / 2 - 22, item.title, 56, '#ff9a8a', { title: true, stroke: '#1d1a2b', strokeThickness: 8 }).setOrigin(0.5));
        this.layer.add(txt(this, cx, GAME_H / 2 + 40, item.sub, 22, '#e8dcc4').setOrigin(0.5));
        this.time.delayedCall(1900, () => this.done());
        break;
      }
      case 'purified': {
        this.dim(0.5);
        this.rays();
        const nm = item.name ?? '흑운 산군', rg = item.region ?? '월하산맥';
        this.layer.add(txt(this, cx, GAME_H / 2 - 60, `${nm}이(가) 정화되었다!`, 44, '#fff3c6', { title: true, stroke: '#1d1a2b', strokeThickness: 8 }).setOrigin(0.5));
        const gName = item.guardian ? MOUNTS[item.guardian as MountId]?.name : null;
        this.layer.add(txt(this, cx, GAME_H / 2, gName ? `${rg}에 빛이 돌아왔다. 정화된 ${gName}이(가) 동료가 되고 싶어 한다!` : `${rg}에 빛이 돌아왔다. 수호신은 고마움의 표시로 영기석을 남겼다.`, 20, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 4 }).setOrigin(0.5));
        this.layer.add(txt(this, cx, GAME_H / 2 + 36, `${item.reward ?? '영기석 +8 · 월하 꽃잎 +5 · 금화 +300'} — 홍살문으로 나아가자`, 18, '#ffe6a6').setOrigin(0.5));
        this.layer.add(button(this, cx, GAME_H / 2 + 120, 200, 58, '확인', () => this.done(), 'primary', 22));
        break;
      }
      case 'message': {
        this.dim(0.6);
        this.layer.add(panel(this, cx - 300, 200, 600, 300));
        this.layer.add(txt(this, cx, 250, item.title, 30, COLORS.text, { title: true }).setOrigin(0.5));
        this.layer.add(txt(this, cx, 300, item.body, 19, '#3a2a2a', { wordWrap: { width: 520 }, align: 'center' }).setOrigin(0.5, 0));
        this.layer.add(button(this, cx, 450, 180, 54, '확인', () => this.done(), 'primary'));
        break;
      }
    }
  }
}
