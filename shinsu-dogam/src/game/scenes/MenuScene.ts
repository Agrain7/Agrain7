// 메뉴: 영물 / 도감 / 일일 / 수행록 / 원정 / 퀘스트 / 소지품 / 상점 / 설정
// 화면 구성: 한지 패널 + 알약 탭 + 단청 띠. 긴 목록은 모두 손가락으로 끌어 넘기는 목록(ScrollArea)이라 칸 밖으로 튀어나오지 않는다.
import Phaser from 'phaser';
import { txt, panel, button, bar, toast, confirmBox, card, fitInto, sectionTitle, tap, pill, setScrollsHidden, resetScrolls, type Pill } from '../../ui/widgets.ts';
import { ScrollArea, type ScrollOpts } from '../../ui/scroll.ts';
import { store } from '../ctx.ts';
import { MOUNTS, MOUNT_ORDER, SKILLS } from '../../data/mounts.ts';
import { ITEMS } from '../../data/items.ts';
import { QUESTS } from '../../data/quests.ts';
import { PRODUCTS } from '../../data/products.ts';
import { COSMETICS } from '../../data/cosmetics.ts';
import type { MountId, ProductCategory } from '../../data/types.ts';
import { expToNext, STONE_EXP } from '../../systems/state.ts';
import { ensurePortrait, ensureRider } from '../textures.ts';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { audio } from '../../systems/audio.ts';
import { payments, isLive } from '../../services/payment/PaymentService.ts';
import { syncWithServer } from '../../services/payment/returnHandler.ts';
import { applyPurchase, revokePurchase } from '../../systems/purchase.ts';
import RELEASE from '../../../release.config.json';
import { analytics } from '../../services/analytics/Analytics.ts';
import { overlayQueue } from '../overlayQueue.ts';
import * as L from '../../systems/live.ts';
import type { WorldScene } from './WorldScene.ts';

type Tab = 'stable' | 'codex' | 'daily' | 'pass' | 'expedition' | 'quests' | 'inventory' | 'shop' | 'settings';
const TABS: [Tab, string][] = [['stable', '영물'], ['codex', '도감'], ['daily', '일일'], ['pass', '수행록'], ['expedition', '원정'], ['quests', '퀘스트'], ['inventory', '소지품'], ['shop', '상점'], ['settings', '설정']];
const X0 = 50, Y0 = 34, W = GAME_W - 100, H = GAME_H - 68;
/** 탭 가운데 x (e2e 테스트도 이 위치를 누른다: X0 + 76 + i × 112, y = Y0 + 40) */
const tabX = (i: number) => X0 + 76 + i * 112;
/** 내용이 시작하는 높이 (탭 + 단청 띠 아래) */
const TOP = Y0 + 92;
const INK = '#3a2a22', SUB = '#7a5a3a', SOFT = '#5a4a3a', RED = '#b8322a', JADE = '#2f7f74';

