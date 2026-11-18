// 정지 일러스트 → 애니메이션 프레임 (원본 그림은 그대로 두고 픽셀 변형만 적용)
// quad: 다리 영역을 앞/뒤 반대로 흔들어 달리기 표현, bird: 날개 영역 수직 압축으로 날갯짓,
// serpent: 몸 전체 물결, shell: 느린 걸음. 스킨은 HSL 색조 변환으로 원본 일러스트를 다시 칠한다.
import type { MountArtInfo } from '../data/mountArt.ts';
import { makeCanvas, TAU } from './paint.ts';

export interface BuiltFrames {
  canvas: HTMLCanvasElement;
  frames: { name: string; x: number; y: number; w: number; h: number }[];
  /** 프레임 내 원본 이미지의 좌상단 위치 */
  padX: number;
  padTop: number;
  fw: number;
  fh: number;
  anims: Record<string, number>;
}

export interface Tint { hue: number; sat: number; light: number }

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

/** 원본 이미지 픽셀 읽기 (+선택적 색조 변환) */
export function readPixels(img: CanvasImageSource, w: number, h: number, tint?: Tint): ImageData {
  const [, ctx] = makeCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  if (tint) {
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const [hh, ss, ll] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      // 거의 무채색(흰 털·검은 선)은 덜 바꿔 원본 느낌 유지
      const satW = Math.min(1, ss * 3);
      const nh = (hh + (tint.hue / 360) * satW + 1) % 1;
      const ns = Math.min(1, ss * (1 + (tint.sat - 1) * satW));
      const nl = Math.min(1, ll * tint.light);
      const [r, g, b] = hslToRgb(nh, ns, nl);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  return data;
}

function sample(src: ImageData, x: number, y: number, out: Uint8ClampedArray, o: number) {
  const w = src.width, h = src.height;
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) { out[o + 3] = 0; return; }
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const d = src.data;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  const w00 = (1 - fx) * (1 - fy) * d[i00 + 3], w10 = fx * (1 - fy) * d[i10 + 3], w01 = (1 - fx) * fy * d[i01 + 3], w11 = fx * fy * d[i11 + 3];
  const a = w00 + w10 + w01 + w11;
  if (a < 0.5) { out[o + 3] = 0; return; }
  out[o] = (d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11) / a;
  out[o + 1] = (d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11) / a;
  out[o + 2] = (d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11) / a;
  out[o + 3] = a;
}

type Warp = (x: number, y: number) => [number, number];

export function buildMountFrames(img: CanvasImageSource, info: MountArtInfo, tint?: Tint): BuiltFrames {
  const w = info.w, h = info.h;
  const src = readPixels(img, w, h, tint);
  const padX = Math.round(w * 0.06) + 4;
  const padTop = Math.round(h * 0.12) + 4;
  const fw = w + padX * 2, fh = h + padTop + 2;
  const legY = info.legLine * h;
  const splitX = info.split * w;
  const root = (info.wingRoot ?? 0.5) * h;
  const bird = info.motion === 'bird';
  const serp = info.motion === 'serpent';
  const shell = info.motion === 'shell';

  const legs = (amp: number, ph: number): Warp => (x, y) => {
    if (y < legY) return [x, y];
    const d = (y - legY) / Math.max(1, h - legY);
    const dir = x > splitX ? 1 : -1;
    return [x - amp * d * Math.sin(ph) * dir, y];
  };
  const wave = (amp: number, ph: number, cycles: number): Warp => (x, y) => {
    const env = Math.pow(1 - x / w, 1.2); // 머리(오른쪽)는 고정, 꼬리 쪽이 크게
    return [x, y - amp * env * Math.sin((x / w) * TAU * cycles - ph)];
  };
  const flap = (k: number): Warp => (x, y) => {
    if (y > root) return [x, y];
    // 날개 뿌리 위쪽 영역을 k배로 늘이거나 줄임
    return [x, root - (root - y) / k];
  };
  const breathe = (s: number): Warp => (x, y) => [x, h - (h - y) / s];
  const compose = (...ws: Warp[]): Warp => (x, y) => ws.reduce<[number, number]>((p, f) => f(p[0], p[1]), [x, y]);

  const anims: Record<string, number> = { idle: 4, run: 6, fly: 6 };
  const plans: { name: string; warp: Warp }[] = [];
  for (let i = 0; i < 4; i++) {
    const ph = (i / 4) * TAU;
    const parts: Warp[] = [breathe(1 + 0.018 * Math.sin(ph))];
    if (bird) parts.push(flap(1 + 0.05 * Math.sin(ph)));
    if (serp) parts.push(wave(h * 0.012, ph, 1));
    plans.push({ name: `idle_${i}`, warp: compose(...parts) });
  }
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * TAU;
    const amp = shell ? w * 0.025 : bird ? w * 0.03 : w * 0.06;
    const parts: Warp[] = [legs(amp, ph)];
    if (serp) parts.push(wave(h * 0.03, ph, 1.1));
    if (bird) parts.push(flap(1 + 0.08 * Math.sin(ph * 2)));
    if (!serp && !bird) parts.push(breathe(1 + 0.012 * Math.sin(ph * 2)));
    plans.push({ name: `run_${i}`, warp: compose(...parts) });
  }
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * TAU;
    let warp: Warp;
    if (bird) warp = flap(0.86 + 0.24 * Math.sin(ph)); // 0.62~1.1: 날개 내렸다 올림
    else if (serp) warp = wave(h * 0.06, ph, 1.2);
    else warp = compose(legs(w * 0.03, ph), breathe(1 + 0.02 * Math.sin(ph)));
    plans.push({ name: `fly_${i}`, warp });
  }

  const cols = Math.max(1, Math.min(plans.length, Math.floor(4096 / fw)));
  const rows = Math.ceil(plans.length / cols);
  const [canvas, ctx] = makeCanvas(cols * fw, rows * fh);
  const frames: BuiltFrames['frames'] = [];
  plans.forEach((pl, k) => {
    const fx = (k % cols) * fw, fy = Math.floor(k / cols) * fh;
    const out = ctx.createImageData(fw, fh);
    const od = out.data;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const [sx, sy] = pl.warp(x - padX, y - padTop);
        sample(src, sx, sy, od, (y * fw + x) * 4);
      }
    }
    ctx.putImageData(out, fx, fy);
    frames.push({ name: pl.name, x: fx, y: fy, w: fw, h: fh });
  });
  return { canvas, frames, padX, padTop, fw, fh, anims };
}

/** 도감용: 원본 그대로 (스킨 적용 가능) */
export function tintedImage(img: CanvasImageSource, w: number, h: number, tint?: Tint): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  if (!tint) {
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  }
  ctx.putImageData(readPixels(img, w, h, tint), 0, 0);
  return c;
}

/** 도감 미획득 실루엣 */
export function silhouette(img: CanvasImageSource, w: number, h: number, color = '#2a2438'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}
