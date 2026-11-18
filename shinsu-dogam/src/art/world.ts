// 월하산맥 배경·지형 페인팅 (패럴랙스 레이어별로 분리된 2D 일러스트)
import {
  type Ctx, makeCanvas, rng, rgba, shadeHex, glow, circle, ellipse, TAU, clamp, splinePath, type V, paintShape, clipTo, tuft, cloudSwirl, lerp,
} from './paint.ts';

export type SkyKind = 'dusk' | 'night' | 'mist';

const SKY: Record<SkyKind, { stops: [number, string][]; stars: number; mount: [string, string, string]; mist: string; moon: string }> = {
  dusk: { stops: [[0, '#2f3b74'], [0.3, '#5a6aa6'], [0.58, '#9a9bc9'], [0.8, '#d6b7b8'], [1, '#f2d6be']], stars: 40, mount: ['#9198c4', '#7178a9', '#525a86'], mist: '#f3d9c4', moon: '#f6bf8a' },
  night: { stops: [[0, '#0f1433'], [0.4, '#273063'], [0.75, '#5d5c94'], [1, '#a996bd']], stars: 160, mount: ['#5c6191', '#424878', '#2f3561'], mist: '#b6a8cc', moon: '#f4c690' },
  mist: { stops: [[0, '#6f8fbf'], [0.45, '#a9c0dc'], [0.8, '#e6dccd'], [1, '#f4e8d6']], stars: 0, mount: ['#9fb0cc', '#8296b8', '#687ea3'], mist: '#f2ece2', moon: '#fff1c9' },
};

export function paintSky(kind: SkyKind, w = 1280, h = 720): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const s = SKY[kind];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of s.stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < s.stars; i++) {
    const x = r() * w, y = r() * h * 0.55, a = 0.3 + r() * 0.6;
    circle(ctx, x, y, r() < 0.1 ? 1.6 : 0.9, rgba('#ffffff', a * (1 - y / (h * 0.6))));
  }
  // 은은한 노을빛 구름띠
  for (let i = 0; i < 6; i++) {
    const y = h * (0.45 + r() * 0.3);
    const gg = ctx.createLinearGradient(0, y - 20, 0, y + 20);
    gg.addColorStop(0, rgba(s.mist, 0));
    gg.addColorStop(0.5, rgba(s.mist, 0.12));
    gg.addColorStop(1, rgba(s.mist, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(0, y - 20, w, 40);
  }
  return c;
}

export function paintMoon(kind: SkyKind): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(420, 420);
  const col = SKY[kind].moon;
  glow(ctx, 210, 210, 210, col, kind === 'mist' ? 0.25 : 0.45);
  const g = ctx.createRadialGradient(185, 180, 10, 210, 210, 110);
  g.addColorStop(0, shadeHex(col, 0.45));
  g.addColorStop(0.7, col);
  g.addColorStop(1, shadeHex(col, -0.12));
  circle(ctx, 210, 210, 108, g);
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = r() * 70;
    ellipse(ctx, 210 + Math.cos(a) * d, 210 + Math.sin(a) * d, 6 + r() * 16, 5 + r() * 12, r(), rgba(shadeHex(col, -0.3), 0.18));
  }
  return c;
}

/** 주기적(타일 가능한) 능선 노이즈 */
function ridge(w: number, seed: number, octaves: [number, number][]) {
  const r = rng(seed);
  const ph = octaves.map(() => r() * TAU);
  return (x: number) => octaves.reduce((s, [freq, amp], i) => s + Math.sin((x / w) * TAU * freq + ph[i]) * amp, 0);
}

