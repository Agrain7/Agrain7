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
