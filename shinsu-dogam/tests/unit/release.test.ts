// 판매 빌드: 서버 함수(주문·승인·구매 기록·환불)와 구매 지급·동기화 단위 테스트 (토스 API는 가짜 응답)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createOrder } from '../../functions/api/orders.ts';
import { onRequestPost as confirm } from '../../functions/api/payments/confirm.ts';
import { onRequestPost as cancel } from '../../functions/api/payments/cancel.ts';
import { onRequestGet as entitlements } from '../../functions/api/entitlements.ts';
import type { Env } from '../../functions/api/_shared.ts';
import { GameState, newCustomerKey } from '../../src/systems/state.ts';
import { applyPurchase, revokePurchase, syncPurchases } from '../../src/systems/purchase.ts';

class KV { m = new Map<string, string>(); async get(k: string) { return this.m.get(k) ?? null; } async put(k: string, v: string) { this.m.set(k, v); } }
const mkEnv = (): Env => ({ TOSS_SECRET_KEY: 'test_sk_dummy', ADMIN_TOKEN: 'adm', ORDERS: new KV() });
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
const KEY = 'SDABCDEFGHIJ0123456789XYZ';

let tossCalls: { url: string; body: string; auth: string }[] = [];
let tossReply: (url: string) => { status: number; body: unknown } = () => ({ status: 200, body: { status: 'DONE', totalAmount: 0 } });
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  tossCalls.push({ url: String(url), body: String(init?.body ?? ''), auth: String((init?.headers as Record<string, string>)?.Authorization ?? '') });
  const r = tossReply(String(url));
  return new Response(JSON.stringify(r.body), { status: r.status });
}) as typeof fetch;

async function buy(env: Env, productId: string, amountOverride?: number) {
  const o = await (await createOrder({ request: post({ productId, customerKey: KEY }), env })).json() as { orderId: string; amount: number; error?: string };
  if (o.error) return { order: o, res: null };
  tossReply = () => ({ status: 200, body: { status: 'DONE', totalAmount: o.amount, orderId: o.orderId } });
  const res = await (await confirm({ request: post({ paymentKey: 'pk_' + o.orderId, orderId: o.orderId, amount: amountOverride ?? o.amount }), env })).json() as Record<string, unknown>;
  return { order: o, res };
}

test('서버: 주문 금액은 서버가 정하고, 승인 후 구매 기록이 남는다', async () => {
  const env = mkEnv(); tossCalls = [];
  const { order, res } = await buy(env, 'p_skin_wolf_snow');
  assert.equal(order.amount, 4900);
  assert.match(order.orderId, /^[A-Za-z0-9_-]{6,64}$/);
  assert.equal(res!.ok, true);
  assert.equal(tossCalls[0].url, 'https://api.tosspayments.com/v1/payments/confirm');
  assert.equal(tossCalls[0].auth, 'Basic ' + btoa('test_sk_dummy:'));
  const ent = await (await entitlements({ request: new Request(`https://x/api/entitlements?customerKey=${KEY}`), env })).json() as { purchases: { productId: string; status: string }[] };
  assert.deepEqual(ent.purchases.map((p) => [p.productId, p.status]), [['p_skin_wolf_snow', 'paid']]);
});

test('서버: 금액 위조·중복 승인·없는 상품·잘못된 계정 키를 막는다', async () => {
  const env = mkEnv(); tossCalls = [];
  const forged = await buy(env, 'p_skin_cr_gold', 100);
  assert.match(String(forged.res!.error), /금액/);
  assert.equal(tossCalls.length, 0, '위조 금액이면 토스에 승인 요청조차 하지 않음');
  const { order } = await buy(env, 'p_decor_knot');
  const again = await (await confirm({ request: post({ paymentKey: 'pk', orderId: order.orderId, amount: order.amount }), env })).json() as Record<string, unknown>;
  assert.equal(again.alreadyPaid, true);
  const list = JSON.parse((await env.ORDERS.get(`ent:${KEY}`))!);
  assert.equal(list.length, 1, '중복 승인해도 한 번만 기록');
  assert.equal((await createOrder({ request: post({ productId: 'p_nope', customerKey: KEY }), env })).status, 400);
  assert.equal((await createOrder({ request: post({ productId: 'p_decor_knot', customerKey: 'x' }), env })).status, 400);
});

test('서버: 토스 승인이 실패하거나 상태가 DONE 이 아니면 기록하지 않는다', async () => {
  const env = mkEnv();
  const o = await (await createOrder({ request: post({ productId: 'p_decor_jade', customerKey: KEY }), env })).json() as { orderId: string; amount: number };
  tossReply = () => ({ status: 400, body: { message: '카드 거절' } });
  const r1 = await (await confirm({ request: post({ paymentKey: 'pk', orderId: o.orderId, amount: o.amount }), env })).json() as Record<string, unknown>;
  assert.equal(r1.error, '카드 거절');
  tossReply = () => ({ status: 200, body: { status: 'WAITING_FOR_DEPOSIT', totalAmount: o.amount } });
  const r2 = await (await confirm({ request: post({ paymentKey: 'pk', orderId: o.orderId, amount: o.amount }), env })).json() as Record<string, unknown>;
  assert.match(String(r2.error), /WAITING/);
  assert.equal(await env.ORDERS.get(`ent:${KEY}`), null);
});

