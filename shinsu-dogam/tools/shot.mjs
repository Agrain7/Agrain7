// 사용법: node tools/shot.mjs "<url>" out.png [width] [height]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out, w = '1400', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 }).catch(() => console.log('timeout waiting ready'));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
