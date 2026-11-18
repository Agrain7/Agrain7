import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { txt, panel, button, bar, toast } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { STAGES, FUTURE_REGIONS } from '../../data/maps/wolha.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { ensurePortrait } from '../textures.ts';
import { expToNext } from '../../systems/state.ts';
import { QUESTS } from '../../data/quests.ts';
import { GAME_W, GAME_H, COLORS, AUTOTEST } from '../config.ts';
import { audio } from '../../systems/audio.ts';

const NODE_POS: [number, number][] = [[120, 430], [230, 330], [360, 400], [470, 270], [590, 350], [690, 220]];

export class MapScene extends Phaser.Scene {
  private bd!: Backdrop;
  private t = 0;
  private sel = 0;
  private info!: Phaser.GameObjects.Container;
  private mountBox!: Phaser.GameObjects.Container;
  private nodes: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('Map');
  }

  create() {
    audio.stopMusic();
    audio.startMusic('calm');
    this.bd = new Backdrop(this, 'dusk');
    const st = store.state;
    st.updateQuests();
    this.nodes = [];
    // 왼쪽: 지역 지도
    panel(this, 30, 70, 760, 520);
    txt(this, 60, 92, '월하산맥', 36, COLORS.text, { title: true });
    txt(this, 214, 104, '月下山脈 · 첫 번째 지역', 18, '#7a5a3a', { title: true });
    const g = this.add.graphics();
    g.lineStyle(6, 0xb89466, 0.6);
    g.beginPath();
    NODE_POS.forEach(([x, y], i) => (i ? g.lineTo(x + 30, y + 40) : g.moveTo(x + 30, y + 40)));
    g.strokePath();
    // 산 그림 (지도 장식)
    for (const [x, y, s] of [[160, 250, 1], [420, 200, 1.2], [640, 300, 0.9]] as const) {
      g.fillStyle(0x8c86b3, 0.25);
      g.fillTriangle(x - 70 * s, y + 60 * s, x, y - 40 * s, x + 70 * s, y + 60 * s);
    }
    STAGES.forEach((s, i) => this.nodes.push(this.makeNode(i, s.id, s.subtitle)));
    // 처음 진입: 아직 돌파 안 한 첫 스테이지
    const firstOpen = STAGES.findIndex((s) => !st.data.stages[s.id]?.cleared);
    this.sel = Math.max(0, firstOpen === -1 ? STAGES.length - 1 : firstOpen);
    if (st.data.currentStage) {
      const ci = STAGES.findIndex((s) => s.id === st.data.currentStage);
      if (ci >= 0 && st.isUnlocked(st.data.currentStage) && !st.data.stages[st.data.currentStage]?.cleared) this.sel = ci;
    }
    // 추후 지역
    txt(this, 60, 600, '다음 지역 (추후 업데이트): ' + FUTURE_REGIONS.join(' · '), 16, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 4 });
    this.info = this.add.container(0, 0);
    this.mountBox = this.add.container(0, 0);
    this.drawInfo();
    this.drawMount();
    // 상단 메뉴
    button(this, 90, 34, 140, 44, '← 처음 화면', () => this.scene.start('Title'), 'normal', 17);
    const menus: [string, string][] = [['영물', 'stable'], ['도감', 'codex'], ['퀘스트', 'quests'], ['소지품', 'inventory'], ['상점', 'shop'], ['설정', 'settings']];
    menus.forEach(([label, tab], i) => {
      const b = button(this, 560 + i * 118, 34, 110, 44, label, () => this.openMenu(tab), 'normal', 18);
      if (tab === 'quests' && QUESTS.some((q) => st.data.quests[q.id]?.done && !st.data.quests[q.id]?.claimed)) {
        const dot = this.add.circle(b.x + 46, b.y - 16, 7, 0xd63c34).setStrokeStyle(2, 0xffffff);
        this.tweens.add({ targets: dot, scale: 1.3, yoyo: true, repeat: -1, duration: 500 });
      }
    });
    // 키보드
    const kb = this.input.keyboard;
    kb?.on('keydown-RIGHT', () => this.pick(Math.min(STAGES.length - 1, this.sel + 1)));
    kb?.on('keydown-LEFT', () => this.pick(Math.max(0, this.sel - 1)));
    kb?.on('keydown-ENTER', () => this.start());
    kb?.on('keydown-SPACE', () => this.start());
    this.events.on('resume', () => this.scene.restart());
    if (AUTOTEST) this.time.delayedCall(300, () => this.start());
  }

  private makeNode(i: number, id: string, sub: string) {
    const st = store.state;
    const [x, y] = NODE_POS[i];
    const unlocked = st.isUnlocked(id);
    const cleared = !!st.data.stages[id]?.cleared;
    const c = this.add.container(x + 30, y + 40);
    const ring = this.add.circle(0, 0, 30, unlocked ? 0x3c3550 : 0x6b6670).setStrokeStyle(4, cleared ? 0xe2b14c : 0xb89466);
    const lab = txt(this, 0, -2, id, 20, unlocked ? '#f6ead0' : '#c8c0b8', { title: true }).setOrigin(0.5);
    const subT = txt(this, 0, 46, unlocked ? sub : '잠김', 15, unlocked ? COLORS.text : '#8a8080').setOrigin(0.5);
    c.add([ring, lab, subT]);
    if (cleared) {
      const seal = this.add.rectangle(24, -24, 30, 30, 0xb8322b).setStrokeStyle(2, 0x6e1b18).setAngle(-8);
      c.add([seal, txt(this, 24, -24, '돌파', 11, '#f6e7c8').setOrigin(0.5).setAngle(-8)]);
    }
    ring.setInteractive({ useHandCursor: true }).on('pointerup', () => this.pick(i));
    return c;
  }

  private pick(i: number) {
    this.sel = i;
    audio.play('select');
    this.drawInfo();
  }

  private drawInfo() {
    const st = store.state;
    this.nodes.forEach((n, i) => n.setScale(i === this.sel ? 1.18 : 1));
    this.info.removeAll(true);
    const s = STAGES[this.sel];
    const unlocked = st.isUnlocked(s.id);
    const rec = st.data.stages[s.id];
    const x = 60, y = 470;
    const p = panel(this, x - 14, y - 12, 720, 110, true);
    this.info.add(p);
    this.info.add(txt(this, x + 6, y + 2, `${s.name} ${s.id} · ${s.subtitle}`, 22, COLORS.textLight, { title: true }));
    this.info.add(txt(this, x + 6, y + 36, unlocked ? s.intro : '이전 구간을 돌파하면 열립니다.', 16, '#e8dcc4', { wordWrap: { width: 480 } }));
    const chests = s.chests.length;
    this.info.add(txt(this, x + 6, y + 70, `보물 상자 ${rec?.chests.length ?? 0}/${chests}${rec?.bestTime ? `  ·  최고 기록 ${rec.bestTime.toFixed(1)}초` : ''}`, 15, '#e2b14c'));
    const go = button(this, x + 610, y + 44, 150, 62, '출발', () => this.start(), 'primary', 26);
    go.setEnabled(unlocked);
    this.info.add(go);
  }

  private drawMount() {
    const st = store.state;
    this.mountBox.removeAll(true);
    const x0 = 810, y0 = 70;
    this.mountBox.add(panel(this, x0, y0, 440, 520));
    this.mountBox.add(txt(this, x0 + 30, y0 + 22, '함께할 영물', 24, COLORS.text, { title: true }));
    const owned = st.ownedMounts();
    const m = st.active;
    const def = MOUNTS[m.id];
    const info = MOUNT_ART[artKey(m.id, m.stage)];
    const key = ensurePortrait(this, m.id, m.stage, 'normal', m.skin);
    const img = this.add.image(x0 + 220, y0 + 250, key).setOrigin(0.5, 1);
    img.setScale(Math.min(1.6, 300 / info.w, 180 / info.h));
    this.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    this.mountBox.add(img);
    this.mountBox.add(txt(this, x0 + 220, y0 + 268, `${def.name} (${def.hanja})`, 26, COLORS.text, { title: true }).setOrigin(0.5, 0));
    this.mountBox.add(txt(this, x0 + 220, y0 + 304, `${def.title} · ${def.stages[m.stage].name}`, 17, '#7a5a3a').setOrigin(0.5, 0));
    this.mountBox.add(txt(this, x0 + 40, y0 + 340, `Lv.${m.level}`, 22, COLORS.text, { title: true }));
    const b = bar(this, x0 + 120, y0 + 346, 280, 16, COLORS.exp);
    b.set(m.exp / expToNext(m.level));
    this.mountBox.add(b.g);
    const s = st.stats(m.id);
    this.mountBox.add(txt(this, x0 + 40, y0 + 378, `체력 ${s.maxHp}   공격 ${s.atk}   방어 ${s.def}`, 17, COLORS.text));
    this.mountBox.add(txt(this, x0 + 40, y0 + 406, def.stages[m.stage].abilities.join(' · '), 15, '#5a4a3a', { wordWrap: { width: 370 } }));
    if (owned.length > 1) {
      const idx = owned.findIndex((o) => o.id === m.id);
      const sw = (d: number) => {
        const n = owned[(idx + d + owned.length) % owned.length];
        st.setActive(n.id);
        st.save();
        this.drawMount();
      };
      this.mountBox.add(button(this, x0 + 40, y0 + 200, 54, 54, '◀', () => sw(-1)));
      this.mountBox.add(button(this, x0 + 400, y0 + 200, 54, 54, '▶', () => sw(1)));
    }
    this.mountBox.add(txt(this, x0 + 220, y0 + 470, `보유 영물 ${owned.length} / 9`, 16, '#7a5a3a').setOrigin(0.5));
    this.mountBox.add(button(this, x0 + 220, y0 + 500, 200, 40, '영물 관리 · 진화', () => this.openMenu('stable'), 'normal', 17));
  }

  private start() {
    const s = STAGES[this.sel];
    if (!store.state.isUnlocked(s.id)) {
      toast(this, '아직 열리지 않은 구간입니다');
      return;
    }
    store.state.data.currentStage = s.id;
    store.state.save();
    audio.unlock();
    this.scene.start('World', { stage: s.id });
  }

  private openMenu(tab: string) {
    this.scene.launch('Menu', { tab, from: 'Map' });
    this.scene.pause();
  }

  update(_t: number, dms: number) {
    this.t += dms / 1000;
    this.bd.update(this.t * 30, 0, dms / 1000);
  }
}

void GAME_W; void GAME_H;
