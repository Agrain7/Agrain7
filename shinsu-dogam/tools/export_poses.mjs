// 사용법: node tools/export_poses.mjs <영물_단계> <출력폴더> [배율]  (개발 서버 실행 중)
// 현재 게임의 움직임을 프레임 PNG로 저장 → 일러스트 작가에게 '동작 참고'로 전달하거나 그림 넣기 시험용
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [key = 'hawk_2', out = `art-ref/${key}`, scale = '3'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:5173/tools/export-poses.html?k=${key}&s=${scale}`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
const { frames, seat } = await page.evaluate(() => window.__poses);
mkdirSync(out, { recursive: true });
for (const [name, url] of Object.entries(frames)) writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
writeFileSync(`${out}/seat.json`, JSON.stringify({ x: Math.round(seat[0]), y: Math.round(seat[1]) }));
console.log(`saved ${Object.keys(frames).length} frames → ${out}`);
await browser.close();
