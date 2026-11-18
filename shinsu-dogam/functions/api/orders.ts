// POST /api/orders  { productId }  → 서버가 금액을 정해 주문을 만든다. (준비 상태, 미배포)
import { type Env, SERVER_PRICES, json } from './_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: string };
  const price = productId ? SERVER_PRICES[productId] : undefined;
  if (!price) return json({ error: 'unknown product' }, 400);
  const orderId = `SD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  // TODO(출시 전): 로그인 사용자 id를 주문에 연결 (Supabase Auth 등)
  // TODO(출시 전): 사용자별 하루 누적 결제가 5만 원 미만인지 서버에서 확인 (토스 게임 업종 기준 — 계약 시 재확인)
  await env.ORDERS.put(orderId, JSON.stringify({ productId, amount: price.amount, status: 'created', createdAt: Date.now() }));
  return json({ orderId, productId, amount: price.amount, orderName: price.name });
};
