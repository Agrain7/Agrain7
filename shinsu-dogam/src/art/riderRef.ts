// 라이더 하람: 참고 게임 화면의 소녀 그림(tools/extract_rider.py)을 그대로 쓰고, 움직임만 더한다.
//  - 몸: 안장(엉덩이) 기준으로 숨쉬기·앞으로 숙이기·손 뻗기·움찔
//  - 머리채: 묶인 곳 기준으로 바람에 흔들림
//  - 뒤로 휘날리는 붉은 띠 + 크림색 안 띠는 코드로 그린다 (참고 화면에서는 청룡 갈기와 겹쳐 잘라 낼 수 없음)
// 판매 의상: 같은 그림에서 붉은 치마·흰 저고리 색만 의상 색으로 바꾼다.
import { makeCanvas, type Ctx, sampleCurve, tubeOutline, paintShape, shadeHex, TAU, type V } from './paint.ts';
import type { FrameBox, Pose } from './types.ts';
import type { Outfit } from './rider.ts';

export interface RefRiderMeta { w: number; h: number; seat: [number, number]; tailPivot: [number, number]; face: [number, number, number]; waist: [number, number] }

const LINE = '#3a2420';
/** 띠가 들어갈 왼쪽 여유 */
const PAD_L = 120, PAD_T = 16, PAD_R = 24, PAD_B = 12;
/** 몸을 안장 뒤쪽으로 (원본 px) — 앞으로 쏠려 영물 얼굴을 가리지 않게 */
const BACK = 26;

export function refRiderBox(m: RefRiderMeta): FrameBox {
  return { w: m.w + PAD_L + PAD_R + BACK, h: m.h + PAD_T + PAD_B, ox: PAD_L + m.seat[0] + BACK, oy: PAD_T + m.seat[1] };
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p: number, q: number, t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

/** 의상 색: 붉은 치마·깃 → skirt/trim, 흰 저고리(목 아래) → top */
export function recolorOutfit(src: HTMLImageElement | HTMLCanvasElement, m: RefRiderMeta, o: Outfit, isDefault: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(m.w, m.h);
  ctx.drawImage(src, 0, 0, m.w, m.h);
  if (isDefault) return c;
  const img = ctx.getImageData(0, 0, m.w, m.h);
  const d = img.data;
  const [sh, ss] = rgb2hsl(...hex(o.skirt));
  const [th, ts, tl] = rgb2hsl(...hex(o.top));
  const neckY = m.face[1] + m.face[2] * 0.9;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const px = (i / 4) % m.w, y = Math.floor(i / 4 / m.w);
    // 얼굴(눈·볼)은 그대로
    if (Math.hypot(px - m.face[0], y - m.face[1]) < m.face[2] * 1.05) continue;
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const hd = h * 360;
    let out: [number, number, number] | null = null;
    if ((hd > 335 || hd < 22) && s > 0.35 && l < 0.74 && l > 0.12) {
      out = hsl2rgb(sh, Math.min(1, ss * 0.9 + s * 0.15), l);
    } else if (y > neckY && l > 0.74 && s < 0.45) {
      // 흰 저고리: 밝기 차이(주름)는 살리고 색만 의상 색으로
      out = hsl2rgb(th, ts * 0.9, Math.min(0.97, tl + (l - 0.86) * 0.9));
    }
    if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 한 프레임 그리기 (ctx 원점 = 안장 위치) */
export function drawRefRider(ctx: Ctx, p: Pose, m: RefRiderMeta, body: CanvasImageSource, tail: CanvasImageSource, o: Outfit) {
  const t = p.t;
  const wave = Math.sin(t * TAU);
  const wind = p.anim === 'run' || p.anim === 'fly' ? 1 : p.anim === 'attack' ? 0.8 : 0.35;
  let lean = 0, bx = 0, by = 0;
  switch (p.anim) {
    case 'idle': lean = 0.6 * wave; by = -1.2 * Math.max(0, wave); break;
    case 'run': lean = 1.5 + 1.2 * wave; by = -2.5 * Math.abs(Math.sin(t * TAU)); break;
    case 'fly': lean = 3 + 1 * wave; by = -1.5 * wave; break;
    case 'attack': lean = 5 * (p.i === 0 ? 0.6 : 1); bx = p.i === 0 ? 1 : 3; break;
    case 'cast': lean = -4; by = -4 - 2 * wave; break;
    case 'hit': lean = -12; bx = -6; break;
    default: break;
  }
  const sx = m.seat[0], sy = m.seat[1];
  ctx.save();
  ctx.translate(bx - BACK, by);
  // 1) 뒤로 휘날리는 띠 (몸 뒤)
  if (o.extra !== 'armor') {
    const [wx, wy] = [m.waist[0] - sx, m.waist[1] - sy];
    const sash = (x0: number, y0: number, len: number, ph: number, w0: number, col: string, lift: number) => {
      const pts: V[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const amp = (2 + u * 10) * (0.45 + wind * 0.75);
        pts.push([x0 - u * len * (0.72 + 0.28 * wind), y0 - u * lift + Math.sin((t - u * 0.8 + ph) * TAU) * amp]);
      }
      const sp = sampleCurve(pts, 16);
      paintShape(ctx, tubeOutline(sp, sp.map((_, i) => w0 * (1 - (i / sp.length) * 0.45))), { fill: col, line: LINE, lw: 1.3, shadow: shadeHex(col, -0.35), shadowAmt: 0.45 });
    };
    sash(wx + 6, wy + 4, 108, 0.5, 5.5, o.extra === 'shawl' ? '#cfe6f2' : '#f3ead6', 18);
    sash(wx + 2, wy - 6, 122, 0, 7, o.ribbon, 30);
  }
  // 2) 몸 + 머리채 (안장 기준 회전)
  ctx.rotate((lean * Math.PI) / 180);
  const tailAng = (p.anim === 'idle' ? 4 * wave : p.anim === 'hit' ? -10 : 8 + 7 * Math.sin((t + 0.15) * TAU)) * (Math.PI / 180);
  ctx.save();
  ctx.translate(m.tailPivot[0] - sx, m.tailPivot[1] - sy);
  ctx.rotate(tailAng);
  ctx.drawImage(tail, -m.tailPivot[0], -m.tailPivot[1]);
  ctx.restore();
  ctx.drawImage(body, -sx, -sy);
  ctx.restore();
}
