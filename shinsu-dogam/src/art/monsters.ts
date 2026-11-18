// 몬스터 페인터 (오른쪽을 바라보는 기준, 원점 = 발 중심)
import type { AnimName, FrameBox, Pose } from './types.ts';
import {
  type Ctx, type V, paintShape, clipTo, furStrokes, bbox, tuft, ellipse, circle, rgba, glow, TAU, clamp, spiral, sparkle, tubeOutline, sampleCurve,
} from './paint.ts';
import { paintLeg, legChain, groundShadow } from './mounts/common.ts';

export interface MonsterPainter {
  box: FrameBox;
  anims: Partial<Record<AnimName, number>>;
  draw(ctx: Ctx, pose: Pose): void;
}

const LINE = '#1d1626';

// ---------------- 붉은 눈의 산돼지 ----------------
const boar: MonsterPainter = {
  box: { w: 150, h: 100, ox: 75, oy: 94 },
  anims: { idle: 4, run: 6, attack: 6, hit: 1 },
  draw(ctx, p) {
    const run = p.anim === 'run' || p.anim === 'attack';
    const ph = p.t * TAU * (p.anim === 'attack' ? 2 : 1);
    const bob = run ? -Math.abs(Math.sin(ph)) * 4 : Math.sin(ph) * 1;
    const hit = p.anim === 'hit';
    const ty = -26 + bob;
    groundShadow(ctx, 0, 52, 0.3);
    const body = '#3a3440', bodyL = '#5b5363';
    const legs = (near: boolean) => {
      for (const [x, off] of [[22, near ? 0 : 0.5], [-24, near ? 0.5 : 0]] as const) {
        const a = run ? Math.sin(ph + off * TAU) * 0.7 : 0;
        const ch = legChain([x + (near ? 3 : -3), ty + 8], [13, 12], [Math.PI / 2 - a, run ? Math.max(0, Math.cos(ph + off * TAU)) * 0.9 : 0]);
        paintLeg(ctx, ch, [13, 9, 7], { fill: body, shade: '#0d0a12', line: LINE, lw: 1.8, paw: '#211c26' }, 10, 7, near ? 0 : 0.25);
      }
    };
    legs(false);
    // 몸통
    const torso: V[] = [[38, ty - 14], [44, ty + 4], [30, ty + 18], [-10, ty + 20], [-40, ty + 14], [-46, ty - 4], [-34, ty - 20], [0, ty - 26]];
    const g = ctx.createLinearGradient(0, ty - 26, 0, ty + 20);
    g.addColorStop(0, bodyL); g.addColorStop(1, body);
    paintShape(ctx, torso, { fill: g, line: LINE, lw: 2, shadow: '#0d0a12', shadowAmt: 0.5 });
    clipTo(ctx, torso, () => furStrokes(ctx, bbox(torso), Math.PI, '#9a8fa8', 0.35, 40, 9, 5));
    // 흰 갈기 + 붉은 소용돌이 문양
    for (let k = 0; k < 7; k++) {
      const x = 26 - k * 9, y = ty - 22 + Math.abs(k - 3) * 1.5;
      tuft(ctx, [[x, y + 6], [x - 4, y - 6], [x - 12, y - 14 + (run ? Math.sin(ph + k) * 3 : 0)]], 9, '#ece4ea', rgba('#7a6a80', 0.9), 1);
    }
    spiral(ctx, -14, ty + 2, 8, 1.4, '#c8352e', 2.2);
    spiral(ctx, 12, ty + 4, 6, 1.4, '#c8352e', 2);
    legs(true);
    // 머리
    const hx = 46, hy = ty + 2 + (p.anim === 'attack' ? 4 : 0);
    const head: V[] = [[hx - 12, hy - 16], [hx + 6, hy - 12], [hx + 20, hy - 2], [hx + 24, hy + 8], [hx + 14, hy + 14], [hx - 6, hy + 12], [hx - 14, hy]];
    paintShape(ctx, head, { fill: bodyL, line: LINE, lw: 2, shadow: '#0d0a12', shadowAmt: 0.4 });
    ellipse(ctx, hx + 22, hy + 6, 6, 7, 0, '#8a6a74', LINE, 1.5);
    circle(ctx, hx + 22, hy + 5, 1.4, LINE);
    circle(ctx, hx + 21, hy + 9, 1.4, LINE);
    // 엄니
    ctx.fillStyle = '#f4ead2';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx + 12, hy + 10); ctx.quadraticCurveTo(hx + 22, hy + 4, hx + 18, hy - 6); ctx.lineTo(hx + 15, hy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 붉은 눈
    glow(ctx, hx + 4, hy - 4, 10, '#ff3a3a', hit ? 0.2 : 0.8);
    ellipse(ctx, hx + 4, hy - 4, 4, hit ? 1 : 3, -0.2, '#ff4a3a', LINE, 1);
    // 귀
    paintShape(ctx, [[hx - 10, hy - 14], [hx - 16, hy - 26], [hx - 2, hy - 16]], { fill: body, line: LINE, lw: 1.5, tension: 0.2 });
    if (run) for (let k = 0; k < 2; k++) circle(ctx, -50 - k * 10, -6 - k * 4, 4 - k, rgba('#e8dcc4', 0.5));
  },
};

