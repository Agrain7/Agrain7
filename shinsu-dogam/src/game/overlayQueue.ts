// 연출(획득·진화·구간 돌파·기절) 대기열. OverlayScene이 순서대로 보여 준다.
import type { MountId } from '../data/types.ts';

export type OverlayItem =
  | { type: 'acquire'; mount: MountId }
  | { type: 'evolve'; mount: MountId; stage: number }
  | { type: 'evolvePrompt'; mount: MountId; stage: number }
  | { type: 'clear'; stageId: string; region?: string; stars?: number; time: number; exp: number; gold: number; defeats: number; chests: string; first: boolean; next?: string }
  | { type: 'faint' }
  | { type: 'boss'; title: string; sub: string }
  | { type: 'purified'; name?: string; region?: string; reward?: string; guardian?: string }
  | { type: 'message'; title: string; body: string }
  | { type: 'story'; id: string; sub?: string };

type Listener = () => void;
const queue: OverlayItem[] = [];
const listeners = new Set<Listener>();

export const overlayQueue = {
  push(item: OverlayItem) {
    queue.push(item);
    for (const l of listeners) l();
  },
  shift() {
    return queue.shift();
  },
  get length() {
    return queue.length;
  },
  clear() {
    queue.length = 0;
  },
  onPush(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
