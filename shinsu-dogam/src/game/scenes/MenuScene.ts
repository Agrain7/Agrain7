// 메뉴: 영물 / 도감 / 퀘스트 / 소지품 / 상점 / 설정
import Phaser from 'phaser';
import { txt, panel, button, bar, toast, confirmBox } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { MOUNTS, MOUNT_ORDER, SKILLS } from '../../data/mounts.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { ITEMS } from '../../data/items.ts';
import { QUESTS } from '../../data/quests.ts';
import { PRODUCTS } from '../../data/products.ts';
import { COSMETICS } from '../../data/cosmetics.ts';
import type { MountId, ProductCategory } from '../../data/types.ts';
import { expToNext, STONE_EXP } from '../../systems/state.ts';
import { ensurePortrait, ensureRider } from '../textures.ts';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { audio } from '../../systems/audio.ts';
import { payments } from '../../services/payment/PaymentService.ts';
import { analytics } from '../../services/analytics/Analytics.ts';
import { overlayQueue } from '../overlayQueue.ts';
import type { WorldScene } from './WorldScene.ts';

type Tab = 'stable' | 'codex' | 'quests' | 'inventory' | 'shop' | 'settings';
const TABS: [Tab, string][] = [['stable', '영물'], ['codex', '도감'], ['quests', '퀘스트'], ['inventory', '소지품'], ['shop', '상점'], ['settings', '설정']];
const X0 = 50, Y0 = 34, W = GAME_W - 100, H = GAME_H - 68;

