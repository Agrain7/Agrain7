// 수집품·상자·효과·UI 페인팅
import { makeCanvas, rgba, shadeHex, glow, circle, ellipse, TAU, tuft, goldDisc, sparkle, cloudSwirl, rng, type Ctx, tassel, spiral } from './paint.ts';

export function paintChest(open: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(80, 70);
  ctx.translate(40, 66);
  if (open) glow(ctx, 0, -34, 46, '#ffe08a', 0.7);
  // 몸체 (붉은 옻칠 + 금장식)
  const g = ctx.createLinearGradient(0, -34, 0, 0);
  g.addColorStop(0, '#b8322b');
  g.addColorStop(1, '#6e1b18');
  ctx.fillStyle = g;
  ctx.fillRect(-30, -32, 60, 32);
  ctx.strokeStyle = '#2b1210';
  ctx.lineWidth = 2;
  ctx.strokeRect(-30, -32, 60, 32);
  ctx.fillStyle = '#e2b14c';
  ctx.fillRect(-30, -32, 6, 32); ctx.fillRect(24, -32, 6, 32); ctx.fillRect(-30, -20, 60, 4);
  if (open) {
    ctx.save();
    ctx.translate(0, -32);
    ctx.fillStyle = '#4a1210';
    ctx.fillRect(-28, -6, 56, 6);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#b8322b';
    ctx.fillRect(-30, -26, 60, 14);
    ctx.strokeRect(-30, -26, 60, 14);
    ctx.restore();
    for (let i = 0; i < 5; i++) sparkle(ctx, -18 + i * 9, -44 - (i % 2) * 10, 5, '#fff6c8');
  } else {
    ctx.beginPath();
    ctx.moveTo(-31, -32); ctx.quadraticCurveTo(0, -50, 31, -32); ctx.closePath();
    ctx.fillStyle = '#9a2a24'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2b14c';
    ctx.fillRect(-4, -40, 8, 14);
    goldDisc(ctx, 0, -24, 5, '#e2b14c');
  }
  return c;
}

/** 엽전 (금화) */
export function paintCoin(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(28, 28);
  const g = ctx.createRadialGradient(10, 9, 2, 14, 14, 13);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(0.6, '#e6b443');
  g.addColorStop(1, '#a8741e');
  circle(ctx, 14, 14, 12, g, '#6b4a12', 1.6);
  ctx.fillStyle = '#5a3c10';
  ctx.fillRect(10.5, 10.5, 7, 7);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(14, 14, 9, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  return c;
}

export function paintPearl(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  glow(ctx, 32, 32, 32, '#8fe3ff', 0.8);
  const g = ctx.createRadialGradient(26, 24, 2, 32, 32, 15);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#9fe2ff');
  g.addColorStop(1, '#2f7fb8');
  circle(ctx, 32, 32, 14, g, '#1d4f7a', 1.5);
  // 조각 균열
  ctx.strokeStyle = 'rgba(20,60,100,0.6)';
  ctx.beginPath(); ctx.moveTo(32, 18); ctx.lineTo(28, 30); ctx.lineTo(34, 36); ctx.lineTo(30, 46); ctx.stroke();
  sparkle(ctx, 22, 20, 6, '#ffffff');
  return c;
}

export function paintLorePage(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(52, 52);
  glow(ctx, 26, 26, 26, '#ffe6a6', 0.6);
  ctx.save();
  ctx.translate(26, 26);
  ctx.rotate(-0.15);
  ctx.fillStyle = '#efe0bd';
  ctx.fillRect(-13, -16, 26, 32);
  ctx.strokeStyle = '#7a5a34';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-13, -16, 26, 32);
  ctx.fillStyle = '#5a3c20';
  for (let i = 0; i < 4; i++) ctx.fillRect(6 - i * 5, -12, 2, 22);
  ctx.fillStyle = '#b8322b';
  ctx.fillRect(-12, 8, 6, 6);
  ctx.restore();
  return c;
}

export function paintPetal(color = '#f4a9be'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(18, 14);
  ctx.translate(9, 7);
  ctx.beginPath();
  ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-2, -7, 7, -2); ctx.quadraticCurveTo(3, 1, 7, 2); ctx.quadraticCurveTo(-2, 7, -8, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shadeHex(color, -0.3);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  return c;
}

/** 홍살문 (골인 지점) */
export function paintGoalGate(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(220, 300);
  ctx.translate(110, 296);
  const red = '#c3352c';
  const pillar = (x: number) => {
    const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    g.addColorStop(0, '#d9473b');
    g.addColorStop(1, '#8e2620');
    ctx.fillStyle = g;
    ctx.fillRect(x - 8, -280, 16, 280);
    ctx.strokeStyle = '#4a1210';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 8, -280, 16, 280);
  };
  pillar(-80);
  pillar(80);
  ctx.fillStyle = red;
  ctx.fillRect(-100, -250, 200, 12);
  ctx.fillRect(-92, -210, 184, 8);
  ctx.strokeStyle = '#4a1210';
  ctx.strokeRect(-100, -250, 200, 12);
  // 살 (화살 모양 기둥)
  for (let x = -66; x <= 66; x += 12) {
    ctx.fillStyle = red;
    ctx.fillRect(x - 2, -296, 4, 50);
    ctx.beginPath(); ctx.moveTo(x - 5, -290); ctx.lineTo(x, -300); ctx.lineTo(x + 5, -290); ctx.closePath(); ctx.fill();
  }
  // 태극 문양
  const cx = 0, cy = -244;
  circle(ctx, cx, cy, 14, '#2a55a8', '#1c1c2c', 1.5);
  ctx.beginPath(); ctx.arc(cx, cy, 14, Math.PI, 0); ctx.arc(cx + 7, cy, 7, 0, Math.PI); ctx.arc(cx - 7, cy, 7, 0, Math.PI, true); ctx.closePath();
  ctx.fillStyle = '#c3352c'; ctx.fill();
  return c;
}