// ---------------- 산속 도깨비 짐승 ----------------
const dokkaebi: MonsterPainter = {
  box: { w: 120, h: 120, ox: 60, oy: 114 },
  anims: { idle: 4, jump: 2, hit: 1 },
  draw(ctx, p) {
    const sq = p.anim === 'idle' ? Math.sin(p.t * TAU) * 0.06 : p.anim === 'jump' ? -0.12 : 0.1;
    const sx = 1 + sq, sy = 1 - sq;
    groundShadow(ctx, 0, 40, p.anim === 'jump' ? 0.12 : 0.3);
    ctx.save();
    ctx.translate(0, p.anim === 'jump' ? -10 : 0);
    ctx.scale(sx, sy);
    const fur = '#2f6f6a', furL = '#4f9a8a';
    // 발
    for (const x of [-16, 16]) ellipse(ctx, x, -6, 12, 7, 0, '#244e4c', LINE, 1.8);
    // 털뭉치 몸
    const body: V[] = [[0, -78], [24, -70], [36, -48], [34, -20], [18, -6], [-18, -6], [-34, -20], [-36, -48], [-24, -70]];
    const g = ctx.createRadialGradient(-8, -60, 6, 0, -40, 50);
    g.addColorStop(0, furL); g.addColorStop(1, fur);
    paintShape(ctx, body, { fill: g, line: LINE, lw: 2.2, shadow: '#0f2a2a', shadowAmt: 0.45 });
    clipTo(ctx, body, () => furStrokes(ctx, bbox(body), Math.PI / 2, '#bfe6d6', 0.3, 60, 8, 21));
    // 털 소용돌이 장식
    spiral(ctx, -18, -28, 7, 1.3, '#9fd6c2', 2);
    spiral(ctx, 20, -24, 6, 1.3, '#9fd6c2', 2);
    // 얼굴 (큰 입 + 송곳니)
    ellipse(ctx, 6, -40, 22, 14, 0, '#e9c79a', LINE, 1.8);
    ctx.fillStyle = '#6e1b25';
    ctx.beginPath(); ctx.moveTo(-10, -36); ctx.quadraticCurveTo(6, -24, 24, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const x of [-4, 14]) { ctx.beginPath(); ctx.moveTo(x - 3, -36); ctx.lineTo(x, -29); ctx.lineTo(x + 3, -36); ctx.fill(); }
    // 눈
    for (const x of [-2, 16]) {
      circle(ctx, x, -48, 6, '#fff7d6', LINE, 1.5);
      circle(ctx, x + 1.5, -48, 3, p.anim === 'hit' ? '#6e1b25' : '#1d1626');
    }
    ctx.strokeStyle = LINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, -58); ctx.lineTo(3, -54); ctx.moveTo(22, -58); ctx.lineTo(12, -54); ctx.stroke();
    // 도깨비 뿔
    paintShape(ctx, [[0, -74], [6, -98], [12, -74]], { fill: '#f0d78a', line: LINE, lw: 1.8, tension: 0.15, shadow: '#a07a2a', shadowAmt: 0.5 });
    // 방울 귀걸이
    circle(ctx, -34, -46, 4, '#e2b14c', LINE, 1.2);
    ctx.restore();
  },
};

