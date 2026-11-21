// 휴대폰 끊김 측정 (개발용): 빌드한 게임(dist)을 vite preview 로 띄워 두 가지를 잰다.
//  1) 120Hz 화면 흉내: 화면 갱신을 8.33ms 간격으로 직접 돌리며, 달리는 영물이 프레임마다 얼마나 고르게 움직이는지
//     (고르지 않으면 = 어떤 프레임엔 안 움직이고 다음 프레임에 두 배 → 끊겨 보임)
//  2) 느린 휴대폰 흉내: 폴드 커버 화면 크기(가로) + CPU 4배 느리게, 실제 시간으로 구간 시작·달리기·영물 교체 동안
//     프레임 간격(긴 프레임 = 멈칫)과 긴 작업(50ms 넘는 메인 스레드 작업)
// 사용법: npm run build && node tools/perf.mjs [라벨]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const label = process.argv[2] ?? 'now';
const PORT = 4190;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const URL = `http://localhost:${PORT}/?autotest&stage=1-2`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function openGame(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__SD__.game.scene.isActive('World'), null, { timeout: 60000 });
  return { ctx, page };
}
const grantAll = `(() => { const st = window.__SD__.store.state; const now = Date.now();
  for (const id of ['wolf','hawk','cheongryong','jujak','baekho','hyeonmu','girin','haetae','bonghwang']) st.data.mounts[id] = { id, level: 30, exp: 0, stage: 2, obtainedAt: now, history: [{ stage: 0, at: now, level: 1 }] };
  st.data.activeMount = 'wolf'; st.data.cosmetics.owned.push('trail_petal'); st.data.cosmetics.trail = 'trail_petal'; st.save(); })()`;

// ---------- 1) 120Hz 고르기 ----------
{
  const { ctx, page } = await openGame({ viewport: { width: 1280, height: 720 } });
  await page.evaluate(grantAll);
  await page.evaluate(() => { const w = window.__SD__.game.scene.getScene('World'); w.scene.restart({ stage: '1-2' }); });
  await page.waitForTimeout(6000); // 미리 만들기 끝날 때까지
  const r = await page.evaluate(async () => {
    const g = window.__SD__.game;
    const loop = g.loop;
    loop.stop(); // 실제 rAF 대신 직접 120Hz 로 돌린다
    const w = g.scene.getScene('World');
    w.monsters.forEach((m) => m.destroy()); w.monsters = [];
    w.player.body.reset(100, 800); // 140+120프레임 달려도 1-2의 첫 턱(x 1300)에 닿지 않게
    const ctl = (await import('/src/game/controls.ts').catch(() => null))?.controls;
    let t = performance.now();
    const step = () => { t += 1000 / 120; loop.step(t); };
    // 달리기 시작 (가상 입력: 키보드 이벤트 대신 컨트롤 직접)
    const press = (v) => { const k = w.input.keyboard; const key = k.addKey('D'); key.isDown = v; };
    press(true);
    for (let i = 0; i < 140; i++) step(); // 가속 + 화면 주사율 다시 재기(90프레임 창이 모두 120Hz 로 채워지도록)
    const xs = [], cams = [];
    for (let i = 0; i < 120; i++) { step(); xs.push(w.player.vis.x); cams.push(w.cameras.main.scrollX); }
    press(false);
    void ctl;
    const d = xs.slice(1).map((x, i) => x - xs[i]);
    const screen = xs.map((x, i) => x - cams[i]);
    const sd = screen.slice(1).map((x, i) => x - screen[i]);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const zero = d.filter((v) => Math.abs(v) < 0.01).length;
    const varc = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length) / Math.max(0.01, Math.abs(mean));
    const jitter = Math.sqrt(sd.reduce((a, b) => a + b * b, 0) / sd.length);
    return { meanStep: +mean.toFixed(2), stillFrames: zero, frames: d.length, unevenness: +varc.toFixed(2), screenJitterPx: +jitter.toFixed(2), sample: d.slice(0, 12).map((v) => +v.toFixed(1)), rle: d.reduce((a, v) => { const k = v.toFixed(1); if (a.length && a[a.length - 1][0] === k) a[a.length - 1][1]++; else a.push([k, 1]); return a; }, []).map(([k, n]) => `${k}×${n}`).join(' '), endX: Math.round(w.player.x) };
  });
  console.log(`[${label}] 120Hz 달리기: 프레임당 평균 이동 ${r.meanStep}px, 안 움직인 프레임 ${r.stillFrames}/${r.frames}, 고르지 않음(변동계수) ${r.unevenness}, 화면 위 흔들림 ${r.screenJitterPx}px`);
  console.log(`[${label}]   프레임별 이동: ${r.sample.join(' ')}`);
  console.log(`[${label}]   전체(값×연속 프레임): ${r.rle}  · 끝 위치 x=${r.endX}`);
  await ctx.close();
}

// ---------- 2) 느린 휴대폰 (폴드 커버 가로 크기, CPU 4배 느림) ----------
{
  const { ctx, page } = await openGame({ viewport: { width: 916, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(grantAll);
  // 게임 로직 시간만 잰다 (이 서버에는 GPU가 없어 그리기가 매우 느림 → 화면 갱신을 60Hz 간격으로 직접 돌려 그리기 지연이
  // 물리 따라잡기로 번지지 않게 하고, 프레임마다 로직(물리·게임 코드·미리 만들기) 시간만 기록)
  await page.evaluate(() => {
    const g = window.__SD__.game;
    g.loop.stop();
    window.__t = performance.now();
    window.__upd = [];
    const orig = g.scene.update.bind(g.scene);
    g.scene.update = (t, d) => { const a = performance.now(); orig(t, d); window.__upd.push(performance.now() - a); };
    window.__run = async (n) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.loop.step(window.__t); if (i % 15 === 0) await new Promise((r) => setTimeout(r, 0)); } };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const measure = async (name, fn, frames) => {
    await page.evaluate(() => { window.__upd = []; });
    await fn();
    await page.evaluate((n) => window.__run(n), frames);
    const r = await page.evaluate(() => {
      const d = [...window.__upd].sort((a, b) => a - b);
      const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0;
      return { n: d.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +(d[d.length - 1] ?? 0).toFixed(0), over8: d.filter((x) => x > 8.3).length, over16: d.filter((x) => x > 16.7).length };
    });
    console.log(`[${label}] 느린 폰(CPU 4배 느림) · ${name}: ${r.n}프레임, 로직 중간 ${r.p50}ms, 95% ${r.p95}ms, 최대 ${r.max}ms, 8.3ms 넘음 ${r.over8}, 16.7ms 넘음 ${r.over16}`);
  };
  const W = () => 'window.__SD__.game.scene.getScene("World")';
  await measure('구간 시작 6초 (영물 미리 만들기 포함)', () => page.evaluate(`${W()}.scene.restart({ stage: '1-2' })`), 360);
  await measure('달리기 6초', () => page.evaluate(`(() => { const k = ${W()}.input.keyboard.addKey('D'); k.isDown = true; })()`), 360);
  await page.evaluate(`(() => { const k = ${W()}.input.keyboard.addKey('D'); k.isDown = false; })()`);
  await measure('영물 교체 3번 (각 1초)', async () => {
    for (let i = 0; i < 3; i++) { await page.evaluate(`${W()}.swapMount()`); await page.evaluate(() => window.__run(60)); }
  }, 1);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
}

await browser.close();
server.kill();
process.exit(0);
