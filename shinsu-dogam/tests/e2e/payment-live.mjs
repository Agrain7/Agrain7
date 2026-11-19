// 판매 빌드(토스 결제 모드) 결제 흐름 E2E — 토스 결제창·서버는 가짜로 대신한다 (실제 청구·외부 호출 없음)
// 확인: 상점 구매 → 서버 주문 → 결제창 이동 → 성공 주소로 복귀 → 서버 승인 → 지급·장착 / 실패 복귀 / 구매 복구·조작 회수
// 사용법: npm run test:e2e:pay
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 4181;
const OUTDIR = 'dist-paytest';
execSync(`npx vite build --outDir ${OUTDIR} --emptyOutDir`, { stdio: 'ignore', env: { ...process.env, VITE_PAYMENT_MODE: 'toss', VITE_TOSS_CLIENT_KEY: 'test_ck_FAKE_FOR_E2E' } });
const server = spawn('npx', ['vite', 'preview', '--outDir', OUTDIR, '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const BASE = `http://localhost:${PORT}/`;

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// ---- 가짜 서버 ----
const server_ = { purchases: [], orders: new Map(), confirmCalls: 0 };
const PRICES = { p_skin_wolf_snow: [4900, '설원 늑대'], p_outfit_fairy: [7900, '선녀 의상'] };
await page.route('**/api/orders', async (r) => {
  const b = JSON.parse(r.request().postData() ?? '{}');
  const [amount, orderName] = PRICES[b.productId];
  const orderId = `SD${Date.now()}E2E`;
  server_.orders.set(orderId, { productId: b.productId, amount, customerKey: b.customerKey });
  await r.fulfill({ json: { orderId, productId: b.productId, amount, orderName } });
});
await page.route('**/api/payments/confirm', async (r) => {
  server_.confirmCalls++;
  const b = JSON.parse(r.request().postData() ?? '{}');
  const o = server_.orders.get(b.orderId);
  if (!o || o.amount !== b.amount) return r.fulfill({ status: 400, json: { error: '금액 불일치' } });
  const at = Date.now();
  if (!server_.purchases.some((p) => p.orderId === b.orderId)) server_.purchases.push({ orderId: b.orderId, productId: o.productId, amount: o.amount, at, status: 'paid' });
  await r.fulfill({ json: { ok: true, productId: o.productId, at } });
});
await page.route('**/api/entitlements*', (r) => r.fulfill({ json: { purchases: server_.purchases } }));
// ---- 가짜 토스 결제창 SDK: 결제하면 successUrl 로 돌아감 (failMode 면 failUrl) ----
await page.route('https://js.tosspayments.com/**', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: `window.TossPayments = function (ck) { window.__tossClientKey = ck; return { payment: function (o) { window.__tossCustomer = o.customerKey; return { requestPayment: async function (p) {
    window.__tossReq = p;
    if (window.__failMode) location.href = p.failUrl + '&code=PAY_PROCESS_CANCELED&message=' + encodeURIComponent('사용자가 결제를 취소했습니다');
    else location.href = p.successUrl + '&paymentType=NORMAL&paymentKey=pk_e2e&orderId=' + p.orderId + '&amount=' + p.amount.value;
  } }; } }; };`,
}));

const hasText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src);
  const walk = (list) => list.some((o) => (o.type === 'Text' && rx.test(o.text)) || (o.list && walk(o.list)));
  return walk(window.__SD__.game.scene.getScene('Title').children.list);
}, re.source);
const ready = async () => { await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 90000 }); await page.evaluate(() => { const l = window.__SD__.game.loop; setInterval(() => { l.inFocus = true; l._coolDown = 0; }, 100); }); };
await page.goto(BASE);
await ready();
const live = await page.evaluate(() => !!document.title);
check('판매 빌드 열림', live);

