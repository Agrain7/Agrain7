// 월하산맥 (月下山脈) 1-1 ~ 1-6
// 좌표 단위: 월드 px. y는 아래로 증가. 지면(ground)은 top에서 월드 바닥까지 채워진다.
// 기본 늑대 점프: 최고 높이 약 150px, 수평 약 260px → 기본 경로의 틈은 220px 이하, 계단은 120px 이하로 설계.

import type { StageMap } from './types.ts';
import { generateRegions } from './generate.ts';
export type { StageMap, TerrainStyle, PlatformStyle } from './types.ts';

const G = 860; // 기본 지면 높이
const H = 1080;

const coins = (x0: number, y: number, n: number, gap = 46, id = 'c'): StageMap['pickups'] =>
  Array.from({ length: n }, (_, i) => ({ id: `${id}${x0}_${i}`, type: 'coin' as const, x: x0 + i * gap, y }));
const arc = (x0: number, y: number, n: number, id: string): StageMap['pickups'] =>
  Array.from({ length: n }, (_, i) => ({ id: `${id}${x0}_${i}`, type: 'coin' as const, x: x0 + i * 42, y: y - Math.sin((i / (n - 1)) * Math.PI) * 80 }));

/** 1지역 (손으로 만든 구간) */
export const WOLHA_STAGES: StageMap[] = [
  {
    id: '1-1', index: 0, name: '월하산맥', subtitle: '산자락의 오솔길', sky: 'dusk', tier: 0, clearExp: 60,
    intro: '달빛이 내려앉는 산자락. 영물과 함께 첫걸음을 내딛자.',
    width: 4300, height: H, spawn: { x: 160, y: G - 40 },
    ground: [
      { x0: 0, x1: 980, top: G }, { x0: 980, x1: 1520, top: G - 70 }, { x0: 1660, x1: 2340, top: G },
      { x0: 2620, x1: 3360, top: G }, { x0: 3540, x1: 4300, top: G },
    ],
    blocks: [{ x: 3000, y: G - 110, w: 180, h: 110, style: 'stone' }],
    platforms: [
      { x: 1180, y: G - 210, w: 170, style: 'wood' }, { x: 2340, y: G - 40, w: 280, style: 'bridge' },
      { x: 1960, y: G - 170, w: 150, style: 'wood' }, { x: 3380, y: G - 60, w: 160, style: 'bridge' },
    ],
    hazards: [], updrafts: [], monsters: [],
    chests: [{ id: '1-1-a', x: 1265, y: G - 210, loot: { gold: 40, spirit_stone: 1 } }],
    pickups: [
      ...coins(420, G - 40, 6), ...arc(1530, G - 70, 4, 'a'), ...coins(1990, G - 210, 3), ...arc(2380, G - 80, 6, 'b'),
      ...coins(3020, G - 150, 4), ...coins(3700, G - 40, 6),
      { id: 'lore-1-1', type: 'lore_page', x: 2035, y: G - 230 },
    ],
    checkpoints: [{ x: 1720, y: G }, { x: 2700, y: G }],
    decor: [
      { type: 'pavilion', x: 560, y: G, s: 1 }, { type: 'tree', x: 120, y: G, s: 1.1 }, { type: 'lantern', x: 900, y: G },
      { type: 'tree', x: 1420, y: G - 70, s: 0.9 }, { type: 'pine', x: 2150, y: G, s: 1 }, { type: 'arch', x: 2480, y: G - 40 },
      { type: 'rock', x: 2900, y: G }, { type: 'tree', x: 3250, y: G, s: 1.2 }, { type: 'pine', x: 3800, y: G, s: 0.9 }, { type: 'grass', x: 700, y: G },
      { type: 'grass', x: 1800, y: G }, { type: 'grass', x: 3650, y: G },
    ],
    signs: [
      { x: 300, y: G, text: '← → 로 이동', pc: 'A / D 또는 ← → 로 이동' },
      { x: 860, y: G, text: '점프 버튼으로 뛰어오르기', pc: 'Space 로 점프 (길게 누르면 더 높이)' },
      { x: 1600, y: G - 70, text: '틈새를 뛰어넘자' },
      { x: 2760, y: G, text: '돌진 버튼으로 빠르게 질주', pc: 'X 로 돌진' },
      { x: 3540, y: G, text: '홍살문에 닿으면 구간 돌파!' },
    ],
    goal: { x: 4150, y: G },
  },
  {
    id: '1-2', index: 1, name: '월하산맥', subtitle: '매화 숲의 습격', sky: 'dusk', tier: 0, clearExp: 90,
    intro: '어둠에 물든 산짐승들이 숲을 어지럽히고 있다.',
    width: 5300, height: H, spawn: { x: 160, y: G - 40 },
    ground: [
      { x0: 0, x1: 1300, top: G }, { x0: 1300, x1: 1800, top: G - 90 }, { x0: 1800, x1: 2600, top: G },
      { x0: 2800, x1: 3700, top: G }, { x0: 3700, x1: 4200, top: G - 80 }, { x0: 4380, x1: 5300, top: G },
    ],
    blocks: [{ x: 2300, y: G - 120, w: 160, h: 120, style: 'stone' }],
    platforms: [
      { x: 900, y: G - 200, w: 160, style: 'wood' }, { x: 1520, y: G - 290, w: 150, style: 'wood' }, { x: 1340, y: G - 200, w: 120, style: 'wood' },
      { x: 2600, y: G - 50, w: 200, style: 'bridge' }, { x: 3200, y: G - 190, w: 180, style: 'wood' },
      { x: 3420, y: G - 320, w: 140, style: 'wood' }, { x: 4200, y: G - 60, w: 180, style: 'bridge' },
    ],
    hazards: [], updrafts: [],
    monsters: [
      { type: 'boar', x: 760, y: G }, { type: 'boar', x: 1500, y: G - 90 }, { type: 'dokkaebi', x: 2100, y: G },
      { type: 'boar', x: 2950, y: G }, { type: 'dokkaebi', x: 3500, y: G }, { type: 'boar', x: 3900, y: G - 80 },
      { type: 'dokkaebi', x: 4600, y: G }, { type: 'boar', x: 4900, y: G },
    ],
    chests: [
      { id: '1-2-a', x: 980, y: G - 200, loot: { gold: 50, yakgwa: 1 } },
      { id: '1-2-b', x: 3490, y: G - 320, loot: { gold: 70, spirit_stone: 2 } },
    ],
    pickups: [
      ...coins(300, G - 40, 5), ...arc(1100, G - 40, 5, 'a'), ...coins(1880, G - 40, 6), ...arc(2580, G - 100, 6, 'b'),
      ...coins(3000, G - 40, 4), ...coins(3720, G - 120, 5), ...coins(4500, G - 40, 6),
      { id: 'pearl-1', type: 'pearl_shard', x: 1595, y: G - 340 },
    ],
    checkpoints: [{ x: 1860, y: G }, { x: 3760, y: G - 80 }],
    decor: [
      { type: 'tree', x: 300, y: G, s: 1.2 }, { type: 'tree', x: 700, y: G, s: 0.9 }, { type: 'lantern', x: 1250, y: G },
      { type: 'tree', x: 1650, y: G - 90, s: 1 }, { type: 'pine', x: 2000, y: G, s: 1.1 }, { type: 'arch', x: 2700, y: G - 50 },
      { type: 'tree', x: 3100, y: G, s: 1.3 }, { type: 'pavilion', x: 3950, y: G - 80, s: 0.9 }, { type: 'tree', x: 4700, y: G, s: 1 },
      { type: 'grass', x: 500, y: G }, { type: 'grass', x: 2200, y: G }, { type: 'grass', x: 4500, y: G },
    ],
    signs: [
      { x: 520, y: G, text: '공격 버튼으로 몬스터를 물리치자', pc: 'Z 로 공격, C 로 특수 기술, V 로 필살기' },
      { x: 1360, y: G - 90, text: '높은 곳에 무언가 빛나고 있다…' },
    ],
    goal: { x: 5150, y: G },
  },
  {
    id: '1-3', index: 2, name: '월하산맥', subtitle: '벼랑길과 용신 사당', sky: 'dusk', tier: 1, clearExp: 120,
    intro: '험한 벼랑길 끝에 오래된 용신 사당이 있다고 한다.',
    width: 5800, height: H, spawn: { x: 160, y: G - 40 },
    ground: [
      { x0: 0, x1: 820, top: G }, { x0: 1020, x1: 1400, top: G - 60 }, { x0: 1600, x1: 1900, top: G - 140 },
      { x0: 2080, x1: 2900, top: G, style: 'cave' }, { x0: 3080, x1: 3400, top: G - 100 }, { x0: 3600, x1: 4300, top: G },
      { x0: 4480, x1: 5800, top: G },
    ],
    blocks: [
      { x: 2080, y: 520, w: 820, h: 140, style: 'cave' }, // 동굴 천장
      { x: 3820, y: G - 130, w: 140, h: 130, style: 'stone' },
      { x: 4000, y: G - 240, w: 120, h: 240, style: 'stone' },
    ],
    platforms: [
      { x: 840, y: G - 80, w: 160, style: 'stone' }, { x: 1420, y: G - 120, w: 160, style: 'stone' },
      { x: 1920, y: G - 90, w: 140, style: 'stone' }, { x: 2900, y: G - 60, w: 170, style: 'bridge' },
      { x: 3420, y: G - 60, w: 170, style: 'bridge' }, { x: 2950, y: 420, w: 160, style: 'cloud' },
      { x: 4300, y: G - 40, w: 170, style: 'bridge' }, { x: 1200, y: G - 260, w: 130, style: 'wood' },
      { x: 1050, y: G - 170, w: 110, style: 'wood' }, { x: 1740, y: 610, w: 140, style: 'wood' },
    ],
    hazards: [
      { x: 2300, y: G - 22, w: 120, h: 22 }, { x: 2620, y: G - 22, w: 110, h: 22 }, { x: 3700, y: G - 22, w: 100, h: 22 },
    ],
    updrafts: [],
    monsters: [
      { type: 'fox', x: 1250, y: G - 60 }, { type: 'boar', x: 2200, y: G }, { type: 'dokkaebi', x: 2500, y: G },
      { type: 'fox', x: 3250, y: G - 100 }, { type: 'boar', x: 3650, y: G }, { type: 'dokkaebi', x: 4650, y: G }, { type: 'fox', x: 5000, y: G },
    ],
    chests: [{ id: '1-3-a', x: 2780, y: G, loot: { gold: 80, spirit_stone: 2, silk_thread: 2 } }],
    pickups: [
      ...coins(300, G - 40, 4), ...arc(830, G - 120, 5, 'a'), ...coins(1650, G - 180, 4), ...coins(2150, G - 40, 3),
      ...coins(3120, G - 140, 5), ...coins(4520, G - 40, 6),
      { id: 'pearl-2', type: 'pearl_shard', x: 1265, y: G - 310 }, // 높은 나무 발판
      { id: 'pearl-3', type: 'pearl_shard', x: 3030, y: 380 }, // 동굴 위 구름 발판 (벽 점프 대신 이단 점프/활공 또는 바위 발판)
      { id: 'lore-1-3', type: 'lore_page', x: 4060, y: G - 290 },
    ],
    checkpoints: [{ x: 1650, y: G - 140 }, { x: 3120, y: G - 100 }, { x: 4520, y: G }],
    decor: [
      { type: 'pine', x: 200, y: G, s: 1.2 }, { type: 'rock', x: 600, y: G }, { type: 'pine', x: 1300, y: G - 60, s: 0.9 },
      { type: 'lantern', x: 2120, y: G }, { type: 'lantern', x: 2860, y: G }, { type: 'pine', x: 3300, y: G - 100, s: 1 },
      { type: 'tree', x: 4600, y: G, s: 1.1 }, { type: 'grass', x: 3650, y: G },
    ],
    signs: [
      { x: 900, y: G - 80, text: '가시덤불을 조심하자' },
      { x: 1700, y: G - 140, text: '나무 발판을 밟고 동굴 지붕 위로 올라가 보자' },
      { x: 4900, y: G, text: '용신 사당: 여의주 조각 3개를 바치면 청룡이 깨어난다' },
    ],
    shrine: { x: 5250, y: G },
    goal: { x: 5650, y: G },
  },
  {
    id: '1-4', index: 3, name: '월하산맥', subtitle: '구름다리 협곡', sky: 'mist', tier: 2, clearExp: 160,
    intro: '깊은 협곡 위로 구름 발판이 떠 있다. 상승 기류를 타고 건너자.',
    width: 6200, height: 1400, spawn: { x: 160, y: 1180 - 40 },
    ground: [
      { x0: 0, x1: 700, top: 1180 }, { x0: 2100, x1: 2500, top: 1120 }, { x0: 4100, x1: 4500, top: 1150 }, { x0: 5700, x1: 6200, top: 1180 },
    ],
    blocks: [{ x: 3200, y: 360, w: 360, h: 60, style: 'stone' }],
    platforms: [
      // 첫 협곡 (700~2100)
      { x: 760, y: 1110, w: 150, style: 'cloud' }, { x: 980, y: 1050, w: 140, style: 'cloud' }, { x: 1200, y: 1100, w: 150, style: 'cloud' },
      { x: 1430, y: 1040, w: 140, style: 'cloud' }, { x: 1650, y: 1090, w: 150, style: 'cloud' }, { x: 1880, y: 1070, w: 150, style: 'cloud' },
      // 두 번째 협곡 (2500~4100) — 상승 기류 사용
      { x: 2560, y: 1060, w: 140, style: 'cloud' }, { x: 2980, y: 980, w: 140, style: 'cloud' }, { x: 3320, y: 1040, w: 150, style: 'cloud' },
      { x: 3560, y: 980, w: 140, style: 'cloud' }, { x: 3820, y: 1060, w: 150, style: 'cloud' },
      // 세 번째 협곡 (4500~5700)
      { x: 4560, y: 1090, w: 140, style: 'cloud' }, { x: 4790, y: 1030, w: 140, style: 'cloud' }, { x: 5020, y: 1090, w: 140, style: 'cloud' },
      { x: 5250, y: 1030, w: 140, style: 'cloud' }, { x: 5480, y: 1100, w: 150, style: 'cloud' },
      // 하늘 길 (비행/날갯짓 전용)
      { x: 1300, y: 640, w: 160, style: 'cloud' }, { x: 1700, y: 520, w: 160, style: 'cloud' }, { x: 4700, y: 560, w: 180, style: 'cloud' },
    ],
    hazards: [],
    updrafts: [
      { x: 2780, y: 700, w: 120, h: 480 }, { x: 3160, y: 600, w: 120, h: 560 }, { x: 4300, y: 500, w: 120, h: 640 },
    ],
    monsters: [
      { type: 'bat', x: 1100, y: 900 }, { type: 'bat', x: 1700, y: 880 }, { type: 'boar', x: 2300, y: 1120 },
      { type: 'bat', x: 3000, y: 820 }, { type: 'bat', x: 3600, y: 840 }, { type: 'fox', x: 4300, y: 1150 },
      { type: 'bat', x: 4900, y: 880 }, { type: 'bat', x: 5300, y: 860 }, { type: 'dokkaebi', x: 5900, y: 1180 },
    ],
    chests: [
      { id: '1-4-sky', x: 3380, y: 360, loot: { gold: 150, spirit_stone: 4 } },
      { id: '1-4-a', x: 2400, y: 1120, loot: { gold: 60, yakgwa: 1 } },
    ],
    pickups: [
      ...coins(820, 1050, 3), ...coins(1450, 990, 3), ...arc(2580, 1000, 5, 'a'), ...coins(2810, 760, 3, 40), ...coins(3190, 660, 3, 40),
      ...coins(4580, 1030, 3), ...coins(5260, 970, 3), ...coins(1720, 470, 4), ...coins(4720, 510, 4),
      { id: 'lore-1-4', type: 'lore_page', x: 1780, y: 470 },
    ],
    checkpoints: [{ x: 2160, y: 1120 }, { x: 4160, y: 1150 }],
    decor: [
      { type: 'pine', x: 200, y: 1180, s: 1.1 }, { type: 'pavilion', x: 450, y: 1180, s: 0.9 }, { type: 'pine', x: 2350, y: 1120, s: 1 },
      { type: 'shrine', x: 3380, y: 360, s: 0.7 }, { type: 'lantern', x: 4450, y: 1150 }, { type: 'tree', x: 5900, y: 1180, s: 1.2 },
    ],
    signs: [
      { x: 560, y: 1180, text: '구름 발판을 건너자. 매는 점프를 누른 채 활공!', pc: '매: Space 를 누른 채 활공' },
      { x: 2440, y: 1120, text: '빛나는 상승 기류 안에서 점프를 누르면 떠오른다' },
    ],
    goal: { x: 6050, y: 1180 },
  },
  {
    id: '1-5', index: 4, name: '월하산맥', subtitle: '바위 정령의 산사', sky: 'dusk', tier: 3, clearExp: 200,
    intro: '오래된 산사를 바위 정령이 지키고 있다. 숨겨진 보물도 있다던데…',
    width: 6000, height: H, spawn: { x: 160, y: G - 40 },
    ground: [
      { x0: 0, x1: 1500, top: G }, { x0: 1500, x1: 2100, top: G - 100, style: 'stone' }, { x0: 2300, x1: 3300, top: G },
      { x0: 3500, x1: 4500, top: G }, { x0: 4500, x1: 4900, top: G - 120, style: 'stone' }, { x0: 5080, x1: 6000, top: G },
    ],
    blocks: [
      { x: 2600, y: 380, w: 520, h: 50, style: 'stone' }, // 구름 위 암자 바닥 (높은 곳)
      { x: 3500, y: G - 150, w: 100, h: 150, style: 'stone' },
    ],
    platforms: [
      { x: 700, y: G - 200, w: 160, style: 'wood' }, { x: 2100, y: G - 70, w: 200, style: 'bridge' },
      { x: 2380, y: G - 210, w: 140, style: 'wood' }, { x: 2470, y: G - 360, w: 130, style: 'cloud' },
      { x: 3300, y: G - 60, w: 200, style: 'bridge' }, { x: 4900, y: G - 60, w: 180, style: 'bridge' },
      { x: 4200, y: G - 220, w: 150, style: 'wood' },
    ],
    hazards: [{ x: 3950, y: G - 22, w: 140, h: 22 }],
    updrafts: [],
    monsters: [
      { type: 'boar', x: 600, y: G }, { type: 'fox', x: 1100, y: G }, { type: 'rock', x: 1800, y: G - 100 },
      { type: 'dokkaebi', x: 2700, y: G }, { type: 'bat', x: 3000, y: 640 }, { type: 'fox', x: 3800, y: G },
      { type: 'boar', x: 4200, y: G }, { type: 'rock', x: 5500, y: G }, { type: 'dokkaebi', x: 5200, y: G },
    ],
    chests: [
      { id: '1-5-hermit', x: 2850, y: 380, loot: { gold: 200, spirit_stone: 5, lore_page: 1 } },
      { id: '1-5-a', x: 780, y: G - 200, loot: { gold: 80, yakgwa: 1 } },
      { id: '1-5-b', x: 4270, y: G - 220, loot: { gold: 90, spirit_stone: 2 } },
    ],
    pickups: [
      ...coins(300, G - 40, 5), ...coins(1550, G - 140, 6), ...coins(2350, G - 40, 4), ...coins(2700, 330, 6),
      ...coins(3550, G - 190, 3), ...coins(4560, G - 160, 5), ...coins(5150, G - 40, 5),
      { id: 'lore-1-5', type: 'lore_page', x: 3000, y: 330 },
    ],
    checkpoints: [{ x: 1560, y: G - 100 }, { x: 3560, y: G }, { x: 5120, y: G }],
    decor: [
      { type: 'pine', x: 250, y: G, s: 1.2 }, { type: 'lantern', x: 1450, y: G }, { type: 'pavilion', x: 1900, y: G - 100, s: 1.1 },
      { type: 'shrine', x: 2950, y: 380, s: 0.8 }, { type: 'tree', x: 3200, y: G, s: 1.1 }, { type: 'rock', x: 4000, y: G },
      { type: 'pine', x: 4700, y: G - 120, s: 1 }, { type: 'tree', x: 5700, y: G, s: 1.2 },
    ],
    signs: [
      { x: 1450, y: G, text: '정예 몬스터: 바위 정령은 단단하다. 특수 기술을 쓰자!' },
      { x: 2330, y: G, text: '구름 위 암자로 가는 길이 있다' },
    ],
    goal: { x: 5850, y: G },
  },
  {
    id: '1-6', index: 5, name: '월하산맥', subtitle: '수호 요괴의 제단', sky: 'dusk', tier: 4, clearExp: 300,
    intro: '산맥의 수호신이 어둠에 물들었다. 정화하자!',
    width: 2900, height: H, spawn: { x: 160, y: G - 40 },
    ground: [{ x0: 0, x1: 2900, top: G }],
    blocks: [{ x: 2860, y: 0, w: 40, h: G }],
    platforms: [{ x: 1200, y: G - 180, w: 170, style: 'stone' }, { x: 2380, y: G - 180, w: 170, style: 'stone' }, { x: 1790, y: G - 300, w: 170, style: 'stone' }],
    hazards: [], updrafts: [], monsters: [],
    chests: [], pickups: [...coins(300, G - 40, 6)],
    checkpoints: [{ x: 700, y: G }],
    decor: [{ type: 'lantern', x: 600, y: G }, { type: 'lantern', x: 840, y: G }, { type: 'shrine', x: 2600, y: G, s: 1.2 }],
    signs: [{ x: 420, y: G, text: '이 앞은 수호 요괴의 제단. 준비가 되면 나아가자.' }],
    boss: { x: 2300, y: G, arena: [940, 2860] },
    goal: { x: 2700, y: G },
  },
];

/** 모든 구간: 1지역 + 생성기로 만든 2~6지역 (5지역 × 6구간) */
export const STAGES: StageMap[] = [...WOLHA_STAGES, ...generateRegions()];

/** (예전 이름 호환) 추후 지역 — 이제 모두 열려 있음 */
export const FUTURE_REGIONS: string[] = [];

export function stageById(id: string) {
  return STAGES.find((s) => s.id === id);
}