/** 원경 산맥 (산수화 풍) — 가로 타일 */
export function paintMountains(kind: SkyKind, layer: 0 | 1, w = 2048, h = 460): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const s = SKY[kind];
  const col = s.mount[layer];
  const f = ridge(w, 11 + layer * 7, layer === 0 ? [[2, 70], [5, 40], [11, 18], [23, 7]] : [[3, 60], [7, 34], [13, 16], [29, 6]]);
  const base = layer === 0 ? h * 0.42 : h * 0.55;
  // 봉우리 (뾰족함 강조)
  const peak = (x: number) => {
    const v = f(x);
    return base - v - Math.pow(Math.max(0, v) / 80, 2) * 70;
  };
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, peak(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - 160, 0, h);
  g.addColorStop(0, shadeHex(col, -0.08));
  g.addColorStop(0.55, col);
  g.addColorStop(1, s.mist);
  ctx.fillStyle = g;
  ctx.fill();
  // 수묵 결: 봉우리에서 내려오는 세로 붓질
  ctx.save();
  ctx.clip();
  const r = rng(29 + layer);
  for (let i = 0; i < 260; i++) {
    const x = r() * w;
    const top = peak(x);
    const len = 30 + r() * 120;
    ctx.strokeStyle = rgba(shadeHex(col, -0.35), 0.08 + r() * 0.1);
    ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, top + 2);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 20, top + len * 0.5, x + (r() - 0.5) * 30, top + len);
    ctx.stroke();
  }
  // 안개띠
  for (let i = 0; i < 4; i++) {
    const y = base + 20 + i * 40;
    const gg = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    gg.addColorStop(0, rgba(s.mist, 0));
    gg.addColorStop(0.5, rgba(s.mist, 0.35));
    gg.addColorStop(1, rgba(s.mist, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(0, y - 30, w, 60);
  }
  ctx.restore();
  // 능선 윤곽선
  ctx.strokeStyle = rgba(shadeHex(col, -0.45), 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) (x ? ctx.lineTo(x, peak(x)) : ctx.moveTo(x, peak(x)));
  ctx.stroke();
  return c;
}

/** 장식 구름 띠 (한국 전통 구름 문양) — 가로 타일 */
export function paintCloudBand(kind: SkyKind, w = 2048, h = 260): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(77);
  const fill = kind === 'night' ? '#cfc6e4' : '#fbf0dc';
  const line = kind === 'night' ? '#8d84b4' : '#d8b278';
  for (let i = 0; i < 9; i++) {
    const x = (i / 9) * w + r() * 120, y = 60 + r() * 140, s = 1.6 + r() * 1.8;
    for (const dx of [0, -w, w]) {
      ctx.globalAlpha = 0.55;
      cloudSwirl(ctx, x + dx, y, s, fill, line, r() < 0.5, 1.6);
      cloudSwirl(ctx, x + dx + 50 * s, y + 8, s * 0.7, fill, line, r() < 0.5, 1.4);
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

/** 전통 기와 건물 (궁궐·누각) */
export function drawPalace(ctx: Ctx, x: number, y: number, s: number, tiers = 2, tone = '#3a3f5c', dark = 0.25) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const wall = shadeHex('#c64a3a', -dark);
  const roof = shadeHex(tone, -dark * 0.5);
  const base = shadeHex('#b7aa95', -dark);
  // 기단
  ctx.fillStyle = base;
  ctx.fillRect(-70, -14, 140, 14);
  for (let t = 0; t < tiers; t++) {
    const ty = -14 - t * 46;
    const ww = 110 - t * 26;
    // 기둥과 벽
    ctx.fillStyle = shadeHex('#e7d9bd', -dark);
    ctx.fillRect(-ww / 2, ty - 30, ww, 30);
    ctx.fillStyle = wall;
    for (let k = 0; k <= 4; k++) ctx.fillRect(-ww / 2 + (k * ww) / 4 - 2, ty - 30, 4, 30);
    // 단청 띠
    ctx.fillStyle = shadeHex('#2e8a7a', -dark);
    ctx.fillRect(-ww / 2, ty - 34, ww, 5);
    // 지붕 (곡선 처마)
    const rw = ww / 2 + 26;
    ctx.beginPath();
    ctx.moveTo(-rw - 6, ty - 30);
    ctx.quadraticCurveTo(-rw + 10, ty - 36, -rw * 0.6, ty - 44);
    ctx.lineTo(-ww * 0.25, ty - 58);
    ctx.lineTo(ww * 0.25, ty - 58);
    ctx.lineTo(rw * 0.6, ty - 44);
    ctx.quadraticCurveTo(rw - 10, ty - 36, rw + 6, ty - 30);
    ctx.quadraticCurveTo(rw - 4, ty - 34, rw * 0.6, ty - 37);
    ctx.lineTo(-rw * 0.6, ty - 37);
    ctx.quadraticCurveTo(-rw + 4, ty - 34, -rw - 6, ty - 30);
    ctx.closePath();
    ctx.fillStyle = roof;
    ctx.fill();
    ctx.strokeStyle = shadeHex(roof, -0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 기와 줄
    ctx.strokeStyle = rgba('#ffffff', 0.12);
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(k * (ww / 10), ty - 57);
      ctx.lineTo(k * (rw / 5), ty - 38);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPine(ctx: Ctx, x: number, y: number, s: number, col: string, r: () => number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = shadeHex(col, -0.4);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(8, -40, -10, -80, 6, -120);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const py = -40 - k * 20, px = (k % 2 ? -1 : 1) * (8 + r() * 10);
    ctx.beginPath();
    ctx.ellipse(px, py, 34 - k * 4, 10, (k % 2 ? 0.1 : -0.1), 0, TAU);
    ctx.fillStyle = shadeHex(col, -0.1 + k * 0.04);
    ctx.fill();
  }
  ctx.restore();
}

/** 중경: 절벽 + 궁궐 + 소나무 (가로 타일, 폭포 자리는 비워 둠) */
export function paintCliffs(kind: SkyKind, w = 2048, h = 620): { canvas: HTMLCanvasElement; falls: number[] } {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(101);
  const rockA = kind === 'night' ? '#4c5677' : kind === 'mist' ? '#7f90a8' : '#6b6f8c';
  const moss = kind === 'night' ? '#3c5a59' : '#5b7f62';
  const falls: number[] = [];
  const cliffs = [
    { x: 160, w: 260, top: 160 }, { x: 560, w: 200, top: 260 }, { x: 900, w: 300, top: 120 }, { x: 1320, w: 220, top: 230 },
    { x: 1700, w: 280, top: 150 },
  ];
  for (const cl of cliffs) {
    for (const dx of [0, -w, w]) {
      const x0 = cl.x + dx;
      if (x0 > w + 300 || x0 + cl.w < -300) continue;
      const rr = rng(Math.floor(cl.x));
      // 절벽 몸체 (세로 결)
      const pts: V[] = [[x0 - 20, h], [x0 - 10, cl.top + 80], [x0 + 10, cl.top + 20], [x0 + cl.w * 0.3, cl.top - 6], [x0 + cl.w * 0.65, cl.top + 4], [x0 + cl.w - 6, cl.top + 30], [x0 + cl.w + 14, cl.top + 120], [x0 + cl.w + 30, h]];
      const g = ctx.createLinearGradient(x0, 0, x0 + cl.w, 0);
      g.addColorStop(0, shadeHex(rockA, 0.12));
      g.addColorStop(0.5, rockA);
      g.addColorStop(1, shadeHex(rockA, -0.25));
      paintShape(ctx, pts, { fill: g, line: shadeHex(rockA, -0.45), lw: 1.5, tension: 0.25 });
      ctx.save();
      ctx.beginPath();
      splinePath(ctx, pts, true, 0.25);
      ctx.clip();
      for (let k = 0; k < 40; k++) {
        const xx = x0 + rr() * cl.w;
        ctx.strokeStyle = rgba(shadeHex(rockA, -0.5), 0.15 + rr() * 0.15);
        ctx.lineWidth = 1 + rr() * 2;
        ctx.beginPath();
        ctx.moveTo(xx, cl.top + rr() * 60);
        ctx.lineTo(xx + (rr() - 0.5) * 16, cl.top + 80 + rr() * (h - cl.top));
        ctx.stroke();
      }
      // 안개 (아래쪽)
      const mg = ctx.createLinearGradient(0, h * 0.6, 0, h);
      mg.addColorStop(0, rgba(SKY[kind].mist, 0));
      mg.addColorStop(1, rgba(SKY[kind].mist, 0.55));
      ctx.fillStyle = mg;
      ctx.fillRect(x0 - 40, h * 0.6, cl.w + 80, h * 0.4);
      ctx.restore();
      // 이끼 덮인 꼭대기
      ctx.fillStyle = moss;
      ctx.beginPath();
      ctx.moveTo(x0 + 6, cl.top + 22);
      ctx.quadraticCurveTo(x0 + cl.w * 0.3, cl.top - 16, x0 + cl.w * 0.65, cl.top - 4);
      ctx.quadraticCurveTo(x0 + cl.w, cl.top + 8, x0 + cl.w - 2, cl.top + 30);
      ctx.quadraticCurveTo(x0 + cl.w * 0.5, cl.top + 14, x0 + 6, cl.top + 22);
      ctx.fill();
      // 소나무
      drawPine(ctx, x0 + cl.w * 0.15, cl.top + 14, 0.55 + rr() * 0.2, kind === 'night' ? '#2f4b4c' : '#3f6650', rr);
      drawPine(ctx, x0 + cl.w * 0.85, cl.top + 22, 0.45 + rr() * 0.2, kind === 'night' ? '#2f4b4c' : '#3f6650', rr);
    }
  }
  // 궁궐 (높은 절벽 위)
  for (const [px, top, sc, tiers] of [[1050, 120, 0.9, 3], [300, 160, 0.7, 2], [1840, 150, 0.75, 2]] as const) {
    for (const dx of [0, -w, w]) drawPalace(ctx, px + dx, top + 4, sc, tiers, kind === 'night' ? '#2f3555' : '#3d4466', kind === 'night' ? 0.35 : 0.15);
  }
  // 폭포 위치 (절벽 사이)
  falls.push(470, 1250);
  void r;
  return { canvas: c, falls };
}

/** 폭포 물줄기 텍스처 (세로 타일, 아래로 흐르게 스크롤) */
export function paintWaterfall(w = 90, h = 256): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(210,235,255,0.0)');
  g.addColorStop(0.2, 'rgba(220,240,255,0.75)');
  g.addColorStop(0.5, 'rgba(250,253,255,0.95)');
  g.addColorStop(0.8, 'rgba(210,235,255,0.75)');
  g.addColorStop(1, 'rgba(210,235,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 70; i++) {
    const x = w * 0.15 + r() * w * 0.7, y = r() * h, l = 20 + r() * 60;
    ctx.strokeStyle = rgba(r() < 0.5 ? '#9cc7e6' : '#ffffff', 0.35 + r() * 0.4);
    ctx.lineWidth = 1 + r() * 2;
    for (const dy of [0, -h, h]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.lineTo(x + (r() - 0.5) * 3, y + l + dy);
      ctx.stroke();
    }
  }
  return c;
}

/** 근경: 벚꽃·매화 나무 실루엣 숲 (가로 타일) */
export function paintGrove(kind: SkyKind, w = 2048, h = 440): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(303);
  const leaf = kind === 'night' ? '#2c3a4e' : kind === 'mist' ? '#6f8a8a' : '#4a5a5c';
  // 덤불 띠
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h - 70 - Math.sin((x / w) * TAU * 7) * 18 - Math.sin((x / w) * TAU * 17) * 10);
  ctx.lineTo(w, h);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * w + r() * 140;
    for (const dx of [0, -w, w]) drawBlossomTree(ctx, x + dx, h - 50, 0.75 + r() * 0.35, r() < 0.5 ? 'cherry' : 'plum', 0.35, 41 + i);
  }
  return c;
}