// ---------------- 어둠의 여우 정령 ----------------
const fox: MonsterPainter = {
  box: { w: 150, h: 120, ox: 70, oy: 112 },
  anims: { idle: 6, attack: 4, hit: 1 },
  draw(ctx, p) {
    const bob = Math.sin(p.t * TAU) * 4;
    const cast = p.anim === 'attack' ? Math.sin(clamp(p.t * 1.2, 0, 1) * Math.PI) : 0;
    groundShadow(ctx, 0, 40, 0.2);
    ctx.save();
    ctx.translate(0, -18 + bob);
    // 꼬리 3개 (어둠의 불꽃)
    for (let k = 0; k < 3; k++) {
      const a = Math.PI + 0.5 - k * 0.45 - cast * 0.3;
      const base: V = [-20, -26];
      const pts: V[] = [base, [base[0] + Math.cos(a) * 22, base[1] + Math.sin(a) * 22 - 8], [base[0] + Math.cos(a - 0.3) * 46, base[1] + Math.sin(a - 0.3) * 46 - 14 + Math.sin(p.t * TAU + k) * 5]];
      tuft(ctx, pts, 18, '#3a2650', LINE, 1.6);
      const tip = pts[2];
      glow(ctx, tip[0], tip[1], 16, '#b45cff', 0.6);
      tuft(ctx, [[tip[0] + 6, tip[1] + 4], [tip[0] - 2, tip[1] - 6], [tip[0] - 8, tip[1] - 16]], 9, rgba('#c98bff', 0.85));
    }
    // 몸
    const body: V[] = [[22, -40], [30, -26], [20, -10], [-10, -8], [-26, -18], [-24, -36], [0, -44]];
    paintShape(ctx, body, { fill: '#3e2a58', line: LINE, lw: 2, shadow: '#120a1e', shadowAmt: 0.5, light: '#a07ac8', lightAmt: 0.4 });
    // 다리 (가늘게, 떠 있음)
    for (const x of [-14, 14]) {
      ctx.strokeStyle = '#2a1c3c'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x + 3, 6 + Math.sin(p.t * TAU + x) * 2); ctx.stroke();
    }
    // 머리 + 흰 가면 문양
    const head: V[] = [[18, -46], [40, -44], [52, -36], [40, -28], [22, -26], [14, -36]];
    paintShape(ctx, head, { fill: '#4a3468', line: LINE, lw: 2 });
    paintShape(ctx, [[24, -42], [44, -40], [48, -35], [32, -31]], { fill: '#f4ecf6', tension: 0.3 });
    paintShape(ctx, [[18, -46], [16, -64], [28, -48]], { fill: '#4a3468', line: LINE, lw: 1.8, tension: 0.15 });
    paintShape(ctx, [[28, -46], [30, -64], [36, -46]], { fill: '#4a3468', line: LINE, lw: 1.8, tension: 0.15 });
    ellipse(ctx, 34, -38, 4, p.anim === 'hit' ? 0.8 : 2, -0.2, '#ff5fd2');
    glow(ctx, 34, -38, 8, '#ff5fd2', 0.6);
    ctx.strokeStyle = '#c8352e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(26, -34); ctx.quadraticCurveTo(30, -30, 38, -33); ctx.stroke();
    if (cast > 0.1) {
      glow(ctx, 58, -40, 22 * cast, '#b45cff', 0.9);
      sparkle(ctx, 58, -40, 9 * cast, '#f2d6ff');
    }
    ctx.restore();
  },
};