export function paintThorns(w = 128, h = 26): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(13);
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * w + r() * 6;
    for (const dx of [0, -w, w]) {
      ctx.strokeStyle = '#3d2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + dx, h);
      ctx.quadraticCurveTo(x + dx + 6, h - 12, x + dx + (r() - 0.5) * 10, 2);
      ctx.stroke();
      ctx.fillStyle = '#7a2a3a';
      ctx.beginPath(); ctx.moveTo(x + dx - 3, 6); ctx.lineTo(x + dx, -2); ctx.lineTo(x + dx + 3, 6); ctx.fill();
    }
  }
  return c;
}

export function paintWisp(color = '#cfefff'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  glow(ctx, 12, 12, 12, color, 0.9);
  circle(ctx, 12, 12, 2.5, '#ffffff');
  return c;
}

// ---------- 전투 효과 ----------
export function paintSlash(color = '#ffffff'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(140, 140);
  ctx.translate(70, 70);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, 0, 54 - k * 8, -1.3, 1.3);
    ctx.arc(-14 - k * 4, 0, 46 - k * 8, 1.15, -1.15, true);
    ctx.closePath();
    ctx.fillStyle = rgba(color, 0.9 - k * 0.25);
    ctx.fill();
  }
  return c;
}

export function paintClaw(color = '#ffffff'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(110, 110);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = rgba(color, 0.95);
    ctx.lineWidth = 5 - k;
    ctx.beginPath();
    ctx.moveTo(20 + k * 18, 15);
    ctx.quadraticCurveTo(60 + k * 10, 50, 40 + k * 18, 100);
    ctx.stroke();
  }
  return c;
}

export function paintDust(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 40);
  const g = ctx.createRadialGradient(20, 20, 2, 20, 20, 19);
  g.addColorStop(0, 'rgba(240,228,206,0.9)');
  g.addColorStop(1, 'rgba(240,228,206,0)');
  circle(ctx, 20, 20, 19, g);
  return c;
}

export function paintFeather(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 18);
  ctx.translate(24, 9);
  ctx.beginPath();
  ctx.moveTo(22, 0); ctx.quadraticCurveTo(4, -9, -20, -3); ctx.lineTo(-22, 0); ctx.lineTo(-20, 3); ctx.quadraticCurveTo(4, 9, 22, 0);
  const g = ctx.createLinearGradient(-22, 0, 22, 0);
  g.addColorStop(0, '#2f3a5e');
  g.addColorStop(0.6, '#d8c7a0');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#2b2416';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.stroke();
  glow(ctx, 10, 0, 14, '#ffffff', 0.4);
  return c;
}

export function paintOrb(core: string, outer: string, r = 18): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(r * 4, r * 4);
  glow(ctx, r * 2, r * 2, r * 2, outer, 0.85);
  const g = ctx.createRadialGradient(r * 1.7, r * 1.7, 1, r * 2, r * 2, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, core);
  g.addColorStop(1, outer);
  circle(ctx, r * 2, r * 2, r * 0.8, g);
  return c;
}

export function paintFireball(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(80, 50);
  glow(ctx, 50, 25, 26, '#ff9a3c', 0.8);
  for (let k = 0; k < 4; k++) {
    tuft(ctx, [[56, 25], [36 - k * 4, 18 + k * 4], [8 + k * 4, 25 + (k - 1.5) * 6]], 16 - k * 3, k % 2 ? 'rgba(255,190,90,0.85)' : 'rgba(255,110,50,0.85)');
  }
  circle(ctx, 54, 25, 9, '#fff3c0');
  return c;
}

export function paintBolt(h = 520): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(90, h);
  const r = rng(Math.floor(h));
  const pts: [number, number][] = [[45, 0]];
  let x = 45;
  for (let y = 30; y < h; y += 26 + r() * 20) { x = 45 + (r() - 0.5) * 50; pts.push([x, y]); }
  pts.push([45, h]);
  const stroke = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  ctx.shadowColor = '#8fe3ff';
  ctx.shadowBlur = 18;
  stroke(12, 'rgba(120,200,255,0.5)');
  stroke(5, '#bff4ff');
  stroke(2, '#ffffff');
  return c;
}

export function paintRing(color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(256, 256);
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = rgba(color, 0.9 - k * 0.2);
    ctx.lineWidth = 10 - k * 2;
    ctx.beginPath();
    ctx.arc(128, 128, 116 - k * 6, 0, TAU);
    ctx.stroke();
  }
  return c;
}