/** 벚꽃/매화 나무 */
/** 꽃잎 다섯 장짜리 작은 꽃 도장 (나무 하나에 수백 개를 찍는다) */
const flowerStampCache = new Map<string, HTMLCanvasElement[]>();
function flowerStamps(kind: 'cherry' | 'plum', dark: number): HTMLCanvasElement[] {
  const key = `${kind}_${dark.toFixed(2)}`;
  const hit = flowerStampCache.get(key);
  if (hit) return hit;
  const pal: [string, string][] = kind === 'cherry'
    ? [['#fff1f5', '#f0a9bf'], ['#fbd0dd', '#e07f9c'], ['#f5aec4', '#cf6688'], ['#ffffff', '#f1b4c6']]
    : [['#ffd6df', '#d9607d'], ['#f28aa3', '#b8405f'], ['#e2607f', '#9c2c4b'], ['#fff0f3', '#e88aa1']];
  const out = pal.map(([petal, edge]) => {
    const [c, ctx] = makeCanvas(24, 24);
    ctx.translate(12, 12);
    const pc = shadeHex(petal, -dark), ec = shadeHex(edge, -dark);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / 5);
      ellipse(ctx, 0, -5.3, 3.7, 5.4, 0, pc, ec, 0.8);
      ctx.restore();
    }
    circle(ctx, 0, 0, 1.9, shadeHex('#c4446a', -dark));
    for (let i = 0; i < 5; i++) { const an = (i * TAU) / 5 + 0.6; circle(ctx, Math.cos(an) * 2.6, Math.sin(an) * 2.6, 0.65, shadeHex('#f7d26a', -dark)); }
    return c;
  });
  flowerStampCache.set(key, out);
  return out;
}

