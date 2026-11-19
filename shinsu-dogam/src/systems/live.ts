// 매일 다시 찾게 하는 요소 (Phaser와 독립 → 단위 테스트 가능)
// 출석 7일 · 일일 임무 · 영물 수행록(시즌 패스) · 달빛 정기권 · 영물 원정(접속하지 않아도 진행) · 구간 별·지역 별 보상
// 확률형 아이템(뽑기)은 넣지 않는다. 모든 보상은 정해진 양.
import type { MountId } from '../data/types.ts';
import { REGIONS } from '../data/regions.ts';

/** 저장 데이터 중 이 모듈이 다루는 부분 */
export interface LiveData {
  daily: {
    loginDays: number;
    loginClaimedOn: string;
    missionsDay: string;
    missions: { id: string; base: number; claimed: boolean }[];
    bonusClaimed: boolean;
  };
  pass: { season: string; xp: number; premium: boolean; free: number[]; prem: number[] };
  monthly: { until: number; lastClaim: string };
  expeditions: Partial<Record<MountId, { start: number; hours: number }>>;
  regionRewards: string[];
}

export function newLive(): LiveData {
  return {
    daily: { loginDays: 0, loginClaimedOn: '', missionsDay: '', missions: [], bonusClaimed: false },
    pass: { season: PASS.season, xp: 0, premium: false, free: [], prem: [] },
    monthly: { until: 0, lastClaim: '' },
    expeditions: {},
    regionRewards: [],
  };
}

/** 이 모듈이 필요로 하는 게임 상태 기능 (GameState 가 구현) */
export interface LiveHost {
  data: LiveData & {
    stats: { defeats: number; distance: number; clears?: number; coins?: number; ults?: number };
    stages: Record<string, { cleared: boolean; stars?: number }>;
    activeMount: MountId;
    mounts: Partial<Record<MountId, { level: number }>>;
  };
  addItem(item: string, qty?: number): void;
  grantCosmetics(ids: string[]): void;
  ownsCosmetic(id: string): boolean;
  addExp(amount: number, id?: MountId): number;
  owns(id: MountId): boolean;
}

export type Reward = { items?: Record<string, number>; cosmetics?: string[] };
function give(h: LiveHost, r: Reward) {
  for (const [k, v] of Object.entries(r.items ?? {})) h.addItem(k, v);
  if (r.cosmetics?.length) h.grantCosmetics(r.cosmetics.filter((c) => !h.ownsCosmetic(c)));
}
export function rewardLabel(r: Reward, names: (id: string) => string): string {
  const parts = Object.entries(r.items ?? {}).map(([k, v]) => `${names(k)} ${v}`);
  for (const c of r.cosmetics ?? []) parts.push(names(c));
  return parts.join(' · ');
}

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hashStr = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// ---------------- 출석 (7일 주기, 빠진 날이 있어도 이어서) ----------------
export const LOGIN_REWARDS: Reward[] = [
  { items: { gold: 200 } },
  { items: { yakgwa: 2, gold: 100 } },
  { items: { spirit_stone: 3 } },
  { items: { gold: 500 } },
  { items: { spirit_stone: 5 } },
  { items: { moon_petal: 5, gold: 300 } },
  { items: { spirit_stone: 10, gold: 500 }, cosmetics: ['decor_knot'] },
];
export const canClaimLogin = (h: LiveHost, now = Date.now()) => h.data.daily.loginClaimedOn !== dayKey(now);
export function claimLogin(h: LiveHost, now = Date.now()): number {
  if (!canClaimLogin(h, now)) return -1;
  const idx = h.data.daily.loginDays % 7;
  give(h, LOGIN_REWARDS[idx]);
  h.data.daily.loginDays++;
  h.data.daily.loginClaimedOn = dayKey(now);
  addPassXp(h, 50);
  return idx;
}

// ---------------- 일일 임무 (하루 3개, 자정에 바뀜) ----------------
export type MissionStat = 'defeats' | 'clears' | 'coins' | 'ults' | 'distance';
export interface MissionDef { id: string; name: string; desc: string; stat: MissionStat; target: number }
export const MISSIONS: MissionDef[] = [
  { id: 'm_defeat', name: '요괴 사냥', desc: '몬스터 15마리 물리치기', stat: 'defeats', target: 15 },
  { id: 'm_clear', name: '구간 돌파', desc: '아무 구간이나 2번 돌파하기', stat: 'clears', target: 2 },
  { id: 'm_coin', name: '엽전 모으기', desc: '엽전 40개 줍기', stat: 'coins', target: 40 },
  { id: 'm_ult', name: '필살기 수련', desc: '필살기 3번 쓰기', stat: 'ults', target: 3 },
  { id: 'm_run', name: '먼 길', desc: '영물을 타고 800m 달리기', stat: 'distance', target: 800 },
];
export const MISSION_REWARD: Reward = { items: { gold: 120 } };
export const MISSION_BONUS: Reward = { items: { spirit_stone: 3, gold: 200 } };
const statOf = (h: LiveHost, s: MissionStat) => Math.floor(h.data.stats[s] ?? 0);