export function paintBreath(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(340, 120);
  const g = ctx.createLinearGradient(0, 0, 340, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.4, 'rgba(160,230,255,0.8)');
  g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 60); ctx.lineTo(340, 0); ctx.lineTo(340, 120); ctx.closePath();
  ctx.fill();
  const r = rng(4);
  for (let i = 0; i < 30; i++) circle(ctx, r() * 330, 60 + (r() - 0.5) * (r() * 100), 2 + r() * 4, 'rgba(255,255,255,0.7)');
  return c;
}

export function paintShield(color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(200, 200);
  const g = ctx.createRadialGradient(100, 100, 50, 100, 100, 96);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.8, rgba(color, 0.18));
  g.addColorStop(1, rgba(color, 0.65));
  circle(ctx, 100, 100, 96, g);
  ctx.strokeStyle = rgba('#ffffff', 0.5);
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(100 + Math.cos(a) * 50, 100 + Math.sin(a) * 50);
    ctx.lineTo(100 + Math.cos(a + 1.05) * 50, 100 + Math.sin(a + 1.05) * 50);
    ctx.stroke();
  }
  return c;
}

export function paintHitSpark(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(80, 80);
  glow(ctx, 40, 40, 38, '#fff3c6', 0.8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40 + Math.cos(a) * 10, 40 + Math.sin(a) * 10);
    ctx.lineTo(40 + Math.cos(a) * 32, 40 + Math.sin(a) * 32);
    ctx.stroke();
  }
  return c;
}

export function paintPlus(color = '#7dff9a'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(30, 30);
  glow(ctx, 15, 15, 15, color, 0.6);
  ctx.fillStyle = color;
  ctx.fillRect(12, 4, 6, 22);
  ctx.fillRect(4, 12, 22, 6);
  return c;
}

export function paintRockShot(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(36, 36);
  ellipse(ctx, 18, 18, 14, 12, 0.3, '#8d8a8e', '#3f3c44', 2);
  ellipse(ctx, 14, 13, 6, 4, 0, 'rgba(255,255,255,0.3)');
  return c;
}

// ---------- UI ----------
/** 한지 패널 (나인슬라이스 128x128, 테두리 28) */
export function paintPanel(dark = false): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  const r = rng(dark ? 2 : 1);
  ctx.fillStyle = dark ? '#2a2433' : '#f2e6cc';
  ctx.fillRect(6, 6, 116, 116);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = rgba(dark ? '#ffffff' : '#a08a5c', 0.04 + r() * 0.05);
    ctx.fillRect(6 + r() * 116, 6 + r() * 116, 1 + r() * 3, 1);
  }
  ctx.strokeStyle = dark ? '#c99a43' : '#6b4a2a';
  ctx.lineWidth = 3;
  ctx.strokeRect(5.5, 5.5, 117, 117);
  ctx.strokeStyle = dark ? 'rgba(201,154,67,0.6)' : 'rgba(107,74,42,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(11.5, 11.5, 105, 105);
  // 모서리 전통 문양 (회문)
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = dark ? '#e2b14c' : '#8a5a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 22); ctx.lineTo(0, 0); ctx.lineTo(22, 0);
    ctx.moveTo(6, 16); ctx.lineTo(6, 6); ctx.lineTo(16, 6); ctx.lineTo(16, 12); ctx.lineTo(11, 12);
    ctx.stroke();
    ctx.restore();
  };
  corner(3, 3, 1, 1);
  corner(125, 3, -1, 1);
  corner(3, 125, 1, -1);
  corner(125, 125, -1, -1);
  return c;
}

export function paintButton(kind: 'primary' | 'normal' | 'disabled' = 'normal'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 48);
  const top = kind === 'primary' ? '#c3402f' : kind === 'disabled' ? '#6b6670' : '#3c3550';
  const bot = kind === 'primary' ? '#7e1f18' : kind === 'disabled' ? '#4a4650' : '#231e33';
  const g = ctx.createLinearGradient(0, 0, 0, 48);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  roundRect(ctx, 2, 2, 92, 44, 10);
  ctx.fill();
  ctx.strokeStyle = kind === 'disabled' ? '#8f8a94' : '#e2b14c';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 2, 2, 92, 44, 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  roundRect(ctx, 6, 6, 84, 18, 6);
  ctx.stroke();
  return c;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 원형 터치 버튼 + 아이콘 */
export function paintRoundButton(icon: string, accent = '#e2b14c'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(112, 112);
  const g = ctx.createRadialGradient(46, 40, 6, 56, 56, 52);
  g.addColorStop(0, 'rgba(70,64,96,0.92)');
  g.addColorStop(1, 'rgba(24,20,36,0.92)');
  circle(ctx, 56, 56, 50, g, accent, 3.5);
  circle(ctx, 56, 56, 43, undefined, rgba(accent, 0.45), 1.5);
  ctx.save();
  ctx.translate(56, 56);
  drawIcon(ctx, icon, 30, '#f6ead0');
  ctx.restore();
  return c;
}

