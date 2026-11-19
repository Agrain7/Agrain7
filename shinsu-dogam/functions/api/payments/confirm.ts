// POST /api/payments/confirm { paymentKey, orderId, amount }
// 1) 서버에 저장된 주문 금액과 비교 (위조 방지)  2) 이미 승인된 주문은 다시 지급하지 않음 (중복 방지)
// 3) 토스페이먼츠 승인 API (시크릿 키는 서버 환경변수)  4) 구매 기록 저장 → 클라이언트는 이 기록으로 지급·복구
// ⚠️ 토스 공식 문서로 엔드포인트·응답 형식을 다시 확인하고, 테스트 키로 실제 승인을 시험한 뒤 판매할 것.
import { type Env, json, tossAuth, readPurchases, writePurchases } from '../_shared.ts';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const body = (await request.json().catch(() => ({}))) as { paymentKey?: string; orderId?: string; amount?: number };
  if (!body.paymentKey || !body.orderId || typeof body.amount !== 'number') return json({ error: '잘못된 요청' }, 400);
  const raw = await env.ORDERS.get(`order:${body.orderId}`);
  if (!raw) return json({ error: '주문을 찾을 수 없음' }, 404);
  const order = JSON.parse(raw) as { amount: number; status: string; productId: string; customerKey: string; paidAt?: number };
  if (order.status === 'paid') return json({ ok: true, alreadyPaid: true, productId: order.productId, at: order.paidAt });
  if (order.amount !== body.amount) return json({ error: '결제 금액이 주문과 다름' }, 400);
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: tossAuth(env.TOSS_SECRET_KEY), 'Content-Type': 'application/json', 'Idempotency-Key': body.orderId },
    body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: body.amount }),
  });
  const result = (await res.json().catch(() => ({}))) as { status?: string; totalAmount?: number; orderId?: string; message?: string };
  if (!res.ok) return json({ error: result.message ?? '결제 승인 실패' }, 400);
  if (result.status && result.status !== 'DONE') return json({ error: `결제 상태: ${result.status}` }, 400);
  if (typeof result.totalAmount === 'number' && result.totalAmount !== order.amount) return json({ error: '승인 금액 불일치' }, 400);
  const paidAt = Date.now();
  await env.ORDERS.put(`order:${body.orderId}`, JSON.stringify({ ...order, status: 'paid', paymentKey: body.paymentKey, paidAt }));
  const list = await readPurchases(env.ORDERS, order.customerKey);
  if (!list.some((p) => p.orderId === body.orderId)) list.push({ orderId: body.orderId, productId: order.productId, amount: order.amount, at: paidAt, status: 'paid' });
  await writePurchases(env.ORDERS, order.customerKey, list);
  return json({ ok: true, productId: order.productId, at: paidAt });
};
