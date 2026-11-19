import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { txt, panel, button, bar, toast, card, fitInto, sectionTitle, tap, resetScrolls } from '../../ui/widgets.ts';
import { ScrollArea } from '../../ui/scroll.ts';
import { store } from '../ctx.ts';
import { STAGES } from '../../data/maps/wolha.ts';
import { REGIONS, regionOf } from '../../data/regions.ts';
import * as L from '../../systems/live.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { ensurePortrait } from '../textures.ts';
import { expToNext } from '../../systems/state.ts';
import { QUESTS } from '../../data/quests.ts';
import { GAME_W, GAME_H, COLORS, AUTOTEST } from '../config.ts';
import { audio } from '../../systems/audio.ts';

const NODE_POS: [number, number][] = [[200, 330], [300, 248], [410, 312], [510, 208], [610, 276], [690, 178]];

export class MapScene extends Phaser.Scene {
  private bd!: Backdrop;
  private t = 0;
  private sel = 0;
  private info!: Phaser.GameObjects.Container;
  private mountBox!: Phaser.GameObjects.Container;
  private nodes: Phaser.GameObjects.Container[] = [];
  /** 지금 보고 있는 지역 (1~6) */
  private region = 1;
  private regionLayer!: Phaser.GameObjects.Container;
  private lockLayer?: Phaser.GameObjects.Container;
  /** 함께할 영물 고르는 가로 띠 (끌어 넘기기) */
  private strip?: ScrollArea;
  private stripPos?: number;
  private get regionStages() { return STAGES.filter((s) => s.id.startsWith(`${this.region}-`)); }

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
    resetScrolls(this);
    this.strip = undefined;
    this.events.once('shutdown', () => { this.strip?.destroy(); this.strip = undefined; });
    // 처음 진입: 아직 돌파 안 한 첫 구간이 있는 지역
    const firstOpen = STAGES.findIndex((s) => !st.data.stages[s.id]?.cleared);
    let selId = STAGES[firstOpen === -1 ? STAGES.length - 1 : firstOpen].id;
    if (st.data.currentStage && st.isUnlocked(st.data.currentStage) && !st.data.stages[st.data.currentStage]?.cleared) selId = st.data.currentStage;
    this.region = regionOf(selId).n;
    this.sel = this.regionStages.findIndex((s) => s.id === selId);
    // 왼쪽: 지역 지도
    panel(this, 30, 70, 760, 520);
    this.regionLayer = this.add.container(0, 0);
    this.buildRegion();
    this.info = this.add.container(0, 0);
    this.mountBox = this.add.container(0, 0);
    this.drawInfo();
    this.drawMount();
    // 상단 메뉴
    button(this, 90, 34, 140, 44, '← 처음 화면', () => this.scene.start('Title'), 'normal', 17);
    void REGIONS;
    const menus: [string, string][] = [['영물', 'stable'], ['일일', 'daily'], ['수행록', 'pass'], ['원정', 'expedition'], ['퀘스트', 'quests'], ['도감', 'codex'], ['상점', 'shop'], ['설정', 'settings']];
    const cl = L.claimables(st);
    const quest = QUESTS.some((q) => st.data.quests[q.id]?.done && !st.data.quests[q.id]?.claimed) ? 1 : 0;
    const dotN: Record<string, number> = { daily: cl.daily, pass: cl.pass, expedition: cl.expedition, quests: quest };
    menus.forEach(([label, tab], i) => {
      const b = button(this, 300 + i * 120, 34, 112, 44, label, () => this.openMenu(tab), tab === 'shop' ? 'primary' : 'normal', 17);
      if (dotN[tab]) {
        const dot = this.add.circle(b.x + 48, b.y - 16, 8, 0xd63c34).setStrokeStyle(2, 0xffffff);
        this.tweens.add({ targets: dot, scale: 1.3, yoyo: true, repeat: -1, duration: 500 });
      }
    });
    // 하루 첫 방문: 출석 보상 안내 (자동으로 일일 탭)
    if (!AUTOTEST && L.canClaimLogin(st) && st.data.stages['1-1']?.cleared) this.time.delayedCall(400, () => this.openMenu('daily'));
    // 키보드
    const kb = this.input.keyboard;
    kb?.on('keydown-RIGHT', () => this.pick(Math.min(this.regionStages.length - 1, this.sel + 1)));
    kb?.on('keydown-LEFT', () => this.pick(Math.max(0, this.sel - 1)));
    kb?.on('keydown-UP', () => this.switchRegion(1));
    kb?.on('keydown-DOWN', () => this.switchRegion(-1));
    kb?.on('keydown-ENTER', () => this.start());
    kb?.on('keydown-SPACE', () => this.start());
    this.events.on('resume', () => this.scene.restart());
    if (AUTOTEST) this.time.delayedCall(300, () => this.start());
  }

  /** 지역 지도: 이름·설명·6구간 길·수호 영물·지역 별 보상 */
  private buildRegion() {
    const st = store.state;
    const R = REGIONS[this.region - 1];
    this.regionLayer.removeAll(true);
    this.lockLayer?.destroy();
    this.lockLayer = undefined;
    this.nodes.forEach((n) => n.destroy());
    this.nodes = [];
    const lay = this.regionLayer;
    lay.add(txt(this, 110, 92, R.name, 34, COLORS.text, { title: true }));
    lay.add(txt(this, 112 + R.name.length * 34 + 10, 104, `${R.hanja} · ${R.subtitle}`, 17, '#7a5a3a', { title: true }));
    const prev = button(this, 72, 112, 50, 50, '◀', () => this.switchRegion(-1), 'normal', 20);
    const next = button(this, 748, 112, 50, 50, '▶', () => this.switchRegion(1), 'normal', 20);
    prev.setEnabled(this.region > 1);
    next.setEnabled(this.region < REGIONS.length);
    lay.add([prev, next]);
    const g = this.add.graphics();
    g.lineStyle(6, 0xb89466, 0.6);
    g.beginPath();
    NODE_POS.forEach(([x, y], i) => (i ? g.lineTo(x + 30, y + 40) : g.moveTo(x + 30, y + 40)));
    g.strokePath();
    for (const [x, y, sc] of [[160, 250, 1], [420, 200, 1.2], [640, 300, 0.9]] as const) {
      g.fillStyle(0x8c86b3, 0.25);
      g.fillTriangle(x - 70 * sc, y + 60 * sc, x, y - 40 * sc, x + 70 * sc, y + 60 * sc);
    }
    lay.add(g);
    this.regionStages.forEach((s, i) => this.nodes.push(this.makeNode(i, s.id, s.subtitle)));
    // 잠긴 지역 안내
    const firstId = this.regionStages[0]?.id;
    if (firstId && !st.isUnlocked(firstId)) {
      const prevR = REGIONS[this.region - 2];
      const cover = this.add.rectangle(40, 186, 740, 262, 0x1d1a2b, 0.62).setOrigin(0).setDepth(5);
      const lockT = txt(this, 410, 300, `🔒 ${prevR?.name ?? ''}의 ${prevR?.bossName ?? '수호 영물'}을(를)\n정화하면 열립니다`, 22, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(6);
      this.lockLayer = this.add.container(0, 0, [cover, lockT]).setDepth(5);
    }
    // 수호 영물 + 지역 별 보상
    if (R.guardian) {
      const owned = st.owns(R.guardian);
      const key = ensurePortrait(this, R.guardian, 2, owned ? 'normal' : 'silhouette');
      const im = this.add.image(110, 360, key).setOrigin(0.5, 1);
      im.setScale(Math.min(0.55, 140 / im.width));
      lay.add(im);
      lay.add(txt(this, 110, 366, owned ? `${MOUNTS[R.guardian].name} 동료` : `정화하면 ${MOUNTS[R.guardian].name} 합류`, 13, owned ? '#2f8a7a' : '#7a5a3a').setOrigin(0.5, 0));
    }
    const rs = L.regionStars(st, this.region);
    lay.add(txt(this, 66, 146, `지역 별 ★ ${rs} / 18`, 17, COLORS.text, { title: true }));
    L.REGION_STAR_REWARDS.forEach((r, i) => {
      const done = st.data.regionRewards.includes(`r${this.region}_${i}`);
      const can = L.canClaimRegion(st, this.region, i);
      const b = button(this, 300 + i * 126, 156, 118, 32, done ? `✓ ★${r.stars}` : `★${r.stars} 보상`, () => {
        if (L.claimRegion(st, this.region, i)) {
          st.save();
          audio.play('chest');
          toast(this, `★${r.stars} 보상: ${L.rewardLabel(r.reward, (k) => k === 'gold' ? '금화' : k === 'spirit_stone' ? '영기석' : k === 'yakgwa' ? '약과' : k === 'moon_petal' ? '월하 꽃잎' : k)}`);
          this.buildRegion();
        }
      }, can ? 'primary' : 'normal', 14);
      b.setEnabled(can);
      lay.add(b);
    });
  }

  private switchRegion(d: number) {
    const n = Phaser.Math.Clamp(this.region + d, 1, REGIONS.length);
    if (n === this.region) return;
    this.region = n;
    audio.play('select');
    const st = store.state;
    const open = this.regionStages.findIndex((s) => st.isUnlocked(s.id) && !st.data.stages[s.id]?.cleared);
    this.sel = open === -1 ? 0 : open;
    this.buildRegion();
    this.drawInfo();
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
      const stars = st.data.stages[id]?.stars ?? 1;
      c.add(txt(this, 0, 64, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, 14, '#e2b14c', { stroke: '#3a2a10', strokeThickness: 3 }).setOrigin(0.5));
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
    const s = this.regionStages[this.sel];
    const unlocked = st.isUnlocked(s.id);
    const rec = st.data.stages[s.id];
    const x = 60, y = 470;
    const p = panel(this, x - 14, y - 12, 720, 110, true);
    this.info.add(p);
    this.info.add(txt(this, x + 6, y + 2, `${s.name} ${s.id} · ${s.subtitle}`, 22, COLORS.textLight, { title: true }));
    this.info.add(txt(this, x + 6, y + 36, unlocked ? s.intro : '이전 구간을 돌파하면 열립니다.', 16, '#e8dcc4', { wordWrap: { width: 480 } }));
    const chests = s.chests.length;
    const stars = rec?.stars ?? (rec?.cleared ? 1 : 0);
    this.info.add(txt(this, x + 6, y + 70, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  보물 상자 ${rec?.chests.length ?? 0}/${chests}${rec?.bestTime ? `  ·  최고 기록 ${rec.bestTime.toFixed(1)}초` : ''}`, 15, '#e2b14c'));
    const go = button(this, x + 610, y + 44, 150, 62, '출발', () => this.start(), 'primary', 26);
    go.setEnabled(unlocked);
    this.info.add(go);
  }

  private drawMount() {
    const st = store.state;
    this.mountBox.removeAll(true);
    if (this.strip) { this.stripPos = this.strip.pos; this.strip.destroy(); this.strip = undefined; }
    const x0 = 810, y0 = 70, bw = 440;
    this.mountBox.add(panel(this, x0, y0, bw, 520));
    this.mountBox.add(sectionTitle(this, x0 + 44, y0 + 20, '함께할 영물', 24));
    const owned = st.rideableMounts();
    const m = st.active;
    const def = MOUNTS[m.id];
    // 큰 그림: 한지 카드 안에 맞춰 (튀어나오지 않게)
    this.mountBox.add(card(this, x0 + 24, y0 + 60, bw - 48, 198));
    const g = this.add.graphics();
    g.fillStyle(0xf3e2bd, 0.75).fillCircle(x0 + bw / 2, y0 + 150, 78);
    g.fillStyle(0xd9c39a, 0.35).fillEllipse(x0 + bw / 2, y0 + 246, 250, 18);
    this.mountBox.add(g);
    const img = fitInto(this.add.image(0, 0, ensurePortrait(this, m.id, m.stage, 'normal', m.skin)), x0 + bw / 2, y0 + 250, bw - 90, 176, 1.6);
    this.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    this.mountBox.add(img);
    this.mountBox.add(txt(this, x0 + bw / 2, y0 + 266, `${def.name} ${def.hanja}`, 24, COLORS.text, { title: true }).setOrigin(0.5, 0));
    this.mountBox.add(txt(this, x0 + bw / 2, y0 + 298, `${def.title} · ${def.stages[m.stage].name}`, 15, '#7a5a3a').setOrigin(0.5, 0));
    this.mountBox.add(txt(this, x0 + 36, y0 + 324, `Lv.${m.level}`, 20, COLORS.text, { title: true }));
    const b = bar(this, x0 + 110, y0 + 330, 290, 14, COLORS.exp);
    b.set(m.exp / expToNext(m.level));
    this.mountBox.add(b.g);
    const s = st.stats(m.id);
    this.mountBox.add(txt(this, x0 + 36, y0 + 354, `체력 ${s.maxHp} · 공격 ${s.atk} · 방어 ${s.def}`, 15, COLORS.text));
    this.mountBox.add(txt(this, x0 + 36, y0 + 376, def.stages[m.stage].abilities.join(' · '), 13, '#2f7f74', { wordWrap: { width: bw - 72 }, maxLines: 1 }));
    // 고르기 띠: 탈 수 있는 영물 모두 (손가락으로 좌우로 끌기, 눌러서 탑승)
    const TW = 84, GAP = 8;
    const strip = new ScrollArea(this, x0 + 24, y0 + 402, bw - 48, 70, { horizontal: true, start: this.stripPos ?? 0 });
    this.strip = strip;
    owned.forEach((o, i) => {
      const x = i * (TW + GAP);
      const on = o.id === m.id;
      const cd = card(this, x, 0, TW, 66, on ? 'sel' : 'normal');
      tap(cd, () => {
        if (st.data.activeMount === o.id) return;
        st.setActive(o.id);
        st.save();
        audio.play('select');
        this.drawMount();
      });
      strip.add(cd);
      strip.add(fitInto(this.add.image(0, 0, ensurePortrait(this, o.id, o.stage, 'normal', o.skin)), x + TW / 2, 62, TW - 10, 58, 1));
    });
    strip.setContentSize(owned.length * (TW + GAP) - GAP);
    if (this.stripPos === undefined) {
      const idx = owned.findIndex((o) => o.id === m.id);
      if (idx >= 0) strip.reveal(idx * (TW + GAP), TW);
    }
    this.mountBox.add(txt(this, x0 + 36, y0 + 488, `보유 ${st.ownedMounts().length} / ${Object.keys(MOUNTS).length}${owned.length > 3 ? ' · 끌어서 넘기기' : ''}`, 13, '#7a5a3a'));
    this.mountBox.add(button(this, x0 + bw - 120, y0 + 494, 184, 40, '영물 관리 · 진화', () => this.openMenu('stable'), 'normal', 16));
  }

  private start() {
    const s = this.regionStages[this.sel];
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
