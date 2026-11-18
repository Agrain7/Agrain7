// 영물 원화 리깅 애니메이션 엔진
// 한 장짜리 원화를 '뼈(부위)'로 나눠 각 부위를 회전·늘이기 하고 다시 합성한다.
//  - 부위 영역: 다각형(원화 크기 대비 0..1 좌표) + 부드러운 경계(feather) → 픽셀별 가중치
//  - 사슬(chain): 꼬리·갈기·리본처럼 여러 마디가 시간차로 흔들리는 부위
//  - 부모-자식: 날개 끝은 날개를 따라 움직이며 한 박자 늦게 휜다 (채찍 효과)
//  - 합성: 앞쪽 부위부터 덮는 방식(front-to-back coverage) → 정지 상태에서는 원화와 완전히 같음
//  - 부위가 몸을 가리고 있던 자리는 주변 색으로 채워(push-pull 인페인팅) 구멍이 보이지 않게 한다
import { makeCanvas, TAU } from './paint.ts';

export type V = [number, number];
export type RigAnim = 'idle' | 'run' | 'fly' | 'atk';
export const RIG_FRAMES: Record<RigAnim, number> = { idle: 8, run: 8, fly: 8, atk: 4 };

export interface Pose { r?: number; sx?: number; sy?: number; x?: number; y?: number }
/** anim, t(0..1), 사슬 마디 번호, 마디 수 → 자세 (r: 도, x·y: 원화 폭·높이 대비 비율) */
export type MotionFn = (anim: RigAnim, t: number, seg: number, segs: number) => Pose;

export interface BoneDef {
  id: string;
  poly: V[];
  pivot?: V;
  /** 사슬: 뿌리→끝 경로. 마디마다 별도 뼈가 생긴다 */
  path?: V[];
  parent?: string;
  /** 그리는 순서: 음수 = 몸 뒤, 양수 = 몸 앞 (몸통 = 0) */
  z?: number;
  feather?: number;
  /** 이 부위 아래에 가려진 몸 영역 → 인페인팅으로 채움 */
  fill?: V[];
  motion: MotionFn;
}

export interface GlobalPose { r?: number; x?: number; y?: number }
export interface RigDef {
  bones: BoneDef[];
  global?: (anim: RigAnim, t: number) => GlobalPose;
  /** 몸 전체 기울기 기준점 (기본: 발 중앙) */
  foot?: V;
}

export interface RigFrame { name: string; anim: RigAnim; i: number; x: number; y: number; w: number; h: number; seat: V }
export interface RigResult {
  canvas: HTMLCanvasElement;
  frames: RigFrame[];
  padX: number;
  padTop: number;
  fw: number;
  fh: number;
  anims: Record<RigAnim, number>;
}

type M = [number, number, number, number, number, number]; // a b c d e f : x' = a x + c y + e, y' = b x + d y + f
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const inv = (m: M): M => {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};
const app = (m: M, x: number, y: number): V => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** 피벗 기준 회전·크기 + 이동 */
function local(p: V, pose: Pose, w: number, h: number): M {
  const r = ((pose.r ?? 0) * Math.PI) / 180;
  const cs = Math.cos(r), sn = Math.sin(r);
  const sx = pose.sx ?? 1, sy = pose.sy ?? 1;
  // T(p) R S T(-p), then translate
  const a = cs * sx, b = sn * sx, c = -sn * sy, d = cs * sy;
  const e = p[0] - (a * p[0] + c * p[1]) + (pose.x ?? 0) * w;
  const f = p[1] - (b * p[0] + d * p[1]) + (pose.y ?? 0) * h;
  return [a, b, c, d, e, f];
}

// ---------------- 가중치 ----------------
function rasterPoly(w: number, h: number, poly: V[]): Float32Array {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.closePath();
  ctx.fill();
  const d = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  void c;
  return out;
}

