// 전역 상태 접근 (씬 간 공유)
import { GameState, type StorageLike } from '../systems/state.ts';
import { applyPlaytestGift, PLAYTEST_GIFT_ID } from '../systems/playtestGift.ts';

function safeStorage(): StorageLike | null {
  try {
    const k = '__sd_test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

const loaded = GameState.load(safeStorage());

export const store = {
  state: loaded,
  storageAvailable: safeStorage() !== null,
  /** 이번 실행에서 플레이테스트 선물이 새로 지급되었는가 (타이틀에서 안내) */
  giftJustApplied: applyPlaytestGift(loaded, PLAYTEST_GIFT_ID),
};
