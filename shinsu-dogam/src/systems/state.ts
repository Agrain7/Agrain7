// 게임 진행 상태 (Phaser와 독립). 저장/불러오기, 경험치, 진화, 인벤토리, 퀘스트, 도감, 꾸미기.
import type { MountId, QuestDef } from '../data/types.ts';
import { MOUNTS, MOUNT_ORDER, mountStats } from '../data/mounts.ts';
import { QUESTS } from '../data/quests.ts';
import { COSMETICS } from '../data/cosmetics.ts';
import { STAGES } from '../data/maps/wolha.ts';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'shinsu-dogam.save';

export interface MountState {
  id: MountId;
  level: number;
  exp: number;
  stage: 0 | 1 | 2;
  obtainedAt: number;
  /** 성장 기록: [단계, 시각] */
  history: { stage: number; at: number; level: number }[];
  skin?: string;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  playTimeSec: number;
  activeMount: MountId;
  mounts: Partial<Record<MountId, MountState>>;
  inventory: Record<string, number>;
  /** 스테이지 id → 최고 기록 */
  stages: Record<string, { cleared: boolean; bestTime?: number; chests: string[]; pickups: string[] }>;
  currentStage: string;
  quests: Record<string, { progress: number; done: boolean; claimed: boolean }>;
  stats: { distance: number; defeats: number; chests: number; deaths: number; bosses: string[] };
  codexSeen: MountId[];
  lorePages: string[];
  cosmetics: { owned: string[]; outfit: string; decor: string[]; trail: string | null };
  purchases: { orderId: string; productId: string; price: number; at: number; test: boolean; status: 'paid' | 'refunded' }[];
  settings: { music: number; sfx: number; touch: 'auto' | 'on' | 'off'; showFps: boolean };
  tutorialDone: boolean;
}

export function expToNext(level: number): number {
  return Math.round(20 + 6 * level + 0.5 * level * level);
}

export const MAX_LEVEL = 40;
/** 계정당 하루 누적 결제 한도 (원). 토스페이먼츠 게임 업종 심사 기준 '1일 5만 원 미만' 안내에 맞춤 — 계약 시 재확인 */
export const DAILY_PURCHASE_LIMIT = 50000;
export const STONE_EXP = 60;

export function newSave(now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playTimeSec: 0,
    activeMount: 'wolf',
    mounts: { wolf: { id: 'wolf', level: 1, exp: 0, stage: 0, obtainedAt: now, history: [{ stage: 0, at: now, level: 1 }] } },
    inventory: { gold: 0, spirit_stone: 0, yakgwa: 1 },
    stages: {},
    currentStage: '1-1',
    quests: {},
    stats: { distance: 0, defeats: 0, chests: 0, deaths: 0, bosses: [] },
    codexSeen: ['wolf'],
    lorePages: [],
    cosmetics: { owned: ['outfit_default'], outfit: 'outfit_default', decor: [], trail: null },
    purchases: [],
    settings: { music: 0.5, sfx: 0.7, touch: 'auto', showFps: false },
    tutorialDone: false,
  };
}

