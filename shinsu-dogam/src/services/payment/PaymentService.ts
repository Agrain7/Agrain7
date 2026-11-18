// 결제 서비스.
// 현재 빌드: TestPaymentProvider — 실제 결제·청구가 일어나지 않는 "테스트 모드"이며, 구매 내역은 test=true로 표시된다.
// 실제 판매 단계: TossPaymentProvider + 서버 검증(functions/api/payments/*)을 연결한다. (사업자 등록·PG 계약·심사 후)
// 원칙: 클라이언트(브라우저) 저장만으로 유료 상품 소유권을 인정하지 않는다 → 실서비스에서는 서버의 구매 내역이 기준.
import type { ProductDef } from '../../data/types.ts';

export interface Order { orderId: string; productId: string; amount: number; orderName: string }
export interface PaymentResult { ok: boolean; orderId: string; test: boolean; message?: string }

export interface PaymentProvider {
  readonly mode: 'test' | 'live';
  createOrder(p: ProductDef): Promise<Order>;
  pay(order: Order): Promise<PaymentResult>;
  refund(orderId: string): Promise<{ ok: boolean; message?: string }>;
}

export class TestPaymentProvider implements PaymentProvider {
  readonly mode = 'test' as const;
  async createOrder(p: ProductDef): Promise<Order> {
    return { orderId: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, productId: p.id, amount: p.price, orderName: p.name };
  }
  async pay(order: Order): Promise<PaymentResult> {
    await new Promise((r) => setTimeout(r, 350));
    return { ok: true, orderId: order.orderId, test: true, message: '테스트 결제 완료 (실제 청구 없음)' };
  }
  async refund(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

/**
 * 토스페이먼츠 연동 골격 (아직 비활성).
 * 흐름: 상품 선택 → 서버 주문 생성(POST /api/orders) → Toss 결제창 → successUrl 리다이렉트
 *       → 서버 승인(POST /api/payments/confirm: 금액 검증 + Toss confirm API) → 서버가 소유권 기록 → 클라이언트는 서버 소유권 조회.
 * 클라이언트 키(test_ck_/live_ck_)만 브라우저에서 사용하고, 시크릿 키는 서버 환경변수(TOSS_SECRET_KEY)에만 둔다.
 */
export class TossPaymentProvider implements PaymentProvider {
  readonly mode = 'live' as const;
  constructor(private clientKey: string, private apiBase = '/api') {}
  async createOrder(p: ProductDef): Promise<Order> {
    const res = await fetch(`${this.apiBase}/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: p.id }) });
    if (!res.ok) throw new Error('주문 생성 실패');
    return res.json();
  }
  async pay(order: Order): Promise<PaymentResult> {
    // 실제 연동 시: Toss Payments JS SDK를 로드하고 requestPayment 호출 (공식 문서의 최신 SDK 버전 확인 필요).
    void this.clientKey;
    return { ok: false, orderId: order.orderId, test: false, message: '실결제는 아직 활성화되지 않았습니다.' };
  }
  async refund(orderId: string) {
    const res = await fetch(`${this.apiBase}/payments/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) });
    return { ok: res.ok };
  }
}

export const payments: PaymentProvider = new TestPaymentProvider();
