// 사용법: node tools/art_kit.mjs  (개발 서버 실행 중) → assets-src/art-templates/
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173/tools/art-kit.html');
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 240000 });
const kit = await page.evaluate(() => window.__kit);
mkdirSync('assets-src/art-templates', { recursive: true });
for (const [name, url] of Object.entries(kit)) {
  const ext = url.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  writeFileSync(`assets-src/art-templates/${name}.${ext}`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('saved', Object.keys(kit).length);
await browser.close();
