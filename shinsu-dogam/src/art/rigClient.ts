// 리깅 작업자 요청 창구. 작업자를 쓸 수 없는 환경(구형 브라우저, 작업자 차단)이면 null → 기존 방식(나눠 그리기)으로.
import type { RigAnim, RigResult } from './rig.ts';
import type { MotionKind } from '../data/mountArt.ts';
import RigWorker from './rigWorker.ts?worker&inline';
import { makeCanvas } from './paint.ts';

let worker: Worker | null = null;
let broken = false;
let seq = 0;
const pending = new Map<number, { resolve: (r: RigResult | null) => void }>();

function get(): Worker | null {
  if (broken) return null;
  if (worker) return worker;
  try {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { broken = true; return null; }
    worker = new RigWorker();
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data as { id: number; ok: boolean; bmp?: ImageBitmap; frames?: RigResult['frames']; padX: number; padTop: number; fw: number; fh: number; anims: RigResult['anims'] };
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (!p) return;
      if (!d.ok || !d.bmp) { p.resolve(null); return; }
      // 비트맵 → 캔버스 (빠른 복사, 기존 텍스처 등록 경로 그대로)
      const [c, ctx] = makeCanvas(d.bmp.width, d.bmp.height);
      ctx.drawImage(d.bmp, 0, 0);
      d.bmp.close();
      p.resolve({ canvas: c, frames: d.frames!, padX: d.padX, padTop: d.padTop, fw: d.fw, fh: d.fh, anims: d.anims });
    };
    worker.onerror = () => {
      broken = true;
      for (const p of pending.values()) p.resolve(null);
      pending.clear();
    };
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

/** 작업자에서 리깅 (실패하면 null) */
export function rigInWorker(img: ImageData, rig: string, motion: MotionKind, seat: [number, number], counts?: Partial<Record<RigAnim, number>>): Promise<RigResult | null> | null {
  const w = get();
  if (!w) return null;
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    const pixels = img.data.buffer.slice(0) as ArrayBuffer;
    w.postMessage({ id, rig, motion, w: img.width, h: img.height, pixels, seat, counts }, [pixels]);
  });
}