/** 분리형 상자 흐림 2회 (가우시안 근사) */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  let a = src, b = new Float32Array(w * h);
  const pass = (from: Float32Array, to: Float32Array, horiz: boolean) => {
    const n = horiz ? w : h, m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      let acc = 0;
      const idx = (k: number) => (horiz ? j * w + k : k * w + j);
      for (let k = -r; k <= r; k++) acc += from[idx(Math.min(n - 1, Math.max(0, k)))];
      for (let k = 0; k < n; k++) {
        to[idx(k)] = acc / (2 * r + 1);
        acc += from[idx(Math.min(n - 1, k + r + 1))] - from[idx(Math.max(0, k - r))];
      }
    }
  };
  for (let it = 0; it < 2; it++) {
    pass(a, b, true);
    const c2 = new Float32Array(w * h);
    pass(b, c2, false);
    a = c2;
    b = new Float32Array(w * h);
  }
  return a;
}

/** 경로에 대한 위치 매개변수 (0..n-1 마디) */
function pathParam(path: V[], x: number, y: number): number {
  let best = Infinity, bu = 0;
  for (let k = 0; k < path.length - 1; k++) {
    const [ax, ay] = path[k], [bx, by] = path[k + 1];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    const px = ax + dx * t, py = ay + dy * t;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) { best = d; bu = k + t; }
  }
  return bu;
}

// ---------------- 인페인팅 (push-pull) ----------------
function inpaint(rgb: Float32Array, known: Float32Array, w: number, h: number): Float32Array {
  const levels: { c: Float32Array; k: Float32Array; w: number; h: number }[] = [];
  let c = new Float32Array(w * h * 3), k = known.slice();
  for (let i = 0; i < w * h; i++) for (let ch = 0; ch < 3; ch++) c[i * 3 + ch] = rgb[i * 3 + ch] * k[i];
  let lw = w, lh = h;
  levels.push({ c, k, w: lw, h: lh });
  while (lw > 1 || lh > 1) {
    const nw = Math.max(1, lw >> 1), nh = Math.max(1, lh >> 1);
    const nc = new Float32Array(nw * nh * 3), nk = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sk = 0;
      const o = y * nw + x;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(lw - 1, x * 2 + dx), sy = Math.min(lh - 1, y * 2 + dy);
        const si = sy * lw + sx;
        sk += k[si];
        for (let ch = 0; ch < 3; ch++) nc[o * 3 + ch] += c[si * 3 + ch];
      }
      nk[o] = sk;
    }
    // 정규화 (가중 평균 색), 가중치는 0..1로
    for (let o = 0; o < nw * nh; o++) {
      if (nk[o] > 0) for (let ch = 0; ch < 3; ch++) nc[o * 3 + ch] /= nk[o];
      nk[o] = Math.min(1, nk[o]);
      for (let ch = 0; ch < 3; ch++) nc[o * 3 + ch] *= nk[o];
    }
    c = nc; k = nk; lw = nw; lh = nh;
    levels.push({ c, k, w: lw, h: lh });
  }
  // pull: 굵은 단계에서 모자란 부분을 채운다
  for (let L = levels.length - 2; L >= 0; L--) {
    const cur = levels[L], up = levels[L + 1];
    for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) {
      const o = y * cur.w + x;
      const kk = cur.k[o];
      if (kk >= 1) continue;
      const uo = Math.min(up.h - 1, y >> 1) * up.w + Math.min(up.w - 1, x >> 1);
      const uk = up.k[uo] || 1e-6;
      for (let ch = 0; ch < 3; ch++) cur.c[o * 3 + ch] = cur.c[o * 3 + ch] + (up.c[uo * 3 + ch] / uk) * (1 - kk) * Math.min(1, uk * 4);
      cur.k[o] = Math.min(1, kk + (1 - kk) * Math.min(1, uk * 4));
    }
  }
  const out = new Float32Array(w * h * 3);
  const L0 = levels[0];
  for (let i = 0; i < w * h; i++) {
    const kk = L0.k[i] || 1e-6;
    for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = L0.c[i * 3 + ch] / kk;
  }
  return out;
}

// ---------------- 준비 ----------------
interface Layer {
  bone: BoneDef;
  seg: number;
  segs: number;
  pivot: V; // px
  parent: number; // layer index or -1
  z: number;
  order: number;
  wts: Float32Array; // bbox 크기
  bx: number; by: number; bw: number; bh: number;
  tex: 'src' | 'root';
}

