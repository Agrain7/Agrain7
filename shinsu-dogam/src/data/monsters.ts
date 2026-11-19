// 월하산맥 몬스터. 스테이지 번호에 따라 체력/공격력이 증가한다 (scaleMonster).
import type { MonsterDef } from './types.ts';

export const MONSTERS: Record<string, MonsterDef> = {
  boar: {
    id: 'boar', name: '붉은 눈의 산돼지', desc: '어둠의 기운에 물든 산돼지. 탐험가를 보면 앞뒤 가리지 않고 돌진한다.',
    ai: 'charger', hp: 30, atk: 10, def: 0, exp: 12, gold: [3, 6], speed: 80, body: { w: 70, h: 46 },
    drops: [{ item: 'spirit_stone', chance: 0.12, qty: [1, 1] }, { item: 'yakgwa', chance: 0.05, qty: [1, 1] }],
  },
  dokkaebi: {
    id: 'dokkaebi', name: '도깨비 멧돼지', desc: '도깨비 기운이 서린 날쌘 멧돼지. 깡충 뛰어올라 덮친다.',
    ai: 'hopper', hp: 42, atk: 12, def: 1, exp: 16, gold: [4, 8], speed: 120, body: { w: 56, h: 54 },
    drops: [{ item: 'spirit_stone', chance: 0.14, qty: [1, 1] }, { item: 'silk_thread', chance: 0.2, qty: [1, 2] }],
  },
  fox: {
    id: 'fox', name: '요기 서린 멧돼지', desc: '요기를 머금고 떠다니는 멧돼지. 거리를 두고 어둠 구슬을 내뿜는다.',
    ai: 'caster', hp: 36, atk: 13, def: 1, exp: 20, gold: [5, 9], speed: 110, body: { w: 60, h: 46 },
    drops: [{ item: 'spirit_stone', chance: 0.16, qty: [1, 1] }, { item: 'moon_petal', chance: 0.25, qty: [1, 2] }],
  },
  bat: {
    id: 'bat', name: '먹구름 까마귀 요괴', desc: '어둠에 물든 까마귀 요괴. 하늘을 맴돌다 급강하한다.',
    ai: 'flyer', hp: 22, atk: 9, def: 0, exp: 14, gold: [3, 5], speed: 140, body: { w: 44, h: 36 }, flying: true,
    drops: [{ item: 'spirit_stone', chance: 0.1, qty: [1, 1] }],
  },
  rock: {
    id: 'rock', name: '우두머리 멧돼지', desc: '무리를 이끄는 거대한 멧돼지. 느리지만 단단하고, 앞발로 땅을 내려찍어 충격파를 일으킨다.',
    ai: 'golem', hp: 160, atk: 18, def: 6, exp: 60, gold: [15, 25], speed: 55, body: { w: 84, h: 92 }, elite: true, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [2, 3] }, { item: 'silk_thread', chance: 0.6, qty: [1, 3] }],
  },
  boss: {
    id: 'boss', name: '흑운 산군', desc: '월하산맥을 지키던 백호 수호신이 흩어진 어둠에 물들어 검은 범의 요괴가 되었다.',
    ai: 'boss', hp: 1500, atk: 20, def: 4, exp: 700, gold: [300, 300], speed: 160, body: { w: 150, h: 150 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [8, 8] }, { item: 'moon_petal', chance: 1, qty: [5, 5] }],
  },
  // 지역 수호 영물 (어둠에 물든 모습) — 정화하면 동료가 된다
  boss_girin: {
    id: 'boss_girin', name: '안개에 갇힌 기린', desc: '운무협곡을 지키던 기린이 짙은 안개에 갇혀 길을 잃었다.',
    ai: 'boss', hp: 2400, atk: 26, def: 6, exp: 1100, gold: [400, 400], speed: 180, body: { w: 150, h: 150 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [10, 10] }],
  },
  boss_hyeonmu: {
    id: 'boss_hyeonmu', name: '심해의 흑현무', desc: '용궁의 수문을 지키던 현무가 깊은 바다의 어둠에 잠겼다.',
    ai: 'boss', hp: 3600, atk: 30, def: 12, exp: 1500, gold: [500, 500], speed: 140, body: { w: 170, h: 140 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [12, 12] }],
  },
  boss_haetae: {
    id: 'boss_haetae', name: '불길에 삼켜진 해태', desc: '불을 먹어 세상을 지키던 해태가 끝내 불길에 삼켜졌다.',
    ai: 'boss', hp: 4800, atk: 36, def: 12, exp: 2000, gold: [600, 600], speed: 190, body: { w: 160, h: 150 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [14, 14] }],
  },
  boss_bonghwang: {
    id: 'boss_bonghwang', name: '빛을 잃은 봉황', desc: '봉래산의 빛이던 봉황이 날개의 빛을 잃었다.',
    ai: 'boss', hp: 6000, atk: 40, def: 14, exp: 2600, gold: [800, 800], speed: 210, body: { w: 150, h: 160 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [16, 16] }],
  },
  boss_dragon: {
    id: 'boss_dragon', name: '설원의 흑룡', desc: '모든 어둠의 근원. 설원의 신전 깊은 곳에서 깨어났다.',
    ai: 'boss', hp: 8000, atk: 46, def: 16, exp: 4000, gold: [1500, 1500], speed: 220, body: { w: 170, h: 150 }, knockbackImmune: true,
    drops: [{ item: 'spirit_stone', chance: 1, qty: [25, 25] }],
  },
};

export function scaleMonster(def: MonsterDef, tier: number) {
  const m = 1 + 0.18 * tier;
  return { hp: Math.round(def.hp * m), atk: Math.round(def.atk * (1 + 0.12 * tier)), exp: Math.round(def.exp * (1 + 0.15 * tier)) };
}