export function drawIcon(ctx: Ctx, icon: string, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (icon) {
    case 'left': case 'right': {
      const d = icon === 'left' ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(-d * s * 0.5, -s * 0.12); ctx.lineTo(d * s * 0.1, -s * 0.12); ctx.lineTo(d * s * 0.1, -s * 0.45); ctx.lineTo(d * s * 0.6, 0); ctx.lineTo(d * s * 0.1, s * 0.45); ctx.lineTo(d * s * 0.1, s * 0.12); ctx.lineTo(-d * s * 0.5, s * 0.12); ctx.closePath(); ctx.fill();
      break;
    }
    case 'down':
      ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, -s * 0.05); ctx.lineTo(s * 0.45, -s * 0.05); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.45, -s * 0.05); ctx.lineTo(-s * 0.12, -s * 0.05); ctx.closePath(); ctx.fill();
      break;
    case 'jump':
      ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.5); ctx.lineTo(s * 0.12, s * 0.5); ctx.lineTo(s * 0.12, s * 0.05); ctx.lineTo(s * 0.45, s * 0.05); ctx.lineTo(0, -s * 0.55); ctx.lineTo(-s * 0.45, s * 0.05); ctx.lineTo(-s * 0.12, s * 0.05); ctx.closePath(); ctx.fill();
      break;
    case 'attack':
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.4 + k * s * 0.3, -s * 0.5); ctx.quadraticCurveTo(-s * 0.05 + k * s * 0.3, 0, -s * 0.3 + k * s * 0.3, s * 0.5); ctx.stroke(); }
      break;
    case 'skill':
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.6); ctx.lineTo(-s * 0.3, s * 0.05); ctx.lineTo(0, s * 0.05); ctx.lineTo(-s * 0.15, s * 0.6); ctx.lineTo(s * 0.35, -s * 0.1); ctx.lineTo(s * 0.05, -s * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'dash':
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.55, (k - 1) * s * 0.3); ctx.lineTo(s * 0.1 - Math.abs(k - 1) * s * 0.2, (k - 1) * s * 0.3); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(s * 0.15, -s * 0.4); ctx.lineTo(s * 0.55, 0); ctx.lineTo(s * 0.15, s * 0.4); ctx.stroke();
      break;
    case 'pause':
      ctx.fillRect(-s * 0.3, -s * 0.4, s * 0.2, s * 0.8); ctx.fillRect(s * 0.1, -s * 0.4, s * 0.2, s * 0.8);
      break;
    case 'menu':
      for (let k = -1; k <= 1; k++) ctx.fillRect(-s * 0.4, k * s * 0.28 - s * 0.06, s * 0.8, s * 0.12);
      break;
    case 'swap':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.38, -2.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.32, s * 0.36); ctx.lineTo(s * 0.32, s * 0.08); ctx.lineTo(s * 0.55, s * 0.18); ctx.closePath(); ctx.fill();
      break;
    default:
      circle(ctx, 0, 0, s * 0.3, col);
  }
}

/** 아이템 아이콘 64x64 */
export function paintItemIcon(id: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.translate(32, 32);
  switch (id) {
    case 'gold': {
      const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 22);
      g.addColorStop(0, '#fff2b0'); g.addColorStop(0.6, '#e6b443'); g.addColorStop(1, '#a8741e');
      circle(ctx, 0, 0, 20, g, '#6b4a12', 2.5);
      ctx.fillStyle = '#5a3c10'; ctx.fillRect(-6, -6, 12, 12);
      break;
    }
    case 'stone': {
      glow(ctx, 0, 0, 30, '#7fd8ff', 0.5);
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(16, -6); ctx.lineTo(10, 20); ctx.lineTo(-10, 20); ctx.lineTo(-16, -6); ctx.closePath();
      const g = ctx.createLinearGradient(-16, -24, 16, 20); g.addColorStop(0, '#d8f6ff'); g.addColorStop(0.5, '#4fb6e0'); g.addColorStop(1, '#1d5a86');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#123a5a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 20); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      break;
    }
    case 'silk':
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = ['#c3352c', '#e2b14c', '#2f8a7a', '#3e5a9a', '#f2f2f2'][k];
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 8 + k * 3.5, 0.3 + k * 0.4, 4.5 + k * 0.4); ctx.stroke();
      }
      break;
    case 'petal':
      for (let k = 0; k < 5; k++) {
        ctx.save(); ctx.rotate((k / 5) * TAU);
        ellipse(ctx, 0, -12, 9, 13, 0, '#f4b8c8', '#c25a7a', 1.5);
        ctx.restore();
      }
      circle(ctx, 0, 0, 5, '#f6d36b');
      break;
    case 'pearl': {
      glow(ctx, 0, 0, 30, '#8fe3ff', 0.7);
      const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 16);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9fe2ff'); g.addColorStop(1, '#2f7fb8');
      circle(ctx, 0, 0, 15, g, '#1d4f7a', 2);
      break;
    }
    case 'yakgwa':
      for (let k = 0; k < 8; k++) {
        ctx.save(); ctx.rotate((k / 8) * TAU);
        ellipse(ctx, 0, -12, 8, 11, 0, '#b8742e', '#5a3510', 1.5);
        ctx.restore();
      }
      circle(ctx, 0, 0, 12, '#c98a3c', '#5a3510', 1.5);
      spiral(ctx, 0, 0, 8, 1.2, '#7a4a1a', 1.5);
      break;
    case 'page':
      ctx.rotate(-0.12);
      ctx.fillStyle = '#efe0bd'; ctx.fillRect(-16, -22, 32, 44); ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 2; ctx.strokeRect(-16, -22, 32, 44);
      ctx.fillStyle = '#5a3c20'; for (let i = 0; i < 5; i++) ctx.fillRect(8 - i * 6, -16, 2, 30);
      break;
    case 'knot': tassel(ctx, 0, -24, 1.6, '#c8352e', '#e2b14c', 0); break;
    case 'jade': circle(ctx, 0, -2, 14, '#4fb39a', '#1f5a4a', 2); circle(ctx, 0, -2, 5, '#f2e6cc'); tassel(ctx, 0, 12, 0.8, '#c8352e', '#e2b14c', 0); break;
    case 'bell': goldDisc(ctx, 0, 0, 16, '#e3b14a'); break;
    case 'cloud': cloudSwirl(ctx, 0, 4, 1.2, '#f7efe0', '#c9b48e'); break;
    case 'foot':
      for (const [x, y] of [[-8, 8], [8, -8]] as const) { ellipse(ctx, x, y, 7, 9, 0, '#9be3ff'); for (let k = -1; k <= 1; k++) circle(ctx, x + k * 5, y - 11, 3, '#9be3ff'); }
      break;
    case 'outfit':
      ctx.fillStyle = '#f2ecdc'; ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, -18); ctx.lineTo(24, 4); ctx.lineTo(-24, 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#c3352c'; ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(16, 4); ctx.lineTo(24, 26); ctx.lineTo(-24, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c3352c'; ctx.fillRect(-2, -14, 4, 16);
      break;
    case 'package':
      ctx.fillStyle = '#b8322b'; ctx.fillRect(-20, -14, 40, 32); ctx.strokeStyle = '#2b1210'; ctx.lineWidth = 2; ctx.strokeRect(-20, -14, 40, 32);
      ctx.fillStyle = '#e2b14c'; ctx.fillRect(-3, -14, 6, 32); ctx.fillRect(-20, -2, 40, 5);
      ellipse(ctx, -7, -18, 8, 5, -0.4, '#e2b14c'); ellipse(ctx, 7, -18, 8, 5, 0.4, '#e2b14c');
      break;
    case 'skin':
      sparkle(ctx, 0, 0, 22, '#e2b14c'); sparkle(ctx, 14, -14, 8, '#ffffff');
      break;
    default:
      circle(ctx, 0, 0, 18, '#888');
  }
  return c;
}

