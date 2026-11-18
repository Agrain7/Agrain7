import { type Ctx, type V, tubeOutline, paintShape, clipTo, furStrokes, bbox, ellipse, shadeHex, rgba, limb, TAU } from '../paint.ts';

/** 피벗을 중심으로 회전 + 평행이동하는 변환 생성 */
export function makeXf(pivot: V, rot: number, dx: number, dy: number) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (p: V): V => {
    const x = p[0] - pivot[0], y = p[1] - pivot[1];
    return [pivot[0] + x * c - y * s + dx, pivot[1] + x * s + y * c + dy];
  };
}

/** 로컬 좌표(원점 기준) 점들을 회전 후 위치로 이동 */
export function place(pts: V[], at: V, rot: number, sx = 1): V[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([x, y]) => [at[0] + x * sx * c - y * s, at[1] + x * sx * s + y * c] as V);
}
export function placeP(p: V, at: V, rot: number): V {
  return place([p], at, rot)[0];
}

export interface LegStyle {
  fill: string;
  shade: string;
  line: string;
  lw: number;
  paw?: string;
  claw?: string;
  furSeed?: number;
}

/** 관절 사슬을 튜브로 칠한 다리 (+발) */
export function paintLeg(ctx: Ctx, chain: V[], widths: number[], st: LegStyle, pawLen: number, pawH: number, dark = 0) {
  const fill = dark ? shadeHex(st.fill, -dark) : st.fill;
  const shade = dark ? shadeHex(st.shade, -dark * 0.6) : st.shade;
  const outline = tubeOutline(chain, widths, true, false);
  const b = bbox(outline);
  const g = ctx.createLinearGradient(b.x0, 0, b.x1, 0);
  g.addColorStop(0, fill);
  g.addColorStop(1, shadeHex(st.fill, -0.12 - dark));
  paintShape(ctx, outline, { fill: g, line: st.line, lw: st.lw, shadow: shade, shadowAmt: 0.3, tension: 0.4 });
  if (st.furSeed !== undefined) {
    clipTo(ctx, outline, () => furStrokes(ctx, b, Math.PI / 2, '#ffffff', 0.18, 10, 6, st.furSeed!));
  }
  // 발
  const end = chain[chain.length - 1];
  const prev = chain[chain.length - 2];
  const legA = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const footA = legA - Math.PI / 2; // 다리 방향에 수직(앞쪽)
  const fx = end[0] + Math.cos(footA) * pawLen * 0.35;
  const fy = end[1] + Math.sin(footA) * pawLen * 0.35;
  ellipse(ctx, fx, fy, pawLen * 0.62, pawH * 0.55, footA, st.paw ? (dark ? shadeHex(st.paw, -dark) : st.paw) : fill, st.line, st.lw);
  if (st.claw) {
    ctx.save();
    ctx.strokeStyle = st.claw;
    ctx.lineWidth = Math.max(1, st.lw * 0.8);
    for (let k = 0; k < 3; k++) {
      const a = footA - 0.25 + k * 0.22;
      const bx = fx + Math.cos(footA) * pawLen * 0.5, by = fy + Math.sin(footA) * pawLen * 0.5 + (k - 1) * pawH * 0.18;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a) * pawLen * 0.25, by + Math.sin(a) * pawLen * 0.1, bx + Math.cos(a) * pawLen * 0.35, by + pawH * 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }
  return { foot: [fx, fy + pawH * 0.5] as V, chain };
}

export function legChain(origin: V, lens: number[], angles: number[]): V[] {
  return limb(origin, lens, angles);
}

/** 바닥 그림자 */
export function groundShadow(ctx: Ctx, cx: number, w: number, alpha = 0.25, y = 0) {
  const g = ctx.createRadialGradient(cx, y, 0, cx, y, w);
  g.addColorStop(0, rgba('#1a1426', alpha));
  g.addColorStop(1, rgba('#1a1426', 0));
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(1, 0.18);
  ctx.translate(-cx, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, y, w, 0, TAU);
  ctx.fill();
  ctx.restore();
}