export function ensureDaily(h: LiveHost, now = Date.now()) {
  const d = h.data.daily;
  const today = dayKey(now);
  if (d.missionsDay === today) return;
  const pool = [...MISSIONS];
  const pick: MissionDef[] = [];
  let seed = hashStr(today);
  while (pick.length < 3) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    pick.push(pool.splice(seed % pool.length, 1)[0]);
  }
  d.missions = pick.map((m) => ({ id: m.id, base: statOf(h, m.stat), claimed: false }));
  d.missionsDay = today;
  d.bonusClaimed = false;
}
export function missionProgress(h: LiveHost, m: { id: string; base: number }) {
  const def = MISSIONS.find((x) => x.id === m.id)!;
  return Math.min(def.target, Math.max(0, statOf(h, def.stat) - m.base));
}
export const missionDone = (h: LiveHost, m: { id: string; base: number }) => missionProgress(h, m) >= MISSIONS.find((x) => x.id === m.id)!.target;
export function claimMission(h: LiveHost, id: string): boolean {
  const m = h.data.daily.missions.find((x) => x.id === id);
  if (!m || m.claimed || !missionDone(h, m)) return false;
  m.claimed = true;
  give(h, MISSION_REWARD);
  addPassXp(h, 100);
  return true;
}
export const canClaimBonus = (h: LiveHost) => !h.data.daily.bonusClaimed && h.data.daily.missions.length === 3 && h.data.daily.missions.every((m) => m.claimed);
export function claimBonus(h: LiveHost): boolean {
  if (!canClaimBonus(h)) return false;
  h.data.daily.bonusClaimed = true;
  give(h, MISSION_BONUS);
  addPassXp(h, 150);
  return true;
}

// ---------------- 영물 수행록 (시즌 패스: 무료 + 프리미엄) ----------------
export const PASS = { season: 's1', name: '영물 수행록 · 시즌 1 「월하의 첫걸음」', levels: 30, xpPerLevel: 300 };
export const passLevel = (xp: number) => Math.min(PASS.levels, Math.floor(xp / PASS.xpPerLevel));
export function passFree(lv: number): Reward {
  if (lv % 10 === 0) return { items: { spirit_stone: 8, moon_petal: 5 } };
  if (lv % 5 === 0) return { items: { spirit_stone: 5 } };
  if (lv % 2 === 0) return { items: { gold: 200 } };
  return lv % 3 === 0 ? { items: { yakgwa: 1, gold: 80 } } : { items: { spirit_stone: 1, gold: 60 } };
}
const PASS_COSMETICS: Record<number, string> = { 5: 'trail_footprint', 10: 'skin_wolf_moon', 15: 'outfit_saekdong', 20: 'trail_petal', 25: 'decor_bell', 30: 'skin_baekho_moon' };
export function passPremium(lv: number): Reward {
  const c = PASS_COSMETICS[lv];
  return c ? { items: { spirit_stone: 3 }, cosmetics: [c] } : { items: { spirit_stone: 2, gold: 150 } };
}
export function addPassXp(h: LiveHost, n: number) {
  h.data.pass.xp = Math.min(PASS.levels * PASS.xpPerLevel, h.data.pass.xp + n);
}
export function canClaimPass(h: LiveHost, track: 'free' | 'prem', lv: number) {
  const p = h.data.pass;
  if (lv < 1 || lv > passLevel(p.xp)) return false;
  if (track === 'prem' && !p.premium) return false;
  return !(track === 'free' ? p.free : p.prem).includes(lv);
}
export function claimPass(h: LiveHost, track: 'free' | 'prem', lv: number): boolean {
  if (!canClaimPass(h, track, lv)) return false;
  (track === 'free' ? h.data.pass.free : h.data.pass.prem).push(lv);
  give(h, track === 'free' ? passFree(lv) : passPremium(lv));
  return true;
}
export function passClaimable(h: LiveHost): number {
  const lv = passLevel(h.data.pass.xp);
  let n = 0;
  for (let i = 1; i <= lv; i++) {
    if (canClaimPass(h, 'free', i)) n++;
    if (canClaimPass(h, 'prem', i)) n++;
  }
  return n;
}

// ---------------- 달빛 정기권 (30일, 매일 접속해 받기) ----------------
export const MONTHLY = { days: 30, instant: { items: { spirit_stone: 10 } } as Reward, daily: { items: { spirit_stone: 3, gold: 100 } } as Reward };
const DAY = 86400_000;
export function activateMonthly(h: LiveHost, now = Date.now()) {
  h.data.monthly.until = Math.max(h.data.monthly.until, now) + MONTHLY.days * DAY;
  give(h, MONTHLY.instant);
}
export const monthlyActive = (h: LiveHost, now = Date.now()) => h.data.monthly.until > now;
export const monthlyDaysLeft = (h: LiveHost, now = Date.now()) => Math.max(0, Math.ceil((h.data.monthly.until - now) / DAY));
export const canClaimMonthly = (h: LiveHost, now = Date.now()) => monthlyActive(h, now) && h.data.monthly.lastClaim !== dayKey(now);
export function claimMonthly(h: LiveHost, now = Date.now()): boolean {
  if (!canClaimMonthly(h, now)) return false;
  h.data.monthly.lastClaim = dayKey(now);
  give(h, MONTHLY.daily);
  return true;
}

