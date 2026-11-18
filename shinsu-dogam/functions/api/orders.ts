// POST /api/orders  { productId }  → 서버가 금액을 정해 주문을 만든다. (준비 상태, 미배포)
import { type Env, SERVER_PRICES, json } from './_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: string };
  const price = productId ? SERVER_PRICES[productId] : undefined;
  if (!price) return json({ error: 'unknown product' }, 400);
  const orderId = `SD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  // TODO(출시 전): 로그인 사용자 id를 주문에 연결 (Supabase Auth 등)
  await env.ORDERS.put(orderId, JSON.stringify({ productId, amount: price.amount, status: 'created', createdAt: Date.now() }));
  return json({ orderId, productId, amount: price.amount, orderName: price.name });
};