test('서버: 하루 5만 원 미만 한도, 계정당 1회 상품', async () => {
  const env = mkEnv();
  await buy(env, 'p_pkg_premium'); // 19,900
  await buy(env, 'p_skin_cr_gold'); // 14,900 → 34,800
  const over = await buy(env, 'p_skin_bh_five'); // +14,900 = 49,700 < 50,000 → 허용
  assert.ok(over.res?.ok);
  const blocked = await buy(env, 'p_decor_knot'); // +1,900 → 51,600
  assert.match(String(blocked.order.error), /한도/);
  const env2 = mkEnv();
  await buy(env2, 'p_pass_premium');
  const twice = await buy(env2, 'p_pass_premium');
  assert.match(String(twice.order.error), /이미/);
});

test('서버: 환불은 관리자 토큰으로만, 환불하면 구매 기록이 refunded', async () => {
  const env = mkEnv();
  const { order } = await buy(env, 'p_outfit_fairy');
  assert.equal((await cancel({ request: post({ orderId: order.orderId }), env })).status, 401);
  tossReply = () => ({ status: 200, body: {} });
  const ok = await (await cancel({ request: post({ orderId: order.orderId }, { authorization: 'Bearer adm' }), env })).json() as Record<string, unknown>;
  assert.equal(ok.ok, true);
  const list = JSON.parse((await env.ORDERS.get(`ent:${KEY}`))!);
  assert.equal(list[0].status, 'refunded');
});

test('구매 계정 키: 서버가 받는 형식, 매번 다름', () => {
  const a = newCustomerKey(), b = newCustomerKey();
  assert.match(a, /^SD[0-9A-Z]{10,40}$/);
  assert.notEqual(a, b);
});

test('지급: 같은 주문은 한 번만, 정기권·수행록 효과, 환불 회수', () => {
  const st = new GameState(null);
  assert.ok(applyPurchase(st, 'p_decor_set', 'o1', 5900, false).ok);
  assert.ok(!applyPurchase(st, 'p_decor_set', 'o1', 5900, false).ok, '같은 주문 두 번 지급 안 함');
  assert.deepEqual(st.data.cosmetics.decor, ['decor_knot', 'decor_jade', 'decor_bell'], '장식 세트는 모두 함께 장착');
  applyPurchase(st, 'p_pass_premium', 'o2', 9900, false);
  assert.ok(st.data.pass.premium);
  const stones = st.count('spirit_stone');
  applyPurchase(st, 'p_monthly', 'o3', 4900, false, 1_000_000);
  assert.equal(st.count('spirit_stone') - stones, 10);
  assert.ok(st.data.monthly.until > 1_000_000);
  revokePurchase(st, 'o1');
  assert.ok(!st.ownsCosmetic('decor_jade'));
});

test('서버 기록 동기화: 조작한 유료 꾸미기 회수, 다른 기기 구매 복구, 정기권 다시 계산', () => {
  const st = new GameState(null);
  // 브라우저 저장을 고쳐 유료 스킨·수행록 프리미엄을 얻은 상황
  st.data.cosmetics.owned.push('skin_cheongryong_gold', 'outfit_royal');
  st.data.pass.premium = true;
  st.data.purchases.push({ orderId: 'fake', productId: 'p_pkg_premium', price: 19900, at: 1, test: true, status: 'paid' });
  const DAY = 86400_000;
  const r = syncPurchases(st, [
    { orderId: 'A', productId: 'p_outfit_fairy', amount: 7900, at: 10 * DAY, status: 'paid' },
    { orderId: 'B', productId: 'p_monthly', amount: 4900, at: 20 * DAY, status: 'paid' },
    { orderId: 'C', productId: 'p_skin_wolf_snow', amount: 4900, at: 21 * DAY, status: 'refunded' },
  ]);
  assert.ok(!st.ownsCosmetic('skin_cheongryong_gold') && !st.ownsCosmetic('outfit_royal'), '조작한 유료 꾸미기 회수');
  assert.ok(st.ownsCosmetic('outfit_fairy'), '다른 기기에서 산 의상 복구');
  assert.ok(!st.ownsCosmetic('skin_wolf_snow'), '환불된 주문은 지급 안 함');
  assert.equal(st.data.pass.premium, false, '서버에 수행록 구매가 없으면 프리미엄 아님');
  assert.equal(st.data.monthly.until, 20 * DAY + 30 * DAY);
  assert.equal(st.data.purchases.length, 3);
  assert.ok(r.removed.includes('skin_cheongryong_gold'));
});

test('서버 기록 동기화: 출석·수행록으로 정당하게 얻은 꾸미기는 남긴다', () => {
  const st = new GameState(null);
  st.data.daily.loginDays = 7;
  st.data.cosmetics.owned.push('decor_knot'); // 출석 7일째 보상 (유료 상품에도 있음)
  syncPurchases(st, []);
  assert.ok(st.ownsCosmetic('decor_knot'));
});
