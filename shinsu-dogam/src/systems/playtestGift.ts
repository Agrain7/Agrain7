// 플레이테스트 선물: 아티팩트(플레이용 웹 페이지) 빌드에서만 켜진다 (vite.artifact.config.ts 의 VITE_PLAYTEST_GIFT).
// 정식 빌드에는 지급되지 않는다. 현재 내용: 늑대 각성체(Lv.30) + 주작 각성체(Lv.30, 자유 비행) 합류.
import type { GameState } from './state.ts';
import type { MountId } from '../data/types.ts';

function grow(st: GameState, id: MountId, level: number, stage: 0 | 1 | 2, now: number) {
  if (!st.data.mounts[id]) {
    st.data.mounts[id] = { id, level: 1, exp: 0, stage: 0, obtainedAt: now, history: [{ stage: 0, at: now, level: 1 }] };
  }
  const m = st.data.mounts[id]!;
  m.level = Math.max(m.level, level);
  for (let s = m.stage + 1; s <= stage; s++) {
    m.stage = s as 0 | 1 | 2;
    m.history.push({ stage: s, at: now, level: m.level });
  }
  if (!st.data.codexSeen.includes(id)) st.data.codexSeen.push(id);
}

/** 이 저장 데이터에 선물이 아직 없으면 지급. 지급했으면 true */
export function applyPlaytestGift(st: GameState, giftId: string | undefined, now = Date.now()): boolean {
  if (!giftId) return false;
  st.data.gifts ??= [];
  if (st.data.gifts.includes(giftId)) return false;
  grow(st, 'wolf', 30, 2, now);
  grow(st, 'jujak', 30, 2, now);
  st.data.activeMount = 'jujak';
  st.data.gifts.push(giftId);
  st.updateQuests();
  st.save();
  return true;
}

export const PLAYTEST_GIFT_ID: string | undefined = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PLAYTEST_GIFT;
