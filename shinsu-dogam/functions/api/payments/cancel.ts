// POST /api/payments/cancel { orderId, reason } — 환불(결제 취소). 준비 상태, 미검증.
import { type Env, json, tossAuth } from '../_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const { orderId, reason } = (await request.json().catch(() => ({}))) as { orderId?: string; reason?: string };
  if (!orderId) return json({ error: 'bad request' }, 400);
  const raw = await env.ORDERS.get(orderId);
  if (!raw) return json({ error: 'order not found' }, 404);
  const order = JSON.parse(raw) as { status: string; paymentKey?: string };
  if (order.status !== 'paid' || !order.paymentKey) return json({ error: 'not refundable' }, 400);
  // TODO(출시 전): 청약철회 가능 여부(사용 여부·기간) 정책 확인 후 허용
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${order.paymentKey}/cancel`, {
    method: 'POST',
    headers: { Authorization: tossAuth(env.TOSS_SECRET_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancelReason: reason ?? '고객 요청' }),
  });
  if (!res.ok) return json({ error: 'cancel failed' }, 400);
  await env.ORDERS.put(orderId, JSON.stringify({ ...order, status: 'refunded', refundedAt: Date.now() }));
  return json({ ok: true });
};