export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'stable';
  private from = 'Map';
  private content!: Phaser.GameObjects.Container;
  private tabBtns: Pill[] = [];
  private selMount: MountId = 'wolf';
  private codexSel: MountId | null = null;
  private shopCat: ProductCategory = 'skin';
  private dots!: Phaser.GameObjects.Container;
  /** 이번 화면의 끌어 넘기는 목록들 (다시 그릴 때 위치를 기억했다가 이어서) */
  private areas = new Map<string, ScrollArea>();
  private keep: Record<string, number> = {};
  /** 1초마다 갱신할 것 (원정 남은 시간) — 목록을 다시 만들지 않아 끌던 손가락이 끊기지 않게 */
  private ticks: (() => boolean)[] = [];
  private dayKey = '';

  constructor() {
    super('Menu');
  }

  init(data: { tab?: Tab; from?: string }) {
    this.tab = data.tab ?? 'stable';
    this.from = data.from ?? 'Map';
    this.selMount = store.state.data.activeMount;
    this.codexSel = null;
    this.keep = {};
    this.areas = new Map();
  }

  create() {
    // 플레이 중 HUD(월드가 맨 위로 올려 둠) 위에 그려지도록 — 연출(Overlay)만 더 위
    this.scene.bringToTop();
    if (this.scene.get('Overlay')) this.scene.bringToTop('Overlay');
    resetScrolls(this);
    this.events.once('shutdown', () => { for (const a of this.areas.values()) a.destroy(); this.areas.clear(); });
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0912, 0.6).setOrigin(0).setInteractive();
    panel(this, X0, Y0, W, H);
    // 단청 띠 (탭 아래 처마선)
    this.add.tileSprite(X0 + 18, Y0 + 70, W - 36, 22, 'ui_dancheong').setOrigin(0).setScale(1, 0.62);
    this.tabBtns = TABS.map(([t, label], i) => pill(this, tabX(i), Y0 + 40, 104, label, t === this.tab, () => this.switchTab(t), 17));
    // 닫기: 붉은 낙관 (플레이 중이면 계속하기)
    const seal = this.add.image(X0 + W - 46, Y0 + 40, 'ui_seal').setScale(0.82);
    tap(seal, () => { audio.play('select'); this.close(); });
    seal.on('pointerover', () => seal.setScale(0.88));
    seal.on('pointerout', () => seal.setScale(0.82));
    if (this.from === 'World') {
      // 플레이 중: 낙관 = 계속하기, 옆의 작은 단추 = 지도로 나가기
      button(this, X0 + W - 112, Y0 + 40, 76, 36, '지도로', () => {
        confirmBox(this, '이 구간을 그만두고 지도로 나갈까요?\n(획득한 경험치·아이템은 저장됩니다)', () => {
          store.state.save();
          this.scene.stop('Hud');
          this.scene.stop('World');
          this.scene.stop();
          this.scene.start('Map');
        });
      }, 'normal', 14);
    } else txt(this, X0 + W - 80, Y0 + 40, '닫기', 15, SUB, { title: true }).setOrigin(1, 0.5);
    // 빨간 점 (받을 보상)
    this.dots = this.add.container(0, 0).setDepth(5);
    // 원정 남은 시간·날짜 바뀜
    this.dayKey = new Date().toDateString();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      let again = false;
      for (const f of this.ticks) again = f() || again;
      const dk = new Date().toDateString();
      if (dk !== this.dayKey) { this.dayKey = dk; again = true; }
      if (again) this.render();
    } });
    this.content = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    if (this.tab === 'shop') analytics.track('shop_view', { from: this.from });
    this.render();
  }

  private switchTab(t: Tab) {
    if (t === this.tab && !this.codexSel) return;
    this.tab = t;
    this.codexSel = null;
    TABS.forEach(([tt], i) => this.tabBtns[i].setActive2(tt === t));
    if (t === 'shop') analytics.track('shop_view', { from: this.from });
    this.render();
  }

  private close() {
    store.state.save();
    const world = this.scene.get('World') as WorldScene;
    if (this.from === 'World') {
      world.player?.rebuild();
      this.scene.resume('World');
      this.scene.resume('Hud');
    } else {
      this.scene.resume(this.from);
    }
    this.scene.stop();
  }

  private render() {
    for (const [k, a] of this.areas) { this.keep[k] = a.pos; a.destroy(); }
    this.areas.clear();
    this.ticks = [];
    this.content.removeAll(true);
    const c = this.content;
    const st = store.state;
    st.updateQuests();
    switch (this.tab) {
      case 'stable': this.renderStable(c); break;
      case 'codex': this.codexSel ? this.renderCodexDetail(c, this.codexSel) : this.renderCodex(c); break;
      case 'quests': this.renderQuests(c); break;
      case 'inventory': this.renderInventory(c); break;
      case 'shop': this.renderShop(c); break;
      case 'settings': this.renderSettings(c); break;
      case 'daily': this.renderDaily(c); break;
      case 'pass': this.renderPass(c); break;
      case 'expedition': this.renderExpedition(c); break;
    }
    this.drawDots();
  }

  /** 끌어 넘기는 목록 만들기 (탭·이름별로 위치 기억) */
  private area(name: string, x: number, y: number, w: number, h: number, opts: ScrollOpts = {}) {
    const key = `${this.tab}:${name}`;
    const remembered = this.keep[key];
    const a = new ScrollArea(this, x, y, w, h, { ...opts, start: remembered ?? opts.start ?? 0 });
    this.areas.set(key, a);
    return { a, fresh: remembered === undefined };
  }

  private t(c: Phaser.GameObjects.Container, x: number, y: number, s: string, size = 18, color: string = INK, opts: Parameters<typeof txt>[6] = {}) {
    const o = txt(this, x, y, s, size, color, opts);
    c.add(o);
    return o;
  }

  /** 영물 그림을 상자에 맞춰 넣기 (가운데 아래 기준, 튀어나오지 않게) */
  private portrait(c: Phaser.GameObjects.Container, id: MountId, stage: number, cx: number, bottom: number, maxW: number, maxH: number, mode: 'normal' | 'silhouette' = 'normal', skin?: string) {
    const key = ensurePortrait(this, id, stage, mode, skin);
    const img = fitInto(this.add.image(0, 0, key), cx, bottom, maxW, maxH, 2);
    c.add(img);
    return img;
  }

  /** 작은 표찰 (탑승·원정·한정 등) */
  private tag(c: Phaser.GameObjects.Container, x: number, y: number, s: string, color = 0xb8322a) {
    const t = txt(this, x, y, s, 12, '#fff6e4', { title: true }).setOrigin(1, 0);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - t.width - 14, y - 3, t.width + 14, t.height + 6, 8);
    t.setX(x - 7);
    c.add([g, t]);
    return t;
  }

  private title(c: Phaser.GameObjects.Container, s: string, sub?: string, x = X0 + 44, y = TOP) {
    c.add(sectionTitle(this, x, y, s, 28, sub));
  }

  // ---------------- 영물 관리 ----------------
  private renderStable(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const owned = st.ownedMounts();
    if (!st.owns(this.selMount)) this.selMount = st.data.activeMount;
    // 왼쪽: 보유 영물 목록 (끌어 넘기기)
    const ROW = 98;
    const { a: list, fresh } = this.area('list', X0 + 26, Y0 + 96, 258, H - 118);
    owned.forEach((m, i) => {
      const y = i * ROW;
      const sel = m.id === this.selMount;
      const cd = card(this, 0, y, 250, 90, sel ? 'sel' : 'normal');
      tap(cd, () => { if (this.selMount === m.id) return; this.selMount = m.id; audio.play('select'); this.render(); });
      list.add(cd);
      this.portrait(list.content, m.id, m.stage, 54, y + 84, 92, 74, 'normal', m.skin);
      this.t(list.content, 106, y + 16, MOUNTS[m.id].name, 20, INK, { title: true });
      this.t(list.content, 106, y + 48, `Lv.${m.level} · ${MOUNTS[m.id].stages[m.stage].name}`, 14, SOFT);
      if (m.id === st.data.activeMount) this.tag(list.content, 240, y + 10, '탑승');
      else if (st.data.expeditions[m.id]) this.tag(list.content, 240, y + 10, '원정', 0x5a4a7a);
    });
    this.t(list.content, 6, owned.length * ROW + 2, `보유 ${owned.length} / ${MOUNT_ORDER.length} · 모두 보기는 도감`, 13, SUB);
    list.setContentSize(owned.length * ROW + 26);
    const idx = owned.findIndex((m) => m.id === this.selMount);
    if (fresh && idx >= 0) list.reveal(idx * ROW, 90);

    // 가운데: 상세
    const m = st.data.mounts[this.selMount]!;
    const def = MOUNTS[m.id];
    const sd = def.stages[m.stage];
    const dx = X0 + 306, dw = 476;
    this.t(c, dx, TOP - 4, `${def.name} ${def.hanja}`, 30, INK, { title: true });
    this.t(c, dx, TOP + 38, `${def.title} · ${def.element} 속성 · ${sd.name}`, 15, SUB);
    c.add(card(this, dx, Y0 + 160, dw, 228));
    const g = this.add.graphics();
    g.fillStyle(0xf3e2bd, 0.75).fillCircle(dx + dw / 2, Y0 + 262, 88);
    g.fillStyle(0xd9c39a, 0.35).fillEllipse(dx + dw / 2, Y0 + 372, 300, 22);
    c.add(g);
    this.portrait(c, m.id, m.stage, dx + dw / 2, Y0 + 378, dw - 50, 198, 'normal', m.skin);
    this.t(c, dx, Y0 + 402, `Lv.${m.level}`, 22, INK, { title: true });
    const eb = bar(this, dx + 82, Y0 + 409, 290, 14, COLORS.exp);
    eb.set(m.exp / expToNext(m.level));
    c.add(eb.g);
    this.t(c, dx + 384, Y0 + 405, `${m.exp} / ${expToNext(m.level)}`, 14, SOFT);
    const s = st.stats(m.id);
    ([['체력', s.maxHp], ['공격', s.atk], ['방어', s.def]] as const).forEach(([k, v], i) => {
      c.add(card(this, dx + i * 160, Y0 + 436, 150, 38));
      this.t(c, dx + i * 160 + 75, Y0 + 455, `${k}  ${v}`, 16, INK, { title: true }).setOrigin(0.5);
    });
    let y = Y0 + 488;
    for (const [label, sk] of [['기본 공격', SKILLS[sd.attack]], ['특수 기술', SKILLS[sd.special]]] as const) {
      const h = this.t(c, dx, y, `${label} · ${sk.name}`, 15, RED, { title: true });
      y += h.height + 2;
      const d = this.t(c, dx, y, sk.desc, 14, SOFT, { wordWrap: { width: dw } });
      y += d.height + 8;
    }
    this.t(c, dx, y, `이동  ${sd.abilities.join(' · ')}`, 14, JADE, { wordWrap: { width: dw } });

    // 오른쪽: 탑승·진화·수련·꾸미기 (끌어 넘기기)
    const RW = 336;
    const { a: side } = this.area('side', X0 + 806, Y0 + 96, RW + 6, H - 118);
    const sc = side.content;
    let sy = 0;
    if (m.id !== st.data.activeMount) {
      const rb = button(this, RW / 2, sy + 28, RW, 54, st.data.expeditions[m.id] ? '원정 중 (원정 탭)' : '이 영물에 탑승', () => {
        if (!st.setActive(m.id)) { toast(this, '원정 중인 영물은 돌아온 뒤에 탈 수 있어요'); return; }
        st.save();
        this.render();
      }, 'primary', 19);
      rb.setEnabled(!st.data.expeditions[m.id]);
      sc.add(rb);
    } else {
      sc.add(card(this, 0, sy, RW, 56, 'sel'));
      this.t(sc, RW / 2, sy + 28, '현재 탑승 중', 19, RED, { title: true }).setOrigin(0.5);
    }
    sy += 68;
    // 진화
    const ce = st.canEvolve(m.id);
    if (m.stage < 2) {
      const next = def.stages[m.stage + 1];
      sc.add(card(this, 0, sy, RW, 156));
      this.t(sc, 16, sy + 14, `진화 · ${next.name}`, 19, INK, { title: true });
      this.t(sc, RW - 16, sy + 18, `Lv.${next.minLevel}`, 15, m.level >= next.minLevel ? JADE : RED, { title: true }).setOrigin(1, 0);
      const ss = st.count('spirit_stone') >= next.evolveCost!.spiritStone, gg = st.count('gold') >= next.evolveCost!.gold;
      this.t(sc, 16, sy + 48, `영기석 ${next.evolveCost!.spiritStone}  (보유 ${st.count('spirit_stone')})`, 14, ss ? SOFT : RED);
      this.t(sc, 16, sy + 70, `금화 ${next.evolveCost!.gold}  (보유 ${st.count('gold')})`, 14, gg ? SOFT : RED);
      const eb2 = button(this, RW / 2, sy + 122, RW - 32, 46, ce.ok ? '진화하기' : ce.reason === 'level' ? `Lv.${next.minLevel} 필요` : '재료 부족', () => {
        if (st.evolve(m.id)) {
          st.save();
          overlayQueue.push({ type: 'evolve', mount: m.id, stage: m.stage });
          if (!this.scene.isActive('Overlay')) this.scene.launch('Overlay');
          this.scene.bringToTop('Overlay');
          this.render();
        }
      }, 'primary', 18);
      eb2.setEnabled(ce.ok);
      sc.add(eb2);
      sy += 168;
    } else {
      sc.add(card(this, 0, sy, RW, 60));
      this.t(sc, RW / 2, sy + 30, '각성체 — 최고 단계', 18, RED, { title: true }).setOrigin(0.5);
      sy += 72;
    }
    // 수련
    sc.add(card(this, 0, sy, RW, 118));
    this.t(sc, 16, sy + 14, '영기석 수련', 19, INK, { title: true });
    this.t(sc, RW - 16, sy + 18, `1개당 경험 ${STONE_EXP} · 보유 ${st.count('spirit_stone')}`, 13, SUB).setOrigin(1, 0);
    const tr = (n: number) => () => {
      const ups = st.train(m.id, n);
      audio.play(ups ? 'levelup' : 'coin');
      st.save();
      this.render();
    };
    const b1 = button(this, RW / 2 - 78, sy + 78, 146, 44, '1개 사용', tr(1), 'normal', 17);
    const b5 = button(this, RW / 2 + 78, sy + 78, 146, 44, '5개 사용', tr(5), 'normal', 17);
    b1.setEnabled(st.count('spirit_stone') >= 1);
    b5.setEnabled(st.count('spirit_stone') >= 5);
    sc.add([b1, b5]);
    sy += 130;
    // 스킨
    const skins = Object.values(COSMETICS).filter((x) => x.kind === 'skin' && x.mount === m.id && st.ownsCosmetic(x.id));
    const skRows = Math.max(1, Math.ceil(skins.length / 2));
    sc.add(card(this, 0, sy, RW, 54 + skRows * 50));
    this.t(sc, 16, sy + 14, '스킨', 19, INK, { title: true });
    if (!skins.length) {
      this.t(sc, 16, sy + 54, '보유한 스킨이 없어요', 14, SUB);
      const go = button(this, RW - 70, sy + 62, 112, 36, '상점 보기', () => { this.shopCat = 'skin'; this.switchTab('shop'); }, 'normal', 14);
      sc.add(go);
    }
    skins.forEach((sk, i) => {
      const on = m.skin === sk.id;
      sc.add(button(this, 16 + 74 + (i % 2) * 156, sy + 72 + Math.floor(i / 2) * 50, 148, 42, `${on ? '✓ ' : ''}${sk.name}`, () => { st.equip(sk.id); st.save(); this.render(); }, on ? 'primary' : 'normal', 14));
    });
    sy += 54 + skRows * 50 + 12;
    // 장식·의상
    const decos = Object.values(COSMETICS).filter((x) => (x.kind === 'decor' || x.kind === 'trail' || x.kind === 'outfit') && st.ownsCosmetic(x.id));
    const dRows = Math.max(1, Math.ceil(decos.length / 2));
    sc.add(card(this, 0, sy, RW, 54 + dRows * 48));
    this.t(sc, 16, sy + 14, '장식 · 의상', 19, INK, { title: true });
    if (!decos.length) this.t(sc, 16, sy + 54, '보유한 장식이 없어요 (상점)', 14, SUB);
    decos.forEach((d, i) => {
      const on = st.data.cosmetics.outfit === d.id || st.data.cosmetics.decor.includes(d.id) || st.data.cosmetics.trail === d.id;
      sc.add(button(this, 16 + 74 + (i % 2) * 156, sy + 72 + Math.floor(i / 2) * 48, 148, 40, `${on ? '✓ ' : ''}${d.name}`, () => {
        st.equip(d.id);
        if (d.kind === 'outfit') ensureRider(this, d.id);
        st.save();
        this.render();
      }, on ? 'primary' : 'normal', 13));
    });
    sy += 54 + dRows * 48 + 8;
    side.setContentSize(sy);
  }

  // ---------------- 도감 ----------------
  private renderCodex(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const comp = st.codexCompletion();
    this.title(c, '영물 도감', '靈物圖鑑');
    this.t(c, X0 + 782, TOP + 10, `수집 ${comp.owned}/${comp.total} · 성장 기록 ${comp.stagesSeen}/${comp.stagesTotal} · 완성률 ${comp.pct}%`, 15, SUB).setOrigin(1, 0);
    const { a: grid } = this.area('grid', X0 + 26, Y0 + 134, 760, H - 156);
    const CW = 242, CH = 152;
    MOUNT_ORDER.forEach((id, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = col * (CW + 10), y = row * (CH + 10);
      const owned = st.owns(id);
      const def = MOUNTS[id];
      const cd = card(this, x, y, CW, CH, owned ? 'normal' : 'lock');
      tap(cd, () => { this.codexSel = id; audio.play('select'); this.render(); });
      grid.add(cd);
      const m = st.data.mounts[id];
      this.portrait(grid.content, id, owned ? m!.stage : 2, x + CW / 2, y + 116, CW - 24, 104, owned ? 'normal' : 'silhouette', m?.skin);
      this.t(grid.content, x + 14, y + 122, owned ? `${def.name} ${def.hanja}` : `??? · ${def.symbol}`, 16, owned ? INK : '#7a6a5a', { title: true });
      if (owned) this.t(grid.content, x + CW - 12, y + 125, `Lv.${m!.level}`, 13, RED).setOrigin(1, 0);
      else this.tag(grid.content, x + CW - 10, y + 10, def.obtainable ? '획득 가능' : '추후', def.obtainable ? 0x2f7f74 : 0x8a7a6a);
    });
    grid.setContentSize(Math.ceil(MOUNT_ORDER.length / 3) * (CH + 10));
    // 업적
    c.add(sectionTitle(this, X0 + 826, TOP + 2, '수집 업적', 22));
    const { a: ach } = this.area('ach', X0 + 812, Y0 + 134, 336, H - 156);
    const achs = st.achievements();
    achs.forEach((a, i) => {
      const y = i * 70;
      ach.add(card(this, 0, y, 328, 62, a.done ? 'sel' : 'normal'));
      this.t(ach.content, 14, y + 10, `${a.done ? '◆' : '◇'} ${a.name}`, 17, a.done ? RED : '#7a6a5a', { title: true });
      this.t(ach.content, 32, y + 36, a.desc, 13, SOFT);
    });
    this.t(ach.content, 6, achs.length * 70 + 4, `고서 조각 ${st.data.lorePages.length}장 수집`, 14, SUB);
    ach.setContentSize(achs.length * 70 + 30);
  }

  private renderCodexDetail(c: Phaser.GameObjects.Container, id: MountId) {
    const st = store.state;
    const def = MOUNTS[id];
    const m = st.data.mounts[id];
    const owned = !!m;
    c.add(button(this, X0 + 104, TOP + 18, 132, 42, '← 목록', () => { this.codexSel = null; this.render(); }, 'normal', 16));
    this.t(c, X0 + 194, TOP - 4, owned ? `${def.name} ${def.hanja}` : `미확인 영물 · ${def.symbol}`, 30, INK, { title: true });
    this.t(c, X0 + 194, TOP + 36, owned ? `${def.title} · ${def.category === 'legend' ? '전설 영물' : '기본 영물'} · ${def.element} 속성 · 상징 ${def.symbol}` : '아직 만나지 못한 영물입니다.', 15, SUB);
    // 3단계 비교
    const CW = 360;
    [0, 1, 2].forEach((s) => {
      const x = X0 + 30 + s * (CW + 20);
      const seen = owned && m!.stage >= s;
      c.add(card(this, x, Y0 + 162, CW, 300, seen ? 'normal' : 'lock'));
      this.portrait(c, id, s, x + CW / 2, Y0 + 368, CW - 30, 192, seen ? 'normal' : 'silhouette', seen ? m?.skin : undefined);
      const sd = def.stages[s];
      this.t(c, x + CW / 2, Y0 + 376, `${sd.name} · Lv.${sd.minLevel}`, 19, seen ? INK : '#8a7a6a', { title: true }).setOrigin(0.5, 0);
      if (seen || (owned && s === m!.stage + 1)) {
        const ab = this.t(c, x + CW / 2, Y0 + 404, sd.abilities.join(' · '), 13, SOFT, { align: 'center', wordWrap: { width: CW - 30 } }).setOrigin(0.5, 0);
        this.t(c, x + CW / 2, Y0 + 408 + ab.height, `${SKILLS[sd.attack].name} / ${SKILLS[sd.special].name}`, 13, '#8a3a2a', { align: 'center' }).setOrigin(0.5, 0);
      } else this.t(c, x + CW / 2, Y0 + 406, '???', 16, '#8a7a6a').setOrigin(0.5, 0);
      if (s < 2) this.t(c, x + CW + 10, Y0 + 300, '›', 34, '#a07a4a').setOrigin(0.5);
    });
    // 이야기·획득·성장 기록 (길면 끌어 넘기기)
    const { a: lore } = this.area(`lore:${id}`, X0 + 34, Y0 + 476, W - 76, H - 494);
    let y = 0;
    const add = (s: string, size: number, color: string) => { const o = this.t(lore.content, 0, y, s, size, color, { wordWrap: { width: W - 90 }, lineSpacing: 4 }); y += o.height + 8; };
    add(owned ? `이야기 — ${def.lore}` : `획득 방법 — ${def.acquisition}`, 15, INK);
    if (owned) {
      add(`획득 방법 — ${def.acquisition}`, 14, SOFT);
      const hist = m!.history.map((h) => `${def.stages[h.stage].name} ${new Date(h.at).toLocaleDateString('ko-KR')} (Lv.${h.level})`).join('  →  ');
      add(`성장 기록 — ${hist}`, 14, SOFT);
    } else if (!def.obtainable) add('이 영물은 다음 지역 업데이트에서 만날 수 있습니다. (현재 빌드에서는 획득 불가)', 14, '#8a3a2a');
    lore.setContentSize(y);
    analytics.track('codex_entry', { mount: id, view: true });
  }

  // ---------------- 빨간 점 ----------------
  private drawDots() {
    if (!this.dots) return;
    this.dots.removeAll(true);
    const st = store.state;
    const cl = L.claimables(st);
    const quest = QUESTS.some((q) => st.data.quests[q.id]?.done && !st.data.quests[q.id]?.claimed) ? 1 : 0;
    const n: Partial<Record<Tab, number>> = { daily: cl.daily, pass: cl.pass, expedition: cl.expedition, quests: quest };
    TABS.forEach(([t], i) => {
      if (!n[t]) return;
      this.dots.add(this.add.circle(tabX(i) + 44, Y0 + 22, 7, 0xd63c34).setStrokeStyle(2, 0xfff6e4));
    });
  }

  private rewardText(r: L.Reward) {
    return L.rewardLabel(r, (id) => ITEMS[id]?.name ?? COSMETICS[id]?.name ?? id);
  }

  // ---------------- 일일: 출석 · 오늘의 임무 · 달빛 정기권 ----------------
  private renderDaily(c: Phaser.GameObjects.Container) {
    const st = store.state;
    L.ensureDaily(st);
    this.title(c, '출석', '7일 · 하루 한 번 · 빠진 날이 있어도 이어서');
    const can = L.canClaimLogin(st);
    const cur = st.data.daily.loginDays % 7;
    L.LOGIN_REWARDS.forEach((r, i) => {
      const x = X0 + 30 + i * 160, y = Y0 + 142;
      const got = i < cur, today = i === cur;
      c.add(card(this, x, y, 150, 134, today && can ? 'sel' : got ? 'lock' : 'normal'));
      this.t(c, x + 75, y + 14, `${i + 1}일째`, 18, i === 6 ? RED : INK, { title: true }).setOrigin(0.5, 0);
      this.t(c, x + 75, y + 46, this.rewardText(r), 14, INK, { align: 'center', wordWrap: { width: 132 } }).setOrigin(0.5, 0);
      if (got) this.t(c, x + 75, y + 104, '✓ 받음', 15, JADE, { title: true }).setOrigin(0.5, 0);
      else if (today && can) this.t(c, x + 75, y + 104, '오늘', 15, RED, { title: true }).setOrigin(0.5, 0);
    });
    const lb = button(this, X0 + W - 150, Y0 + 100, 220, 44, can ? '오늘 출석 보상 받기' : '내일 또 만나요', () => {
      if (L.claimLogin(st) >= 0) { st.save(); audio.play('chest'); toast(this, '출석 보상을 받았어요!'); }
      this.render();
    }, 'primary', 17);
    lb.setEnabled(can);
    c.add(lb);

    // 오늘의 임무
    const my = Y0 + 300;
    c.add(sectionTitle(this, X0 + 44, my, '오늘의 임무', 24, '자정에 새 임무 · 하나마다 금화 120 + 수행록 경험 100'));
    st.data.daily.missions.forEach((m, i) => {
      const def = L.MISSIONS.find((x) => x.id === m.id)!;
      const y = my + 46 + i * 60;
      const prog = L.missionProgress(st, m);
      const done = prog >= def.target;
      c.add(card(this, X0 + 30, y, 774, 52, m.claimed ? 'lock' : done ? 'sel' : 'normal'));
      this.t(c, X0 + 48, y + 14, `${m.claimed ? '✓' : done ? '★' : '·'} ${def.name}`, 18, INK, { title: true });
      this.t(c, X0 + 220, y + 17, def.desc, 14, SOFT);
      const b = bar(this, X0 + 470, y + 20, 170, 12, COLORS.exp);
      b.set(prog / def.target);
      c.add(b.g);
      this.t(c, X0 + 650, y + 15, `${prog}/${def.target}`, 14, INK);
      if (!m.claimed && done) c.add(button(this, X0 + 748, y + 26, 92, 36, '받기', () => { L.claimMission(st, m.id); st.save(); audio.play('chest'); this.render(); }, 'primary', 15));
    });
    const by = my + 46 + 3 * 60 + 4;
    this.t(c, X0 + 48, by + 8, `모두 완료 보너스 — ${this.rewardText(L.MISSION_BONUS)} + 수행록 경험 150`, 15, SUB);
    if (L.canClaimBonus(st)) c.add(button(this, X0 + 748, by + 18, 92, 36, '받기', () => { L.claimBonus(st); st.save(); audio.play('chest'); this.render(); }, 'primary', 15));
    else if (st.data.daily.bonusClaimed) this.t(c, X0 + 720, by + 8, '✓ 받음', 15, JADE);

    // 달빛 정기권
    const px = X0 + 830, py = Y0 + 300, pw = 322;
    c.add(card(this, px, py, pw, 270, 'dark'));
    const moon = this.add.graphics();
    moon.fillStyle(0xffe6a6, 0.18).fillCircle(px + pw - 54, py + 54, 34);
    c.add(moon);
    this.t(c, px + pw / 2, py + 18, '달빛 정기권', 24, '#ffe6a6', { title: true }).setOrigin(0.5, 0);
    const active = L.monthlyActive(st);
    this.t(c, px + pw / 2, py + 60, active ? `남은 기간 ${L.monthlyDaysLeft(st)}일` : '30일 동안 매일 접속하면', 15, '#f6ead0').setOrigin(0.5, 0);
    this.t(c, px + pw / 2, py + 88, `매일 ${this.rewardText(L.MONTHLY.daily)}`, 17, '#ffe6a6', { title: true }).setOrigin(0.5, 0);
    this.t(c, px + pw / 2, py + 120, active ? '오늘 받을 수 있어요' : `구매 즉시 ${this.rewardText(L.MONTHLY.instant)}`, 14, '#c8c0d8').setOrigin(0.5, 0);
    if (active) {
      const mb = button(this, px + pw / 2, py + 214, 210, 46, L.canClaimMonthly(st) ? '오늘 몫 받기' : '✓ 오늘 받음', () => { if (L.claimMonthly(st)) { st.save(); audio.play('chest'); } this.render(); }, 'primary', 17);
      mb.setEnabled(L.canClaimMonthly(st));
      c.add(mb);
    } else c.add(button(this, px + pw / 2, py + 214, 236, 46, '4,900원 · 상점에서 보기', () => { this.shopCat = 'pass'; this.switchTab('shop'); }, 'primary', 16));
  }

  // ---------------- 영물 수행록 (시즌 패스) — 30단계를 가로로 끌어 넘기기 ----------------
  private renderPass(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const p = st.data.pass;
    const lv = L.passLevel(p.xp);
    this.title(c, L.PASS.name);
    this.t(c, X0 + 44, TOP + 44, `${lv} / ${L.PASS.levels} 단계`, 22, RED, { title: true });
    const xpIn = lv >= L.PASS.levels ? L.PASS.xpPerLevel : p.xp - lv * L.PASS.xpPerLevel;
    const b = bar(this, X0 + 200, TOP + 51, 320, 14, COLORS.exp);
    b.set(xpIn / L.PASS.xpPerLevel);
    c.add(b.g);
    this.t(c, X0 + 532, TOP + 47, `${xpIn} / ${L.PASS.xpPerLevel}`, 14, SOFT);
    this.t(c, X0 + 44, TOP + 78, '경험: 구간 돌파 120(재도전 60) · 보스 정화 300 · 일일 임무 100 · 출석 50', 13, SUB);
    if (!p.premium) c.add(button(this, X0 + W - 176, TOP + 22, 300, 50, '프리미엄 열기 · 9,900원', () => this.buy('p_pass_premium'), 'primary', 18));
    else this.t(c, X0 + W - 40, TOP + 8, '★ 프리미엄 열림', 22, RED, { title: true }).setOrigin(1, 0);
    const all = button(this, X0 + W - 110, TOP + 78, 170, 40, '모두 받기', () => {
      let n = 0;
      for (let i = 1; i <= lv; i++) { if (L.claimPass(st, 'free', i)) n++; if (L.claimPass(st, 'prem', i)) n++; }
      if (n) { st.save(); audio.play('chest'); toast(this, `보상 ${n}개를 받았어요`); }
      this.render();
    }, 'normal', 16);
    all.setEnabled(L.passClaimable(st) > 0);
    c.add(all);
    // 단계 칸들
    const COL = 106, top = Y0 + 214;
    this.t(c, X0 + 44, top + 30 + 62, '무료', 18, INK, { title: true });
    this.t(c, X0 + 44, top + 186 + 62, '프리미엄', 18, RED, { title: true });
    const { a: lane, fresh } = this.area('lane', X0 + 136, top, W - 166, 338, { horizontal: true });
    for (let k = 0; k < L.PASS.levels; k++) {
      const L1 = k + 1;
      const x = k * COL;
      const reached = L1 <= lv;
      this.t(lane.content, x + 49, 0, `${L1}`, 18, reached ? RED : '#8a7a6a', { title: true }).setOrigin(0.5, 0);
      for (const [track, ty] of [['free', 30], ['prem', 186]] as const) {
        const r = track === 'free' ? L.passFree(L1) : L.passPremium(L1);
        const got = (track === 'free' ? p.free : p.prem).includes(L1);
        const locked = track === 'prem' && !p.premium;
        lane.add(card(this, x, ty, 98, 146, got || locked ? 'lock' : r.cosmetics ? 'sel' : 'normal'));
        this.t(lane.content, x + 49, ty + 12, this.rewardText(r), 12, locked ? '#9a8a7a' : INK, { align: 'center', wordWrap: { width: 86 } }).setOrigin(0.5, 0);
        if (got) this.t(lane.content, x + 49, ty + 112, '✓', 20, JADE).setOrigin(0.5, 0);
        else if (locked) this.t(lane.content, x + 49, ty + 112, '🔒', 16, SUB).setOrigin(0.5, 0);
        else if (reached) lane.add(button(this, x + 49, ty + 122, 80, 32, '받기', () => { if (L.claimPass(st, track, L1)) { st.save(); audio.play('chest'); } this.render(); }, 'primary', 14));
      }
    }
    lane.setContentSize(L.PASS.levels * COL - 8);
    if (fresh) lane.reveal(Math.max(0, lv - 2) * COL, COL);
    this.t(c, X0 + W / 2 + 60, Y0 + H - 40, '‹  끌어서 넘겨 보기  ›', 14, '#9a7a5a').setOrigin(0.5, 0);
  }

  // ---------------- 영물 원정 ----------------
  private renderExpedition(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.title(c, '영물 원정', `쉬는 영물을 보내면 게임을 꺼 두어도 금화·영기석·경험을 가져와요 (동시에 ${L.MAX_EXPEDITIONS}마리)`);
    const owned = st.ownedMounts();
    const { a: grid } = this.area('grid', X0 + 26, Y0 + 134, W - 58, H - 156);
    const CW = 364, CH = 156;
    owned.forEach((m, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = col * (CW + 10), y = row * (CH + 10);
      const def = MOUNTS[m.id];
      const e = st.data.expeditions[m.id];
      grid.add(card(this, x, y, CW, CH, e ? 'sel' : 'normal'));
      this.portrait(grid.content, m.id, m.stage, x + 70, y + CH - 14, 120, 110, 'normal', m.skin);
      this.t(grid.content, x + 140, y + 12, `${def.name}  Lv.${m.level}`, 19, INK, { title: true });
      if (e) {
        const ex = L.EXPEDITIONS.find((x2) => x2.hours === e.hours);
        this.t(grid.content, x + 140, y + 42, `원정 중 · ${ex?.name ?? ''} (${e.hours}시간)`, 14, '#5a4a7a');
        const left0 = L.expeditionLeftMs(st, m.id);
        if (left0 > 0) {
          const fmt = (left: number) => { const hh = Math.floor(left / 3600_000), mm = Math.floor((left % 3600_000) / 60_000), ss = Math.floor((left % 60_000) / 1000); return `남은 시간 ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };
          const tt = this.t(grid.content, x + 140, y + 72, fmt(left0), 20, INK, { title: true });
          this.ticks.push(() => { const l = L.expeditionLeftMs(st, m.id); if (l <= 0) return true; tt.setText(fmt(l)); return false; });
        } else {
          const r = L.expeditionReward(m.level, e.hours);
          this.t(grid.content, x + 140, y + 70, `돌아왔어요! 금화 ${r.gold} · 영기석 ${r.stones} · 경험 ${r.exp}`, 14, JADE, { wordWrap: { width: 212 } });
          grid.add(button(this, x + 286, y + 128, 120, 38, '보상 받기', () => {
            const got = L.claimExpedition(st, m.id);
            if (got) { st.save(); audio.play('chest'); toast(this, `${def.name}이(가) 돌아왔다! 금화 ${got.gold} · 영기석 ${got.stones}`); }
            this.render();
          }, 'primary', 15));
        }
      } else {
        const why = L.canStartExpedition(st, m.id);
        this.t(grid.content, x + 140, y + 42, why ?? '어디로 보낼까요?', 14, why ? '#9a5a4a' : SOFT, { wordWrap: { width: 212 } });
        if (!why) L.EXPEDITIONS.forEach((ex, k) => {
          const r = L.expeditionReward(m.level, ex.hours);
          grid.add(button(this, x + 174 + k * 66, y + 94, 60, 38, `${ex.hours}시간`, () => {
            if (L.startExpedition(st, m.id, ex.hours)) { st.save(); audio.play('select'); toast(this, `${def.name} 원정 출발! (${ex.name})`); }
            this.render();
          }, 'normal', 13));
          if (k === 2) this.t(grid.content, x + 140, y + 124, `8시간: 금화 ${r.gold} · 영기석 ${r.stones}`, 12, SUB);
        });
      }
    });
    grid.setContentSize(Math.ceil(owned.length / 3) * (CH + 10));
  }

  // ---------------- 퀘스트 (받을 것 → 진행 중 → 잠김 → 끝낸 것 순) ----------------
  private renderQuests(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const doneN = QUESTS.filter((q) => st.data.quests[q.id]?.claimed).length;
    this.title(c, '퀘스트', `완료 ${doneN} / ${QUESTS.length}`);
    const rank = (q: (typeof QUESTS)[number]) => { const r = st.data.quests[q.id]; return r?.done && !r.claimed ? 0 : r?.claimed ? 3 : st.questAvailable(q) ? 1 : 2; };
    const list = [...QUESTS].sort((a, b) => rank(a) - rank(b));
    const RW = W - 70, ROW = 66;
    const { a: lst } = this.area('list', X0 + 26, Y0 + 134, RW + 8, H - 156);
    const lc = lst.content;
    list.forEach((q, i) => {
      const y = i * ROW;
      const rec = st.data.quests[q.id];
      const avail = st.questAvailable(q);
      const target = st.questTarget(q);
      const prog = Math.min(target, st.questProgress(q));
      const claimable = !!rec?.done && !rec.claimed;
      lst.add(card(this, 0, y, RW, 58, claimable ? 'sel' : rec?.claimed || !avail ? 'lock' : 'normal'));
      this.t(lc, 18, y + 16, `${rec?.claimed ? '✓' : claimable ? '★' : '·'} ${q.name}`, 18, avail ? INK : '#8a7a6a', { title: true });
      this.t(lc, 236, y + 19, avail ? q.desc : '선행 퀘스트를 먼저 완료하세요', 14, SOFT, { wordWrap: { width: 440 } });
      const rw = [q.reward.gold ? `금화 ${q.reward.gold}` : '', ...Object.entries(q.reward.items ?? {}).map(([k, v]) => `${ITEMS[k]?.name} ${v}`), q.reward.mount ? `영물 ${MOUNTS[q.reward.mount].name}` : ''].filter(Boolean).join(' · ');
      this.t(lc, 700, y + 9, `${prog} / ${target}`, 15, claimable || rec?.claimed ? JADE : RED, { title: true });
      this.t(lc, 700, y + 32, rw, 13, SUB);
      if (claimable) lst.add(button(this, RW - 76, y + 29, 128, 40, '보상 받기', () => { st.claimQuest(q.id); st.save(); audio.play('chest'); this.render(); }, 'primary', 16));
    });
    lst.setContentSize(list.length * ROW);
  }

  // ---------------- 소지품 ----------------
  private renderInventory(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.title(c, '소지품');
    const items = Object.values(ITEMS);
    const { a: grid } = this.area('grid', X0 + 26, Y0 + 134, W - 58, H - 196);
    const CW = 276, CH = 140;
    items.forEach((it, i) => {
      const x = (i % 4) * (CW + 10), y = Math.floor(i / 4) * (CH + 10);
      grid.add(card(this, x, y, CW, CH));
      const icon = this.add.image(x + 46, y + 50, `icon_${it.icon}`).setScale(0.9);
      grid.add(icon);
      this.t(grid.content, x + 92, y + 16, it.name, 19, INK, { title: true });
      this.t(grid.content, x + 92, y + 44, `× ${st.count(it.id).toLocaleString('ko-KR')}`, 22, RED, { title: true });
      this.t(grid.content, x + 14, y + 88, it.desc, 13, SOFT, { wordWrap: { width: CW - 28 } });
      if (it.id === 'yakgwa' && this.from === 'World' && st.count('yakgwa') > 0) {
        grid.add(button(this, x + CW - 52, y + 52, 84, 36, '먹기', () => {
          const w = this.scene.get('World') as WorldScene;
          if (st.useItem('yakgwa')) { w.player.heal(w.player.maxHp * 0.4); audio.play('levelup'); toast(this, '체력을 회복했다!'); }
          this.render();
        }, 'primary', 15));
      }
    });
    grid.setContentSize(Math.ceil(items.length / 4) * (CH + 10));
    c.add(card(this, X0 + 26, Y0 + H - 56, W - 60, 40, 'lock'));
    this.t(c, X0 + 44, Y0 + H - 45, `모험 기록 — 달린 거리 ${Math.floor(st.data.stats.distance).toLocaleString('ko-KR')}m · 처치 ${st.data.stats.defeats} · 보물 ${st.data.stats.chests} · 기절 ${st.data.stats.deaths}`, 15, SOFT);
  }

  // ---------------- 상점 ----------------
  private renderShop(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.title(c, '상점');
    c.add(card(this, X0 + 150, TOP - 2, 790, 38, 'dark'));
    this.t(c, X0 + 545, TOP + 17, isLive() ? '안전 결제 토스페이먼츠 · 뽑기(확률형) 없음 · 정해진 보상만 · 하루 결제 5만 원 미만' : '테스트 모드 · 실제 결제 없음 · 뽑기(확률형) 없음 · 정해진 보상만', 14, '#ffe6a6').setOrigin(0.5);
    const cats: [ProductCategory, string][] = [['skin', '영물 스킨'], ['decor', '영물 장식'], ['outfit', '라이더 의상'], ['package', '패키지'], ['pass', '수행록·정기권']];
    cats.forEach(([k, label], i) => {
      c.add(pill(this, X0 + 100 + i * 150, TOP + 62, 140, label, this.shopCat === k, () => { if (this.shopCat !== k) { this.shopCat = k; this.render(); } }, 16));
    });
    const list = PRODUCTS.filter((p) => p.category === this.shopCat);
    const CW = 292, CH = 200;
    const { a: grid } = this.area(`grid:${this.shopCat}`, X0 + 26, Y0 + 178, 3 * CW + 2 * 12, H - 206);
    const gc = grid.content;
    list.forEach((p, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = col * (CW + 12), y = row * (CH + 12);
      const ownedAll = (p.grants.length > 0 && p.grants.every((g) => st.ownsCosmetic(g))) || (p.effect === 'pass_premium' && st.data.pass.premium);
      const bought = p.oncePerAccount && st.data.purchases.some((x2) => x2.productId === p.id && x2.status === 'paid');
      grid.add(card(this, x, y, CW, CH, !p.available ? 'lock' : p.tier === '프리미엄' ? 'sel' : 'normal'));
      // 미리보기 (칸 안에 맞춰)
      if (p.category === 'skin' && p.mount) {
        const skinId = p.grants[0];
        const can = st.owns(p.mount) || p.available;
        if (can && p.available) this.portrait(gc, p.mount, Math.min(2, st.data.mounts[p.mount]?.stage ?? 1), x + 78, y + 124, 136, 106, 'normal', skinId);
        else this.portrait(gc, p.mount, 1, x + 78, y + 124, 136, 106, 'silhouette');
      } else {
        const icon = p.category === 'outfit' ? 'outfit' : p.category === 'package' ? 'package' : p.category === 'pass' ? 'page' :
          p.grants[0]?.includes('knot') ? 'knot' : p.grants[0]?.includes('jade') ? 'jade' : p.grants[0]?.includes('bell') ? 'bell' : p.grants[0]?.includes('cloud') ? 'cloud' : p.grants[0]?.includes('petal') ? 'petal' : 'foot';
        grid.add(this.add.image(x + 74, y + 76, `icon_${icon}`).setScale(1.3));
      }
      this.t(gc, x + 152, y + 14, p.name, 18, INK, { title: true, wordWrap: { width: CW - 164 } });
      this.t(gc, x + 152, y + 60, p.tier, 13, p.tier === '프리미엄' ? RED : SUB);
      this.t(gc, x + 152, y + 80, `${p.price.toLocaleString('ko-KR')}원`, 20, INK, { title: true });
      this.t(gc, x + 14, y + 134, p.desc, 12, SOFT, { wordWrap: { width: 150 }, maxLines: 4 });
      const needMount = p.category === 'skin' && p.mount && !st.owns(p.mount);
      if (ownedAll && p.grants.length === 1) {
        // 보유한 단품: 바로 장착/해제
        const on = st.isEquipped(p.grants[0]);
        grid.add(button(this, x + 222, y + 160, 120, 38, on ? '✓ 장착 중' : '장착하기', () => {
          st.equip(p.grants[0]);
          if (COSMETICS[p.grants[0]]?.kind === 'outfit') ensureRider(this, p.grants[0]);
          st.save();
          this.applyToWorld();
          this.render();
        }, on ? 'primary' : 'normal', 15));
      } else {
        const label = !p.available ? '출시 예정' : ownedAll || bought ? '보유 중' : needMount ? '영물 필요' : '구매';
        const b = button(this, x + 222, y + 160, 120, 38, label, () => this.buy(p.id), 'primary', 15);
        b.setEnabled(p.available && !ownedAll && !bought && !needMount);
        grid.add(b);
      }
    });
    grid.setContentSize(Math.ceil(list.length / 3) * (CH + 12));
    // 구매 내역
    const hx = X0 + 960, hw = W - 990;
    c.add(card(this, hx - 12, Y0 + 178, hw + 12, H - 206));
    this.t(c, hx + 4, Y0 + 192, isLive() ? '구매 내역' : '구매 내역 (테스트)', 17, INK, { title: true });
    const ps = st.data.purchases.slice(-5).reverse();
    if (!ps.length) this.t(c, hx + 4, Y0 + 224, '아직 없어요', 14, SUB);
    ps.forEach((pc, i) => {
      const prod = PRODUCTS.find((x) => x.id === pc.productId);
      const y = Y0 + 224 + i * 56;
      this.t(c, hx + 4, y, `${prod?.name ?? pc.productId}`, 14, INK, { title: true });
      this.t(c, hx + 4, y + 20, `${pc.price.toLocaleString('ko-KR')}원 · ${pc.status === 'paid' ? (pc.test ? '완료(테스트)' : '결제 완료') : '환불됨'}`, 12, pc.status === 'paid' ? JADE : '#8a3a2a');
      if (pc.status === 'paid') c.add(button(this, hx + hw - 34, y + 18, 60, 28, '환불', () => this.refund(pc.orderId), 'normal', 12));
    });
    this.t(c, hx + 4, Y0 + H - 116, isLive() ? `구매는 서버에 기록되어 기기를 바꿔도\n설정 › 구매 복구로 되찾을 수 있어요.\n환불: ${RELEASE.refundDays}일 이내 미사용 상품` : '판매 빌드에서는 구매·환불·복구를\n서버 기록으로 검증합니다.', 12, SUB, { lineSpacing: 3 });
    this.t(c, X0 + 40, Y0 + H - 22, businessLine(), 11, '#7a6a5a');
  }

  buy(productId: string) {
    const st = store.state;
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p) return;
    if (!st.canSpend(p.price)) {
      toast(this, `하루 결제 한도(5만 원 미만)를 넘을 수 없어요. 오늘 결제: ${st.spentToday().toLocaleString('ko-KR')}원`, '#ffb0a0', 120, 2600);
      return;
    }
    const live = isLive();
    const msg = live
      ? `${p.name}\n${p.price.toLocaleString('ko-KR')}원 (부가세 포함)\n\n토스페이먼츠 결제창으로 이동합니다.\n디지털 상품 특성상 지급 후 사용(장착·보상 받기)하면\n청약철회가 제한될 수 있어요 (환불 정책 참고)`
      : `${p.name}\n${p.price.toLocaleString('ko-KR')}원 (부가세 포함)\n\n테스트 모드: 실제로 청구되지 않습니다.`;
    confirmBox(this, msg, async () => {
      analytics.track('purchase_start', { product: p.id, price: p.price, mode: payments.mode });
      try {
        const order = await payments.createOrder(p, st.data.account.customerKey);
        st.save(); // 결제창으로 떠나기 전에 진행 저장
        const res = await payments.pay(order, st.data.account.customerKey);
        if (res.pending) return; // 결제창으로 이동 — 돌아오면 부팅 때 서버 승인·지급
        if (!res.ok) { toast(this, res.message ?? '결제 실패', '#ffb0a0', 120); return; }
        const eq = applyPurchase(st, p.id, order.orderId, p.price, res.test);
        for (const g of eq.equipped) if (COSMETICS[g]?.kind === 'outfit') ensureRider(this, g);
        st.save();
        this.applyToWorld();
        analytics.track('purchase_success', { product: p.id, price: p.price, test: res.test });
        audio.play('chest');
        this.render();
        if (p.effect) toast(this, p.effect === 'pass_premium' ? '수행록 프리미엄이 열렸어요! 수행록 탭에서 보상을 받으세요' : '달빛 정기권 시작! 영기석 10 지급 · 일일 탭에서 매일 받기', '#ffe6a6', 120, 3200);
        else this.purchaseDone(p.name, { equipped: eq.equipped, needMount: eq.needMount as MountId[] });
      } catch (e) {
        toast(this, (e as Error).message || '결제를 시작하지 못했어요', '#ffb0a0', 120, 2800);
      }
    }, live ? '결제하기' : '테스트 구매');
  }

  /** 플레이 중에 연 메뉴라면 영물·라이더 외형을 즉시 다시 그린다 */
  private applyToWorld() {
    if (this.from !== 'World') return;
    const w = this.scene.get('World') as WorldScene;
    w.player?.rebuild();
  }

  /** 구매 완료 안내: 무엇이 장착됐는지 보여 준다 */
  private purchaseDone(name: string, eq: { equipped: string[]; needMount: MountId[] }) {
    const layer = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive();
    const pnl = panel(this, GAME_W / 2 - 280, GAME_H / 2 - 160, 560, 320);
    const lines = eq.equipped.map((id) => `✓ ${COSMETICS[id]?.name ?? id} — 장착했어요`);
    for (const m of eq.needMount) lines.push(`※ ${MOUNTS[m].name}을(를) 얻으면 이 스킨을 장착할 수 있어요`);
    const t1 = txt(this, GAME_W / 2, GAME_H / 2 - 112, `${name} 구매 완료!`, 30, INK, { title: true }).setOrigin(0.5);
    const t2 = txt(this, GAME_W / 2, GAME_H / 2 - 60, lines.join('\n'), 19, INK, { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);
    const t3 = txt(this, GAME_W / 2, GAME_H / 2 + 74, isLive() ? '영물 탭·상점에서 바꿔 낄 수 있어요' : '테스트 결제 · 실제 청구 없음 · 영물 탭에서 바꿔 낄 수 있어요', 14, SUB).setOrigin(0.5);
    setScrollsHidden(this, true);
    const ok = button(this, GAME_W / 2, GAME_H / 2 + 120, 180, 50, '확인', () => { layer.destroy(); setScrollsHidden(this, false); }, 'primary');
    layer.add([dim, pnl, t1, t2, t3, ok]);
  }

  private refund(orderId: string) {
    const st = store.state;
    const pc = st.data.purchases.find((x) => x.orderId === orderId);
    if (!pc) return;
    if (isLive()) {
      confirmBox(this, `환불은 고객센터로 요청해 주세요.\n${RELEASE.business.email || '[고객센터 이메일 — 출시 전 입력]'}\n주문번호: ${orderId}\n(환불 정책: 설정 > 환불 정책)`, () => undefined, '확인');
      return;
    }
    confirmBox(this, '이 구매를 환불(테스트)할까요?\n지급된 꾸미기 아이템이 회수됩니다.', async () => {
      const r = await payments.refund(orderId);
      if (!r.ok) return;
      revokePurchase(st, orderId);
      st.save();
      analytics.track('purchase_refund', { product: pc.productId });
      this.render();
    }, '환불');
  }

  // ---------------- 설정 ----------------
  private renderSettings(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const s = st.data.settings;
    this.title(c, '설정');
    const lx = X0 + 30, lw = 560;
    c.add(card(this, lx, Y0 + 134, lw, 236));
    const row = (y: number, label: string, value: string, dec: () => void, inc: () => void) => {
      this.t(c, lx + 28, y, label, 19, INK, { title: true });
      c.add(button(this, lx + 300, y + 12, 50, 42, '−', () => { dec(); this.apply(); }));
      this.t(c, lx + 370, y + 12, value, 20, INK, { title: true }).setOrigin(0.5);
      c.add(button(this, lx + 440, y + 12, 50, 42, '+', () => { inc(); this.apply(); }));
    };
    row(Y0 + 156, '배경음', `${Math.round(s.music * 10)}`, () => (s.music = Math.max(0, +(s.music - 0.1).toFixed(1))), () => (s.music = Math.min(1, +(s.music + 0.1).toFixed(1))));
    row(Y0 + 216, '효과음', `${Math.round(s.sfx * 10)}`, () => (s.sfx = Math.max(0, +(s.sfx - 0.1).toFixed(1))), () => (s.sfx = Math.min(1, +(s.sfx + 0.1).toFixed(1))));
    this.t(c, lx + 28, Y0 + 276, '터치 버튼', 19, INK, { title: true });
    (['auto', 'on', 'off'] as const).forEach((m, i) => {
      c.add(pill(this, lx + 300 + i * 96, Y0 + 288, 88, m === 'auto' ? '자동' : m === 'on' ? '켜기' : '끄기', s.touch === m, () => { s.touch = m; this.apply(); }, 15));
    });
    this.t(c, lx + 28, Y0 + 326, `저장: 이 브라우저에 자동 저장 (${new Date(st.data.updatedAt).toLocaleString('ko-KR')}) · 총 ${Math.round(st.data.playTimeSec / 60)}분`, 13, SOFT);
    c.add(card(this, lx, Y0 + 382, lw, 186));
    this.t(c, lx + 28, Y0 + 398, '조작법', 19, INK, { title: true });
    this.t(c, lx + 28, Y0 + 430, 'PC  A/D·←→ 이동 · Space 점프(길게: 높이/활공)\n      Z 공격 · X 돌진 · C 기술 · V 필살기 · Q 영물 교체 · Esc 메뉴\n      비행 중 Space/W 상승 · S 하강\n휴대폰  왼쪽 원형 방향키 · 오른쪽 점프·공격·기술·필살기·돌진', 14, INK, { lineSpacing: 7 });
    c.add(button(this, lx + 110, Y0 + 606, 190, 42, '진행 초기화', () => {
      confirmBox(this, '모든 진행 상황을 지울까요?\n(되돌릴 수 없습니다)', () => {
        st.reset();
        st.save();
        this.scene.stop('Hud');
        this.scene.stop('World');
        this.scene.stop();
        this.scene.start('Title');
      }, '초기화');
    }, 'normal', 16));
    const rx = X0 + 612, rw = W - 642;
    c.add(card(this, rx, Y0 + 134, rw, 152));
    this.t(c, rx + 24, Y0 + 150, '정보', 19, INK, { title: true });
    this.t(c, rx + 24, Y0 + 180, [
      `신수도감 (神獸圖鑑) v${RELEASE.version}${isLive() ? '' : ' · 테스트 결제'}`,
      '글꼴: 고운바탕·고운돋움·Noto Serif KR (SIL OFL 1.1) · 엔진: Phaser (MIT)',
    ].join('\n'), 13, INK, { lineSpacing: 6 });
    const open = (f: string) => window.open(`legal/${f}.html`, '_blank', 'noopener');
    c.add(button(this, rx + 84, Y0 + 252, 120, 36, '이용약관', () => open('terms'), 'normal', 14));
    c.add(button(this, rx + 212, Y0 + 252, 120, 36, '개인정보', () => open('privacy'), 'normal', 14));
    c.add(button(this, rx + 340, Y0 + 252, 120, 36, '환불 정책', () => open('refund'), 'normal', 14));
    // 구매 복구 (기기 변경·저장 삭제 후)
    c.add(card(this, rx, Y0 + 298, rw, 270));
    this.t(c, rx + 24, Y0 + 314, '구매 복구 코드', 19, INK, { title: true });
    this.t(c, rx + 24, Y0 + 346, st.data.account.customerKey, 16, RED, { title: true });
    this.t(c, rx + 24, Y0 + 374, '기기를 바꾸면 이 코드를 입력해 구매한 상품을 되찾을 수 있어요.\n다른 사람에게 알려 주지 마세요.', 12, SOFT, { lineSpacing: 4 });
    c.add(button(this, rx + 84, Y0 + 438, 120, 38, '코드 복사', () => {
      navigator.clipboard?.writeText(st.data.account.customerKey).then(() => toast(this, '복사했어요'), () => toast(this, st.data.account.customerKey));
    }, 'normal', 14));
    c.add(button(this, rx + 212, Y0 + 438, 120, 38, '코드 입력', () => {
      const v = (window.prompt('구매 복구 코드를 입력하세요') ?? '').trim().toUpperCase();
      if (!/^SD[0-9A-Z]{10,40}$/.test(v)) { if (v) toast(this, '코드 형식이 맞지 않아요', '#ffb0a0'); return; }
      st.data.account.customerKey = v;
      st.save();
      this.restore();
    }, 'normal', 14));
    c.add(button(this, rx + 340, Y0 + 438, 120, 38, '구매 복구', () => this.restore(), 'primary', 14));
    this.t(c, rx + 24, Y0 + 476, businessLine(), 11, '#7a6a5a', { wordWrap: { width: rw - 48 } });
  }

  private async restore() {
    if (!isLive()) { toast(this, '테스트 결제 빌드에서는 서버 구매 기록이 없어요'); return; }
    const r = await syncWithServer(store.state);
    if (!r) { toast(this, '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요', '#ffb0a0'); return; }
    this.applyToWorld();
    toast(this, `구매 기록을 맞췄어요 (복구 ${r.restored}건)`);
    this.render();
  }

  private apply() {
    const s = store.state.data.settings;
    audio.setVolumes(s.music, s.sfx);
    store.state.save();
    this.render();
  }
}

/** 사업자 정보 한 줄 (전자상거래법 표시 항목 — release.config.json) */
function businessLine() {
  const b = RELEASE.business;
  if (!b.name) return '사업자 정보: [출시 전 release.config.json 에 입력]';
  return `상호 ${b.name} · 대표 ${b.ceo} · 사업자등록번호 ${b.regNo} · 통신판매업 ${b.mailOrderNo} · ${b.address} · ${b.email} · ${b.phone}`;
}