export function drawBlossomTree(ctx: Ctx, x: number, y: number, s: number, kind: 'cherry' | 'plum', dark = 0, seed = 1) {
  const r = rng(seed);
  const bark = shadeHex('#4a3428', -dark);
  const barkLine = shadeHex('#24170f', -dark);
  const barkLight = shadeHex('#7a5a44', -dark);
  const deep = kind === 'cherry' ? '#d97a9a' : '#a8344f';
  const stamps = flowerStamps(kind, dark);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  // 줄기와 가지: 먹선 → 껍질 → 한쪽 밝은 결 (붓질 느낌)
  const segs: { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; w: number }[] = [];
  const clusters: V[] = [];
  const branch = (x0: number, y0: number, a: number, len: number, w: number, depth: number) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    segs.push({ x0, y0, cx: (x0 + x1) / 2 + (r() - 0.5) * len * 0.45, cy: (y0 + y1) / 2 + (r() - 0.5) * len * 0.15, x1, y1, w });
    if (depth > 0) {
      branch(x1, y1, a - 0.35 - r() * 0.45, len * 0.72, w * 0.62, depth - 1);
      branch(x1, y1, a + 0.3 + r() * 0.45, len * 0.68, w * 0.6, depth - 1);
      if (depth >= 2 && r() < 0.5) clusters.push([x1 + (r() - 0.5) * 20, y1]);
    } else {
      clusters.push([x1, y1]);
    }
  };
  branch(0, 0, -Math.PI / 2 + (r() - 0.5) * 0.2, 90, 17, 4);
  const stroke = (col: string, k: number, add = 0, ox = 0) => {
    ctx.strokeStyle = col;
    for (const sg of segs) {
      ctx.lineWidth = sg.w * k + add;
      ctx.beginPath();
      ctx.moveTo(sg.x0 + ox * sg.w, sg.y0);
      ctx.quadraticCurveTo(sg.cx + ox * sg.w, sg.cy, sg.x1 + ox * sg.w, sg.y1);
      ctx.stroke();
    }
  };
  stroke(barkLine, 1, 3);
  stroke(bark, 1);
  stroke(rgba(barkLight, 0.7), 0.3, 0, -0.22);
  // 뿌리 쪽 퍼짐
  ellipse(ctx, 0, 2, 26, 6, 0, rgba(barkLine, 0.35));
  // 꽃 구름: 그늘 덩어리 → 작은 꽃 수백 송이 (위쪽은 밝게) → 흩날리는 꽃잎
  for (const [cx, cy] of clusters) {
    for (let k = 0; k < 5; k++) ellipse(ctx, cx + (r() - 0.5) * 44, cy + (r() - 0.3) * 30, 18 + r() * 14, 12 + r() * 9, r(), rgba(shadeHex(deep, -dark), 0.5));
  }
  for (const [cx, cy] of clusters) {
    const n = 52;
    for (let k = 0; k < n; k++) {
      const an = r() * TAU, rad = Math.sqrt(r());
      const px = cx + Math.cos(an) * rad * 34, py = cy + Math.sin(an) * rad * 25;
      const up = py < cy - 4;
      const st = up ? stamps[r() < 0.6 ? 0 : 3] : stamps[1 + Math.floor(r() * 2)];
      const sz = 0.5 + r() * 0.45;
      ctx.drawImage(st, px - 12 * sz, py - 12 * sz, 24 * sz, 24 * sz);
    }
  }
  for (let k = 0; k < 14; k++) {
    const [cx, cy] = clusters[Math.floor(r() * clusters.length)];
    ellipse(ctx, cx + (r() - 0.5) * 120, cy + 20 + r() * 110, 2.4, 1.4, r() * 3, rgba(shadeHex('#f6bfd0', -dark), 0.85));
  }
  ctx.restore();
}

// ---------- 월드 장식 오브젝트 ----------
export function paintPavilion(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(300, 260);
  ctx.translate(150, 250);
  // 정자: 기단, 4기둥, 겹처마 지붕
  ctx.fillStyle = '#9b8f7d';
  ctx.fillRect(-110, -18, 220, 18);
  ctx.fillStyle = '#7d7262';
  ctx.fillRect(-110, -4, 220, 4);
  for (const px of [-90, -32, 32, 90]) {
    const g = ctx.createLinearGradient(px - 6, 0, px + 6, 0);
    g.addColorStop(0, '#c2483a');
    g.addColorStop(1, '#8e2c24');
    ctx.fillStyle = g;
    ctx.fillRect(px - 6, -130, 12, 112);
  }
  // 난간
  ctx.strokeStyle = '#7a2a22';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-96, -50); ctx.lineTo(96, -50);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let x = -90; x <= 90; x += 12) { ctx.beginPath(); ctx.moveTo(x, -50); ctx.lineTo(x, -20); ctx.stroke(); }
  // 단청 들보
  ctx.fillStyle = '#2f8a7a';
  ctx.fillRect(-104, -142, 208, 14);
  ctx.fillStyle = '#e2b14c';
  for (let x = -96; x < 96; x += 24) ctx.fillRect(x, -139, 10, 8);
  // 지붕
  ctx.beginPath();
  ctx.moveTo(-150, -136);
  ctx.quadraticCurveTo(-128, -146, -100, -170);
  ctx.lineTo(-40, -212);
  ctx.lineTo(40, -212);
  ctx.lineTo(100, -170);
  ctx.quadraticCurveTo(128, -146, 150, -136);
  ctx.quadraticCurveTo(120, -150, 90, -152);
  ctx.lineTo(-90, -152);
  ctx.quadraticCurveTo(-120, -150, -150, -136);
  ctx.closePath();
  const rg = ctx.createLinearGradient(0, -212, 0, -136);
  rg.addColorStop(0, '#4b5376');
  rg.addColorStop(1, '#2b3150');
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.strokeStyle = '#1c2038';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.2;
  for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(k * 5, -210); ctx.lineTo(k * 14, -154); ctx.stroke(); }
  ctx.fillStyle = '#2b3150';
  ctx.fillRect(-46, -222, 92, 12);
  // 처마 끝 풍경(풍경)
  for (const px of [-140, 140]) {
    ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, -138); ctx.lineTo(px, -120); ctx.stroke();
    circle(ctx, px, -116, 4, '#e2b14c', '#7a5a1e', 1);
  }
  return c;
}