// ---------------- 원거리·필살기 효과 ----------------
/** 초승달 참격 (늑대) */
export function paintCrescent(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 120);
  ctx.translate(60, 60);
  glow(ctx, 6, 0, 56, '#9fe3ff', 0.55);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(-6, 0, 48 - k * 6, -1.25, 1.25);
    ctx.arc(-26 - k * 3, 0, 42 - k * 6, 1.05, -1.05, true);
    ctx.closePath();
    ctx.fillStyle = k === 2 ? '#ffffff' : rgba(k ? '#bff0ff' : '#5fb8ff', 0.8);
    ctx.fill();
  }
  return c;
}

/** 번개 구슬 (청룡) */
export function paintThunderBall(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(72, 72);
  glow(ctx, 36, 36, 36, '#7fd6ff', 0.9);
  circle(ctx, 36, 36, 13, '#e8fbff');
  const r = rng(7);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + r();
    ctx.beginPath();
    ctx.moveTo(36, 36);
    let x = 36, y = 36;
    for (let j = 0; j < 3; j++) { x += Math.cos(a + (r() - 0.5)) * 8; y += Math.sin(a + (r() - 0.5)) * 8; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return c;
}

/** 땅을 타고 가는 금빛 발톱 파동 (백호) */
export function paintClawWave(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(110, 90);
  glow(ctx, 60, 70, 50, '#ffe08a', 0.6);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const x = 30 + k * 22;
    ctx.moveTo(x - 10, 88); ctx.quadraticCurveTo(x + 4, 50, x + 18 - k * 2, 6 + k * 8); ctx.quadraticCurveTo(x + 10, 50, x + 8, 88); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe08a'); g.addColorStop(1, '#c99a43');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#7a5a1e'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  return c;
}

/** 쇠 칼날 (백호 필살기) */
export function paintSpike(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(60, 160);
  glow(ctx, 30, 120, 40, '#ffe8a8', 0.5);
  ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(48, 160); ctx.lineTo(12, 160); ctx.closePath();
  const g = ctx.createLinearGradient(12, 0, 48, 0);
  g.addColorStop(0, '#f6f2e6'); g.addColorStop(0.5, '#bcc4d4'); g.addColorStop(1, '#6a7286');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(16, 140); ctx.lineTo(44, 140); ctx.stroke();
  return c;
}

/** 해일 (현무) */
export function paintTidalWave(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(300, 260);
  const g = ctx.createLinearGradient(0, 40, 0, 260);
  g.addColorStop(0, 'rgba(230,252,255,0.95)'); g.addColorStop(0.35, 'rgba(110,200,230,0.9)'); g.addColorStop(1, 'rgba(30,90,140,0.85)');
  ctx.beginPath();
  ctx.moveTo(0, 260); ctx.lineTo(0, 150);
  ctx.bezierCurveTo(40, 60, 150, 10, 230, 40);
  ctx.bezierCurveTo(290, 60, 300, 120, 250, 120);
  ctx.bezierCurveTo(210, 120, 220, 80, 250, 84);
  ctx.bezierCurveTo(230, 60, 170, 70, 160, 120);
  ctx.bezierCurveTo(150, 180, 220, 230, 300, 260);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(10, 150); ctx.bezierCurveTo(50, 70, 150, 22, 228, 46); ctx.stroke();
  const r = rng(3);
  for (let i = 0; i < 26; i++) circle(ctx, 60 + r() * 230, 20 + r() * 110, 2 + r() * 5, 'rgba(255,255,255,0.85)');
  cloudSwirl(ctx, 120, 170, 1.4, 'rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', false, 2);
  return c;
}

/** 빛기둥 (기린) */
export function paintLightPillar(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(120, 512);
  const g = ctx.createLinearGradient(0, 0, 120, 0);
  g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(0.3, 'rgba(255,240,170,0.6)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(255,240,170,0.6)'); g.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 120, 512);
  const v = ctx.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.15, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = v; ctx.fillRect(0, 0, 120, 512);
  return c;
}