interface Prepared {
  w: number; h: number;
  src: Float32Array; // premultiplied rgba
  root: Float32Array;
  layers: Layer[];
}

function crop(full: Float32Array, w: number, h: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (full[y * w + x] > 0.002) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { wts: new Float32Array(1), bx: 0, by: 0, bw: 1, bh: 1 };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const wts = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) wts[y * bw + x] = full[(y + y0) * w + x + x0];
  return { wts, bx: x0, by: y0, bw, bh };
}

export function prepareRig(img: ImageData, def: RigDef): Prepared {
  const w = img.width, h = img.height, d = img.data;
  const src = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    src[i * 4] = (d[i * 4] / 255) * a;
    src[i * 4 + 1] = (d[i * 4 + 1] / 255) * a;
    src[i * 4 + 2] = (d[i * 4 + 2] / 255) * a;
    src[i * 4 + 3] = a;
  }
  const minWH = Math.min(w, h);
  // 부위 마스크 (부드러운 경계)
  const masks = def.bones.map((b) => blur(rasterPoly(w, h, b.poly), w, h, Math.max(1, Math.round((b.feather ?? 0.03) * minWH))));
  // 우선순위: 나중에 정의한 부위가 먼저 차지
  const rem = new Float32Array(w * h).fill(1);
  const full: Float32Array[] = new Array(def.bones.length);
  for (let bi = def.bones.length - 1; bi >= 0; bi--) {
    const m = masks[bi];
    const f = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { f[i] = m[i] * rem[i]; rem[i] -= f[i]; }
    full[bi] = f;
  }
  // 가려진 몸 채우기
  const fillMask = new Float32Array(w * h);
  for (const b of def.bones) if (b.fill) {
    const fm = blur(rasterPoly(w, h, b.fill), w, h, Math.max(1, Math.round(0.02 * minWH)));
    for (let i = 0; i < w * h; i++) fillMask[i] = Math.max(fillMask[i], fm[i]);
  }
  const root = src.slice();
  let anyFill = false;
  for (let i = 0; i < w * h; i++) if (fillMask[i] > 0.01) { anyFill = true; break; }
  if (anyFill) {
    const rgb = new Float32Array(w * h * 3), known = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = src[i * 4 + 3];
      // 부위가 아닌 몸 픽셀만 '알려진 색'
      const partW = 1 - rem[i];
      known[i] = a > 0.6 && fillMask[i] < 0.3 && partW < 0.3 ? 1 : 0;
      if (a > 0) for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = src[i * 4 + ch] / a;
    }
    const filled = inpaint(rgb, known, w, h);
    for (let i = 0; i < w * h; i++) {
      const f = fillMask[i];
      if (f <= 0.001) continue;
      const a0 = src[i * 4 + 3];
      const a = a0 * (1 - f) + f;
      for (let ch = 0; ch < 3; ch++) root[i * 4 + ch] = src[i * 4 + ch] * (1 - f) + filled[i * 3 + ch] * f;
      root[i * 4 + 3] = a;
      rem[i] = Math.max(rem[i], f);
    }
  }
  // 층 만들기
  const layers: Layer[] = [];
  const rootC = crop(rem, w, h);
  layers.push({ bone: { id: 'root', poly: [], motion: () => ({}) }, seg: 0, segs: 1, pivot: [0, 0], parent: -1, z: 0, order: 0, ...rootC, tex: 'root' });
  const firstLayerOf = new Map<string, number>();
  const lastLayerOf = new Map<string, number>();
  def.bones.forEach((b, bi) => {
    const parentIdx = b.parent ? (lastLayerOf.get(b.parent) ?? 0) : 0;
    if (b.path && b.path.length >= 2) {
      const P = b.path.map(([x, y]) => [x * w, y * h] as V);
      const segs = P.length - 1;
      const per: Float32Array[] = Array.from({ length: segs }, () => new Float32Array(w * h));
      const f = full[bi];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (f[i] <= 0.002) continue;
        const u = pathParam(P, x + 0.5, y + 0.5);
        // 마디 중심(k+0.5) 사이 선형 분배
        const v = u - 0.5;
        const k0 = Math.floor(v);
        const fr = v - k0;
        const a0 = Math.max(0, Math.min(segs - 1, k0)), a1 = Math.max(0, Math.min(segs - 1, k0 + 1));
        per[a0][i] += f[i] * (1 - fr);
        per[a1][i] += f[i] * fr;
      }
      let prev = parentIdx;
      for (let s = 0; s < segs; s++) {
        const c = crop(per[s], w, h);
        layers.push({ bone: b, seg: s, segs, pivot: P[s], parent: prev, z: b.z ?? 1, order: layers.length, ...c, tex: 'src' });
        prev = layers.length - 1;
        if (s === 0) firstLayerOf.set(b.id, prev);
      }
      lastLayerOf.set(b.id, prev);
    } else {
      const c = crop(full[bi], w, h);
      const pv = b.pivot ?? [0.5, 0.5];
      layers.push({ bone: b, seg: 0, segs: 1, pivot: [pv[0] * w, pv[1] * h], parent: parentIdx, z: b.z ?? 1, order: layers.length, ...c, tex: 'src' });
      firstLayerOf.set(b.id, layers.length - 1);
      lastLayerOf.set(b.id, layers.length - 1);
    }
  });
  return { w, h, src, root, layers };
}

