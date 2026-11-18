// Cloudflare Pages Functions 공용 (준비 상태 — 아직 배포/실결제 검증 안 됨)
// 필요한 바인딩/환경변수: TOSS_SECRET_KEY (시크릿), ORDERS (KV 또는 D1/Supabase로 교체 가능)
export interface Env {
  TOSS_SECRET_KEY: string;
  ORDERS: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> };
}

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
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export const tossAuth = (secret: string) => 'Basic ' + btoa(`${secret}:`);