/** 불기둥 (해태) */
export function paintFireColumn(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(110, 300);
  glow(ctx, 55, 250, 70, '#ff8a3c', 0.7);
  const r = rng(11);
  for (let k = 0; k < 9; k++) {
    const x = 30 + r() * 50, top = 10 + r() * 80;
    tuft(ctx, [[x, 300], [x + (r() - 0.5) * 30, 180], [x + (r() - 0.5) * 20, top]], 26 - k, k % 3 === 0 ? 'rgba(255,240,170,0.9)' : k % 2 ? 'rgba(255,140,50,0.85)' : 'rgba(220,60,30,0.85)');
  }
  return c;
}

/** 먹구름 (청룡 필살기) */
export function paintStormCloud(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(420, 160);
  const r = rng(5);
  for (let i = 0; i < 16; i++) ellipse(ctx, 40 + r() * 340, 60 + r() * 60, 50 + r() * 50, 30 + r() * 25, 0, rgba(r() < 0.5 ? '#2a3050' : '#3a4266', 0.85));
  ctx.strokeStyle = 'rgba(160,220,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(80 + i * 60, 90, 14, Math.PI * 0.2, Math.PI * 1.7); ctx.stroke(); }
  return c;
}

/** 필살기 버튼용 연꽃 아이콘 */
export function paintLotusButton(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(112, 112);
  const g = ctx.createRadialGradient(46, 40, 6, 56, 56, 52);
  g.addColorStop(0, 'rgba(90,60,96,0.95)'); g.addColorStop(1, 'rgba(30,18,36,0.95)');
  circle(ctx, 56, 56, 50, g, '#e2b14c', 3.5);
  ctx.save();
  ctx.translate(56, 60);
  for (let k = -2; k <= 2; k++) {
    ctx.save();
    ctx.rotate(k * 0.42);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-11, -14, 0, -30); ctx.quadraticCurveTo(11, -14, 0, 6); ctx.closePath();
    const pg = ctx.createLinearGradient(0, -30, 0, 6);
    pg.addColorStop(0, '#fff3d0'); pg.addColorStop(1, '#f2a7c0');
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = '#a0506a'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#e2b14c'; ctx.beginPath(); ctx.ellipse(0, 8, 20, 5, 0, 0, TAU); ctx.fill();
  ctx.restore();
  return c;
}

/** 소용돌이 스킬 버튼 (참고 화면의 파랑·빨강 소용돌이) */
export function paintSwirlButton(col: string, col2: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(112, 112);
  const g = ctx.createRadialGradient(46, 40, 6, 56, 56, 52);
  g.addColorStop(0, 'rgba(60,56,90,0.95)'); g.addColorStop(1, 'rgba(18,16,30,0.95)');
  circle(ctx, 56, 56, 50, g, '#e2b14c', 3.5);
  glow(ctx, 56, 56, 40, col, 0.5);
  for (let k = 0; k < 3; k++) spiral(ctx, 56, 56, 30 - k * 5, 1.6, k === 1 ? '#ffffff' : k ? col2 : col, 5 - k, k * 2.1);
  return c;
}

