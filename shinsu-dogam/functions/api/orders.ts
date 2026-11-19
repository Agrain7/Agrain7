// POST /api/orders  { productId, customerKey }  → 서버가 금액을 정해 주문을 만든다 (클라이언트가 보낸 금액은 믿지 않음)
import { type Env, SERVER_PRICES, ONCE_PER_ACCOUNT, DAILY_LIMIT, json, validCustomerKey, readPurchases, paidToday } from './_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const { productId, customerKey } = (await request.json().catch(() => ({}))) as { productId?: string; customerKey?: string };
  const price = productId ? SERVER_PRICES[productId] : undefined;
  if (!price || !productId) return json({ error: '알 수 없는 상품' }, 400);
  if (!validCustomerKey(customerKey)) return json({ error: '구매 계정 키가 올바르지 않음' }, 400);
  const list = await readPurchases(env.ORDERS, customerKey);
  if (ONCE_PER_ACCOUNT.has(productId) && list.some((p) => p.productId === productId && p.status === 'paid')) return json({ error: '이미 구매한 상품입니다' }, 409);
  if (paidToday(list) + price.amount >= DAILY_LIMIT) return json({ error: '하루 결제 한도(5만 원 미만)를 넘을 수 없어요' }, 409);
  // 토스 orderId 규칙(영문·숫자·-·_, 6~64자)에 맞춤
  const orderId = `SD${Date.now()}${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await env.ORDERS.put(`order:${orderId}`, JSON.stringify({ productId, amount: price.amount, customerKey, status: 'created', createdAt: Date.now() }));
  return json({ orderId, productId, amount: price.amount, orderName: price.name });
};
