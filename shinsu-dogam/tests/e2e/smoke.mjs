// 신수도감 E2E 스모크 테스트 (Playwright, 빌드된 dist 를 vite preview 로 띄워 검사)
// 사용법: npm run build && npm run test:e2e   (결과 스크린샷: test-results/)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const BASE = process.env.SD_URL ?? `http://localhost:${PORT}/`;

let server;
if (!process.env.SD_URL) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 2500));
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const launchArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: launchArgs });

async function open(ctxOpts, url) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 90000 });
  // 헤드리스 창은 포커스가 없어 Phaser가 프레임 시간을 묶으므로 포커스 상태로 유지
  await page.evaluate(() => { const l = window.__SD__.game.loop; setInterval(() => { l.inFocus = true; l._coolDown = 0; }, 100); });
  return { ctx, page, errors };
}
const world = (page, fn) => page.evaluate(`(() => { const w = window.__SD__.game.scene.getScene('World'); const s = window.__SD__.store.state; return (${fn})(w, s); })()`);
const activeScenes = (page) => page.evaluate(() => window.__SD__.game.scene.getScenes(true).map((s) => s.scene.key));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ---------------- PC ----------------
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, BASE);
  await sleep(800);
  check('타이틀 화면 표시', (await activeScenes(page)).includes('Title'));
  await page.screenshot({ path: `${OUT}/01_title.png` });
  await page.mouse.click(1050, 360); // 새 모험
  await sleep(700);
  await page.mouse.click(1170, 50); // 인트로 건너뛰기
  await sleep(1200);
  check('지도(스테이지 선택) 진입', (await activeScenes(page)).includes('Map'));
  await page.screenshot({ path: `${OUT}/02_map.png` });
  await page.keyboard.press('Enter');
  await sleep(1800);
  const sc = await activeScenes(page);
  check('1-1 월드 + HUD 실행', sc.includes('World') && sc.includes('Hud'), sc.join(','));
  const x0 = await world(page, (w) => w.player.x);
  await page.keyboard.down('d');
  await sleep(1200);
  const x1 = await world(page, (w) => w.player.x);
  check('키보드 오른쪽 이동', x1 - x0 > 150, `${Math.round(x1 - x0)}px`);
  const yBefore = await world(page, (w) => w.player.y);
  await page.keyboard.down('Space');
  await sleep(260);
  const yJump = await world(page, (w) => w.player.y);
  await page.keyboard.up('Space');
  check('점프', yBefore - yJump > 40, `${Math.round(yBefore - yJump)}px 상승`);
  await page.screenshot({ path: `${OUT}/03_world_jump.png` });
  await page.keyboard.up('d');
  await sleep(900);
  check('착지', await world(page, (w) => w.player.grounded));
  // 패럴랙스: 배경 레이어가 카메라 이동에 따라 움직인다
  const para = await world(page, (w) => w.bd.layers.map((l) => Math.round(l.obj.tilePositionX)));
  check('패럴랙스 레이어 이동', para.some((v) => v > 0) && new Set(para).size > 2, JSON.stringify(para));
  // 골 도달 → 구간 돌파
  await world(page, (w) => { w.player.body.reset(w.map.goal.x, w.map.goal.y - 60); return 1; });
  await sleep(1500);
  const cleared = await world(page, (w, s) => !!s.data.stages['1-1']?.cleared);
  check('1-1 돌파 기록 저장', cleared);
  await page.screenshot({ path: `${OUT}/04_clear.png` });
  await page.mouse.click(520, 520); // 다음 구간
  await sleep(2200);
  check('다음 구간(1-2) 시작', (await world(page, (w) => w.map.id)) === '1-2');
  // 전투: 첫 산돼지 옆으로 이동해 공격
  await world(page, (w) => { const m = w.monsters[0]; w.player.body.reset(m.x - 90, m.body.bottom - 40); w.player.facing = 1; return 1; });
  for (let i = 0; i < 8; i++) { await page.keyboard.press('j'); await sleep(380); }
  const st = await world(page, (w, s) => ({ defeats: s.data.stats.defeats, exp: s.active.exp, lv: s.active.level, m0: w.monsters[0]?.dead ?? true }));
  check('몬스터 처치 + 경험치', st.defeats >= 1 && (st.exp > 0 || st.lv > 1), JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/05_combat.png` });
  // 메뉴
  await page.keyboard.press('Escape');
  await sleep(800);
  check('메뉴 열림(월드 일시정지)', (await activeScenes(page)).includes('Menu'));
  for (const [x, name] of [[310, 'codex'], [760, 'shop']]) {
    await page.mouse.click(x, 74);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/06_menu_${name}.png` });
  }
  // 상점 테스트 구매 (설원 늑대)
  await page.mouse.click(300, 375);
  await sleep(500);
  await page.mouse.click(540, 420); // 확인 대화상자 '테스트 구매'
  await sleep(1200);
  const bought = await page.evaluate(() => window.__SD__.store.state.data.purchases.length);
  check('상점 테스트 구매 (실결제 없음)', bought === 1, `구매 ${bought}건`);
  await page.keyboard.press('Escape');
  await sleep(500);
  // 진화 + 청룡 비행 (데이터 조작으로 빠르게 확인)
  await world(page, (w, s) => { s.obtainMount('cheongryong'); return 1; });
  await sleep(900);
  await page.mouse.click(510, 610); // 획득 연출: 함께 달리기
  await sleep(600);
  await world(page, (w, s) => { s.data.mounts.cheongryong.level = 30; s.addItem('spirit_stone', 30); s.addItem('gold', 2000); s.evolve('cheongryong'); s.evolve('cheongryong'); w.player.rebuild(); return 1; });
  await sleep(1500);
  // 진화 연출 대기열 비우기
  for (let i = 0; i < 3; i++) {
    if ((await activeScenes(page)).includes('World')) break;
    await page.mouse.click(640, 640);
    await sleep(800);
  }
  const y0 = await world(page, (w) => w.player.y);
  await page.keyboard.press('Space');
  await sleep(200);
  await page.keyboard.down('Space');
  await sleep(1300);
  const fly = await world(page, (w) => ({ y: w.player.y, flying: w.player.flying, stage: w.player.st.stage, id: w.player.def.id }));
  await page.keyboard.up('Space');
  check('청룡 각성체 자유 비행', fly.flying && y0 - fly.y > 200, JSON.stringify({ ...fly, rise: Math.round(y0 - fly.y) }));
  await page.screenshot({ path: `${OUT}/07_fly.png` });
  // 저장 → 새로고침 → 이어하기
  await page.evaluate(() => window.__SD__.store.state.save());
  await page.reload();
  await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 90000 });
  const persisted = await page.evaluate(() => ({ owns: !!window.__SD__.store.state.data.mounts.cheongryong, cleared: !!window.__SD__.store.state.data.stages['1-1']?.cleared }));
  check('새로고침 후 진행 상황 유지', persisted.owns && persisted.cleared, JSON.stringify(persisted));
  check('PC 실행 중 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ---------------- 모바일 (가로) ----------------
  const dev = devices['iPhone 13 landscape'] ?? devices['Pixel 7 landscape'];
  const m = await open({ ...dev }, `${BASE}?autotest`);
  await sleep(1500);
  const box = await m.page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const P = (gx, gy) => ({ x: box.x + (gx / 1280) * box.w, y: box.y + (gy / 720) * box.h });
  const mx0 = await world(m.page, (w) => w.player.x);
  const cdp = await m.ctx.newCDPSession(m.page);
  const r = P(222, 628);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
  await sleep(1000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mx1 = await world(m.page, (w) => w.player.x);
  check('모바일 터치 이동', mx1 - mx0 > 120, `${Math.round(mx1 - mx0)}px`);
  const touchVisible = await m.page.evaluate(() => window.__SD__.game.scene.getScene('Hud').touchOn);
  check('모바일 터치 버튼 표시', touchVisible === true);
  await m.page.screenshot({ path: `${OUT}/08_mobile.png` });
  check('모바일 실행 중 오류 없음', m.errors.length === 0, m.errors.slice(0, 3).join(' | '));
  await m.ctx.close();
} catch (e) {
  check('테스트 실행', false, String(e?.stack ?? e));
} finally {
  await browser.close();
  server?.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
