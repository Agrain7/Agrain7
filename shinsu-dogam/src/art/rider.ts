// 라이더 '하람' — 영물에 올라탄 동방의 탐험가 (오른쪽을 바라봄, 원점 = 엉덩이/안장 접점)
import type { FrameBox, Pose, AnimName } from './types.ts';
import { type Ctx, type V, paintShape, ellipse, circle, shadeHex, rgba, tuft, TAU, sampleCurve, tubeOutline, tassel, goldDisc } from './paint.ts';

export interface Outfit {
  top: string; topShade: string; trim: string; skirt: string; skirtShade: string; ribbon: string; sleeveBand?: string[];
  hairOrnament: string; extra?: 'armor' | 'shawl' | 'fur' | 'royal';
}

export const OUTFITS: Record<string, Outfit> = {
  outfit_default: { top: '#f6f1e6', topShade: '#c9c0b0', trim: '#c3352c', skirt: '#c3352c', skirtShade: '#7e1f18', ribbon: '#d33a2f', hairOrnament: '#e2b14c' },
  outfit_saekdong: { top: '#fbf3e2', topShade: '#cfc4ae', trim: '#2f5fae', skirt: '#2f8a7a', skirtShade: '#1b5248', ribbon: '#f2c94c', sleeveBand: ['#c3352c', '#f2c94c', '#2f8a7a', '#3e5a9a', '#f4f4f4'], hairOrnament: '#c3352c' },
  outfit_warrior: { top: '#2c3556', topShade: '#161b30', trim: '#c99a43', skirt: '#3a2e2a', skirtShade: '#1a1412', ribbon: '#c3352c', hairOrnament: '#9aa4b8', extra: 'armor' },
  outfit_fairy: { top: '#f3ecfb', topShade: '#c9bde0', trim: '#9ad0e8', skirt: '#cdb6ea', skirtShade: '#8f78b8', ribbon: '#9ad0e8', hairOrnament: '#f4b8c8', extra: 'shawl' },
  outfit_royal: { top: '#2f7a5a', topShade: '#1a4a36', trim: '#e2b14c', skirt: '#b8322b', skirtShade: '#6e1b18', ribbon: '#e2b14c', hairOrnament: '#e2b14c', extra: 'royal' },
  outfit_winter: { top: '#e7d6c0', topShade: '#b8a48a', trim: '#7a4a2a', skirt: '#4a5a8a', skirtShade: '#2a3456', ribbon: '#c3352c', hairOrnament: '#f4f4f4', extra: 'fur' },
};

const LINE = '#2a1e26';
const SKIN = '#fbe3cf';
const HAIR = '#1f1a26';

// 왼쪽 여유 공간: 뒤로 휘날리는 띠(피백)가 들어갈 자리
export const RIDER_BOX: FrameBox = { w: 160, h: 130, ox: 94, oy: 104 };
export const RIDER_ANIMS: Partial<Record<AnimName, number>> = { idle: 4, run: 4, attack: 2, hit: 1, cast: 2, fly: 4 };