export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'stable';
  private from = 'Map';
  private content!: Phaser.GameObjects.Container;
  private tabBtns: Phaser.GameObjects.Container[] = [];
  private selMount: MountId = 'wolf';
  private codexSel: MountId | null = null;
  private shopCat: ProductCategory = 'skin';
  private scrollY = 0;

  constructor() {
    super('Menu');
  }

  init(data: { tab?: Tab; from?: string }) {
    this.tab = data.tab ?? 'stable';
    this.from = data.from ?? 'Map';
    this.selMount = store.state.data.activeMount;
    this.codexSel = null;
    this.scrollY = 0;
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0912, 0.6).setOrigin(0).setInteractive();
    panel(this, X0, Y0, W, H);
    this.tabBtns = TABS.map(([t, label], i) => {
      const b = button(this, X0 + 110 + i * 150, Y0 + 40, 140, 48, label, () => this.switchTab(t), t === this.tab ? 'primary' : 'normal', 19);
      return b;
    });
    button(this, X0 + W - 90, Y0 + 40, 140, 48, this.from === 'World' ? '계속하기' : '닫기', () => this.close(), 'primary', 19);
    if (this.from === 'World') button(this, X0 + W - 90, Y0 + H - 36, 160, 44, '지도로 나가기', () => {
      confirmBox(this, '이 구간을 그만두고 지도로 나갈까요?\n(획득한 경험치·아이템은 저장됩니다)', () => {
        store.state.save();
        this.scene.stop('Hud');
        this.scene.stop('World');
        this.scene.stop();
        this.scene.start('Map');
      });
    }, 'normal', 17);
    this.content = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.tab === 'shop' || this.tab === 'quests' || this.tab === 'codex') {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, 900);
        this.render();
      }
    });
    if (this.tab === 'shop') analytics.track('shop_view', { from: this.from });
    this.render();
  }

  private switchTab(t: Tab) {
    this.tab = t;
    this.scrollY = 0;
    this.codexSel = null;
    TABS.forEach(([tt], i) => this.tabBtns[i].list[0] && (this.tabBtns[i].list[0] as Phaser.GameObjects.NineSlice).setTexture(tt === t ? 'ui_btn_primary' : 'ui_btn'));
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
    }
  }

  private t(c: Phaser.GameObjects.Container, x: number, y: number, s: string, size = 18, color: string = COLORS.text, opts: Parameters<typeof txt>[6] = {}) {
    const o = txt(this, x, y, s, size, color, opts);
    c.add(o);
    return o;
  }

  private portrait(c: Phaser.GameObjects.Container, id: MountId, stage: number, x: number, y: number, maxW: number, maxH: number, mode: 'normal' | 'silhouette' = 'normal', skin?: string) {
    const key = ensurePortrait(this, id, stage, mode, skin);
    const info = MOUNT_ART[artKey(id, stage)];
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(Math.min(2, maxW / info.w, maxH / info.h));
    c.add(img);
    return img;
  }

  // ---------------- 영물 관리 ----------------
  private renderStable(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const owned = st.ownedMounts();
    if (!st.owns(this.selMount)) this.selMount = st.data.activeMount;
    // 왼쪽 목록
    owned.forEach((m, i) => {
      const y = Y0 + 100 + i * 88;
      const sel = m.id === this.selMount;
      const bg = this.add.rectangle(X0 + 30, y, 230, 80, sel ? 0xe9d5a8 : 0xf6ecd6).setOrigin(0).setStrokeStyle(2, sel ? 0xc3352c : 0xb89466).setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => { this.selMount = m.id; audio.play('select'); this.render(); });
      c.add(bg);
      this.portrait(c, m.id, m.stage, X0 + 80, y + 74, 90, 66, 'normal', m.skin);
      this.t(c, X0 + 132, y + 12, MOUNTS[m.id].name, 20, COLORS.text, { title: true });
      this.t(c, X0 + 132, y + 42, `Lv.${m.level} · ${MOUNTS[m.id].stages[m.stage].name}`, 15, '#5a4a3a');
      if (m.id === st.data.activeMount) this.t(c, X0 + 220, y + 6, '탑승', 13, '#c3352c');
    });
    this.t(c, X0 + 30, Y0 + 110 + owned.length * 88, `보유 ${owned.length}/9 · 나머지는 도감에서 확인`, 14, '#7a5a3a');
    // 상세
    const m = st.data.mounts[this.selMount]!;
    const def = MOUNTS[m.id];
    const sd = def.stages[m.stage];
    const dx = X0 + 290;
    this.portrait(c, m.id, m.stage, dx + 200, Y0 + 330, 360, 230, 'normal', m.skin);
    this.t(c, dx + 20, Y0 + 92, `${def.name} ${def.hanja}`, 30, COLORS.text, { title: true });
    this.t(c, dx + 20, Y0 + 132, `${def.title} · ${def.element} 속성 · ${sd.name}`, 16, '#7a5a3a');
    this.t(c, dx + 20, Y0 + 350, `Lv.${m.level}`, 22, COLORS.text, { title: true });
    const eb = bar(this, dx + 96, Y0 + 356, 280, 14, COLORS.exp);
    eb.set(m.exp / expToNext(m.level));
    c.add(eb.g);
    this.t(c, dx + 390, Y0 + 352, `${m.exp}/${expToNext(m.level)}`, 14, '#5a4a3a');
    const s = st.stats(m.id);
    this.t(c, dx + 20, Y0 + 384, `체력 ${s.maxHp}  ·  공격 ${s.atk}  ·  방어 ${s.def}`, 18);
    this.t(c, dx + 20, Y0 + 414, `기본 공격 — ${SKILLS[sd.attack].name}: ${SKILLS[sd.attack].desc}`, 15, '#3a2a2a', { wordWrap: { width: 470 } });
    this.t(c, dx + 20, Y0 + 446, `특수 기술 — ${SKILLS[sd.special].name}: ${SKILLS[sd.special].desc}`, 15, '#3a2a2a', { wordWrap: { width: 470 } });
    this.t(c, dx + 20, Y0 + 496, `이동: ${sd.abilities.join(' · ')}`, 15, '#3a2a2a', { wordWrap: { width: 470 } });
    // 오른쪽: 행동
    const rx = X0 + 800;
    if (m.id !== st.data.activeMount) c.add(button(this, rx + 150, Y0 + 110, 260, 52, '이 영물에 탑승', () => { st.setActive(m.id); st.save(); this.render(); }, 'primary'));
    else this.t(c, rx + 150, Y0 + 110, '현재 탑승 중', 20, '#c3352c', { title: true }).setOrigin(0.5);
    // 진화
    const ce = st.canEvolve(m.id);
    if (m.stage < 2) {
      const next = def.stages[m.stage + 1];
      this.t(c, rx + 20, Y0 + 150, `다음 단계: ${next.name} (Lv.${next.minLevel})`, 18, COLORS.text, { title: true });
      this.t(c, rx + 20, Y0 + 178, `필요: 영기석 ${next.evolveCost!.spiritStone} (보유 ${st.count('spirit_stone')}) · 금화 ${next.evolveCost!.gold} (보유 ${st.count('gold')})`, 14, '#5a4a3a', { wordWrap: { width: 300 } });
      const eb2 = button(this, rx + 150, Y0 + 236, 260, 52, ce.ok ? '진화하기' : ce.reason === 'level' ? `Lv.${next.minLevel} 필요` : '재료 부족', () => {
        if (st.evolve(m.id)) {
          st.save();
          overlayQueue.push({ type: 'evolve', mount: m.id, stage: m.stage });
          if (!this.scene.isActive('Overlay')) this.scene.launch('Overlay');
          this.scene.bringToTop('Overlay');
          this.render();
        }
      }, 'primary');
      eb2.setEnabled(ce.ok);
      c.add(eb2);
    } else this.t(c, rx + 20, Y0 + 160, '각성체 — 최고 단계에 도달했어요', 18, '#c3352c', { title: true });
    // 수련
    this.t(c, rx + 20, Y0 + 284, `영기석 수련: 1개당 경험치 ${STONE_EXP}`, 16, COLORS.text);
    const tr = (n: number) => () => {
      const ups = st.train(m.id, n);
      audio.play(ups ? 'levelup' : 'coin');
      st.save();
      this.render();
    };
    const b1 = button(this, rx + 80, Y0 + 330, 120, 46, '1개 사용', tr(1));
    const b5 = button(this, rx + 220, Y0 + 330, 120, 46, '5개 사용', tr(5));
    b1.setEnabled(st.count('spirit_stone') >= 1);
    b5.setEnabled(st.count('spirit_stone') >= 5);
    c.add([b1, b5]);
    // 스킨
    const skins = Object.values(COSMETICS).filter((x) => x.kind === 'skin' && x.mount === m.id && st.ownsCosmetic(x.id));
    this.t(c, rx + 20, Y0 + 372, '스킨', 18, COLORS.text, { title: true });
    if (!skins.length) this.t(c, rx + 20, Y0 + 400, '보유한 스킨이 없어요 (상점)', 14, '#7a5a3a');
    skins.forEach((sk, i) => {
      const on = m.skin === sk.id;
      c.add(button(this, rx + 85 + (i % 2) * 140, Y0 + 412 + Math.floor(i / 2) * 50, 130, 42, `${on ? '✓ ' : ''}${sk.name}`, () => { st.equip(sk.id); st.save(); this.render(); }, on ? 'primary' : 'normal', 15));
    });
    // 장식·의상
    const decos = Object.values(COSMETICS).filter((x) => (x.kind === 'decor' || x.kind === 'trail' || x.kind === 'outfit') && st.ownsCosmetic(x.id));
    this.t(c, rx + 20, Y0 + 500, '장식 · 의상', 18, COLORS.text, { title: true });
    decos.forEach((d, i) => {
      const on = st.data.cosmetics.outfit === d.id || st.data.cosmetics.decor.includes(d.id) || st.data.cosmetics.trail === d.id;
      c.add(button(this, rx + 70 + (i % 3) * 110, Y0 + 540 + Math.floor(i / 3) * 44, 104, 38, `${on ? '✓' : ''}${d.name}`, () => {
        st.equip(d.id);
        if (d.kind === 'outfit') ensureRider(this, d.id);
        st.save();
        this.render();
      }, on ? 'primary' : 'normal', 12));
    });
  }

  // ---------------- 도감 ----------------
  private renderCodex(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const comp = st.codexCompletion();
    this.t(c, X0 + 40, Y0 + 82, '영물 도감 靈物圖鑑', 30, COLORS.text, { title: true });
    this.t(c, X0 + 360, Y0 + 92, `수집 ${comp.owned}/${comp.total} · 성장 기록 ${comp.stagesSeen}/${comp.stagesTotal} (완성률 ${comp.pct}%)`, 18, '#7a5a3a');
    MOUNT_ORDER.forEach((id, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = X0 + 40 + col * 250, y = Y0 + 130 + row * 158;
      const owned = st.owns(id);
      const def = MOUNTS[id];
      const card = this.add.rectangle(x, y, 236, 148, owned ? 0xf6ecd6 : 0xe6dcc8).setOrigin(0).setStrokeStyle(2, owned ? 0xc3352c : 0xb89466).setInteractive({ useHandCursor: true });
      card.on('pointerup', () => { this.codexSel = id; audio.play('select'); this.render(); });
      c.add(card);
      const m = st.data.mounts[id];
      this.portrait(c, id, owned ? m!.stage : 2, x + 118, y + 116, 210, 100, owned ? 'normal' : 'silhouette', m?.skin);
      this.t(c, x + 10, y + 120, owned ? `${def.name} ${def.hanja}` : `??? (${def.symbol})`, 17, owned ? COLORS.text : '#7a6a5a', { title: true });
      this.t(c, x + 226, y + 124, owned ? `Lv.${m!.level}` : def.obtainable ? '획득 가능' : '추후', 14, owned ? '#c3352c' : '#8a7a6a').setOrigin(1, 0);
    });
    // 업적
    const ax = X0 + 800;
    this.t(c, ax, Y0 + 130, '수집 업적', 22, COLORS.text, { title: true });
    st.achievements().forEach((a, i) => {
      this.t(c, ax, Y0 + 168 + i * 50, `${a.done ? '◆' : '◇'} ${a.name}`, 18, a.done ? '#c3352c' : '#7a6a5a', { title: true });
      this.t(c, ax + 20, Y0 + 192 + i * 50, a.desc, 14, '#5a4a3a');
    });
    this.t(c, ax, Y0 + 580, `고서 조각 ${st.data.lorePages.length}장 수집`, 16, '#7a5a3a');
  }

  private renderCodexDetail(c: Phaser.GameObjects.Container, id: MountId) {
    const st = store.state;
    const def = MOUNTS[id];
    const m = st.data.mounts[id];
    const owned = !!m;
    c.add(button(this, X0 + 100, Y0 + 100, 140, 44, '← 목록', () => { this.codexSel = null; this.render(); }, 'normal', 17));
    this.t(c, X0 + 200, Y0 + 82, owned ? `${def.name} ${def.hanja}` : `미확인 영물 (${def.symbol})`, 34, COLORS.text, { title: true });
    this.t(c, X0 + 200, Y0 + 126, owned ? `${def.title} · ${def.category === 'legend' ? '전설 영물' : '기본 영물'} · ${def.element} 속성 · 상징: ${def.symbol}` : '아직 만나지 못한 영물입니다.', 16, '#7a5a3a');
    // 3단계 비교
    [0, 1, 2].forEach((s) => {
      const x = X0 + 150 + s * 330;
      const seen = owned && m!.stage >= s;
      this.portrait(c, id, s, x, Y0 + 370, 290, 200, seen ? 'normal' : 'silhouette', seen ? m?.skin : undefined);
      const sd = def.stages[s];
      this.t(c, x, Y0 + 380, `${sd.name} (Lv.${sd.minLevel})`, 20, seen ? COLORS.text : '#8a7a6a', { title: true }).setOrigin(0.5, 0);
      if (seen || (owned && s === m!.stage + 1)) {
        this.t(c, x, Y0 + 410, sd.abilities.join(' · '), 14, '#5a4a3a', { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
        this.t(c, x, Y0 + 452, `${SKILLS[sd.attack].name} / ${SKILLS[sd.special].name}`, 14, '#7a3a2a', { align: 'center' }).setOrigin(0.5, 0);
      } else this.t(c, x, Y0 + 410, '???', 16, '#8a7a6a').setOrigin(0.5, 0);
      if (s < 2) this.t(c, x + 165, Y0 + 280, '›', 40, '#8a6a4a').setOrigin(0.5);
    });
    const y = Y0 + 488;
    this.t(c, X0 + 40, y, owned ? `이야기 — ${def.lore}` : `획득 방법 — ${def.acquisition}`, 16, '#3a2a2a', { wordWrap: { width: W - 90 } });
    if (owned) {
      this.t(c, X0 + 40, y + 52, `획득 방법 — ${def.acquisition}`, 14, '#5a4a3a');
      const hist = m!.history.map((h) => `${def.stages[h.stage].name} ${new Date(h.at).toLocaleDateString('ko-KR')} (Lv.${h.level})`).join('  →  ');
      this.t(c, X0 + 40, y + 78, `성장 기록 — ${hist}`, 14, '#5a4a3a', { wordWrap: { width: W - 90 } });
    } else if (!def.obtainable) {
      this.t(c, X0 + 40, y + 52, '이 영물은 다음 지역 업데이트에서 만날 수 있습니다. (현재 빌드에서는 획득 불가)', 14, '#8a3a2a');
    }
    analytics.track('codex_entry', { mount: id, view: true });
  }

  // ---------------- 퀘스트 ----------------
  private renderQuests(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.t(c, X0 + 40, Y0 + 82, '퀘스트', 30, COLORS.text, { title: true });
    QUESTS.forEach((q, i) => {
      const y = Y0 + 132 + i * 50 - this.scrollY;
      if (y < Y0 + 110 || y > Y0 + H - 60) return;
      const rec = st.data.quests[q.id];
      const avail = st.questAvailable(q);
      const target = st.questTarget(q);
      const prog = Math.min(target, st.questProgress(q));
      this.t(c, X0 + 40, y, `${rec?.claimed ? '✓' : rec?.done ? '★' : '·'} ${q.name}`, 19, avail ? COLORS.text : '#8a7a6a', { title: true });
      this.t(c, X0 + 240, y + 3, avail ? q.desc : '선행 퀘스트를 먼저 완료하세요', 15, '#5a4a3a');
      const rw = [q.reward.gold ? `금화 ${q.reward.gold}` : '', ...Object.entries(q.reward.items ?? {}).map(([k, v]) => `${ITEMS[k]?.name} ${v}`), q.reward.mount ? `영물: ${MOUNTS[q.reward.mount].name}` : ''].filter(Boolean).join(', ');
      this.t(c, X0 + 700, y + 3, `${prog}/${target}  ·  ${rw}`, 14, '#7a5a3a');
      if (rec?.done && !rec.claimed) {
        c.add(button(this, X0 + W - 110, y + 12, 130, 40, '보상 받기', () => { st.claimQuest(q.id); st.save(); audio.play('chest'); this.render(); }, 'primary', 16));
      }
    });
  }

  // ---------------- 소지품 ----------------
  private renderInventory(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.t(c, X0 + 40, Y0 + 82, '소지품', 30, COLORS.text, { title: true });
    const items = Object.values(ITEMS);
    items.forEach((it, i) => {
      const x = X0 + 40 + (i % 4) * 285, y = Y0 + 140 + Math.floor(i / 4) * 150;
      c.add(this.add.rectangle(x, y, 270, 136, 0xf6ecd6).setOrigin(0).setStrokeStyle(2, 0xb89466));
      c.add(this.add.image(x + 46, y + 48, `icon_${it.icon}`).setScale(0.9));
      this.t(c, x + 90, y + 14, it.name, 19, COLORS.text, { title: true });
      this.t(c, x + 90, y + 42, `× ${st.count(it.id)}`, 22, '#c3352c', { title: true });
      this.t(c, x + 12, y + 84, it.desc, 13, '#5a4a3a', { wordWrap: { width: 250 } });
      if (it.id === 'yakgwa' && this.from === 'World' && st.count('yakgwa') > 0) {
        c.add(button(this, x + 210, y + 50, 90, 36, '먹기', () => {
          const w = this.scene.get('World') as WorldScene;
          if (st.useItem('yakgwa')) { w.player.heal(w.player.maxHp * 0.4); audio.play('levelup'); toast(this, '체력을 회복했다!'); }
          this.render();
        }, 'primary', 15));
      }
    });
    this.t(c, X0 + 40, Y0 + H - 70, `모험 기록 — 달린 거리 ${Math.floor(st.data.stats.distance)}m · 처치 ${st.data.stats.defeats} · 보물 ${st.data.stats.chests} · 기절 ${st.data.stats.deaths}`, 16, '#5a4a3a');
  }

  // ---------------- 상점 ----------------
  private renderShop(c: Phaser.GameObjects.Container) {
    const st = store.state;
    this.t(c, X0 + 40, Y0 + 82, '상점', 30, COLORS.text, { title: true });
    const banner = this.add.rectangle(X0 + 160, Y0 + 84, 700, 34, 0x3c3550).setOrigin(0).setStrokeStyle(2, 0xe2b14c);
    c.add(banner);
    this.t(c, X0 + 176, Y0 + 90, `테스트 모드 · 실제 결제가 이루어지지 않습니다 (결제 연동 전)  ·  모든 상품은 외형 전용`, 15, '#ffe6a6');
    const cats: [ProductCategory, string][] = [['skin', '영물 스킨'], ['decor', '영물 장식'], ['outfit', '라이더 의상'], ['package', '패키지'], ['pass', '탐험 패스']];
    cats.forEach(([k, label], i) => {
      c.add(button(this, X0 + 100 + i * 150, Y0 + 150, 140, 42, label, () => { this.shopCat = k; this.scrollY = 0; this.render(); }, this.shopCat === k ? 'primary' : 'normal', 16));
    });
    const list = PRODUCTS.filter((p) => p.category === this.shopCat);
    list.forEach((p, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = X0 + 30 + col * 300, y = Y0 + 190 + row * 196 - this.scrollY;
      if (y < Y0 + 170 || y > Y0 + H - 150) return;
      const ownedAll = p.grants.length > 0 && p.grants.every((g) => st.ownsCosmetic(g));
      const bought = p.oncePerAccount && st.data.purchases.some((x) => x.productId === p.id && x.status === 'paid');
      c.add(this.add.rectangle(x, y, 286, 184, p.available ? 0xf6ecd6 : 0xe2dacb).setOrigin(0).setStrokeStyle(2, p.tier === '프리미엄' ? 0xc3352c : 0xb89466));
      // 미리보기
      if (p.category === 'skin' && p.mount) {
        const skinId = p.grants[0];
        const can = st.owns(p.mount) || p.available;
        if (can && p.available) this.portrait(c, p.mount, Math.min(2, st.data.mounts[p.mount]?.stage ?? 1), x + 80, y + 120, 140, 100, 'normal', skinId);
        else this.portrait(c, p.mount, 1, x + 80, y + 120, 140, 100, 'silhouette');
      } else {
        const icon = p.category === 'outfit' ? 'outfit' : p.category === 'package' ? 'package' : p.category === 'pass' ? 'page' :
          p.grants[0]?.includes('knot') ? 'knot' : p.grants[0]?.includes('jade') ? 'jade' : p.grants[0]?.includes('bell') ? 'bell' : p.grants[0]?.includes('cloud') ? 'cloud' : p.grants[0]?.includes('petal') ? 'petal' : 'foot';
        c.add(this.add.image(x + 70, y + 74, `icon_${icon}`).setScale(1.3));
      }
      this.t(c, x + 150, y + 12, p.name, 18, COLORS.text, { title: true, wordWrap: { width: 130 } });
      this.t(c, x + 150, y + 56, p.tier, 14, p.tier === '프리미엄' ? '#c3352c' : '#7a5a3a');
      this.t(c, x + 150, y + 76, `${p.price.toLocaleString('ko-KR')}원`, 20, '#3a2a2a', { title: true });
      this.t(c, x + 12, y + 128, p.desc, 13, '#5a4a3a', { wordWrap: { width: 150 } });
      const needMount = p.category === 'skin' && p.mount && !st.owns(p.mount);
      if (ownedAll && p.grants.length === 1) {
        // 보유한 단품: 바로 장착/해제
        const on = st.isEquipped(p.grants[0]);
        const b = button(this, x + 222, y + 150, 112, 38, on ? '✓ 장착 중' : '장착하기', () => {
          st.equip(p.grants[0]);
          if (COSMETICS[p.grants[0]]?.kind === 'outfit') ensureRider(this, p.grants[0]);
          st.save();
          this.applyToWorld();
          this.render();
        }, on ? 'primary' : 'normal', 15);
        c.add(b);
      } else {
        const label = !p.available ? '출시 예정' : ownedAll || bought ? '보유 중' : needMount ? '영물 필요' : '구매';
        const b = button(this, x + 222, y + 150, 112, 38, label, () => this.buy(p.id), 'primary', 15);
        b.setEnabled(p.available && !ownedAll && !bought && !needMount);
        c.add(b);
      }
    });
    // 구매 내역
    const hy = Y0 + H - 110;
    this.t(c, X0 + 940, Y0 + 150, '구매 내역 (테스트)', 18, COLORS.text, { title: true });
    const ps = st.data.purchases.slice(-5).reverse();
    if (!ps.length) this.t(c, X0 + 940, Y0 + 182, '아직 없음', 14, '#7a5a3a');
    ps.forEach((pc, i) => {
      const prod = PRODUCTS.find((x) => x.id === pc.productId);
      const y = Y0 + 182 + i * 62;
      this.t(c, X0 + 940, y, `${prod?.name ?? pc.productId} · ${pc.price.toLocaleString('ko-KR')}원`, 14, '#3a2a2a');
      this.t(c, X0 + 940, y + 20, pc.status === 'paid' ? '결제 완료(테스트)' : '환불됨', 12, pc.status === 'paid' ? '#2f8a7a' : '#8a3a2a');
      if (pc.status === 'paid') c.add(button(this, X0 + 1100, y + 16, 70, 30, '환불', () => this.refund(pc.orderId), 'normal', 13));
    });
    this.t(c, X0 + 940, hy, '※ 실서비스에서는 구매·환불·복구를\n서버 기록으로 검증합니다.\n청약철회 정책은 출시 전 확정.', 12, '#7a5a3a');
  }

  private buy(productId: string) {
    const st = store.state;
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p) return;
    if (!st.canSpend(p.price)) {
      toast(this, `하루 결제 한도(5만 원 미만)를 넘을 수 없어요. 오늘 결제: ${st.spentToday().toLocaleString('ko-KR')}원`, '#ffb0a0', 120, 2600);
      return;
    }
    confirmBox(this, `${p.name}\n${p.price.toLocaleString('ko-KR')}원 (부가세 포함)\n\n테스트 모드: 실제로 청구되지 않습니다.`, async () => {
      analytics.track('purchase_start', { product: p.id, price: p.price, mode: payments.mode });
      const order = await payments.createOrder(p);
      const res = await payments.pay(order);
      if (res.ok) {
        st.grantCosmetics(p.grants);
        st.data.purchases.push({ orderId: order.orderId, productId: p.id, price: p.price, at: Date.now(), test: res.test, status: 'paid' });
        const eq = st.autoEquip(p.grants);
        for (const g of eq.equipped) if (COSMETICS[g]?.kind === 'outfit') ensureRider(this, g);
        st.save();
        this.applyToWorld();
        analytics.track('purchase_success', { product: p.id, price: p.price, test: res.test });
        audio.play('chest');
        this.render();
        this.purchaseDone(p.name, eq);
      } else toast(this, res.message ?? '결제 실패', '#ffb0a0', 120);
    }, '테스트 구매');
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
    const t1 = txt(this, GAME_W / 2, GAME_H / 2 - 112, `${name} 구매 완료!`, 30, COLORS.text, { title: true }).setOrigin(0.5);
    const t2 = txt(this, GAME_W / 2, GAME_H / 2 - 60, lines.join('\n'), 19, '#3a2a2a', { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);
    const t3 = txt(this, GAME_W / 2, GAME_H / 2 + 74, '테스트 결제 · 실제 청구 없음 · 영물 탭에서 바꿔 낄 수 있어요', 14, '#7a5a3a').setOrigin(0.5);
    const ok = button(this, GAME_W / 2, GAME_H / 2 + 120, 180, 50, '확인', () => layer.destroy(), 'primary');
    layer.add([dim, pnl, t1, t2, t3, ok]);
  }

  private refund(orderId: string) {
    const st = store.state;
    const pc = st.data.purchases.find((x) => x.orderId === orderId);
    if (!pc) return;
    confirmBox(this, '이 구매를 환불(테스트)할까요?\n지급된 꾸미기 아이템이 회수됩니다.', async () => {
      const r = await payments.refund(orderId);
      if (!r.ok) return;
      pc.status = 'refunded';
      const p = PRODUCTS.find((x) => x.id === pc.productId);
      // 다른 유효 구매로도 받은 아이템은 남긴다
      const still = new Set(st.data.purchases.filter((x) => x.status === 'paid').flatMap((x) => PRODUCTS.find((y) => y.id === x.productId)?.grants ?? []));
      st.revokeCosmetics((p?.grants ?? []).filter((g) => !still.has(g)));
      st.save();
      analytics.track('purchase_refund', { product: pc.productId });
      this.render();
    }, '환불');
  }

  // ---------------- 설정 ----------------
  private renderSettings(c: Phaser.GameObjects.Container) {
    const st = store.state;
    const s = st.data.settings;
    this.t(c, X0 + 40, Y0 + 82, '설정', 30, COLORS.text, { title: true });
    const row = (y: number, label: string, value: string, dec: () => void, inc: () => void) => {
      this.t(c, X0 + 60, y, label, 20);
      c.add(button(this, X0 + 330, y + 12, 50, 42, '−', () => { dec(); this.apply(); }));
      this.t(c, X0 + 400, y + 12, value, 20, '#3a2a2a').setOrigin(0.5);
      c.add(button(this, X0 + 470, y + 12, 50, 42, '+', () => { inc(); this.apply(); }));
    };
    row(Y0 + 140, '배경음', `${Math.round(s.music * 10)}`, () => (s.music = Math.max(0, +(s.music - 0.1).toFixed(1))), () => (s.music = Math.min(1, +(s.music + 0.1).toFixed(1))));
    row(Y0 + 200, '효과음', `${Math.round(s.sfx * 10)}`, () => (s.sfx = Math.max(0, +(s.sfx - 0.1).toFixed(1))), () => (s.sfx = Math.min(1, +(s.sfx + 0.1).toFixed(1))));
    this.t(c, X0 + 60, Y0 + 260, '터치 버튼', 20);
    (['auto', 'on', 'off'] as const).forEach((m, i) => {
      c.add(button(this, X0 + 360 + i * 110, Y0 + 272, 100, 42, m === 'auto' ? '자동' : m === 'on' ? '켜기' : '끄기', () => { s.touch = m; this.apply(); }, s.touch === m ? 'primary' : 'normal', 16));
    });
    this.t(c, X0 + 60, Y0 + 330, '조작법', 20, COLORS.text, { title: true });
    this.t(c, X0 + 60, Y0 + 362, 'PC: A/D·←→ 이동 · Space 점프(길게: 높이/활공) · J 공격 · K 특수 기술 · L 돌진\nQ 영물 교체 · Esc 메뉴 · 비행 중: Space/W 상승, S 하강\n모바일: 화면 왼쪽 ←→, 오른쪽 점프·공격·기술·돌진 버튼', 15, '#3a2a2a', { lineSpacing: 6 });
    this.t(c, X0 + 60, Y0 + 450, `저장: 이 브라우저에 자동 저장됨 (${new Date(st.data.updatedAt).toLocaleString('ko-KR')}) · 총 플레이 ${Math.round(st.data.playTimeSec / 60)}분`, 14, '#5a4a3a');
    c.add(button(this, X0 + 160, Y0 + 510, 200, 46, '진행 초기화', () => {
      confirmBox(this, '모든 진행 상황을 지울까요?\n(되돌릴 수 없습니다)', () => {
        st.reset();
        st.save();
        this.scene.stop('Hud');
        this.scene.stop('World');
        this.scene.stop();
        this.scene.start('Title');
      }, '초기화');
    }, 'normal', 17));
    const rx = X0 + 660;
    this.t(c, rx, Y0 + 140, '정보', 20, COLORS.text, { title: true });
    this.t(c, rx, Y0 + 172, [
      '신수도감 (神獸圖鑑) v0.1 프로토타입',
      '영물 일러스트: 사용자 제공 원화 (영물 도감 이미지에서 추출)',
      '배경·라이더·몬스터·UI: 코드로 그린 2D 일러스트',
      '글꼴: 고운바탕·고운돋움·Noto Serif KR (SIL OFL 1.1)',
      '음악·효과음: 웹오디오로 실시간 합성 (국악 5음계)',
      '',
      '개인정보 처리방침 · 이용약관 · 환불 정책:',
      '정식 출시 전 공개 예정 (현재는 이 브라우저에만',
      '진행 상황을 저장하며 서버로 보내지 않습니다)',
    ].join('\n'), 14, '#3a2a2a', { lineSpacing: 6 });
  }

  private apply() {
    const s = store.state.data.settings;
    audio.setVolumes(s.music, s.sfx);
    store.state.save();
    this.render();
  }
}