// ---------------- 작은 비행 요괴 ----------------
const bat: MonsterPainter = {
  box: { w: 120, h: 90, ox: 60, oy: 60 },
  anims: { fly: 4, hit: 1 },
  draw(ctx, p) {
    const flap = Math.sin(p.t * TAU);
    const wing = (dir: number) => {
      const a = -0.4 - flap * 0.7;
      const pts: V[] = [[dir * 10, -20], [dir * 34, -20 + Math.sin(a) * 30], [dir * 52, -8 + Math.sin(a) * 34], [dir * 40, -6 + Math.sin(a) * 14], [dir * 30, -2 + Math.sin(a) * 10], [dir * 18, -4]];
      paintShape(ctx, pts, { fill: '#2a2236', line: LINE, lw: 1.6, tension: 0.15, light: '#6a5a86', lightAmt: 0.5 });
    };
    wing(-1);
    wing(1);
    // 먹물 몸통
    const g = ctx.createRadialGradient(-4, -22, 3, 0, -16, 22);
    g.addColorStop(0, '#4a3e5e'); g.addColorStop(1, '#141018');
    circle(ctx, 0, -16, 20, g, LINE, 2);
    for (let k = 0; k < 4; k++) circle(ctx, -12 + k * 8, 2 + (k % 2) * 3, 4, '#141018');
    // 외눈
    circle(ctx, 2, -18, 9, '#fff3c6', LINE, 1.5);
    circle(ctx, 4, -18, 4.5, p.anim === 'hit' ? '#6e1b25' : '#c8352e');
    circle(ctx, 2, -20, 1.6, '#ffffff');
    // 부적
    ctx.save();
    ctx.translate(-6, -34);
    ctx.rotate(-0.2);
    ctx.fillStyle = '#f2d36b';
    ctx.fillRect(-5, -8, 10, 16);
    ctx.strokeStyle = '#b8322b'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.moveTo(-3, -2); ctx.lineTo(3, -2); ctx.moveTo(-3, 2); ctx.lineTo(3, 3); ctx.stroke();
    ctx.restore();
  },
};

// ---------------- 바위 정령 (정예) ----------------
const rock: MonsterPainter = {
  box: { w: 180, h: 170, ox: 90, oy: 164 },
  anims: { idle: 4, run: 6, attack: 6, hit: 1 },
  draw(ctx, p) {
    const walk = p.anim === 'run';
    const slam = p.anim === 'attack' ? Math.sin(clamp(p.t, 0, 1) * Math.PI) : 0;
    const bob = walk ? Math.abs(Math.sin(p.t * TAU)) * -3 : Math.sin(p.t * TAU) * 1;
    groundShadow(ctx, 0, 70, 0.35);
    const stone = '#8b8590', stoneD = '#4e4956';
    const boulder = (x: number, y: number, rx: number, ry: number, seed: number) => {
      const pts: V[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const rr = 0.85 + ((seed * (k + 3)) % 7) / 30;
        pts.push([x + Math.cos(a) * rx * rr, y + Math.sin(a) * ry * rr]);
      }
      paintShape(ctx, pts, { fill: stone, line: LINE, lw: 2.2, shadow: stoneD, shadowAmt: 0.7, light: '#ffffff', lightAmt: 0.25, tension: 0.35 });
      return pts;
    };
    // 다리 돌
    const lift = walk ? Math.sin(p.t * TAU) * 6 : 0;
    boulder(-24, -16 - Math.max(0, lift), 18, 14, 3);
    boulder(24, -16 - Math.max(0, -lift), 18, 14, 5);
    // 몸통
    const body = boulder(0, -72 + bob, 50, 46, 7);
    clipTo(ctx, body, () => {
      // 빛나는 균열
      ctx.strokeStyle = '#7ff3ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#7ff3ff';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(-20, -100 + bob); ctx.lineTo(-6, -80 + bob); ctx.lineTo(-14, -60 + bob); ctx.lineTo(4, -40 + bob); ctx.stroke();
      ctx.shadowBlur = 0;
    });
    // 이끼 머리
    ellipse(ctx, -4, -112 + bob, 40, 12, -0.1, '#5f8a5a', LINE, 1.5);
    for (let k = 0; k < 5; k++) tuft(ctx, [[-30 + k * 14, -114 + bob], [-34 + k * 14, -122 + bob], [-40 + k * 14, -126 + bob]], 6, '#77a85a');
    // 눈
    glow(ctx, 18, -82 + bob, 16, '#7ff3ff', 0.7);
    ellipse(ctx, 18, -82 + bob, 6, p.anim === 'hit' ? 1 : 4, 0, '#dffcff');
    // 팔 (주먹 돌)
    const armY = -66 + bob - slam * 50;
    boulder(52 + slam * 10, armY, 20, 18, 11);
    boulder(-50, -60 + bob, 18, 16, 13);
    if (slam > 0.8) for (let k = 0; k < 5; k++) sparkle(ctx, 40 + k * 10, -8, 6, '#e8dcc4');
  },
};

