// 리깅 프레임을 메인 스레드 밖에서 그리는 작업자 — 게임 화면이 멈칫하지 않게 (휴대폰 끊김 대책)
// 입력: 원화 픽셀 + 리그 키·움직임 종류·동작 수 / 출력: 완성된 시트(ImageBitmap) + 프레임 정보
import { rigJob, type RigAnim } from './rig.ts';
import { rigFor } from '../data/mountRigs.ts';
import type { MotionKind } from '../data/mountArt.ts';

export interface RigRequest { id: number; rig: string; motion: MotionKind; w: number; h: number; pixels: ArrayBuffer; seat: [number, number]; counts?: Partial<Record<RigAnim, number>> }

self.onmessage = (e: MessageEvent<RigRequest>) => {
  const q = e.data;
  try {
    const img = new ImageData(new Uint8ClampedArray(q.pixels), q.w, q.h);
    const job = q.counts ? rigJob(img, rigFor(q.rig, q.motion), q.seat, q.counts) : rigJob(img, rigFor(q.rig, q.motion), q.seat);
    const r = job.finish();
    const bmp = (r.canvas as unknown as OffscreenCanvas).transferToImageBitmap();
    (self as unknown as Worker).postMessage({ id: q.id, ok: true, bmp, frames: r.frames, padX: r.padX, padTop: r.padTop, fw: r.fw, fh: r.fh, anims: r.anims }, [bmp]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: q.id, ok: false, error: String(err) });
  }
};