/** 빗줄기 */
export function paintRainStreak(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(6, 48);
  const g = ctx.createLinearGradient(0, 0, 0, 48);
  g.addColorStop(0, 'rgba(190,230,255,0)'); g.addColorStop(1, 'rgba(210,240,255,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(2, 0, 2, 48);
  return c;
}

/** 원형 방향키 받침: 옻칠 먹색 원판 + 이중 금테 + 네 방향 표시 + 구름 문양 */
export function paintJoystickBase(): HTMLCanvasElement {
  const S = 220, c0 = S / 2;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(c0 - 20, c0 - 24, 10, c0, c0, 100);
  g.addColorStop(0, 'rgba(62,56,92,0.9)'); g.addColorStop(1, 'rgba(16,14,28,0.88)');
  circle(ctx, c0, c0, 98, g, '#e2b14c', 4);
  ctx.strokeStyle = 'rgba(122,90,30,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c0, c0, 104, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,241,196,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c0, c0, 90, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(226,177,76,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c0, c0, 52, 0, TAU); ctx.stroke();
  // 네 방향 화살 (좌우는 크게)
  const tri = (ang: number, r: number, size: number, a: number) => {
    ctx.save(); ctx.translate(c0 + Math.cos(ang) * r, c0 + Math.sin(ang) * r); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.6, -size * 0.8); ctx.lineTo(-size * 0.6, size * 0.8); ctx.closePath();
    ctx.fillStyle = `rgba(246,234,208,${a})`; ctx.fill(); ctx.strokeStyle = 'rgba(122,90,30,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  };
  tri(0, 74, 13, 0.95); tri(Math.PI, 74, 13, 0.95); tri(-Math.PI / 2, 74, 9, 0.6); tri(Math.PI / 2, 74, 9, 0.6);
  // 금빛 구름 장식 (참고 화면 버튼 받침)
  cloudSwirl(ctx, 34, 196, 0.9, 'rgba(226,177,76,0.25)', 'rgba(226,177,76,0.9)', true, 1.4);
  cloudSwirl(ctx, 186, 196, 0.9, 'rgba(226,177,76,0.25)', 'rgba(226,177,76,0.9)', false, 1.4);
  return c;
}

/** 원형 방향키 손잡이: 금테 원판 + 태극 빛 소용돌이 */
export function paintJoystickKnob(): HTMLCanvasElement {
  const S = 104, c0 = S / 2;
  const [c, ctx] = makeCanvas(S, S);
  glow(ctx, c0, c0, 50, '#ffe08a', 0.35);
  const g = ctx.createRadialGradient(c0 - 12, c0 - 14, 4, c0, c0, 44);
  g.addColorStop(0, '#fff3d0'); g.addColorStop(0.55, '#e8c78a'); g.addColorStop(1, '#9a6a2a');
  circle(ctx, c0, c0, 40, g, '#7a5a1e', 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c0, c0, 34, 0, TAU); ctx.stroke();
  spiral(ctx, c0, c0, 22, 1.5, '#c3352c', 4, 0);
  spiral(ctx, c0, c0, 22, 1.5, '#2f5fae', 4, Math.PI);
  return c;
}

/** 특별 발자국: 빛나는 영물 발자국 (땅에 찍혀 천천히 사라짐) */
export function paintPawPrint(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 48);
  glow(ctx, 28, 26, 26, '#4fc3ff', 0.75);
  const pad = (x: number, y: number, rx: number, ry: number) => ellipse(ctx, x, y, rx, ry, 0, '#d6f6ff', '#1f7fc4', 2.4);
  pad(28, 31, 11, 9);
  pad(14, 17, 5, 6);
  pad(23, 10, 5, 6);
  pad(33, 10, 5, 6);
  pad(42, 17, 5, 6);
  return c;
}

/** 구름 꼬리: 크림색 소용돌이 구름 한 덩이 */
export function paintCloudPuff(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(70, 44);
  for (const [x, y, r] of [[22, 26, 14], [36, 20, 16], [50, 27, 12], [34, 30, 14]] as const) circle(ctx, x, y, r, '#fbf3e2');
  cloudSwirl(ctx, 35, 25, 0.9, 'rgba(251,243,226,0)', 'rgba(214,166,80,0.95)', false, 1.6);
  ctx.strokeStyle = 'rgba(214,166,80,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(22, 26, 14, Math.PI * 0.7, Math.PI * 1.5); ctx.stroke();
  return c;
}

/** 근두운: 네발 영물·현무가 타고 나는 구름 */
export function paintFlyCloud(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(220, 100);
  ctx.translate(0, 8);
  glow(ctx, 110, 40, 90, '#fff4d6', 0.35);
  const puffs: [number, number, number][] = [[40, 42, 20], [70, 32, 26], [104, 28, 30], [140, 32, 26], [172, 42, 20], [100, 46, 26], [60, 48, 18], [150, 48, 18]];
  for (const [x, y, r] of puffs) circle(ctx, x, y, r, '#fbf3e2', 'rgba(196,150,70,0.85)', 1.8);
  for (const [x, y, r] of puffs) circle(ctx, x, y - 2, r - 3, '#fffaf0');
  cloudSwirl(ctx, 66, 40, 1.0, 'rgba(0,0,0,0)', 'rgba(214,166,80,0.95)', true, 1.8);
  cloudSwirl(ctx, 150, 40, 1.0, 'rgba(0,0,0,0)', 'rgba(214,166,80,0.95)', false, 1.8);
  return c;
}

