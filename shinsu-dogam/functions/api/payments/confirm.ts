// POST /api/payments/confirm { paymentKey, orderId, amount }
// 1) 서버에 저장된 주문 금액과 요청 금액 비교 (위조 방지)  2) 이미 승인된 주문이면 재지급 금지 (중복 방지)
// 3) 토스페이먼츠 승인 API 호출 (시크릿 키는 서버 환경변수)  4) 결과 저장 → 소유권 부여
// 준비 상태: 토스 테스트 키로 실제 호출 검증을 하지 않았다. 출시 전 공식 문서로 엔드포인트·응답 형식을 재확인할 것.
import { type Env, json, tossAuth } from '../_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const body = (await request.json().catch(() => ({}))) as { paymentKey?: string; orderId?: string; amount?: number };
  if (!body.paymentKey || !body.orderId || typeof body.amount !== 'number') return json({ error: 'bad request' }, 400);
  const raw = await env.ORDERS.get(body.orderId);
  if (!raw) return json({ error: 'order not found' }, 404);
  const order = JSON.parse(raw) as { amount: number; status: string; productId: string };
  if (order.status === 'paid') return json({ ok: true, alreadyPaid: true });
  if (order.amount !== body.amount) return json({ error: 'amount mismatch' }, 400);
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: tossAuth(env.TOSS_SECRET_KEY), 'Content-Type': 'application/json', 'Idempotency-Key': body.orderId },
    body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: body.amount }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: 'confirm failed', detail: result }, 400);
  await env.ORDERS.put(body.orderId, JSON.stringify({ ...order, status: 'paid', paymentKey: body.paymentKey, paidAt: Date.now() }));
  return json({ ok: true, productId: order.productId });
};
