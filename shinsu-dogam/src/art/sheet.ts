// 페인터 → 스프라이트 시트(캔버스) 변환. Phaser와 독립적이라 미리보기/테스트에서도 사용.
import { makeCanvas, type Ctx } from './paint.ts';
import type { AnimName, FrameBox, Pose } from './types.ts';

export interface SheetFrame { name: string; anim: AnimName; i: number; x: number; y: number; w: number; h: number }

export interface SheetResult<I> {
  canvas: HTMLCanvasElement;
  frames: SheetFrame[];
  infos: Record<string, I>;
  box: FrameBox;
  anims: Partial<Record<AnimName, number>>;
}

/** 최대 텍스처 폭 (모바일 GPU 안전 범위) */
const MAX_W = 4096;

export function buildSheet<I>(
  box: FrameBox,
  anims: Partial<Record<AnimName, number>>,
  draw: (ctx: Ctx, pose: Pose) => I,
  pad = 2,
): SheetResult<I> {
  const list: { anim: AnimName; i: number; n: number }[] = [];
  for (const [anim, n] of Object.entries(anims) as [AnimName, number][]) {
    for (let i = 0; i < n; i++) list.push({ anim, i, n });
  }
  const fw = box.w + pad * 2, fh = box.h + pad * 2;
  const cols = Math.max(1, Math.min(list.length, Math.floor(MAX_W / fw)));
  const rows = Math.ceil(list.length / cols);
  const [canvas, ctx] = makeCanvas(cols * fw, rows * fh);
  const frames: SheetFrame[] = [];
  const infos: Record<string, I> = {};
  list.forEach((f, k) => {
    const cx = (k % cols) * fw + pad, cy = Math.floor(k / cols) * fh + pad;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, box.w, box.h);
    ctx.clip();
    ctx.translate(cx + box.ox, cy + box.oy);
    const pose: Pose = { anim: f.anim, i: f.i, n: f.n, t: f.n > 1 ? f.i / f.n : 0 };
    const info = draw(ctx, pose);
    ctx.restore();
    const name = `${f.anim}_${f.i}`;
    frames.push({ name, anim: f.anim, i: f.i, x: cx, y: cy, w: box.w, h: box.h });
    infos[name] = info;
  });
  return { canvas, frames, infos, box, anims };
}