/** 이전 버전 저장 데이터를 현재 형식으로 변환 */
export function migrate(raw: unknown): SaveData {
  const base = newSave();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<SaveData> & { version?: number };
  const merged: SaveData = {
    ...base,
    ...d,
    inventory: { ...base.inventory, ...(d.inventory ?? {}) },
    stats: { ...base.stats, ...(d.stats ?? {}) },
    cosmetics: { ...base.cosmetics, ...(d.cosmetics ?? {}) },
    settings: { ...base.settings, ...(d.settings ?? {}) },
    mounts: { ...(d.mounts ?? base.mounts) },
    version: SAVE_VERSION,
  };
  // v1 → v2: 성장 기록(history) 필드 추가
  for (const id of Object.keys(merged.mounts) as MountId[]) {
    const m = merged.mounts[id]!;
    if (!m.history) m.history = [{ stage: m.stage ?? 0, at: m.obtainedAt ?? Date.now(), level: m.level ?? 1 }];
    if (!MOUNTS[id]) delete merged.mounts[id];
  }
  if (!merged.mounts[merged.activeMount]) merged.activeMount = 'wolf';
  if (!merged.mounts.wolf) merged.mounts.wolf = base.mounts.wolf;
  return merged;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type GameEvent =
  | { type: 'levelUp'; mount: MountId; level: number }
  | { type: 'canEvolve'; mount: MountId; stage: number }
  | { type: 'evolved'; mount: MountId; stage: number }
  | { type: 'mountObtained'; mount: MountId }
  | { type: 'questDone'; quest: QuestDef }
  | { type: 'item'; item: string; qty: number }
  | { type: 'changed' };

export class GameState {
  data: SaveData;
  private listeners = new Set<(e: GameEvent) => void>();
  private storage: StorageLike | null;
  dirty = false;

  constructor(storage: StorageLike | null, data?: SaveData) {
    this.storage = storage;
    this.data = data ?? newSave();
  }

  static load(storage: StorageLike | null): GameState {
    let data: SaveData | undefined;
    try {
      const raw = storage?.getItem(SAVE_KEY);
      if (raw) data = migrate(JSON.parse(raw));
    } catch {
      data = undefined;
    }
    return new GameState(storage, data);
  }

  hasSave(): boolean {
    try {
      return !!this.storage?.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  save(): boolean {
    this.data.updatedAt = Date.now();
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.dirty = false;
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    this.data = newSave();
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* 저장소 접근 불가 */
    }
    this.emit({ type: 'changed' });
  }

  on(fn: (e: GameEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e: GameEvent) {
    this.dirty = true;
    for (const fn of this.listeners) fn(e);
  }

  // ---------- 영물 ----------
  get active(): MountState {
    return this.data.mounts[this.data.activeMount] ?? this.data.mounts.wolf!;
  }
  owns(id: MountId) {
    return !!this.data.mounts[id];
  }
  ownedMounts(): MountState[] {
    return MOUNT_ORDER.filter((id) => this.data.mounts[id]).map((id) => this.data.mounts[id]!);
  }
  setActive(id: MountId) {
    if (!this.owns(id)) return false;
    this.data.activeMount = id;
    this.emit({ type: 'changed' });
    return true;
  }
  stats(id: MountId = this.data.activeMount) {
    const m = this.data.mounts[id]!;
    return mountStats(MOUNTS[id], m.level, m.stage);
  }
  obtainMount(id: MountId) {
    if (this.owns(id)) return false;
    const now = Date.now();
    this.data.mounts[id] = { id, level: 1, exp: 0, stage: 0, obtainedAt: now, history: [{ stage: 0, at: now, level: 1 }] };
    if (!this.data.codexSeen.includes(id)) this.data.codexSeen.push(id);
    this.emit({ type: 'mountObtained', mount: id });
    this.emit({ type: 'changed' });
    return true;
  }

  /** 경험치 추가. 반환: 오른 레벨 수 */
  addExp(amount: number, id: MountId = this.data.activeMount): number {
    const m = this.data.mounts[id];
    if (!m || amount <= 0) return 0;
    let ups = 0;
    m.exp += Math.round(amount);
    while (m.level < MAX_LEVEL && m.exp >= expToNext(m.level)) {
      m.exp -= expToNext(m.level);
      m.level++;
      ups++;
      this.emit({ type: 'levelUp', mount: id, level: m.level });
      const can = this.canEvolve(id);
      if (can.ok || (can.reason === 'material' && this.nextStageLevel(m) === m.level)) this.emit({ type: 'canEvolve', mount: id, stage: m.stage + 1 });
    }
    if (m.level >= MAX_LEVEL) m.exp = Math.min(m.exp, expToNext(m.level));
    this.updateQuests();
    this.emit({ type: 'changed' });
    return ups;
  }

  nextStageLevel(m: MountState): number | null {
    if (m.stage >= 2) return null;
    return MOUNTS[m.id].stages[m.stage + 1].minLevel;
  }

  canEvolve(id: MountId): { ok: boolean; reason?: 'max' | 'level' | 'material'; cost?: { spiritStone: number; gold: number } } {
    const m = this.data.mounts[id];
    if (!m) return { ok: false, reason: 'level' };
    if (m.stage >= 2) return { ok: false, reason: 'max' };
    const next = MOUNTS[id].stages[m.stage + 1];
    const cost = next.evolveCost!;
    if (m.level < next.minLevel) return { ok: false, reason: 'level', cost };
    if ((this.data.inventory.spirit_stone ?? 0) < cost.spiritStone || (this.data.inventory.gold ?? 0) < cost.gold) return { ok: false, reason: 'material', cost };
    return { ok: true, cost };
  }

  evolve(id: MountId): boolean {
    const c = this.canEvolve(id);
    if (!c.ok || !c.cost) return false;
    const m = this.data.mounts[id]!;
    this.data.inventory.spirit_stone -= c.cost.spiritStone;
    this.data.inventory.gold -= c.cost.gold;
    m.stage = (m.stage + 1) as 1 | 2;
    m.history.push({ stage: m.stage, at: Date.now(), level: m.level });
    this.emit({ type: 'evolved', mount: id, stage: m.stage });
    this.updateQuests();
    this.emit({ type: 'changed' });
    return true;
  }

  /** 영기석 수련: 영기석 1개 = 경험치 STONE_EXP */
  train(id: MountId, stones: number): number {
    const have = this.data.inventory.spirit_stone ?? 0;
    const n = Math.max(0, Math.min(stones, have));
    if (!n) return 0;
    this.data.inventory.spirit_stone = have - n;
    return this.addExp(n * STONE_EXP, id);
  }

  // ---------- 인벤토리 ----------
  count(item: string) {
    return this.data.inventory[item] ?? 0;
  }
  addItem(item: string, qty = 1) {
    if (qty === 0) return;
    this.data.inventory[item] = Math.max(0, (this.data.inventory[item] ?? 0) + qty);
    if (qty > 0) this.emit({ type: 'item', item, qty });
    this.updateQuests();
    this.emit({ type: 'changed' });
  }
  useItem(item: string): boolean {
    if (this.count(item) <= 0) return false;
    this.data.inventory[item]--;
    this.emit({ type: 'changed' });
    return true;
  }

  // ---------- 스테이지 ----------
  stageRec(id: string) {
    return (this.data.stages[id] ??= { cleared: false, chests: [], pickups: [] });
  }
  isUnlocked(stageId: string) {
    const idx = STAGES.findIndex((s) => s.id === stageId);
    if (idx <= 0) return true;
    return !!this.data.stages[STAGES[idx - 1].id]?.cleared;
  }
  clearStage(id: string, time: number) {
    const r = this.stageRec(id);
    r.cleared = true;
    r.bestTime = r.bestTime ? Math.min(r.bestTime, time) : time;
    this.updateQuests();
    this.emit({ type: 'changed' });
  }
  openChest(stageId: string, chestId: string) {
    const r = this.stageRec(stageId);
    if (r.chests.includes(chestId)) return false;
    r.chests.push(chestId);
    this.data.stats.chests++;
    this.updateQuests();
    return true;
  }
  takePickup(stageId: string, id: string) {
    const r = this.stageRec(stageId);
    if (r.pickups.includes(id)) return false;
    r.pickups.push(id);
    return true;
  }
  addDistance(px: number) {
    this.data.stats.distance += px / 100; // 100px = 1m
  }
  recordDefeat(monster: string) {
    this.data.stats.defeats++;
    if (monster === 'boss' && !this.data.stats.bosses.includes('boss')) this.data.stats.bosses.push('boss');
    this.updateQuests();
  }

  // ---------- 퀘스트 ----------
  questProgress(q: QuestDef): number {
    const d = this.data;
    const g = q.goal;
    switch (g.type) {
      case 'distance': return Math.min(g.meters, Math.floor(d.stats.distance));
      case 'defeat': return Math.min(g.count, d.stats.defeats);
      case 'chest': return Math.min(g.count, d.stats.chests);
      case 'reach': case 'clear': return d.stages[g.stage]?.cleared ? 1 : 0;
      case 'collect': return Math.min(g.count, (d.inventory[g.item] ?? 0) + (q.id === 'q_pearls' && this.owns('cheongryong') ? 3 : 0));
      case 'level': return Math.max(...this.ownedMounts().map((m) => m.level)) >= g.level ? 1 : 0;
      case 'evolve': return this.ownedMounts().some((m) => m.stage >= g.stage) ? 1 : 0;
      case 'boss': return d.stats.bosses.includes(g.boss) ? 1 : 0;
    }
  }
  questTarget(q: QuestDef): number {
    const g = q.goal;
    return g.type === 'distance' ? g.meters : g.type === 'defeat' || g.type === 'chest' || g.type === 'collect' ? g.count : 1;
  }
  questAvailable(q: QuestDef) {
    return (q.requires ?? []).every((r) => this.data.quests[r]?.done);
  }
  updateQuests() {
    for (const q of QUESTS) {
      const rec = (this.data.quests[q.id] ??= { progress: 0, done: false, claimed: false });
      if (rec.done) continue;
      rec.progress = this.questProgress(q);
      // 청룡 퀘스트는 사당에서 직접 완료한다
      if (q.id === 'q_pearls') continue;
      if (rec.progress >= this.questTarget(q) && this.questAvailable(q)) {
        rec.done = true;
        this.emit({ type: 'questDone', quest: q });
      }
    }
  }
  /** 완료된 퀘스트 보상 받기 */
  claimQuest(id: string): boolean {
    const q = QUESTS.find((x) => x.id === id);
    const rec = this.data.quests[id];
    if (!q || !rec || !rec.done || rec.claimed) return false;
    rec.claimed = true;
    if (q.reward.gold) this.addItem('gold', q.reward.gold);
    for (const [k, v] of Object.entries(q.reward.items ?? {})) this.addItem(k, v);
    if (q.reward.mount) this.obtainMount(q.reward.mount);
    if (q.reward.exp) this.addExp(q.reward.exp);
    this.emit({ type: 'changed' });
    return true;
  }
  completeQuest(id: string) {
    const rec = (this.data.quests[id] ??= { progress: 0, done: false, claimed: false });
    if (rec.done) return;
    rec.done = true;
    const q = QUESTS.find((x) => x.id === id);
    if (q) this.emit({ type: 'questDone', quest: q });
  }

  // ---------- 도감 ----------
  codexCompletion() {
    const owned = MOUNT_ORDER.filter((id) => this.owns(id)).length;
    const stagesSeen = this.ownedMounts().reduce((n, m) => n + m.stage + 1, 0);
    return { owned, total: MOUNT_ORDER.length, stagesSeen, stagesTotal: MOUNT_ORDER.length * 3, pct: Math.round((stagesSeen / (MOUNT_ORDER.length * 3)) * 100) };
  }
  achievements() {
    const d = this.data;
    const c = this.codexCompletion();
    return [
      { id: 'a_first', name: '첫 동료', desc: '영물 1종 보유', done: c.owned >= 1 },
      { id: 'a_three', name: '영물 친구들', desc: '영물 3종 보유', done: c.owned >= 3 },
      { id: 'a_evolve', name: '성장의 기쁨', desc: '영물을 성장체로 진화', done: this.ownedMounts().some((m) => m.stage >= 1) },
      { id: 'a_awaken', name: '각성', desc: '영물을 각성체로 진화', done: this.ownedMounts().some((m) => m.stage >= 2) },
      { id: 'a_hunter', name: '산의 사냥꾼', desc: '몬스터 50마리 처치', done: d.stats.defeats >= 50 },
      { id: 'a_treasure', name: '보물 사냥꾼', desc: '보물 상자 10개 열기', done: d.stats.chests >= 10 },
      { id: 'a_boss', name: '월하의 수호자', desc: '흑운 산군 정화', done: d.stats.bosses.includes('boss') },
      { id: 'a_lore', name: '고서 수집가', desc: '고서 조각 5장 수집', done: d.lorePages.length >= 5 },
    ];
  }

  // ---------- 결제 한도 ----------
  /** 오늘(로컬 날짜) 결제 완료된 금액 합계 */
  spentToday(now = Date.now()): number {
    const d = new Date(now).toDateString();
    return this.data.purchases.filter((p) => p.status === 'paid' && new Date(p.at).toDateString() === d).reduce((a, p) => a + p.price, 0);
  }
  /** 이 금액을 더 결제해도 하루 한도(5만 원 미만)를 지키는가 */
  canSpend(price: number, now = Date.now()): boolean {
    return this.spentToday(now) + price < DAILY_PURCHASE_LIMIT;
  }

  // ---------- 꾸미기 ----------
  ownsCosmetic(id: string) {
    return this.data.cosmetics.owned.includes(id) || !!COSMETICS[id]?.free;
  }
  grantCosmetics(ids: string[]) {
    for (const id of ids) if (!this.data.cosmetics.owned.includes(id)) this.data.cosmetics.owned.push(id);
    this.emit({ type: 'changed' });
  }
  revokeCosmetics(ids: string[]) {
    const c = this.data.cosmetics;
    c.owned = c.owned.filter((x) => !ids.includes(x));
    if (ids.includes(c.outfit)) c.outfit = 'outfit_default';
    c.decor = c.decor.filter((x) => !ids.includes(x));
    if (c.trail && ids.includes(c.trail)) c.trail = null;
    for (const m of this.ownedMounts()) if (m.skin && ids.includes(m.skin)) m.skin = undefined;
    this.emit({ type: 'changed' });
  }
  equip(id: string): boolean {
    const def = COSMETICS[id];
    if (!def || !this.ownsCosmetic(id)) return false;
    const c = this.data.cosmetics;
    if (def.kind === 'outfit') c.outfit = id;
    else if (def.kind === 'decor') c.decor = c.decor.includes(id) ? c.decor.filter((x) => x !== id) : [id];
    else if (def.kind === 'trail') c.trail = c.trail === id ? null : id;
    else if (def.kind === 'skin' && def.mount) {
      const m = this.data.mounts[def.mount];
      if (!m) return false;
      m.skin = m.skin === id ? undefined : id;
    }
    this.emit({ type: 'changed' });
    return true;
  }
}
