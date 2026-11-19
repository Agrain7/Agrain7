// Cloudflare Pages Functions 공용 (판매 빌드 서버). 배포·실결제 검증은 아직 하지 않음 — docs/DEPLOYMENT.md
// 필요한 바인딩/환경변수 (Cloudflare 대시보드 → Pages → 설정):
//  - TOSS_SECRET_KEY  (Secret) 토스페이먼츠 시크릿 키 — 코드·저장소에 절대 넣지 않는다
//  - ADMIN_TOKEN      (Secret) 환불 처리용 관리자 토큰
//  - ORDERS           (KV 네임스페이스) 주문·구매 기록
export interface KVLike { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> }
export interface Env {
  TOSS_SECRET_KEY: string;
  ADMIN_TOKEN?: string;
  ORDERS: KVLike;
}

/** 계정당 하루 누적 결제 한도 (원, 미만). 토스 게임 업종 기준 안내 — 계약 시 재확인 */
export const DAILY_LIMIT = 50000;
/** 계정당 한 번만 살 수 있는 상품 */
export const ONCE_PER_ACCOUNT = new Set(['p_pkg_first', 'p_pass_premium']);

/** 구매 계정 키 (클라이언트 newCustomerKey 와 같은 형식) */
export const validCustomerKey = (k: unknown): k is string => typeof k === 'string' && /^SD[0-9A-Z]{10,40}$/.test(k);

/** 한국 시각 날짜 (하루 한도 계산) */
export const kstDay = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);

export interface Purchase { orderId: string; productId: string; amount: number; at: number; status: 'paid' | 'refunded' }
export async function readPurchases(kv: KVLike, customerKey: string): Promise<Purchase[]> {
  const raw = await kv.get(`ent:${customerKey}`);
  return raw ? (JSON.parse(raw) as Purchase[]) : [];
}
export async function writePurchases(kv: KVLike, customerKey: string, list: Purchase[]) {
  await kv.put(`ent:${customerKey}`, JSON.stringify(list));
}
export const paidToday = (list: Purchase[], t = Date.now()) => list.filter((p) => p.status === 'paid' && kstDay(p.at) === kstDay(t)).reduce((a, p) => a + p.amount, 0);

// 서버 기준 가격표 (클라이언트가 보낸 금액을 믿지 않는다) — src/data/products.ts 와 동기화 필요
export const SERVER_PRICES: Record<string, { amount: number; name: string }> = {
  p_skin_wolf_snow: { amount: 4900, name: '설원 늑대' },
  p_skin_hawk_ruby: { amount: 4900, name: '홍옥 매' },
  p_skin_wolf_obsidian: { amount: 7900, name: '흑요 늑대' },
  p_skin_hawk_indigo: { amount: 7900, name: '청람 매' },
  p_skin_cr_moon: { amount: 7900, name: '월광 청룡' },
  p_skin_cr_maehwa: { amount: 9900, name: '매화 청룡' },
  p_skin_cr_gold: { amount: 14900, name: '황금 청룡' },
  p_decor_knot: { amount: 1900, name: '전통 매듭' },
  p_decor_jade: { amount: 1900, name: '옥 장식' },
  p_trail_foot: { amount: 1900, name: '특별 발자국' },
  p_decor_bell: { amount: 3900, name: '금색 방울' },
  p_trail_cloud: { amount: 3900, name: '구름 꼬리' },
  p_trail_petal: { amount: 3900, name: '꽃잎 이동 효과' },
  p_decor_set: { amount: 5900, name: '장식 세트' },
  p_outfit_saekdong: { amount: 3900, name: '색동 한복' },
  p_outfit_winter: { amount: 3900, name: '겨울 털배자' },
  p_outfit_warrior: { amount: 5900, name: '무사 의상' },
  p_outfit_fairy: { amount: 7900, name: '선녀 의상' },
  p_outfit_royal: { amount: 9900, name: '궁중 예복' },
  p_pkg_first: { amount: 3900, name: '첫 모험 패키지' },
  p_pkg_decor: { amount: 9900, name: '영물 꾸미기 패키지' },
  p_pkg_special: { amount: 12900, name: '특별 영물 패키지' },
  p_pkg_premium: { amount: 19900, name: '프리미엄 컬렉션' },
  p_skin_baekho_snow: { amount: 9900, name: '설산 백호' },
  p_skin_jujak_lotus: { amount: 9900, name: '홍련 주작' },
  p_skin_bh_five: { amount: 14900, name: '오색 봉황' },
  p_skin_hm_jade: { amount: 7900, name: '청옥 현무' },
  p_skin_gr_sakura: { amount: 9900, name: '벚꽃 기린' },
  p_skin_ht_gold: { amount: 14900, name: '황금 해태' },
  p_pass_premium: { amount: 9900, name: '영물 수행록 프리미엄' },
  p_monthly: { amount: 4900, name: '달빛 정기권 (30일)' },
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export const tossAuth = (secret: string) => 'Basic ' + btoa(`${secret}:`);
