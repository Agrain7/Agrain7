// 전역 상태 접근 (씬 간 공유)
import { GameState, type StorageLike } from '../systems/state.ts';

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

export const store = {
  state: GameState.load(safeStorage()),
  storageAvailable: safeStorage() !== null,
};
