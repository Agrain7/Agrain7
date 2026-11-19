// GET /api/entitlements?customerKey=…  → 이 계정의 구매 기록 (게임이 부팅·구매 복구 때 맞춘다)
import { type Env, json, validCustomerKey, readPurchases } from './_shared.ts';

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const key = new URL(request.url).searchParams.get('customerKey');
  if (!validCustomerKey(key)) return json({ error: '구매 계정 키가 올바르지 않음' }, 400);
  const purchases = await readPurchases(env.ORDERS, key);
  return new Response(JSON.stringify({ purchases }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
};