export function paintLantern(lit: boolean): HTMLCanvasElement {
  // 석등
  const [c, ctx] = makeCanvas(90, 150);
  ctx.translate(45, 146);
  if (lit) glow(ctx, 0, -86, 70, '#ffcf7a', 0.55);
  const stone = '#a39d92', dark = '#6e685f';
  const blk = (x: number, y: number, w: number, h: number) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, shadeHex(stone, 0.12));
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4a453e';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
  };
  blk(-26, -12, 52, 12);
  blk(-9, -62, 18, 50);
  blk(-24, -70, 48, 8);
  blk(-18, -104, 36, 34);
  ctx.fillStyle = lit ? '#ffd88a' : '#3d3832';
  ctx.fillRect(-10, -98, 20, 22);
  if (lit) glow(ctx, 0, -87, 22, '#fff2c6', 0.9);
  // 지붕돌
  ctx.beginPath();
  ctx.moveTo(-32, -104); ctx.quadraticCurveTo(-20, -112, -10, -124); ctx.lineTo(10, -124); ctx.quadraticCurveTo(20, -112, 32, -104); ctx.closePath();
  ctx.fillStyle = stone; ctx.fill(); ctx.strokeStyle = '#4a453e'; ctx.stroke();
  circle(ctx, 0, -130, 6, stone, '#4a453e', 1.2);
  return c;
}

export function paintTreeDecor(kind: 'cherry' | 'plum', seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(360, 340);
  drawBlossomTree(ctx, 180, 335, 1.25, kind, 0, seed);
  return c;
}

export function paintPineDecor(seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(200, 320);
  const r = rng(seed);
  ctx.translate(100, 316);
  ctx.strokeStyle = '#4a3428';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(14, -90, -26, -170, 10, -270);
  ctx.stroke();
  ctx.lineWidth = 5;
  for (let k = 0; k < 6; k++) {
    const y = -70 - k * 36, dir = k % 2 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(dir * 30, y - 10, dir * (50 + r() * 20), y - 20); ctx.stroke();
    for (let j = 0; j < 3; j++) {
      ellipse(ctx, dir * (40 + r() * 30), y - 22 + j * 4, 34 - j * 6, 11, dir * 0.1, j === 0 ? '#2f5a45' : j === 1 ? '#3d6f53' : '#4f8763');
    }
  }
  ellipse(ctx, 8, -278, 30, 12, 0, '#3d6f53');
  return c;
}

export function paintRock(seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(160, 100);
  const r = rng(seed);
  const pts: V[] = [[10, 96], [18, 50], [50, 20], [96, 14], [134, 38], [150, 96]];
  pts.forEach((p) => { p[1] += (r() - 0.5) * 10; });
  paintShape(ctx, pts, { fill: '#8d8a8e', line: '#3f3c44', lw: 2, shadow: '#3f3c44', shadowAmt: 0.6, light: '#ffffff', lightAmt: 0.25, tension: 0.4 });
  ellipse(ctx, 70, 26, 40, 10, -0.1, rgba('#5f8a5a', 0.85));
  return c;
}

export function paintGrassTuft(seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(140, 60);
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x = 10 + r() * 120, h = 20 + r() * 34, a = (r() - 0.5) * 0.6;
    tuft(ctx, [[x, 60], [x + Math.sin(a) * h * 0.5, 60 - h * 0.5], [x + Math.sin(a) * h, 60 - h]], 4, r() < 0.5 ? '#5f8f4e' : '#77a85a');
  }
  for (let i = 0; i < 5; i++) circle(ctx, 15 + r() * 110, 30 + r() * 20, 3, r() < 0.5 ? '#f6d36b' : '#f3a3b9');
  return c;
}

export function paintArch(): HTMLCanvasElement {
  // 돌다리 아치 (다리 아래 장식)
  const [c, ctx] = makeCanvas(300, 160);
  ctx.fillStyle = '#8f8a84';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(300, 0); ctx.lineTo(300, 160); ctx.lineTo(240, 160);
  ctx.quadraticCurveTo(150, 30, 60, 160); ctx.lineTo(0, 160); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4c4842'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(60,55,50,0.6)';
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    ctx.beginPath(); ctx.moveTo(150 + Math.cos(a) * 92, 160 + Math.sin(a) * 128); ctx.lineTo(150 + Math.cos(a) * 118, 160 + Math.sin(a) * 150); ctx.stroke();
  }
  for (let y = 20; y < 160; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(40, y); ctx.moveTo(260, y); ctx.lineTo(300, y); ctx.stroke(); }
  return c;
}

export function paintShrine(): HTMLCanvasElement {
  // 용신 사당 / 산사 암자
  const [c, ctx] = makeCanvas(260, 230);
  drawPalace(ctx, 130, 226, 1.2, 1, '#3a4266', 0);
  // 현판
  ctx.fillStyle = '#2b2236';
  ctx.fillRect(108, 150, 44, 16);
  ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 1.5; ctx.strokeRect(108, 150, 44, 16);
  return c;
}