export function drawRider(ctx: Ctx, p: Pose, o: Outfit) {
  const t = p.t;
  const lean = p.anim === 'run' || p.anim === 'fly' ? 0.22 : p.anim === 'hit' ? -0.25 : 0.04;
  const breathe = Math.sin(t * TAU) * (p.anim === 'idle' ? 1 : 0.5);
  const wind = p.anim === 'run' || p.anim === 'fly' ? 1 : 0.4;
  ctx.save();
  // 다리 (가까운 쪽, 영물 옆구리로 내려옴)
  const legPts: V[] = [[2, -2], [12, 8], [8, 22]];
  const leg = tubeOutline(sampleCurve(legPts, 8), [11, 10, 9, 8, 8, 7, 7, 6], true, true);
  paintShape(ctx, leg, { fill: o.skirtShade, line: LINE, lw: 1.4 });
  ellipse(ctx, 11, 24, 6, 3.5, 0.2, '#f2ecdc', LINE, 1.2); // 버선
  // 치마 (앉은 자세로 퍼짐)
  ctx.rotate(lean * 0.4);
  const skirt: V[] = [[-14, -16], [10, -16], [20, 2], [16, 10], [-18, 10], [-22, 0]];
  paintShape(ctx, skirt, { fill: o.skirt, line: LINE, lw: 1.5, shadow: o.skirtShade, shadowAmt: 0.8, light: '#ffffff', lightAmt: 0.2 });
  if (o.extra === 'royal') { ctx.strokeStyle = o.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(16, 6); ctx.stroke(); }
  ctx.restore();
  // 상체
  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(lean);
  // 뒤로 길게 휘날리는 띠 (참고 화면의 붉은 피백 + 크림색 안 띠)
  if (o.extra !== 'armor') {
    const sash = (x0: number, y0: number, len: number, ph: number, w0: number, col: string, lift: number) => {
      const pts: V[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const amp = (1.5 + u * 7) * (0.45 + wind * 0.75);
        pts.push([x0 - u * len * (0.75 + 0.25 * wind), y0 - u * lift + Math.sin((t - u * 0.8 + ph) * TAU) * amp]);
      }
      const sp = sampleCurve(pts, 14);
      paintShape(ctx, tubeOutline(sp, sp.map((_, i) => w0 * (1 - i / sp.length * 0.45) + (i > sp.length - 4 ? 1.2 : 0)), true, true), { fill: col, line: LINE, lw: 1.1, shadow: shadeHex(col, -0.35), shadowAmt: 0.5 });
    };
    sash(-6, -14, 70, 0.5, 4.2, o.extra === 'shawl' ? rgba(o.trim, 0.8) : '#f3ead6', 10);
    sash(-8, -22, 82, 0, 5.2, o.ribbon, 18);
  }
  // 날개옷 (선녀)
  if (o.extra === 'shawl') {
    const s = Math.sin(t * TAU) * 6 * wind;
    tuft(ctx, [[-6, -22], [-28, -18 + s], [-50, -8 + s * 1.4], [-64, -18 + s]], 9, rgba(o.trim, 0.65), rgba('#5a7a9a', 0.5), 1);
  }
  // 저고리 몸통
  const torso: V[] = [[-11, -30 + breathe * 0.3], [9, -30 + breathe * 0.3], [13, -8], [12, 2], [-12, 2], [-13, -10]];
  paintShape(ctx, torso, { fill: o.top, line: LINE, lw: 1.5, shadow: o.topShade, shadowAmt: 0.7 });
  if (o.extra === 'armor') {
    paintShape(ctx, [[-9, -24], [9, -24], [11, -6], [-11, -6]], { fill: '#5a6480', line: LINE, lw: 1.2, light: '#ffffff', lightAmt: 0.3 });
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = o.trim; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-9, -20 + k * 5); ctx.lineTo(9, -20 + k * 5); ctx.stroke(); }
  }
  if (o.extra === 'fur') {
    for (let k = 0; k < 6; k++) circle(ctx, -10 + k * 4, -29, 3.4, '#fbfaf5', rgba('#b8a48a', 0.8), 0.8);
    for (let k = 0; k < 5; k++) circle(ctx, 11, -26 + k * 6, 3, '#fbfaf5', rgba('#b8a48a', 0.8), 0.8);
  }
  // 깃 + 고름
  ctx.strokeStyle = o.trim;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(6, -16); ctx.stroke();
  if (!o.extra || o.extra === 'royal' || o.extra === 'shawl') {
    const gs = Math.sin(t * TAU + 1) * 3 * wind;
    tuft(ctx, [[5, -16], [-2, -8 + gs * 0.3], [-8 - wind * 4, -2 + gs]], 4.5, o.trim, rgba(LINE, 0.6), 0.8);
  }
  if (o.extra === 'royal') { goldDisc(ctx, 0, -12, 3.5, '#e2b14c'); }
  // 팔 (고삐를 잡거나 앞으로 뻗음)
  const point = p.anim === 'attack' || p.anim === 'cast';
  const armEnd: V = point ? [30, -26 - (p.anim === 'cast' ? 10 : 0)] : p.anim === 'hit' ? [-6, -40] : [18, -6 + breathe * 0.5];
  const armPts = sampleCurve([[2, -26], [point ? 14 : 12, point ? -26 : -16], armEnd], 8);
  paintShape(ctx, tubeOutline(armPts, [11, 11, 10, 10, 9, 9, 8, 8], true, false), { fill: o.top, line: LINE, lw: 1.4, shadow: o.topShade, shadowAmt: 0.6 });
  if (o.sleeveBand) {
    o.sleeveBand.forEach((col, i) => {
      const q = armPts[2 + i];
      if (q) ellipse(ctx, q[0], q[1], 2.2, 5.2, 0.6, col);
    });
  }
  circle(ctx, armEnd[0] + 2, armEnd[1], 3.6, SKIN, LINE, 1.2);
  if (point) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    circle(ctx, armEnd[0] + 8, armEnd[1] - 1, 4, rgba('#fff3c6', 0.9));
    ctx.restore();
  }
  // 머리
  ctx.translate(2, -44 + breathe * 0.4);
  // 뒷머리 + 댕기
  const sway = Math.sin(t * TAU) * 4 * wind;
  tuft(ctx, [[-10, -2], [-20, 6 + sway * 0.3], [-24 - wind * 6, 18 + sway]], 12, HAIR, LINE, 1.2);
  // 길게 늘어진 뒷머리 (바람에 날림)
  tuft(ctx, [[-8, -8], [-22, -2 + sway * 0.4], [-36 - wind * 8, 4 + sway], [-46 - wind * 12, 8 + sway * 1.3]], 10, HAIR, LINE, 1.2);
  const rib = sampleCurve([[-14, -14], [-28, -10 + sway], [-42 - wind * 6, -8 + sway * 1.6], [-50 - wind * 10, -2 + sway]], 12);
  paintShape(ctx, tubeOutline(rib, rib.map((_, i) => 5 - i * 0.25), true, true), { fill: o.ribbon, line: LINE, lw: 1.1 });
  // 얼굴
  const faceG = ctx.createRadialGradient(4, -2, 2, 2, 0, 18);
  faceG.addColorStop(0, '#fff2e6');
  faceG.addColorStop(1, SKIN);
  ctx.beginPath();
  ctx.ellipse(2, 0, 15, 16, 0, 0, TAU);
  ctx.fillStyle = faceG;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // 앞머리
  paintShape(ctx, [[-14, -4], [-12, -14], [0, -18], [14, -12], [17, -2], [12, -8], [4, -6], [-4, -10]], { fill: HAIR, line: LINE, lw: 1.4, tension: 0.4 });
  // 옆머리
  tuft(ctx, [[14, -6], [17, 4], [15, 12]], 5, HAIR, LINE, 1);
  // 올림머리(위로 둥글게) + 비녀 + 꽃 장식 (참고 화면의 소녀처럼)
  circle(ctx, -3, -21, 9.5, HAIR, LINE, 1.4);
  circle(ctx, -9, -27, 6, HAIR, LINE, 1.2);
  ctx.strokeStyle = o.hairOrnament;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-17, -23); ctx.lineTo(9, -19); ctx.stroke();
  circle(ctx, 10, -19, 2.6, o.hairOrnament, LINE, 1);
  for (let k = 0; k < 5; k++) {
    const an = (k * TAU) / 5 - 0.3;
    ellipse(ctx, 3 + Math.cos(an) * 3.2, -27 + Math.sin(an) * 3.2, 2.6, 1.8, an, '#f7c6d4', rgba(LINE, 0.7), 0.7);
  }
  circle(ctx, 3, -27, 1.6, '#d6455a');
  circle(ctx, -2, -30, 2.2, o.ribbon, rgba(LINE, 0.7), 0.7);
  if (o.extra === 'armor') { ctx.fillStyle = '#c3352c'; ctx.fillRect(-13, -12, 28, 4); tuft(ctx, [[-13, -10], [-24, -6 + sway], [-32, -10 + sway]], 4, '#c3352c'); }
  if (o.extra === 'royal') { paintShape(ctx, [[-10, -24], [-4, -32], [4, -32], [10, -24]], { fill: '#e2b14c', line: LINE, lw: 1.2, tension: 0.2 }); }
  if (o.extra === 'fur') { ellipse(ctx, -2, -16, 14, 6, 0, '#fbfaf5', rgba('#b8a48a', 0.8), 1); }
  // 눈 (큰 눈)
  const blink = p.anim === 'idle' && p.i === 3;
  if (p.anim === 'hit' || blink) {
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(10, 3); ctx.stroke();
  } else {
    ellipse(ctx, 8, 1, 3.2, 4.6, 0, '#3a2a3a');
    circle(ctx, 9, -0.8, 1.3, '#ffffff');
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(8, -6.5, 12, -4); ctx.stroke();
  }
  // 볼터치 + 입
  ellipse(ctx, 8, 8, 3.6, 2, 0, rgba('#f29aa0', 0.55));
  ctx.strokeStyle = '#8a3a3a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (p.anim === 'cast' || p.anim === 'attack') ctx.arc(13, 9, 2, 0, Math.PI);
  else ctx.arc(13, 8, 1.6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
  // 허리 장신구 (노리개)
  tassel(ctx, -6, -6, 0.45, o.trim, '#e2b14c', Math.sin(t * TAU) * 0.3 * wind + 0.2);
}
