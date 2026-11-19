// 결제 서비스.
// - test (기본, 플레이테스트 페이지): 실제 청구 없음, 구매 내역 test=true
// - toss (판매 빌드: VITE_PAYMENT_MODE=toss + VITE_TOSS_CLIENT_KEY): 토스페이먼츠 결제창 → 서버 승인 → 서버 구매 기록
// 원칙: 클라이언트(브라우저) 저장만으로 유료 상품 소유권을 인정하지 않는다 → 실결제에서는 서버 구매 기록이 기준 (systems/purchase.ts syncPurchases).
// 비밀 키(TOSS_SECRET_KEY)는 서버 환경변수에만. 브라우저에는 클라이언트 키만.
import type { ProductDef } from '../../data/types.ts';
import type { ServerPurchase } from '../../systems/purchase.ts';

export interface Order { orderId: string; productId: string; amount: number; orderName: string }
export interface PaymentResult { ok: boolean; orderId: string; test: boolean; pending?: boolean; message?: string }

export interface PaymentProvider {
  readonly mode: 'test' | 'live';
  createOrder(p: ProductDef, customerKey: string): Promise<Order>;
  pay(order: Order, customerKey: string): Promise<PaymentResult>;
  refund(orderId: string): Promise<{ ok: boolean; message?: string }>;
  /** 서버 구매 기록 (실결제만) */
  entitlements(customerKey: string): Promise<ServerPurchase[] | null>;
}

type Env = Record<string, string | undefined>;
const env: Env = (import.meta as unknown as { env?: Env }).env ?? {};
export const PAYMENT_MODE: 'test' | 'toss' = env.VITE_PAYMENT_MODE === 'toss' ? 'toss' : 'test';
export const TOSS_CLIENT_KEY = env.VITE_TOSS_CLIENT_KEY ?? '';
export const API_BASE = env.VITE_API_BASE ?? 'api';

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
  async entitlements() {
    return null;
  }
}

// ---- 토스페이먼츠 결제창 (JavaScript SDK v2) ----
// ⚠️ 아래 SDK 주소·함수 이름·파라미터는 토스 공식 문서 기준으로 작성했으나, 이 개발 환경에서는 docs.tosspayments.com 에
// 접속할 수 없어 최신 문서로 다시 확인하지 못했다. 토스 테스트 키로 결제·실패·취소를 시험하면서 반드시 확인할 것.
const TOSS_SDK = 'https://js.tosspayments.com/v2/standard';
type TossPayment = { requestPayment(o: Record<string, unknown>): Promise<void> };
type TossFactory = (clientKey: string) => { payment(o: { customerKey: string }): TossPayment };

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
}

/** 결제창에서 돌아올 주소 (같은 페이지, 쿼리로 결과를 받는다) */
const returnUrl = (kind: 'success' | 'fail') => {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('pay', kind);
  return u.toString();
};

export class TossPaymentProvider implements PaymentProvider {
  readonly mode = 'live' as const;
  constructor(private clientKey: string, private apiBase = API_BASE) {}
  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiBase}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `서버 오류 (${res.status})`);
    return data;
  }
  async createOrder(p: ProductDef, customerKey: string): Promise<Order> {
    return this.post<Order>('orders', { productId: p.id, customerKey });
  }
  async pay(order: Order, customerKey: string): Promise<PaymentResult> {
    if (!this.clientKey) return { ok: false, orderId: order.orderId, test: false, message: '결제 키가 설정되지 않았습니다 (VITE_TOSS_CLIENT_KEY)' };
    await loadScript(TOSS_SDK);
    const TossPayments = (window as unknown as { TossPayments?: TossFactory }).TossPayments;
    if (!TossPayments) return { ok: false, orderId: order.orderId, test: false, message: '결제 모듈을 불러오지 못했습니다' };
    const payment = TossPayments(this.clientKey).payment({ customerKey });
    // 결제창으로 이동 → 끝나면 successUrl/failUrl 로 돌아와 handlePaymentReturn() 이 서버 승인을 요청한다
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: order.amount },
      orderId: order.orderId,
      orderName: order.orderName,
      successUrl: returnUrl('success'),
      failUrl: returnUrl('fail'),
    });
    return { ok: false, pending: true, orderId: order.orderId, test: false };
  }
  /** 환불은 고객센터에서 서버(관리자 키)로만 처리한다 — 게임 안 버튼으로는 요청 안내만 */
  async refund(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: '환불은 고객센터로 주문번호와 함께 요청해 주세요.' };
  }
  async entitlements(customerKey: string): Promise<ServerPurchase[] | null> {
    try {
      const res = await fetch(`${this.apiBase}/entitlements?customerKey=${encodeURIComponent(customerKey)}`);
      if (!res.ok) return null;
      const d = (await res.json()) as { purchases?: ServerPurchase[] };
      return d.purchases ?? [];
    } catch {
      return null;
    }
  }
  async confirm(paymentKey: string, orderId: string, amount: number) {
    return this.post<{ ok: boolean; productId: string; alreadyPaid?: boolean; at?: number }>('payments/confirm', { paymentKey, orderId, amount });
  }
}

export const payments: PaymentProvider = PAYMENT_MODE === 'toss' ? new TossPaymentProvider(TOSS_CLIENT_KEY) : new TestPaymentProvider();
export const isLive = () => payments.mode === 'live';
