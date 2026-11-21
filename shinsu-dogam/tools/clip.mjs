// 실제 플레이 영상 만들기 (홍보용): 청룡 각성체 이륙 → 비행 중 뇌운주 → 요괴 무리 위에서 청룡 뇌우 → 날아감 (월하산맥 1-2)
// 게임 시계를 직접 한 칸씩 돌리며(60Hz) 매 2칸마다 한 장 찍어 30fps MP4 로 묶는다 → GPU 없는 환경에서도 끊김 없는 영상.
// 사용법: npx vite --port 5173 (개발 서버) 띄운 뒤  node tools/clip.mjs out.mp4 [초=13] [preview]
// 필요: ffmpeg. 조작은 실제 키(D·Space·S·Z·V) 입력과 같은 방식. 소리는 담기지 않는다.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.argv[2];
const SECONDS = Number(process.argv[3] ?? 12.5);
const PREVIEW = process.argv[4] === 'preview';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/?nostory');
await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 60000 });
await page.evaluate(() => { const l = window.__SD__.game.loop; setInterval(() => { l.inFocus = true; l._coolDown = 0; }, 100); });
await page.evaluate(async () => {
  const st = window.__SD__.store.state; const now = Date.now();
  st.data.mounts.cheongryong = { id: 'cheongryong', level: 30, exp: 0, stage: 2, obtainedAt: now, history: [{ stage: 0, at: now, level: 1 }] };
  st.data.activeMount = 'cheongryong';
  st.save();
  const g = window.__SD__.game; g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key)); g.scene.start('World', { stage: '1-2' });
});
await page.waitForTimeout(6500); // 구간 제목 사라지고 영물 그림 준비될 때까지
await page.evaluate(async () => {
  const g = window.__SD__.game;
  const w = g.scene.getScene('World');
  const kb = w.input.keyboard;
  window.__keys = { right: kb.addKey('D'), jump: kb.addKey('SPACE'), down: kb.addKey('S'), attack: kb.addKey('Z'), ult: kb.addKey('V') };
  // 시작 자리 + 몬스터 배치 (뇌운주로 맞힐 산돼지 2, 필살기 무리 4)
  w.player.body.reset(260, 800); w.player.facing = 1; w.player.ult = 0;
  const mons = w.monsters.filter((m) => !m.dead);
  const put = (m, x) => { m.body.reset(x, 700); };
  if (mons[0]) put(mons[0], 1180);
  if (mons[1]) put(mons[1], 1560);
  const rest = mons.slice(2, 7);
  [2860, 3010, 3150, 3290, 3430].forEach((x, i) => rest[i] && put(rest[i], x));
  g.loop.stop();
  window.__t = performance.now();
  // Phaser 트윈은 실제 시계(Date.now)로 움직인다 → 한 칸씩 돌리는 녹화에서는 게임 시계에 맞춰 줘야 영상 속 연출 길이가 실제 플레이와 같다
  const realNow = Date.now.bind(Date), base = realNow(), t0 = window.__t;
  Date.now = () => base + (window.__t - t0);
  for (const sc of g.scene.getScenes(true)) if (sc.tweens) { sc.tweens.prevTime = Date.now(); }
  window.__step = (n) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.loop.step(window.__t); } };
  window.__step(30); // 몬스터가 땅에 내려앉게
});
// 시간표 (초): 입력 상태를 프레임마다 정한다
const FPS = 30, N = Math.round(SECONDS * FPS);
const plan = (t) => ({
  right: (t < 6.0) || (t > 9.3),
  // 점프 → 공중에서 한 번 더(비행) → 상승 / 짧게 눌러 높이 유지 / 필살기 뒤 다시 높이 올라 날아감
  jump: (t >= 0.9 && t < 0.97) || (t >= 1.25 && t < 1.32) || (t >= 1.32 && t < 2.25) || (t >= 9.3 && t < 10.1)
    || [3.6, 5.0, 7.4, 10.9, 12.0].some((k) => t >= k && t < k + 0.16),
  // 돌기둥을 지난 뒤 낮게 내려와 땅의 요괴 무리가 화면에 보이게
  down: t >= 5.35 && t < 5.8,
  attack: (t >= 2.3 && t < 4.3) || (t >= 10.3 && t < 11.0),
  ult: t >= 6.2 && t < 6.27,
});
const ff = PREVIEW ? null : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
const log = [];
for (let f = 0; f < N; f++) {
  const t = f / FPS;
  const p = plan(t);
  const s = await page.evaluate(([p, t]) => {
    const w = window.__SD__.game.scene.getScene('World');
    if (p.ult) w.player.ult = 100;
    for (const k of ['right', 'jump', 'down', 'attack', 'ult']) window.__keys[k].isDown = !!p[k];
    window.__step(2);
    return { x: Math.round(w.player.x), y: Math.round(w.player.y), fly: w.player.flying, hp: Math.round(w.player.hp), alive: w.monsters.filter((m) => !m.dead).length };
  }, [p, t]);
  if (f % 15 === 0) log.push(`${t.toFixed(1)}s x${s.x} y${s.y} ${s.fly ? 'FLY' : ''} mons${s.alive}`);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (PREVIEW) { if ([20, 45, 90, 130, 190, 200, 215, 240, 300, 330].includes(f)) await import('node:fs').then((fs) => fs.writeFileSync(`${OUT}_${String(f).padStart(3, '0')}.jpg`, buf)); }
  else ff.stdin.write(buf);
}
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
console.log(log.join('\n'));
console.log('errors', errs);
await b.close();