/** 영물 장식: 전통 매듭 / 옥 노리개 / 금방울 (목에 매달려 흔들림, 위쪽 가운데가 매다는 점) */
export function paintOrnament(kind: 'knot' | 'jade' | 'bell'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 76);
  ctx.strokeStyle = '#7a1f1a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 12); ctx.stroke();
  if (kind === 'knot') {
    // 매듭: 마름모꼴 엮음 + 술
    ctx.save(); ctx.translate(20, 22); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#d0362c'; ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#7a1f1a'; ctx.lineWidth = 1.6; ctx.strokeRect(-9, -9, 18, 18);
    ctx.strokeStyle = 'rgba(255,220,200,0.7)'; ctx.lineWidth = 1.2;
    for (const d of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(d, -9); ctx.lineTo(d, 9); ctx.moveTo(-9, d); ctx.lineTo(9, d); ctx.stroke(); }
    ctx.restore();
    for (const [x, y] of [[8, 22], [32, 22]] as const) circle(ctx, x, y, 4, '#d0362c', '#7a1f1a', 1.2);
    circle(ctx, 20, 38, 3.5, '#e2b14c', '#7a5a1e', 1);
  } else if (kind === 'jade') {
    // 옥 노리개: 초록 옥 원판 + 금 장식
    circle(ctx, 20, 26, 11, '#3fae8f', '#1f5e4e', 1.8);
    circle(ctx, 20, 26, 4, '#fbf3e2', '#1f5e4e', 1);
    ellipse(ctx, 16, 21, 3, 2, -0.6, 'rgba(255,255,255,0.6)');
    goldDisc(ctx, 20, 41, 3.6, '#e2b14c');
  } else {
    // 금방울
    const g = ctx.createRadialGradient(16, 20, 2, 20, 26, 14);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, '#f0c451'); g.addColorStop(1, '#a87418');
    circle(ctx, 20, 26, 12, g, '#7a5a1e', 1.8);
    ctx.strokeStyle = '#7a5a1e'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(10, 28); ctx.lineTo(30, 28); ctx.stroke();
    circle(ctx, 20, 33, 2.5, '#5a3a10');
    circle(ctx, 20, 41, 3, '#d0362c', '#7a1f1a', 1);
  }
  // 술 (붉은 실)
  const tc = kind === 'jade' ? '#2f8a7a' : '#d0362c';
  for (let k = -3; k <= 3; k++) {
    ctx.strokeStyle = tc; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20 + k, 44); ctx.quadraticCurveTo(20 + k * 1.6, 58, 20 + k * 2, 74); ctx.stroke();
  }
  ctx.fillStyle = '#e2b14c'; ctx.fillRect(15, 43, 10, 4);
  return c;
}

// ---------- 메뉴 UI (깔끔한 한지 + 단청 포인트) ----------
/** 한지 카드: 둥근 모서리, 금빛 가는 테두리 + 안쪽 실선 (나인슬라이스 64×64, 테두리 18) */
export function paintCard(kind: 'normal' | 'sel' | 'dark' | 'lock'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  const fill = kind === 'dark' ? '#2b2438' : kind === 'lock' ? '#e7e0d2' : kind === 'sel' ? '#fff8e6' : '#fbf5e8';
  const line = kind === 'sel' ? '#b8322a' : kind === 'dark' ? '#c9a24a' : '#c9a86a';
  const rr = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // 아래 그림자
  rr(3, 5, 58, 57, 12); ctx.fillStyle = 'rgba(60,40,20,0.14)'; ctx.fill();
  rr(2, 2, 58, 57, 12); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = kind === 'sel' ? 3 : 2; ctx.strokeStyle = line; ctx.stroke();
  rr(7, 7, 48, 47, 8); ctx.lineWidth = 1; ctx.strokeStyle = kind === 'dark' ? 'rgba(201,162,74,0.35)' : 'rgba(201,168,106,0.45)'; ctx.stroke();
  if (kind !== 'dark') for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(160,130,80,${0.03 + Math.random() * 0.04})`; ctx.fillRect(8 + Math.random() * 46, 8 + Math.random() * 46, 1 + Math.random() * 2, 1); }
  return c;
}

/** 단청 띠 (가로 반복 128×22): 녹청 바탕에 붉은 마름모·금빛 꽃 무늬 */
export function paintDancheong(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 22);
  ctx.fillStyle = '#2f7f74'; ctx.fillRect(0, 0, 128, 22);
  ctx.fillStyle = '#1f3d6b'; ctx.fillRect(0, 0, 128, 4); ctx.fillRect(0, 18, 128, 4);
  ctx.fillStyle = '#e2b14c'; ctx.fillRect(0, 4, 128, 1.5); ctx.fillRect(0, 16.5, 128, 1.5);
  for (const x of [16, 48, 80, 112]) {
    ctx.save(); ctx.translate(x, 11); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#c3352c'; ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
    circle(ctx, x, 11, 2.2, '#f6e2a8');
  }
  for (const x of [0, 32, 64, 96, 128]) {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ellipse(ctx, x + Math.cos(a) * 3.5, 11 + Math.sin(a) * 3.5, 2.2, 1.4, a, '#f2c94c'); }
    circle(ctx, x, 11, 1.8, '#c3352c');
  }
  return c;
}

/** 붉은 낙관 모양 닫기 단추 */
export function paintSealButton(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.save(); ctx.translate(32, 32); ctx.rotate(-0.08);
  ctx.fillStyle = 'rgba(40,20,10,0.25)'; ctx.fillRect(-24, -22, 50, 50);
  ctx.fillStyle = '#b8322a'; ctx.fillRect(-25, -25, 50, 50);
  ctx.strokeStyle = '#f3dcc0'; ctx.lineWidth = 2; ctx.strokeRect(-20, -20, 40, 40);
  ctx.strokeStyle = '#fbeee0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.stroke();
  ctx.restore();
  return c;
}

/** 탭: 선택 안 됨 (옅은 먹선 테두리 한지) */
export function paintTab(active: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 44);
  const rr = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  if (active) {
    const g = ctx.createLinearGradient(0, 0, 0, 44); g.addColorStop(0, '#c8412f'); g.addColorStop(1, '#8e2219');
    rr(2, 2, 92, 40, 20); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 1; rr(6, 6, 84, 32, 16); ctx.stroke();
  } else {
    rr(2, 2, 92, 40, 20); ctx.fillStyle = 'rgba(255,250,238,0.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(226,177,76,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  return c;
}