// ---------- 지형 텍스처 ----------
/** 참고 화면의 돌다리·석축 (가지런한 돌 블록 + 이끼) */
/** 다듬지 않은 큰 돌 하나 (둥근 모서리, 위는 밝고 아래는 어둡게, 얼룩·금) */
function roughStone(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, r: () => number) {
  const rad = Math.min(w, h) * (0.22 + r() * 0.12);
  const j = () => (r() - 0.5) * 3;
  const pts: V[] = [
    [x + rad, y + j()], [x + w * 0.5, y + j() - 1], [x + w - rad, y + j()],
    [x + w + j(), y + rad], [x + w + j(), y + h * 0.5], [x + w + j(), y + h - rad],
    [x + w - rad, y + h + j()], [x + w * 0.5, y + h + j()], [x + rad, y + h + j()],
    [x + j(), y + h - rad], [x + j(), y + h * 0.5], [x + j(), y + rad],
  ];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shadeHex(base, 0.16));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shadeHex(base, -0.24));
  paintShape(ctx, pts, { fill: g, line: 'rgba(52,44,38,0.82)', lw: 2.2 });
  clipTo(ctx, pts, () => {
    for (let i = 0; i < 6; i++) ellipse(ctx, x + r() * w, y + r() * h, 6 + r() * w * 0.25, 3 + r() * h * 0.2, r() * 3, rgba(r() < 0.5 ? '#ffffff' : '#3a332c', 0.06 + r() * 0.05));
    // 윗면 반사광
    ctx.strokeStyle = 'rgba(255,250,236,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + rad * 0.8, y + 3.5); ctx.lineTo(x + w - rad * 0.8, y + 3.5); ctx.stroke();
    // 금
    if (r() < 0.55) {
      ctx.strokeStyle = 'rgba(52,44,38,0.5)';
      ctx.lineWidth = 1.2;
      const cx = x + w * (0.2 + r() * 0.6);
      ctx.beginPath(); ctx.moveTo(cx, y + h * 0.15); ctx.lineTo(cx + (r() - 0.5) * 10, y + h * 0.5); ctx.lineTo(cx + (r() - 0.5) * 14, y + h * 0.8); ctx.stroke();
    }
    // 이끼
    if (r() < 0.45) for (let i = 0; i < 4; i++) ellipse(ctx, x + r() * w, y + h * (0.05 + r() * 0.25), 5 + r() * 10, 2.5 + r() * 3, 0, rgba(r() < 0.5 ? '#7d8f3e' : '#a4ad4e', 0.45));
  }, 0.5);
}

/** 참고 화면의 돌다리: 크기가 제각각인 다듬지 않은 큰 돌을 쌓은 석축 (가로·세로 반복) */
function paintMasonry(size: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const r = rng(21);
  ctx.fillStyle = '#3f3934';
  ctx.fillRect(0, 0, size, size);
  const rows = [46, 40, 50, 38, 44, 38];
  const tones = ['#a49b8c', '#968d7f', '#b1a897', '#8c8477', '#a0988d', '#9b9283'];
  let y = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const rh = rows[ri];
    // 한 줄의 돌 폭 (합이 size가 되도록)
    const widths: number[] = [];
    let left = size;
    while (left > 0) {
      let w = 58 + Math.floor(r() * 70);
      if (left - w < 50) w = left;
      widths.push(w);
      left -= w;
    }
    let x = Math.floor(r() * size);
    for (const w of widths) {
      const base = tones[Math.floor(r() * tones.length)];
      const seed = r();
      for (const dx of [0, -size]) {
        for (const dy of ri === rows.length - 1 ? [0, -size] : [0]) {
          const rr = rng(Math.floor(seed * 1e6));
          roughStone(ctx, x + dx + 1.5, y + dy + 1.5, w - 3, rh - 3, base, rr);
        }
      }
      x += w;
    }
    y += rh;
  }
  // 세월의 얼룩: 아래로 흐른 물때·이끼
  for (let i = 0; i < 18; i++) {
    const x = r() * size, yy = r() * size;
    for (const dx of [0, -size, size]) ellipse(ctx, x + dx, yy, 3 + r() * 5, 10 + r() * 18, 0, rgba('#4b5a3a', 0.12));
  }
  for (let i = 0; i < 140; i++) circle(ctx, r() * size, r() * size, 0.8 + r() * 1.4, rgba(r() < 0.5 ? '#ffffff' : '#000000', 0.07));
  return c;
}