// 구매: 상점에서 설원 늑대 → 확인 대화상자 '결제하기'
await page.evaluate(() => { const g = window.__SD__.game; g.scene.start('Menu', { tab: 'shop', from: 'Title' }); });
await page.waitForTimeout(900);
const nav = page.waitForURL(/pay=success/, { timeout: 20000 });
await page.evaluate(() => { window.__SD__.game.scene.getScene('Menu').buy('p_skin_wolf_snow'); });
await page.waitForTimeout(500);
await page.mouse.click(540, 420); // '결제하기'
await nav;
await ready();
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const st = window.__SD__.store.state;
  return { owned: st.ownsCosmetic('skin_wolf_snow'), equipped: st.data.mounts.wolf.skin, purchases: st.data.purchases.map((p) => [p.productId, p.test, p.status]), url: location.search, key: st.data.account.customerKey };
});
check('결제창 → 서버 승인 → 스킨 지급·장착', after.owned && after.equipped === 'skin_wolf_snow', JSON.stringify(after.purchases));
check('실결제 기록 (test=false)', after.purchases.length === 1 && after.purchases[0][1] === false);
check('복귀 주소 정리 (결제 키가 주소창에 남지 않음)', !/paymentKey/.test(after.url), after.url || '(빈 쿼리)');
check('서버 승인 1회', server_.confirmCalls === 1, `${server_.confirmCalls}회`);
const notice = await hasText(/구매 완료/);
check('구매 완료 안내 표시', notice);

// 실패 복귀
await page.evaluate(() => { const g = window.__SD__.game; g.scene.getScenes(true).forEach((s) => g.scene.stop(s.scene.key)); g.scene.start('Menu', { tab: 'shop', from: 'Title' }); window.__failMode = true; });
await page.waitForTimeout(900);
const nav2 = page.waitForURL(/pay=fail/, { timeout: 20000 });
await page.evaluate(() => { window.__failMode = true; window.__SD__.game.scene.getScene('Menu').buy('p_outfit_fairy'); });
await page.waitForTimeout(500);
await page.evaluate(() => { window.__failMode = true; });
await page.mouse.click(540, 420);
await nav2;
await ready();
await page.waitForTimeout(1200);
const fail = { ...(await page.evaluate(() => ({ owned: window.__SD__.store.state.ownsCosmetic('outfit_fairy'), n: window.__SD__.store.state.data.purchases.length }))), msg: await hasText(/완료되지 않았/) };
check('결제 취소 복귀: 지급 없음 + 안내', !fail.owned && fail.n === 1 && fail.msg, JSON.stringify(fail));

// 저장 조작 → 새로고침 → 서버 기록으로 회수 / 다른 기기 복구
await page.evaluate(() => { const st = window.__SD__.store.state; st.data.cosmetics.owned.push('skin_cheongryong_gold'); st.data.pass.premium = true; st.save(); });
server_.purchases.push({ orderId: 'OTHERDEVICE1', productId: 'p_outfit_fairy', amount: 7900, at: Date.now(), status: 'paid' });
await page.reload();
await ready();
await page.waitForTimeout(1200);
const synced = await page.evaluate(() => { const st = window.__SD__.store.state; return { gold: st.ownsCosmetic('skin_cheongryong_gold'), premium: st.data.pass.premium, fairy: st.ownsCosmetic('outfit_fairy'), snow: st.ownsCosmetic('skin_wolf_snow') }; });
check('저장 조작한 유료 상품 회수', !synced.gold && !synced.premium, JSON.stringify(synced));
check('다른 기기 구매 복구 + 기존 구매 유지', synced.fairy && synced.snow);
check('약관·개인정보·환불 페이지', (await (await page.request.get(BASE + 'legal/terms.html')).text()).includes('이용약관') && (await page.request.get(BASE + 'legal/refund.html')).ok() && (await page.request.get(BASE + 'legal/privacy.html')).ok());
check('앱 설치 정보(manifest·아이콘)', (await page.request.get(BASE + 'manifest.webmanifest')).ok() && (await page.request.get(BASE + 'icons/icon-512.png')).ok());
check('디버그 치트 꺼짐 (?debug 무시)', await (async () => { await page.goto(BASE + '?debug&stage=4-2'); await ready(); return page.evaluate(() => !window.__SD__.game.scene.isActive('World')); })());
check('실행 중 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.kill();
execSync(`rm -rf ${OUTDIR}`);
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} 통과`);
process.exit(pass === results.length ? 0 : 1);
