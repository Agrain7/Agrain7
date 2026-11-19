// 신수도감 — 2D 핸드페인팅 스타일 절차적 드로잉 유틸리티
// 모든 캐릭터·배경은 Canvas 2D 위에 스플라인 외곽선, 그라데이션 명암, 털/비늘/깃털 질감을 겹쳐 그려
// 스프라이트 시트로 변환된다. (3D, 픽셀아트, CSS 도형 사용 안 함)

export type Ctx = CanvasRenderingContext2D;
export type V = [number, number];

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** 결정적 의사난수 (시드 고정 → 같은 그림이 매번 같게 그려짐) */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  // 작업자(Web Worker) 안에서는 OffscreenCanvas (리깅 프레임을 메인 스레드 밖에서 그릴 때)
  if (typeof document === 'undefined') {
    const oc = new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    return [oc as unknown as HTMLCanvasElement, oc.getContext('2d') as unknown as Ctx];
  }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

// ---------- 색 ----------
export function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/[\d.]+/g) ?? ['0', '0', '0'];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** amt>0 밝게, amt<0 어둡게 */
export function shadeHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(clamp(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt), 0, 255));
  return toHex(f(r), f(g), f(b));
}
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(Math.round(lerp(A[0], B[0], t)), Math.round(lerp(A[1], B[1], t)), Math.round(lerp(A[2], B[2], t)));
}
export function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function hexNum(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

// ---------- 경로 ----------
/** Catmull-Rom 스플라인으로 점들을 부드럽게 잇는 경로 */
export function splinePath(ctx: Ctx, pts: V[], closed = true, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  const get = (i: number): V => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t = tension / 3 * 2;
    const c1: V = [p1[0] + (p2[0] - p0[0]) * t / 2, p1[1] + (p2[1] - p0[1]) * t / 2];
    const c2: V = [p2[0] - (p3[0] - p1[0]) * t / 2, p2[1] - (p3[1] - p1[1]) * t / 2];
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

/** 척추(spine) 점들과 폭(widths)으로 튜브형 몸통 외곽선을 만든다 */
export function tubeOutline(spine: V[], widths: number[], capStart = true, capEnd = true): V[] {
  const n = spine.length;
  const left: V[] = [], right: V[] = [];
  for (let i = 0; i < n; i++) {
    const p = spine[i];
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = widths[i] / 2;
    left.push([p[0] - dy * w, p[1] + dx * w]);
    right.push([p[0] + dy * w, p[1] - dx * w]);
  }
  const out: V[] = [];
  if (capStart && widths[0] > 0.5) {
    const p = spine[0], q = spine[1];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    out.push([p[0] - (q[0] - p[0]) / d * widths[0] * 0.35, p[1] - (q[1] - p[1]) / d * widths[0] * 0.35]);
  }
  out.push(...left);
  if (capEnd && widths[n - 1] > 0.5) {
    const p = spine[n - 1], q = spine[n - 2];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    out.push([p[0] - (q[0] - p[0]) / d * widths[n - 1] * 0.35, p[1] - (q[1] - p[1]) / d * widths[n - 1] * 0.35]);
  }
  out.push(...right.reverse());
  return out;
}

/** 곡선을 따라 점을 샘플링 (2차 베지어 체인) */
export function sampleCurve(pts: V[], count: number): V[] {
  // 스플라인을 근사 샘플링
  const out: V[] = [];
  const n = pts.length;
  for (let k = 0; k < count; k++) {
    const u = (k / (count - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    const t = u - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t2 = t * t, t3 = t2 * t;
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

export interface FillOpts {
  fill: string | CanvasGradient;
  line?: string;
  lw?: number;
  /** 안쪽 그림자 색 (아래쪽 어둡게) */
  shadow?: string;
  shadowAmt?: number;
  /** 윗부분 하이라이트 */
  light?: string;
  lightAmt?: number;
  /** 명암 방향 기준 bbox */
  tension?: number;
}

export function bbox(pts: V[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** 부드러운 외곽선 + 채색 + 명암을 한 번에 그린다 (핸드페인팅 느낌의 기본 단위) */
export function paintShape(ctx: Ctx, pts: V[], o: FillOpts) {
  const b = bbox(pts);
  ctx.save();
  ctx.beginPath();
  splinePath(ctx, pts, true, o.tension ?? 0.5);
  ctx.fillStyle = o.fill;
  ctx.fill();
  // 명암: 클립 후 그라데이션
  if (o.shadow || o.light) {
    ctx.save();
    ctx.clip();
    if (o.shadow) {
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      g.addColorStop(0, rgba(o.shadow, 0));
      g.addColorStop(0.55, rgba(o.shadow, 0));
      g.addColorStop(1, rgba(o.shadow, o.shadowAmt ?? 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
    }
    if (o.light) {
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      g.addColorStop(0, rgba(o.light, o.lightAmt ?? 0.5));
      g.addColorStop(0.35, rgba(o.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
    }
    ctx.restore();
  }
  if (o.line) {
    ctx.beginPath();
    splinePath(ctx, pts, true, o.tension ?? 0.5);
    ctx.strokeStyle = o.line;
    ctx.lineWidth = o.lw ?? 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** 클립 영역 안에서만 그리기 */
export function clipTo(ctx: Ctx, pts: V[], draw: () => void, tension = 0.5) {
  ctx.save();
  ctx.beginPath();
  splinePath(ctx, pts, true, tension);
  ctx.clip();
  draw();
  ctx.restore();
}

/** 부드러운 붓선 (끝이 가늘어지는 획) */
export function brushStroke(ctx: Ctx, pts: V[], width: number, color: string, taper = true) {
  if (pts.length < 2) return;
  const sp = sampleCurve(pts, Math.max(6, pts.length * 5));
  const widths = sp.map((_, i) => {
    const t = i / (sp.length - 1);
    return taper ? width * Math.sin(Math.PI * clamp(t * 0.95 + 0.05, 0, 1)) + 0.3 : width;
  });
  const outline = tubeOutline(sp, widths, false, false);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (const p of outline) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** 끝이 뾰족해지는 털 다발/깃털/갈기 획 (시작 굵고 끝 가늘게) */
export function tuft(ctx: Ctx, pts: V[], width: number, fill: string, line?: string, lw = 1.5) {
  const sp = sampleCurve(pts, Math.max(8, pts.length * 6));
  const widths = sp.map((_, i) => {
    const t = i / (sp.length - 1);
    return width * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 2 + 0.2))) + 0.2;
  });
  const outline = tubeOutline(sp, widths, true, false);
  ctx.save();
  ctx.beginPath();
  splinePath(ctx, outline, true, 0.3);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill?: string, line?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill?: string | CanvasGradient, line?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 한국 전통 구름 문양 (소용돌이 끝) */
export function cloudSwirl(ctx: Ctx, x: number, y: number, s: number, fill: string, line: string, flip = false, lw = 1.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.beginPath();
  // 몸통 구름
  ctx.moveTo(-20, 4);
  ctx.bezierCurveTo(-24, -6, -12, -14, -4, -8);
  ctx.bezierCurveTo(-2, -18, 14, -18, 14, -6);
  ctx.bezierCurveTo(24, -8, 26, 6, 16, 6);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw / s;
  ctx.strokeStyle = line;
  ctx.stroke();
  // 소용돌이
  ctx.beginPath();
  ctx.arc(-6, -4, 4, Math.PI * 0.2, Math.PI * 1.9);
  ctx.moveTo(8, -6);
  ctx.arc(5, -5, 3.2, 0, Math.PI * 1.6);
  ctx.stroke();
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(16, 6);
  ctx.bezierCurveTo(26, 8, 32, 2, 30, -4);
  ctx.stroke();
  ctx.restore();
}

/** 소용돌이 장식선 (금색 문양) */
export function spiral(ctx: Ctx, x: number, y: number, r: number, turns: number, color: string, lw: number, rot = 0) {
  ctx.save();
  ctx.beginPath();
  const steps = 30 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = rot + t * turns * TAU;
    const rr = r * (1 - t * 0.85);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
}

/** 털 질감: 방향을 따라 짧은 획을 흩뿌림 (클립 안에서 호출) */
export function furStrokes(ctx: Ctx, b: { x0: number; y0: number; w: number; h: number }, dir: number, color: string, alpha: number, count: number, len: number, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const x = b.x0 + r() * b.w, y = b.y0 + r() * b.h;
    const a = dir + (r() - 0.5) * 0.5;
    const l = len * (0.5 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 - 1, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** 비늘: 척추를 따라 U자 비늘 줄 (클립 안에서 호출) */
export function scaleRows(ctx: Ctx, spine: V[], widths: number[], color: string, alpha: number, size: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  let acc = 0;
  for (let i = 1; i < spine.length; i++) {
    const [ax, ay] = spine[i - 1], [bx, by] = spine[i];
    const seg = Math.hypot(bx - ax, by - ay);
    acc += seg;
    if (acc < size * 0.9) continue;
    acc = 0;
    const dx = (bx - ax) / (seg || 1), dy = (by - ay) / (seg || 1);
    const nx = -dy, ny = dx;
    const w = widths[i];
    const rows = Math.max(1, Math.floor(w / size));
    for (let k = 0; k < rows; k++) {
      const off = -w / 2 + (k + 0.5) * (w / rows) + ((i % 2) * size * 0.5 - size * 0.25);
      const cx = bx + nx * off, cy = by + ny * off;
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.55, ang + Math.PI * 0.5 - 1.2, ang + Math.PI * 0.5 + 1.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 장식 술(매듭+술) */
export function tassel(ctx: Ctx, x: number, y: number, s: number, color: string, gold: string, sway = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(s, s);
  // 매듭
  ctx.fillStyle = color;
  ctx.strokeStyle = shadeHex(color, -0.45);
  ctx.lineWidth = 1 / s;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(4, 4); ctx.lineTo(0, 8); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  circle(ctx, 0, 10, 2.2, gold, shadeHex(gold, -0.4), 0.8 / s);
  // 술
  const g = ctx.createLinearGradient(0, 12, 0, 26);
  g.addColorStop(0, color);
  g.addColorStop(1, shadeHex(color, -0.35));
  ctx.beginPath();
  ctx.moveTo(-2.4, 12); ctx.lineTo(2.4, 12); ctx.lineTo(3.6, 26); ctx.quadraticCurveTo(0, 28, -3.6, 26); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba('#000000', 0.2);
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.9, 14); ctx.lineTo(i * 1.3, 25.5); ctx.stroke(); }
  ctx.restore();
}

/** 금장식 고리/원판 */
export function goldDisc(ctx: Ctx, x: number, y: number, r: number, gold: string, gem?: string) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, shadeHex(gold, 0.55));
  g.addColorStop(0.6, gold);
  g.addColorStop(1, shadeHex(gold, -0.35));
  circle(ctx, x, y, r, g, shadeHex(gold, -0.55), Math.max(0.8, r * 0.18));
  spiral(ctx, x, y, r * 0.65, 1.3, shadeHex(gold, -0.5), Math.max(0.6, r * 0.1));
  if (gem) circle(ctx, x, y, r * 0.3, gem, shadeHex(gem, -0.5), 0.6);
}

/** 반짝임 (십자 별) */
export function sparkle(ctx: Ctx, x: number, y: number, r: number, color: string, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r * 0.28, y);
  ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r * 0.28, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.moveTo(x - r * 0.7, y); ctx.quadraticCurveTo(x, y, x, y - r * 0.2);
  ctx.quadraticCurveTo(x, y, x + r * 0.7, y); ctx.quadraticCurveTo(x, y, x, y + r * 0.2);
  ctx.quadraticCurveTo(x, y, x - r * 0.7, y);
  ctx.fill();
  ctx.restore();
}

/** 다리(2~3관절) 계산: 관절 각도들을 받아 점 목록 반환 */
export function limb(origin: V, lens: number[], angles: number[]): V[] {
  const pts: V[] = [origin];
  let a = 0;
  let [x, y] = origin;
  for (let i = 0; i < lens.length; i++) {
    a += angles[i];
    x += Math.cos(a) * lens[i];
    y += Math.sin(a) * lens[i];
    pts.push([x, y]);
  }
  return pts;
}

/** 주기 함수 도우미 */
export const wave = (t: number, off = 0) => Math.sin((t + off) * TAU);