// ---------------- 영물 원정 (접속하지 않아도 시간이 흐르면 보상) ----------------
export const EXPEDITIONS = [
  { hours: 1, name: '가까운 숲' },
  { hours: 4, name: '먼 산자락' },
  { hours: 8, name: '미지의 땅' },
];
export const MAX_EXPEDITIONS = 3;
export function expeditionReward(level: number, hours: number): { gold: number; stones: number; exp: number } {
  return { gold: Math.round(hours * (50 + level * 4)), stones: Math.max(1, Math.floor(hours * 0.75)), exp: Math.round(hours * (40 + level * 6)) };
}
export function canStartExpedition(h: LiveHost, id: MountId): string | null {
  if (!h.owns(id)) return '아직 동료가 아닌 영물';
  if (h.data.activeMount === id) return '지금 함께 달리는 영물은 보낼 수 없어요';
  if (h.data.expeditions[id]) return '이미 원정 중';
  if (Object.keys(h.data.expeditions).length >= MAX_EXPEDITIONS) return `원정은 동시에 ${MAX_EXPEDITIONS}마리까지`;
  return null;
}
export function startExpedition(h: LiveHost, id: MountId, hours: number, now = Date.now()): boolean {
  if (canStartExpedition(h, id)) return false;
  h.data.expeditions[id] = { start: now, hours };
  return true;
}
export const expeditionLeftMs = (h: LiveHost, id: MountId, now = Date.now()) => {
  const e = h.data.expeditions[id];
  return e ? Math.max(0, e.start + e.hours * 3600_000 - now) : 0;
};
export function claimExpedition(h: LiveHost, id: MountId, now = Date.now()): { gold: number; stones: number; exp: number } | null {
  const e = h.data.expeditions[id];
  if (!e || expeditionLeftMs(h, id, now) > 0) return null;
  const r = expeditionReward(h.data.mounts[id]?.level ?? 1, e.hours);
  delete h.data.expeditions[id];
  h.addItem('gold', r.gold);
  if (r.stones) h.addItem('spirit_stone', r.stones);
  h.addExp(r.exp, id);
  return r;
}
export const expeditionsReady = (h: LiveHost, now = Date.now()) => (Object.keys(h.data.expeditions) as MountId[]).filter((id) => expeditionLeftMs(h, id, now) === 0).length;

// ---------------- 구간 별 ★ · 지역 별 보상 ----------------
/** ★1 돌파 · ★2 보물 상자 모두 · ★3 한 번도 쓰러지지 않고 돌파 */
export function computeStars(allChests: boolean, noFaint: boolean) {
  return 1 + (allChests ? 1 : 0) + (noFaint ? 1 : 0);
}
export const REGION_STAR_REWARDS: { stars: number; reward: Reward }[] = [
  { stars: 6, reward: { items: { gold: 300, yakgwa: 2 } } },
  { stars: 12, reward: { items: { spirit_stone: 6, gold: 300 } } },
  { stars: 18, reward: { items: { spirit_stone: 12, moon_petal: 10 } } },
];
export function regionStars(h: LiveHost, n: number) {
  return Object.entries(h.data.stages).filter(([id]) => id.startsWith(`${n}-`)).reduce((a, [, r]) => a + (r.stars ?? (r.cleared ? 1 : 0)), 0);
}
export const canClaimRegion = (h: LiveHost, n: number, i: number) => !h.data.regionRewards.includes(`r${n}_${i}`) && regionStars(h, n) >= REGION_STAR_REWARDS[i].stars;
export function claimRegion(h: LiveHost, n: number, i: number): boolean {
  if (!canClaimRegion(h, n, i)) return false;
  h.data.regionRewards.push(`r${n}_${i}`);
  give(h, REGION_STAR_REWARDS[i].reward);
  return true;
}

/** 빨간 점: 받을 수 있는 보상 개수 */
export function claimables(h: LiveHost, now = Date.now()) {
  ensureDaily(h, now);
  const missions = h.data.daily.missions.filter((m) => !m.claimed && missionDone(h, m)).length + (canClaimBonus(h) ? 1 : 0);
  const stars = REGIONS.reduce((a, r) => a + REGION_STAR_REWARDS.filter((_, i) => canClaimRegion(h, r.n, i)).length, 0);
  return {
    daily: (canClaimLogin(h, now) ? 1 : 0) + missions + (canClaimMonthly(h, now) ? 1 : 0),
    pass: passClaimable(h),
    expedition: expeditionsReady(h, now),
    stars,
  };
}