// ---------------- 보스: 흑운 산군 ----------------
const boss: MonsterPainter = {
  box: { w: 360, h: 300, ox: 180, oy: 292 },
  anims: { idle: 4, run: 6, attack: 6, cast: 4, hit: 1, fall: 2 },
  draw(ctx, p) {
    const t = p.t;
    const walk = p.anim === 'run';
    const slam = p.anim === 'attack' ? Math.sin(clamp(t * 1.1, 0, 1) * Math.PI) : 0;
    const roar = p.anim === 'cast' ? Math.sin(clamp(t * 1.2, 0, 1) * Math.PI) : 0;
    const stun = p.anim === 'fall';
    const bob = walk ? -Math.abs(Math.sin(t * TAU)) * 6 : Math.sin(t * TAU) * 2;
    const ty = -120 + bob - slam * 30 + (stun ? 20 : 0);
    groundShadow(ctx, 0, 150, 0.4);
    const body = '#2b2a48', bodyL = '#4a4875', line = LINE;
    // 검은 구름 갈기 (뒤)
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * 0.6 + k * 0.22;
      const r0 = 70;
      const cx = 30 + Math.cos(a) * r0, cy = ty - 30 + Math.sin(a) * r0 * -0.9;
      const sw = Math.sin(t * TAU + k) * 6;
      tuft(ctx, [[cx, cy], [cx - 30, cy - 20 + sw], [cx - 70 - k * 4, cy - 10 + sw * 1.5]], 34, k % 2 ? '#1a1830' : '#24213d', rgba('#6a5aa0', 0.6), 1.5);
    }
    glow(ctx, 0, ty, 160, '#6a3aa0', 0.25 + roar * 0.3);
    // 뒷다리/앞다리 (거대한 발)
    const leg = (x: number, phase: number, near: boolean) => {
      const a = walk ? Math.sin(t * TAU + phase) * 0.5 : 0;
      const ch = legChain([x, ty + 40], [52, 46], [Math.PI / 2 - a - (slam && near && x > 0 ? slam * 1.2 : 0), walk ? Math.max(0, Math.cos(t * TAU + phase)) * 0.6 : 0.1]);
      paintLeg(ctx, ch, [46, 34, 26], { fill: body, shade: '#09080f', line, lw: 2.5, paw: '#1c1a2e', claw: '#e8e0d0' }, 36, 22, near ? 0 : 0.2);
    };
    leg(-70, 0.5, false);
    leg(60, 0, false);
    // 몸통
    const torso: V[] = [[100, ty - 60], [120, ty - 10], [96, ty + 50], [0, ty + 60], [-100, ty + 50], [-130, ty], [-110, ty - 50], [-20, ty - 74]];
    const g = ctx.createLinearGradient(0, ty - 74, 0, ty + 60);
    g.addColorStop(0, bodyL); g.addColorStop(1, body);
    paintShape(ctx, torso, { fill: g, line, lw: 3, shadow: '#08070e', shadowAmt: 0.6 });
    clipTo(ctx, torso, () => {
      furStrokes(ctx, bbox(torso), Math.PI, '#8a86c0', 0.25, 120, 16, 77);
      // 붉은 주술 문양
      spiral(ctx, -50, ty + 4, 22, 1.5, '#c8352e', 4);
      spiral(ctx, 30, ty + 14, 16, 1.5, '#c8352e', 3.5);
    });
    // 끊어진 금 사슬
    ctx.strokeStyle = '#c99a43';
    ctx.lineWidth = 4;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(-60 + k * 18, ty + 46 + Math.sin(k) * 4, 7, 4, 0.3, 0, TAU); ctx.stroke(); }
    leg(-40, 0, true);
    leg(80, 0.5, true);
    // 머리 + 뼈 가면
    const hx = 120, hy = ty - 50 + (roar ? -10 : 0);
    const head: V[] = [[hx - 40, hy - 40], [hx + 10, hy - 50], [hx + 56, hy - 24], [hx + 70, hy + 6], [hx + 50, hy + 36], [hx - 10, hy + 40], [hx - 46, hy + 10]];
    paintShape(ctx, head, { fill: body, line, lw: 3, shadow: '#08070e', shadowAmt: 0.5 });
    const mask: V[] = [[hx - 18, hy - 36], [hx + 30, hy - 40], [hx + 62, hy - 8], [hx + 54, hy + 16], [hx + 10, hy + 20], [hx - 24, hy - 2]];
    paintShape(ctx, mask, { fill: '#efe6d8', line, lw: 2.5, shadow: '#9a8a7a', shadowAmt: 0.6 });
    ctx.strokeStyle = '#c8352e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx + 6, hy - 34); ctx.lineTo(hx + 14, hy + 14); ctx.moveTo(hx + 30, hy - 30); ctx.lineTo(hx + 44, hy + 10); ctx.stroke();
    // 눈
    for (const ex of [hx + 14, hx + 40]) {
      glow(ctx, ex, hy - 14, 22, '#ff3030', stun ? 0.1 : 0.9);
      ellipse(ctx, ex, hy - 14, 8, stun ? 1.5 : 5, -0.2, stun ? '#5a1010' : '#ff5a3a', line, 1.5);
    }
    // 입 (포효)
    if (roar > 0.1 || slam > 0.3) {
      ctx.fillStyle = '#5a0f18';
      ctx.beginPath(); ctx.moveTo(hx + 8, hy + 18); ctx.lineTo(hx + 56, hy + 14); ctx.lineTo(hx + 36, hy + 18 + 26 * Math.max(roar, slam)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(hx + 12 + k * 10, hy + 17); ctx.lineTo(hx + 16 + k * 10, hy + 26); ctx.lineTo(hx + 20 + k * 10, hy + 17); ctx.fill(); }
    }
    // 뿔
    for (const [bx, by, l] of [[hx - 10, hy - 42, 60], [hx + 20, hy - 44, 48]] as const) {
      const pts = sampleCurve([[bx, by], [bx - 14, by - l * 0.6], [bx - 40, by - l]], 10);
      paintShape(ctx, tubeOutline(pts, pts.map((_, i) => 14 * (1 - i / pts.length) + 1), true, true), { fill: '#d8ccb6', line, lw: 2, shadow: '#7a6a5a', shadowAmt: 0.6 });
    }
    if (stun) for (let k = 0; k < 3; k++) sparkle(ctx, hx - 20 + k * 30, hy - 80 + Math.sin(t * TAU + k) * 6, 9, '#fff3a0');
  },
};

export const MONSTER_PAINTERS: Record<string, MonsterPainter> = { boar, dokkaebi, fox, bat, rock, boss };
