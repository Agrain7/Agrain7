// 결제창에서 돌아왔을 때 (판매 빌드): 서버 승인 → 지급 → 주소 정리. 부팅 때 한 번.
// 성공: ?pay=success&paymentKey=…&orderId=…&amount=…   실패: ?pay=fail&code=…&message=…
import { payments, TossPaymentProvider } from './PaymentService.ts';
import { applyPurchase, syncPurchases } from '../../systems/purchase.ts';
import type { GameState } from '../../systems/state.ts';
import { productById } from '../../data/products.ts';
import { analytics } from '../analytics/Analytics.ts';

export interface PayNotice { ok: boolean; title: string; body: string }

export async function handlePaymentReturn(st: GameState): Promise<PayNotice | null> {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search);
  const kind = q.get('pay');
  if (!kind) return null;
  const clean = () => {
    const u = new URL(location.href);
    for (const k of ['pay', 'paymentKey', 'orderId', 'amount', 'paymentType', 'code', 'message']) u.searchParams.delete(k);
    history.replaceState(null, '', u.toString());
  };
  try {
    if (kind === 'fail') {
      analytics.track('purchase_fail', { code: q.get('code') ?? '' });
      return { ok: false, title: '결제가 완료되지 않았어요', body: q.get('message') ?? '결제를 취소했거나 오류가 있었습니다. 청구되지 않았습니다.' };
    }
    const paymentKey = q.get('paymentKey'), orderId = q.get('orderId'), amount = Number(q.get('amount'));
    if (!paymentKey || !orderId || !Number.isFinite(amount) || !(payments instanceof TossPaymentProvider)) return null;
    const r = await payments.confirm(paymentKey, orderId, amount);
    const p = productById(r.productId);
    applyPurchase(st, r.productId, orderId, amount, false, r.at ?? Date.now());
    st.save();
    analytics.track('purchase_success', { product: r.productId, price: amount, test: false });
    return { ok: true, title: `${p?.name ?? '상품'} 구매 완료!`, body: '구매한 꾸미기는 바로 장착했어요. (메뉴 > 상점에서 바꿔 낄 수 있어요)' };
  } catch (e) {
    return { ok: false, title: '결제 확인 중 문제가 생겼어요', body: `${(e as Error).message}\n청구가 되었다면 잠시 후 설정 > 구매 복구를 눌러 주세요.` };
  } finally {
    clean();
  }
}

/** 서버 구매 기록과 맞추기 (실결제 모드만) */
export async function syncWithServer(st: GameState) {
  if (payments.mode !== 'live') return null;
  const list = await payments.entitlements(st.data.account.customerKey);
  if (!list) return null;
  const r = syncPurchases(st, list);
  st.save();
  return r;
}