// ---------------- 프레임 렌더 ----------------
export interface RigJob {
  done: boolean;
  /** 남은 프레임을 budget(ms) 동안 렌더. 끝나면 결과 반환 */
  step(budgetMs: number): RigResult | null;
  finish(): RigResult;
}

/** counts: 만들 동작·프레임 수 (생략하면 RIG_FRAMES 전체) — 몬스터는 필요한 동작만 만들어 메모리를 아낀다 */
export function rigJob(img: ImageData, def: RigDef, seat: V, counts: Partial<Record<RigAnim, number>> = RIG_FRAMES): RigJob {
  let prep: Prepared | null = null;
  const w = img.width, h = img.height;
  const padX = Math.round(w * 0.16) + 4;
  const padTop = Math.round(h * 0.2) + 4;
  const padBot = Math.round(h * 0.05) + 2;
  const fw = w + padX * 2, fh = padTop + h + padBot;
  const list: { anim: RigAnim; i: number; n: number }[] = [];
  for (const [anim, n] of Object.entries(counts) as [RigAnim, number][]) for (let i = 0; i < n; i++) list.push({ anim, i, n });
  const cols = Math.max(1, Math.min(list.length, Math.floor(4096 / fw)));
  const rows = Math.ceil(list.length / cols);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  const frames: RigFrame[] = [];
  let k = 0;
  let result: RigResult | null = null;
  const foot = def.foot ?? [0.5, 1];

  const renderOne = (f: { anim: RigAnim; i: number; n: number }) => {
    const P = prep!;
    const t = f.n > 1 ? f.i / f.n : 0;
    const gp = def.global?.(f.anim, t) ?? {};
    const G = local([foot[0] * w, foot[1] * h], { r: gp.r, x: gp.x, y: gp.y }, w, h);
    // 층별 변환
    const L = P.layers;
    const world: M[] = new Array(L.length);
    const F: M[] = new Array(L.length);
    const Inv: M[] = new Array(L.length);
    const bb: [number, number, number, number][] = new Array(L.length);
    for (let li = 0; li < L.length; li++) {
      const ly = L[li];
      const parentW = ly.parent >= 0 ? world[ly.parent] : I;
      const pose = li === 0 ? {} : ly.bone.motion(f.anim, t, ly.seg, ly.segs);
      world[li] = li === 0 ? I : mul(parentW, local(ly.pivot, pose, w, h));
      F[li] = mul(G, world[li]);
      Inv[li] = inv(F[li]);
      const cs = [app(F[li], ly.bx, ly.by), app(F[li], ly.bx + ly.bw, ly.by), app(F[li], ly.bx, ly.by + ly.bh), app(F[li], ly.bx + ly.bw, ly.by + ly.bh)];
      bb[li] = [Math.min(...cs.map((c) => c[0])) - 1, Math.min(...cs.map((c) => c[1])) - 1, Math.max(...cs.map((c) => c[0])) + 1, Math.max(...cs.map((c) => c[1])) + 1];
    }
    const orderIdx = L.map((_, i) => i).sort((a, b) => (L[b].z - L[a].z) || (L[b].order - L[a].order));
    const out = ctx!.createImageData(fw, fh);
    const od = out.data;
    const SRC = P.src, ROOT = P.root;
    for (let Y = 0; Y < fh; Y++) {
      const py = Y - padTop + 0.5;
      const act = orderIdx.filter((li) => py >= bb[li][1] && py <= bb[li][3]);
      if (!act.length) continue;
      for (let X = 0; X < fw; X++) {
        const px = X - padX + 0.5;
        let rem = 1, ar = 0, ag = 0, ab = 0, aa = 0;
        for (let q = 0; q < act.length; q++) {
          const li = act[q];
          const b = bb[li];
          if (px < b[0] || px > b[2]) continue;
          const m = Inv[li];
          const sx = m[0] * px + m[2] * py + m[4];
          const sy = m[1] * px + m[3] * py + m[5];
          const ly = L[li];
          const wx = Math.floor(sx) - ly.bx, wy = Math.floor(sy) - ly.by;
          if (wx < 0 || wy < 0 || wx >= ly.bw || wy >= ly.bh) continue;
          const wt = ly.wts[wy * ly.bw + wx];
          if (wt <= 0.002) continue;
          // 쌍선형 표본 (premultiplied)
          const fx = sx - 0.5, fy = sy - 0.5;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = fx - x0, ty = fy - y0;
          const T = ly.tex === 'root' ? ROOT : SRC;
          let r = 0, g = 0, bl = 0, a = 0;
          for (let dy = 0; dy < 2; dy++) {
            const yy = y0 + dy;
            if (yy < 0 || yy >= h) continue;
            const wyv = dy ? ty : 1 - ty;
            for (let dx = 0; dx < 2; dx++) {
              const xx = x0 + dx;
              if (xx < 0 || xx >= w) continue;
              const wv = wyv * (dx ? tx : 1 - tx);
              const o = (yy * w + xx) * 4;
              r += T[o] * wv; g += T[o + 1] * wv; bl += T[o + 2] * wv; a += T[o + 3] * wv;
            }
          }
          if (a <= 0.002) continue;
          const take = Math.min(rem, a * wt);
          const s = take / a;
          ar += r * s; ag += g * s; ab += bl * s; aa += take;
          rem -= take;
          if (rem <= 0.003) break;
        }
        if (aa > 0.004) {
          const o = (Y * fw + X) * 4;
          od[o] = (ar / aa) * 255;
          od[o + 1] = (ag / aa) * 255;
          od[o + 2] = (ab / aa) * 255;
          od[o + 3] = aa * 255;
        }
      }
    }
    const kx = (k % cols) * fw, ky = Math.floor(k / cols) * fh;
    ctx!.putImageData(out, kx, ky);
    const st = app(G, seat[0] * w, seat[1] * h);
    frames.push({ name: `${f.anim}_${f.i}`, anim: f.anim, i: f.i, x: kx, y: ky, w: fw, h: fh, seat: [st[0] / w - seat[0], st[1] / h - seat[1]] });
  };

  const job: RigJob = {
    done: false,
    step(budgetMs: number) {
      if (result) return result;
      const t0 = performance.now();
      if (!prep) {
        prep = prepareRig(img, def);
        [canvas, ctx] = makeCanvas(cols * fw, rows * fh);
        if (performance.now() - t0 > budgetMs) return null;
      }
      while (k < list.length) {
        renderOne(list[k]);
        k++;
        if (performance.now() - t0 > budgetMs && k < list.length) return null;
      }
      result = { canvas: canvas!, frames, padX, padTop, fw, fh, anims: { ...counts } as Record<RigAnim, number> };
      job.done = true;
      return result;
    },
    finish() {
      return job.step(1e9)!;
    },
  };
  return job;
}

export const wave = (t: number, ph = 0, f = 1) => Math.sin(TAU * (f * t + ph));