/** 돌다리 아래 아치 (안쪽은 안개 낀 먼 풍경이 비침) */
export function paintBridgeArch(w = 260, h = 190): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(77);
  const cx = w / 2, top = 18, bot = h;
  const rx = w * 0.36, ry = h * 0.62;
  const inner = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - rx, bot);
    ctx.lineTo(cx - rx, top + ry);
    ctx.ellipse(cx, top + ry, rx, ry, 0, Math.PI, 0);
    ctx.lineTo(cx + rx, bot);
    ctx.closePath();
  };
  // 안쪽: 안개 낀 하늘·먼 숲
  inner();
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#c9c5de');
  g.addColorStop(0.55, '#a9b2cf');
  g.addColorStop(1, '#6f7a92');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  inner();
  ctx.clip();
  for (let i = 0; i < 9; i++) ellipse(ctx, cx - rx + r() * rx * 2, bot - 20 - r() * 40, 18 + r() * 26, 12 + r() * 14, 0, rgba(r() < 0.5 ? '#5f7466' : '#71856f', 0.55));
  for (let i = 0; i < 4; i++) ellipse(ctx, cx - rx + r() * rx * 2, top + ry * (0.6 + r() * 0.5), 30 + r() * 20, 6, 0, rgba('#ffffff', 0.25));
  // 아치 안쪽 그늘
  const sh = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  sh.addColorStop(0, 'rgba(20,18,30,0.55)'); sh.addColorStop(0.18, 'rgba(20,18,30,0)'); sh.addColorStop(0.82, 'rgba(20,18,30,0)'); sh.addColorStop(1, 'rgba(20,18,30,0.45)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);
  const st = ctx.createLinearGradient(0, top, 0, top + ry * 0.7);
  st.addColorStop(0, 'rgba(20,18,30,0.5)'); st.addColorStop(1, 'rgba(20,18,30,0)');
  ctx.fillStyle = st;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // 아치 돌 (홍예석)
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI, a1 = Math.PI + ((i + 1) / n) * Math.PI;
    const o = 16;
    const p = (a: number, k: number): V => [cx + Math.cos(a) * (rx + k), top + ry + Math.sin(a) * (ry + k)];
    const pts: V[] = [p(a0 + 0.01, 0), p(a1 - 0.01, 0), p(a1 - 0.01, o), p(a0 + 0.01, o)];
    const base = ['#a49b8c', '#968d7f', '#b1a897'][i % 3];
    paintShape(ctx, pts, { fill: base, line: 'rgba(52,44,38,0.8)', lw: 2 }, );
  }
  return c;
}

export function paintGroundBody(style: 'grass' | 'stone' | 'cave', size = 256): HTMLCanvasElement {
  if (style === 'grass') return paintMasonry(size);
  const [c, ctx] = makeCanvas(size, size);
  const r = rng(style === 'stone' ? 19 : 29);
  const base = style === 'cave' ? '#3d3a4c' : style === 'stone' ? '#6d6a78' : '#6e5a4c';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // 지층 / 돌 블록 (타일 가능하도록 경계 래핑)
  for (let i = 0; i < 22; i++) {
    const x = r() * size, y = r() * size, w = 40 + r() * 70, h = 22 + r() * 30;
    const col = shadeHex(base, (r() - 0.5) * 0.3);
    for (const dx of [0, -size, size]) for (const dy of [0, -size, size]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, w / 2, h / 2, (r() - 0.5) * 0.2, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = rgba('#1b1824', 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  for (let i = 0; i < 90; i++) {
    circle(ctx, r() * size, r() * size, 1 + r() * 2, rgba(r() < 0.5 ? '#ffffff' : '#000000', 0.08));
  }
  return c;
}

export function paintGroundTop(style: 'grass' | 'stone' | 'cave', w = 256, h = 48): HTMLCanvasElement {
  if (style === 'grass') {
    // 돌다리 윗면: 크기가 제각각인 판석 + 노란빛 이끼·풀 (참고 화면처럼)
    const [c, ctx] = makeCanvas(w, h);
    const r = rng(33);
    ctx.fillStyle = '#5d564d';
    ctx.fillRect(0, 20, w, 16);
    let x = 0;
    while (x < w) {
      let sw = 44 + Math.floor(r() * 46);
      if (w - (x + sw) < 36) sw = w - x;
      const base = ['#b7ae9d', '#aaa190', '#c0b7a5', '#a39a89'][Math.floor(r() * 4)];
      roughStone(ctx, x + 1, 18, sw - 2, 18, base, r);
      x += sw;
    }
    // 이끼 낀 가장자리
    for (let i = 0; i < 26; i++) {
      const xx = r() * w;
      for (const dx of [0, -w, w]) ellipse(ctx, xx + dx, 19 + r() * 3, 8 + r() * 16, 3 + r() * 3, 0, rgba(r() < 0.5 ? '#8f9a3e' : '#b3b552', 0.85));
    }
    for (let i = 0; i < 80; i++) {
      const xx = r() * w, hh = 5 + r() * 13;
      for (const dx of [0, -w, w]) tuft(ctx, [[xx + dx, 20], [xx + dx + (r() - 0.5) * 4, 20 - hh * 0.6], [xx + dx + (r() - 0.5) * 8, 20 - hh]], 2.6, ['#7f9a3f', '#a8b84e', '#c9c35c', '#6d8a3a'][Math.floor(r() * 4)]);
    }
    for (let i = 0; i < 9; i++) circle(ctx, r() * w, 8 + r() * 10, 2, ['#f6e27a', '#f5b3c6', '#ffffff'][Math.floor(r() * 3)]);
    // 아래로 늘어진 이끼
    for (let i = 0; i < 12; i++) ellipse(ctx, r() * w, 37 + r() * 4, 6 + r() * 10, 2.5 + r() * 3, 0, rgba('#6f7f3a', 0.7));
    return c;
  }
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(style.length * 7);
  const g1 = style === 'cave' ? '#4f5a63' : style === 'stone' ? '#7e8a6b' : '#5d8e48';
  const g2 = style === 'cave' ? '#6b7680' : style === 'stone' ? '#a0aa82' : '#8bbf5f';
  // 아래 흙 경계 그림자
  const sg = ctx.createLinearGradient(0, 14, 0, h);
  sg.addColorStop(0, rgba('#000000', 0.0));
  sg.addColorStop(1, rgba('#000000', 0.0));
  ctx.fillStyle = sg;
  // 풀 띠 (타일 가능: 사인 주기 정수배)
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 22);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 14 + Math.sin((x / w) * TAU * 4) * 2 + Math.sin((x / w) * TAU * 11) * 1.5);
  ctx.lineTo(w, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 8, 0, h);
  g.addColorStop(0, g2);
  g.addColorStop(0.5, g1);
  g.addColorStop(1, shadeHex(g1, -0.4));
  ctx.fillStyle = g;
  ctx.fill();
  // 풀잎
  for (let i = 0; i < 70; i++) {
    const x = r() * w, hh = 6 + r() * 12;
    for (const dx of [0, -w, w]) tuft(ctx, [[x + dx, 20], [x + dx + (r() - 0.5) * 4, 20 - hh * 0.6], [x + dx + (r() - 0.5) * 8, 20 - hh]], 3, r() < 0.5 ? g1 : g2);
  }
  // 아래 늘어진 풀/이끼
  for (let i = 0; i < 16; i++) {
    const x = r() * w;
    ellipse(ctx, x, 34 + r() * 6, 8 + r() * 10, 4 + r() * 4, 0, rgba(shadeHex(g1, -0.2), 0.8));
  }
  return c;
}

export function paintPlatform(style: 'wood' | 'cloud' | 'stone' | 'bridge', w = 256, h = 40): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  if (style === 'wood') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9a6a44');
    g.addColorStop(1, '#5b3a24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 6, w, 18);
    ctx.strokeStyle = '#3b2416';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 6, w, 18);
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 24); ctx.stroke(); }
    ctx.fillStyle = '#b8322b';
    ctx.fillRect(0, 2, w, 5);
    ctx.fillStyle = '#e2b14c';
    for (let x = 8; x < w; x += 32) ctx.fillRect(x, 3, 6, 3);
  } else if (style === 'stone') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#a29c95');
    g.addColorStop(1, '#5f5a55');
    ctx.fillStyle = g;
    ctx.fillRect(0, 4, w, 24);
    ctx.strokeStyle = '#3f3a36';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 4, w, 24);
    for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 8, 28); ctx.stroke(); }
    ctx.fillStyle = '#6d935c';
    ctx.fillRect(0, 2, w, 4);
  } else if (style === 'bridge') {
    ctx.fillStyle = '#8f8a84';
    ctx.fillRect(0, 10, w, 18);
    ctx.strokeStyle = '#4c4842';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 10, w, 18);
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 28); ctx.stroke(); }
    // 돌 난간
    ctx.fillStyle = '#a7a199';
    ctx.fillRect(0, 0, w, 5);
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 4, 0, 6, 10);
  } else {
    // 구름 발판
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * w;
      for (const dx of [0, -w, w]) {
        ellipse(ctx, x + dx, 22, 30, 15, 0, '#f7efe0', '#c9b48e', 1.5);
      }
    }
    ctx.fillStyle = '#fbf5ea';
    ctx.fillRect(0, 14, w, 12);
    ctx.strokeStyle = 'rgba(201,180,142,0.6)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc((i + 0.5) * (w / 6), 22, 6, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
    }
  }
  void lerp; void clamp;
  return c;
}

