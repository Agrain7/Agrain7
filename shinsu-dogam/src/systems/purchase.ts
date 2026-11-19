// 구매 지급·환불·서버 기록 동기화 (Phaser와 독립 → 단위 테스트)
// 실결제 모드에서는 서버의 구매 기록이 기준이다: 브라우저 저장을 고쳐서 얻은 유료 꾸미기는 동기화 때 회수된다.
import type { GameState } from './state.ts';
import { PRODUCTS, productById } from '../data/products.ts';
import { COSMETICS } from '../data/cosmetics.ts';
import { LOGIN_REWARDS, passFree, passPremium } from './live.ts';

export interface ServerPurchase { orderId: string; productId: string; amount: number; at: number; status: 'paid' | 'refunded' }

const DAY = 86400_000;
export const MONTHLY_DAYS = 30;

/** 결제가 끝난 상품을 지급하고 바로 장착. 같은 주문을 두 번 지급하지 않는다 */
export function applyPurchase(st: GameState, productId: string, orderId: string, amount: number, test: boolean, at = Date.now()) {
  const p = productById(productId);
  if (!p) return { ok: false as const, equipped: [] as string[], needMount: [] as string[] };
  if (st.data.purchases.some((x) => x.orderId === orderId)) return { ok: false as const, equipped: [], needMount: [] };
  st.grantCosmetics(p.grants);
  if (p.effect === 'pass_premium') st.data.pass.premium = true;
  if (p.effect === 'monthly') {
    st.data.monthly.until = Math.max(st.data.monthly.until, at) + MONTHLY_DAYS * DAY;
    st.addItem('spirit_stone', 10);
  }
  st.data.purchases.push({ orderId, productId, price: amount, at, test, status: 'paid' });
  const eq = st.autoEquip(p.grants);
  return { ok: true as const, equipped: eq.equipped, needMount: eq.needMount as string[] };
}

/** 환불된 주문의 아이템 회수 (다른 유효 구매·무료 보상으로도 얻은 것은 남김) */
export function revokePurchase(st: GameState, orderId: string) {
  const pc = st.data.purchases.find((x) => x.orderId === orderId);
  if (!pc || pc.status === 'refunded') return false;
  pc.status = 'refunded';
  const p = productById(pc.productId);
  const keep = earnedFree(st);
  for (const x of st.data.purchases) if (x.status === 'paid') for (const g of productById(x.productId)?.grants ?? []) keep.add(g);
  st.revokeCosmetics((p?.grants ?? []).filter((g) => !keep.has(g)));
  if (p?.effect === 'pass_premium' && !st.data.purchases.some((x) => x.status === 'paid' && x.productId === pc.productId)) st.data.pass.premium = false;
  return true;
}

/** 무료로(출석·수행록) 정당하게 얻은 꾸미기 */
function earnedFree(st: GameState): Set<string> {
  const s = new Set<string>();
  if (st.data.daily.loginDays >= 7) for (const r of LOGIN_REWARDS) for (const c of r.cosmetics ?? []) s.add(c);
  for (const lv of st.data.pass.free) for (const c of passFree(lv).cosmetics ?? []) s.add(c);
  if (st.data.pass.premium) for (const lv of st.data.pass.prem) for (const c of passPremium(lv).cosmetics ?? []) s.add(c);
  for (const [id, def] of Object.entries(COSMETICS)) if (def.free) s.add(id);
  return s;
}

/**
 * 서버 구매 기록으로 맞추기 (실결제 모드, 부팅·구매 복구 때).
 * - 서버에 있는 결제는 모두 지급 (다른 기기·지워진 저장 복구)
 * - 서버에서 환불된 주문은 회수
 * - 서버 기록에 없는 유료 꾸미기·수행록 프리미엄·정기권은 회수 (브라우저 저장 조작 방지)
 */
export function syncPurchases(st: GameState, server: ServerPurchase[]) {
  const paid = server.filter((x) => x.status === 'paid');
  // 1) 정기권·수행록은 서버 기록으로 다시 계산
  st.data.pass.premium = paid.some((x) => productById(x.productId)?.effect === 'pass_premium');
  let until = 0;
  for (const x of paid.filter((y) => productById(y.productId)?.effect === 'monthly').sort((a, b) => a.at - b.at)) until = Math.max(until, x.at) + MONTHLY_DAYS * DAY;
  const hadMonthly = st.data.purchases.some((x) => x.status === 'paid' && productById(x.productId)?.effect === 'monthly');
  st.data.monthly.until = until;
  // 2) 구매 내역을 서버 기준으로 다시 쓴다 (테스트 결제 기록은 지움)
  const before = new Set(st.data.purchases.filter((x) => x.status === 'paid').map((x) => x.orderId));
  st.data.purchases = server.map((x) => ({ orderId: x.orderId, productId: x.productId, price: x.amount, at: x.at, test: false, status: x.status }));
  // 3) 꾸미기: 허용 목록 = 서버 결제 지급품 ∪ 무료로 얻은 것
  const allowed = earnedFree(st);
  for (const x of paid) for (const g of productById(x.productId)?.grants ?? []) allowed.add(g);
  const paidOnly = new Set(PRODUCTS.flatMap((p) => p.grants));
  const remove = st.data.cosmetics.owned.filter((c) => paidOnly.has(c) && !allowed.has(c));
  if (remove.length) st.revokeCosmetics(remove);
  const add = [...allowed].filter((c) => paidOnly.has(c) && !st.data.cosmetics.owned.includes(c));
  if (add.length) { st.grantCosmetics(add); st.autoEquip(add); }
  // 새로 복구된 정기권이면 즉시 지급분(영기석 10)도
  const restored = paid.filter((x) => !before.has(x.orderId));
  if (!hadMonthly) for (const x of restored) if (productById(x.productId)?.effect === 'monthly') st.addItem('spirit_stone', 10);
  return { removed: remove, added: add, restored: restored.length };
}
