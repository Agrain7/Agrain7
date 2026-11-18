// 영물 원화 픽셀 도구: 스킨 색조 변환(HSL), 도감용 원화·실루엣.
// (움직임은 src/art/rig.ts 의 리깅 엔진이 담당)
import { makeCanvas } from './paint.ts';

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

export function sample(src: ImageData, x: number, y: number, out: Uint8ClampedArray, o: number) {
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