/** 매달린 붉은 깃발 (참고 화면 왼쪽 나무의 깃발) */
export function paintBanner(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(70, 200);
  ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(66, 8); ctx.stroke();
  ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(35, 0); ctx.lineTo(35, 8); ctx.stroke();
  const g = ctx.createLinearGradient(0, 10, 0, 170);
  g.addColorStop(0, '#c8352e'); g.addColorStop(1, '#8e2620');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(60, 10); ctx.lineTo(60, 160); ctx.lineTo(35, 176); ctx.lineTo(10, 160); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(226,177,76,0.8)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 18, 38, 132);
  cloudSwirl(ctx, 35, 70, 0.7, 'rgba(226,177,76,0.25)', '#e2b14c', false, 1.2);
  goldDiscLite(ctx, 35, 118, 9);
  for (const x of [18, 52]) { ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x, 190); ctx.stroke(); circle(ctx, x, 192, 3, '#c8352e'); }
  return c;
}

function goldDiscLite(ctx: Ctx, x: number, y: number, r: number) {
  circle(ctx, x, y, r, '#e2b14c', '#7a5a1e', 1.5);
  circle(ctx, x, y, r * 0.45, '#c8352e');
}

/** 매달린 등롱 (빛남) */
export function paintHangLantern(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(90, 150);
  glow(ctx, 45, 92, 46, '#ffb35a', 0.65);
  ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(45, 0); ctx.lineTo(45, 56); ctx.stroke();
  ctx.fillStyle = '#3a2416'; ctx.fillRect(33, 54, 24, 6); ctx.fillRect(33, 124, 24, 6);
  const g = ctx.createRadialGradient(40, 84, 4, 45, 92, 34);
  g.addColorStop(0, '#fff2c0'); g.addColorStop(0.5, '#ff9a3c'); g.addColorStop(1, '#c3352c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(45, 92, 22, 32, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,10,0.6)'; ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(45, 92, Math.abs(k) * 7 + 1, 32, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = '#c3352c'; ctx.lineWidth = 2;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(45 + k * 3, 130); ctx.lineTo(45 + k * 4, 148); ctx.stroke(); }
  return c;
}

/** 화면 아래 어두운 전경 수풀 (가로 타일) */
export function paintForegroundLeaves(w = 1024, h = 150): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(91);
  for (let i = 0; i < 46; i++) {
    const x = r() * w, y = h - r() * 60, rx = 30 + r() * 50, ry = 18 + r() * 30;
    for (const dx of [0, -w, w]) ellipse(ctx, x + dx, y, rx, ry, r() - 0.5, rgba(r() < 0.5 ? '#1c2a2e' : '#24363a', 0.95));
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = h - 20 - r() * 70;
    for (const dx of [0, -w, w]) tuft(ctx, [[x + dx, h], [x + dx + (r() - 0.5) * 20, y + 30], [x + dx + (r() - 0.5) * 40, y]], 8, rgba('#2a4042', 0.9));
  }
  return c;
}
