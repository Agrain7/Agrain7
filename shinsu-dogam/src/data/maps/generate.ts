// 2~6지역 구간 생성기 (같은 씨앗이면 언제나 같은 지도).
// 기본 늑대 점프(높이 약 150px, 거리 약 260px)로 갈 수 있도록 규칙을 지킨다:
//  - 지면 사이 틈은 200px 이하, 그보다 넓으면 다리나 구름 발판을 깐다
//  - 오르막 계단은 한 번에 100px 이하, 구름 발판끼리는 가로 70px·세로 60px 이내
//  - 가시(불길)는 180px 이하라 뛰어넘을 수 있다
//  - 상승 기류는 선택 길(보물·고서)에만 쓰고, 기본 길에는 쓰지 않는다
import type { StageMap } from './types.ts';
import { REGIONS, type RegionDef, type Feature } from '../regions.ts';

const G = 860;
const H = 1080;
const TOP_MIN = G - 200;
const TOP_MAX = G + 40;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);

function weighted<T extends string>(r: () => number, w: Partial<Record<T, number>>): T {
  const entries = Object.entries(w) as [T, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let x = r() * total;
  for (const [k, v] of entries) if ((x -= v) <= 0) return k;
  return entries[entries.length - 1][0];
}

const SUBTITLES: Record<string, string[]> = {
  unmu: ['안개 낀 협곡 입구', '구름다리 계곡', '바람이 우는 벼랑', '구름 위 오솔길', '안개 폭포 아래', '기린의 안개 제단'],
  yonggung: ['바닷가 산호 길', '물기둥 회랑', '진주 정원', '용왕의 수문', '심해의 다리', '흑현무의 둥지'],
  hwayeom: ['붉은 계곡 입구', '불길 뛰어넘기', '주작의 불씨 터', '용암 다리', '타오르는 돌계단', '해태의 화염 제단'],
  bongnae: ['신선의 산길', '구름 정원', '하늘 계단', '복숭아 숲', '천상의 문', '봉황의 둥지'],
  seolwon: ['눈보라 길', '얼어붙은 다리', '설원의 석탑', '빙벽 오르기', '신전 회랑', '흑룡의 제단'],
};

const INTROS: Record<string, string[]> = {
  unmu: ['안개 너머로 협곡이 열린다. 발밑을 조심하자.', '구름 발판을 건너 협곡을 가로지르자.', '바람 소리에 섞여 요괴의 울음이 들린다.', '구름 위로 길이 이어진다.', '안개 폭포 아래 숨은 보물이 있다고 한다.', '안개에 갇힌 기린을 구하자!'],
  yonggung: ['바닷물이 빠진 산호 길을 따라 용궁으로.', '물기둥을 타면 높은 곳에 닿을 수 있다.', '진주빛 정원에 요괴가 숨어 있다.', '용왕의 수문을 지나자.', '깊은 바다 위 다리를 건너자.', '심해에 갇힌 흑현무를 정화하자!'],
  hwayeom: ['땅이 끓는 계곡. 불길에 닿지 않게 뛰어넘자.', '불길 사이로 길을 찾자.', '주작의 불씨가 깃든 터. 끝까지 가면 주작을 만날 수 있다.', '용암 위 다리를 건너자.', '타오르는 돌계단을 오르자.', '불길에 삼켜진 해태를 정화하자!'],
  bongnae: ['신선이 다니던 산길.', '구름 정원을 건너자.', '하늘로 이어진 계단.', '복숭아꽃이 흩날리는 숲.', '천상의 문 앞에 섰다.', '빛을 잃은 봉황을 정화하자!'],
  seolwon: ['눈보라를 헤치고 신전으로.', '얼어붙은 다리를 건너자.', '설원의 석탑 사이로.', '빙벽을 오르자.', '신전 깊은 곳으로.', '모든 어둠의 근원, 흑룡과 마주하자!'],
};

/** 지역 하나의 6구간 */
export function generateRegion(R: RegionDef): StageMap[] {
  const out: StageMap[] = [];
  for (let i = 0; i < 6; i++) out.push(i === 5 ? bossStage(R) : normalStage(R, i));
  return out;
}

export function generateRegions(): StageMap[] {
  return REGIONS.filter((r) => r.n >= 2).flatMap(generateRegion);
}

function normalStage(R: RegionDef, i: number): StageMap {
  const id = `${R.n}-${i + 1}`;
  const r = mulberry32(hash(id + R.key));
  const ri = (a: number, b: number) => Math.round(a + r() * (b - a));
  const W = 4600 + i * 380 + R.n * 60;
  const tier = R.tier0 + i;
  const m: StageMap = {
    id, index: i, name: R.name, subtitle: SUBTITLES[R.key][i], intro: INTROS[R.key][i], sky: R.sky, region: R.n, tier,
    clearExp: 160 + R.n * 40 + i * 30,
    width: W, height: H, spawn: { x: 160, y: G - 40 },
    ground: [], blocks: [], platforms: [], hazards: [], updrafts: [], monsters: [], chests: [], pickups: [],
    checkpoints: [], decor: [], signs: [], goal: { x: 0, y: G },
  };
  let x = 0;
  let top = G;
  let lastCp = 0;
  let chestN = 0;
  let loreDone = false;
  const coinRow = (x0: number, y: number, n: number) => {
    for (let k = 0; k < n; k++) m.pickups.push({ id: `c${id}_${x0}_${k}`, type: 'coin', x: x0 + k * 44, y });
  };
  const coinArc = (x0: number, y: number, n: number) => {
    for (let k = 0; k < n; k++) m.pickups.push({ id: `a${id}_${x0}_${k}`, type: 'coin', x: x0 + k * 42, y: y - Math.sin((k / (n - 1)) * Math.PI) * 80 });
  };
  const chest = (cx: number, cy: number, rich = false) => {
    chestN++;
    m.chests.push({ id: `${id}-${chestN}`, x: cx, y: cy, loot: rich ? { gold: 80 + tier * 12, spirit_stone: 2 + Math.floor(tier / 4) } : { gold: 50 + tier * 8, yakgwa: 1 } });
  };
  const monster = (mx: number, my: number) => {
    const t = weighted(r, R.monsters as Record<string, number>);
    if (t === 'rock' && i < 2) return void m.monsters.push({ type: 'boar', x: mx, y: my });
    if (t === 'bat') return void m.monsters.push({ type: 'bat', x: mx, y: my - 220 });
    m.monsters.push({ type: t, x: mx, y: my });
  };
  const decorOn = (x0: number, x1: number, y: number) => {
    if (x1 - x0 < 260) return;
    const roll = r();
    const dx = x0 + 80 + r() * (x1 - x0 - 160);
    if (roll < 0.28) m.decor.push({ type: 'tree', x: dx, y, s: 0.9 + r() * 0.35 });
    else if (roll < 0.5) m.decor.push({ type: 'pine', x: dx, y, s: 0.85 + r() * 0.3 });
    else if (roll < 0.62) m.decor.push({ type: 'lantern', x: dx, y });
    else if (roll < 0.74) m.decor.push({ type: 'rock', x: dx, y });
    else m.decor.push({ type: 'grass', x: dx, y });
  };
  const ground = (x0: number, x1: number, t: number, style?: 'stone') => {
    m.ground.push(style ? { x0, x1, top: t, style } : { x0, x1, top: t });
    if (x0 - lastCp > 1500 && x0 > 600) { m.checkpoints.push({ x: x0 + 70, y: t }); lastCp = x0; }
    decorOn(x0, x1, t);
  };

  // 시작 땅
  ground(0, 760, G);
  if (i === 0) m.decor.push({ type: 'pavilion', x: 520, y: G, s: 0.95 });
  coinRow(320, G - 40, 5);
  x = 760;
  let pavilion = i === 0;

  while (x < W - 1000) {
    const f: Feature = weighted(r, R.features as Record<Feature, number>);
    switch (f) {
      case 'flat': {
        const len = ri(520, 820);
        ground(x, x + len, top);
        if (r() < 0.7) monster(x + len * 0.6, top);
        if (r() < 0.6) coinRow(x + 80, top - 40, ri(4, 6));
        if (!pavilion && len > 700 && r() < 0.5) { m.decor.push({ type: 'pavilion', x: x + len / 2, y: top, s: 0.9 }); pavilion = true; }
        x += len;
        break;
      }
      case 'step': {
        const dir = top <= TOP_MIN + 40 ? 1 : top >= TOP_MAX - 20 ? -1 : r() < 0.55 ? -1 : 1;
        top = Math.min(TOP_MAX, Math.max(TOP_MIN, top + dir * ri(50, 95)));
        const len = ri(460, 700);
        ground(x, x + len, top, r() < 0.3 ? 'stone' : undefined);
        if (r() < 0.6) monster(x + len * 0.5, top);
        coinArc(x + 60, top - 40, 5);
        x += len;
        break;
      }
      case 'gap': {
        const gw = ri(140, 200);
        x += gw;
        coinArc(x - gw - 20, top - 60, Math.max(3, Math.round(gw / 45)));
        top = Math.min(TOP_MAX, Math.max(TOP_MIN, top + ri(-60, 40)));
        const len = ri(480, 700);
        ground(x, x + len, top);
        if (r() < 0.55) monster(x + len * 0.55, top);
        x += len;
        break;
      }
      case 'bridge': {
        const gw = ri(300, 460);
        m.platforms.push({ x: x - 20, y: top - 40, w: gw + 40, style: 'bridge' });
        coinRow(x + 30, top - 80, Math.round(gw / 50));
        x += gw;
        const len = ri(480, 680);
        ground(x, x + len, top);
        if (r() < 0.6) monster(x + len * 0.5, top);
        x += len;
        break;
      }
      case 'clouds': {
        const n = ri(4, 6);
        const step = 205;
        const base = top;
        for (let k = 0; k < n; k++) {
          const py = base - 50 - (k % 2) * 45;
          m.platforms.push({ x: x + 50 + k * step, y: py, w: 145, style: 'cloud' });
          if (k % 2 === 1) coinRow(x + 70 + k * step, py - 40, 2);
        }
        if (r() < 0.6) m.monsters.push({ type: 'bat', x: x + (n * step) / 2, y: base - 300 });
        // 하늘 위 선택 길: 높은 구름 + 보물
        if (chestN < 3 && r() < 0.6) {
          const hx = x + 50 + Math.floor(n / 2) * step;
          m.platforms.push({ x: hx - 20, y: base - 290, w: 170, style: 'cloud' });
          m.updrafts.push({ x: hx - 160, y: base - 520, w: 120, h: 470 });
          chest(hx + 60, base - 290, true);
        }
        x += 50 + n * step + 40;
        top = Math.min(TOP_MAX, Math.max(TOP_MIN, base + ri(-40, 40)));
        const len = ri(480, 660);
        ground(x, x + len, top);
        if (r() < 0.5) monster(x + len * 0.6, top);
        x += len;
        break;
      }
      case 'block': {
        const len = ri(620, 820);
        ground(x, x + len, top);
        const bh = ri(80, 105), bw = ri(150, 210);
        m.blocks.push({ x: x + len * 0.45, y: top - bh, w: bw, h: bh, style: 'stone' });
        coinRow(x + len * 0.45 + 20, top - bh - 40, Math.round(bw / 50));
        if (r() < 0.6) monster(x + len * 0.2, top);
        x += len;
        break;
      }
      case 'stairs': {
        const len = ri(760, 940);
        ground(x, x + len, top);
        const k = ri(2, 3);
        for (let s = 0; s < k; s++) m.platforms.push({ x: x + 120 + s * 190, y: top - 110 - s * 90, w: 150, style: 'wood' });
        const ty = top - 110 - (k - 1) * 90;
        if (chestN < 3) chest(x + 120 + (k - 1) * 190 + 75, ty, r() < 0.5);
        else coinRow(x + 130 + (k - 1) * 190, ty - 40, 3);
        if (!loreDone && r() < 0.5) { m.pickups.push({ id: `lore-${id}`, type: 'lore_page', x: x + 120 + (k - 1) * 190 + 40, y: ty - 60 }); loreDone = true; }
        if (r() < 0.6) monster(x + len * 0.75, top);
        x += len;
        break;
      }
      case 'hazard': {
        const len = ri(700, 900);
        ground(x, x + len, top);
        const hw = ri(120, 180);
        m.hazards.push({ x: x + len * 0.5 - hw / 2, y: top - 22, w: hw, h: 22 });
        coinArc(x + len * 0.5 - hw / 2 - 30, top - 70, 5);
        if (r() < 0.5) monster(x + len * 0.15, top);
        x += len;
        break;
      }
      case 'updraft': {
        // 선택 길: 땅은 계속 이어지고, 기류를 타면 높은 발판의 보물·고서
        const len = ri(700, 860);
        ground(x, x + len, top);
        m.updrafts.push({ x: x + 200, y: top - 560, w: 120, h: 560 });
        m.platforms.push({ x: x + 330, y: top - 430, w: 170, style: 'cloud' });
        if (!loreDone) { m.pickups.push({ id: `lore-${id}`, type: 'lore_page', x: x + 415, y: top - 480 }); loreDone = true; }
        else coinRow(x + 345, top - 470, 3);
        if (chestN < 3) chest(x + 450, top - 430, true);
        if (r() < 0.5) monster(x + len * 0.8, top);
        x += len;
        break;
      }
      default: break;
    }
  }
  // 마지막 땅 + 홍살문
  top = Math.min(TOP_MAX, Math.max(TOP_MIN, top));
  const endLen = Math.max(700, W - x);
  ground(x, x + endLen, top);
  coinRow(x + 100, top - 40, 6);
  m.goal = { x: x + endLen - 160, y: top };
  m.width = x + endLen;
  if (chestN === 0) chest(x + 300, top);
  if (!loreDone) m.pickups.push({ id: `lore-${id}`, type: 'lore_page', x: x + 420, y: top - 60 });
  if (i === 0) m.signs.push({ x: 300, y: G, text: `${R.name} — ${R.intro.split('.')[0]}.` });
  return m;
}

function bossStage(R: RegionDef): StageMap {
  const id = `${R.n}-6`;
  const tier = R.tier0 + 4;
  return {
    id, index: 5, name: R.name, subtitle: SUBTITLES[R.key][5], intro: INTROS[R.key][5], sky: R.sky, region: R.n, tier,
    clearExp: 400 + R.n * 80,
    width: 2900, height: H, spawn: { x: 160, y: G - 40 },
    ground: [{ x0: 0, x1: 2900, top: G }],
    blocks: [{ x: 2860, y: 0, w: 40, h: G }],
    platforms: [{ x: 1200, y: G - 180, w: 170, style: 'stone' }, { x: 2380, y: G - 180, w: 170, style: 'stone' }, { x: 1790, y: G - 300, w: 170, style: 'stone' }],
    hazards: [], updrafts: [], monsters: [],
    chests: [], pickups: Array.from({ length: 6 }, (_, k) => ({ id: `c${id}_${k}`, type: 'coin' as const, x: 300 + k * 46, y: G - 40 })),
    checkpoints: [{ x: 700, y: G }],
    decor: [{ type: 'lantern', x: 600, y: G }, { type: 'lantern', x: 840, y: G }, { type: 'shrine', x: 2600, y: G, s: 1.2 }],
    signs: [{ x: 420, y: G, text: `이 앞은 ${R.bossName}의 제단. 준비가 되면 나아가자.` }],
    boss: { x: 2300, y: G, arena: [940, 2860] },
    goal: { x: 2700, y: G },
  };
}
