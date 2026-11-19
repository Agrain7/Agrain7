// POST /api/payments/cancel { orderId, reason }  — 환불(결제 취소). 관리자만: 헤더 Authorization: Bearer <ADMIN_TOKEN>
// 고객이 고객센터로 요청 → 환불 정책(청약철회 가능 여부) 확인 → 관리자가 호출. 구매 기록은 'refunded' 로 바뀌고 게임은 다음 동기화 때 회수한다.
import { type Env, json, tossAuth, readPurchases, writePurchases } from '../_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const auth = request.headers.get('authorization') ?? '';
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: '권한 없음' }, 401);
  const { orderId, reason } = (await request.json().catch(() => ({}))) as { orderId?: string; reason?: string };
  if (!orderId) return json({ error: '잘못된 요청' }, 400);
  const raw = await env.ORDERS.get(`order:${orderId}`);
  if (!raw) return json({ error: '주문을 찾을 수 없음' }, 404);
  const order = JSON.parse(raw) as { status: string; paymentKey?: string; customerKey: string };
  if (order.status !== 'paid' || !order.paymentKey) return json({ error: '환불할 수 없는 주문' }, 400);
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${order.paymentKey}/cancel`, {
    method: 'POST',
    headers: { Authorization: tossAuth(env.TOSS_SECRET_KEY), 'Content-Type': 'application/json', 'Idempotency-Key': `cancel-${orderId}` },
    body: JSON.stringify({ cancelReason: reason ?? '고객 요청' }),
  });
  if (!res.ok) return json({ error: '토스 결제 취소 실패' }, 400);
  await env.ORDERS.put(`order:${orderId}`, JSON.stringify({ ...order, status: 'refunded', refundedAt: Date.now() }));
  const list = await readPurchases(env.ORDERS, order.customerKey);
  for (const p of list) if (p.orderId === orderId) p.status = 'refunded';
  await writePurchases(env.ORDERS, order.customerKey, list);
  return json({ ok: true });
};
