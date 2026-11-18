// 개발용: 게임을 열고 스크립트대로 조작하며 스크린샷을 찍는다.
// 사용법: node tools/play.mjs <url> <outDir> [steps.json]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, outDir = '/tmp/claude-0/shots', stepsJson] = process.argv.slice(2);
const steps = stepsJson ? JSON.parse(stepsJson) : [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[console.error]', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')); });
await page.goto(url);
await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 60000 });
// 헤드리스 창은 포커스가 없어 Phaser가 프레임 시간을 1/60초로 묶는다 → 테스트에선 포커스 상태로 둔다
await page.evaluate(() => { const l = window.__SD__.game.loop; l.focus(); setInterval(() => { l.inFocus = true; l._coolDown = 0; }, 100); });
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log('[eval]', JSON.stringify(r)); }
  if (s.down) await page.keyboard.down(s.down);
  if (s.up) await page.keyboard.up(s.up);
  if (s.press) await page.keyboard.press(s.press);
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.shot) await page.screenshot({ path: `${outDir}/${s.shot}.png` });
}
console.log('errors:', errors.length);
await browser.close();
