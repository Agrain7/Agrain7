// 상점 상품 (소비자가, 부가세 포함, 원). 모든 상품은 외형·꾸미기 전용이며 능력치를 바꾸지 않는다.
// available=false 상품은 해당 영물이 아직 획득 불가능하므로 '출시 예정'으로만 표시된다.
import type { ProductDef } from './types.ts';

export const PRODUCTS: ProductDef[] = [
  // 영물 스킨
  { id: 'p_skin_wolf_snow', name: '설원 늑대', category: 'skin', tier: '일반', price: 4900, mount: 'wolf', grants: ['skin_wolf_snow'], available: true, desc: '눈 덮인 산맥의 빛깔을 입은 늑대.' },
  { id: 'p_skin_hawk_ruby', name: '홍옥 매', category: 'skin', tier: '일반', price: 4900, mount: 'hawk', grants: ['skin_hawk_ruby'], available: true, desc: '붉은 옥처럼 빛나는 깃털.' },
  { id: 'p_skin_wolf_obsidian', name: '흑요 늑대', category: 'skin', tier: '희귀', price: 7900, mount: 'wolf', grants: ['skin_wolf_obsidian'], available: true, desc: '흑요석처럼 깊은 빛의 늑대.' },
  { id: 'p_skin_hawk_indigo', name: '청람 매', category: 'skin', tier: '희귀', price: 7900, mount: 'hawk', grants: ['skin_hawk_indigo'], available: true, desc: '쪽빛으로 물든 깃털.' },
  { id: 'p_skin_cr_moon', name: '월광 청룡', category: 'skin', tier: '희귀', price: 7900, mount: 'cheongryong', grants: ['skin_cheongryong_moon'], available: true, desc: '달빛을 머금은 은청색 비늘.' },
  { id: 'p_skin_cr_maehwa', name: '매화 청룡', category: 'skin', tier: '특별', price: 9900, mount: 'cheongryong', grants: ['skin_cheongryong_maehwa'], available: true, desc: '매화 꽃빛으로 물든 청룡.' },
  { id: 'p_skin_cr_gold', name: '황금 청룡', category: 'skin', tier: '프리미엄', price: 14900, mount: 'cheongryong', grants: ['skin_cheongryong_gold'], available: true, desc: '금빛 비늘이 빛나는 청룡.' },
  { id: 'p_skin_baekho_snow', name: '설산 백호', category: 'skin', tier: '특별', price: 9900, mount: 'baekho', grants: [], available: false, desc: '백호 획득 업데이트와 함께 출시 예정.' },
  { id: 'p_skin_jujak_lotus', name: '홍련 주작', category: 'skin', tier: '특별', price: 9900, mount: 'jujak', grants: [], available: false, desc: '주작 획득 업데이트와 함께 출시 예정.' },
  { id: 'p_skin_bh_five', name: '오색 봉황', category: 'skin', tier: '프리미엄', price: 14900, mount: 'bonghwang', grants: [], available: false, desc: '봉황 획득 업데이트와 함께 출시 예정.' },
  { id: 'p_skin_hm_jade', name: '청옥 현무', category: 'skin', tier: '희귀', price: 7900, mount: 'hyeonmu', grants: [], available: false, desc: '현무 획득 업데이트와 함께 출시 예정.' },
  // 장식
  { id: 'p_decor_knot', name: '전통 매듭', category: 'decor', tier: '단일', price: 1900, grants: ['decor_knot'], available: true, desc: '영물의 목에 다는 붉은 매듭.' },
  { id: 'p_decor_jade', name: '옥 장식', category: 'decor', tier: '단일', price: 1900, grants: ['decor_jade'], available: true, desc: '맑은 옥 노리개.' },
  { id: 'p_trail_foot', name: '특별 발자국', category: 'decor', tier: '단일', price: 1900, grants: ['trail_footprint'], available: true, desc: '달릴 때 빛나는 발자국이 남는다.' },
  { id: 'p_decor_bell', name: '금색 방울', category: 'decor', tier: '특별', price: 3900, grants: ['decor_bell'], available: true, desc: '달릴 때 반짝이는 금방울.' },
  { id: 'p_trail_cloud', name: '구름 꼬리', category: 'decor', tier: '특별', price: 3900, grants: ['trail_cloud'], available: true, desc: '지나간 자리에 구름이 피어난다.' },
  { id: 'p_trail_petal', name: '꽃잎 이동 효과', category: 'decor', tier: '특별', price: 3900, grants: ['trail_petal'], available: true, desc: '달리면 매화 꽃잎이 흩날린다.' },
  { id: 'p_decor_set', name: '장식 세트', category: 'decor', tier: '세트', price: 5900, grants: ['decor_knot', 'decor_jade', 'decor_bell'], available: true, desc: '매듭·옥·방울 장식 묶음.' },
  // 라이더 의상
  { id: 'p_outfit_saekdong', name: '색동 한복', category: 'outfit', tier: '일반', price: 3900, grants: ['outfit_saekdong'], available: true, desc: '오방색 색동 소매의 한복.' },
  { id: 'p_outfit_winter', name: '겨울 털배자 (계절)', category: 'outfit', tier: '일반', price: 3900, grants: ['outfit_winter'], available: true, desc: '털 배자를 덧입은 겨울 차림.' },
  { id: 'p_outfit_warrior', name: '무사 의상', category: 'outfit', tier: '희귀', price: 5900, grants: ['outfit_warrior'], available: true, desc: '날렵한 무사의 철릭 차림.' },
  { id: 'p_outfit_fairy', name: '선녀 의상', category: 'outfit', tier: '특별', price: 7900, grants: ['outfit_fairy'], available: true, desc: '날개옷 자락이 바람에 흩날린다.' },
  { id: 'p_outfit_royal', name: '궁중 예복', category: 'outfit', tier: '프리미엄', price: 9900, grants: ['outfit_royal'], available: true, desc: '금박 무늬의 화려한 예복.' },
  // 패키지
  { id: 'p_pkg_first', name: '첫 모험 패키지', category: 'package', tier: '패키지', price: 3900, grants: ['outfit_saekdong', 'decor_knot', 'trail_footprint'], available: true, oncePerAccount: true, desc: '색동 한복 + 전통 매듭 + 특별 발자국. 계정당 1회.' },
  { id: 'p_pkg_decor', name: '영물 꾸미기 패키지', category: 'package', tier: '패키지', price: 9900, grants: ['decor_knot', 'decor_jade', 'decor_bell', 'trail_cloud', 'trail_petal'], available: true, desc: '장식 세트 + 구름 꼬리 + 꽃잎 이동 효과.' },
  { id: 'p_pkg_special', name: '특별 영물 패키지', category: 'package', tier: '패키지', price: 12900, grants: ['skin_cheongryong_moon', 'outfit_fairy'], available: true, desc: '월광 청룡 스킨 + 선녀 의상.' },
  { id: 'p_pkg_premium', name: '프리미엄 컬렉션', category: 'package', tier: '패키지', price: 19900, grants: ['skin_cheongryong_gold', 'outfit_royal', 'decor_bell', 'trail_cloud'], available: true, desc: '황금 청룡 + 궁중 예복 + 금색 방울 + 구름 꼬리.' },
  // 탐험 패스 (추후)
  { id: 'p_pass_basic', name: '탐험 패스', category: 'pass', tier: '일반', price: 7900, grants: [], available: false, desc: '재방문율 검증 후 도입 예정.' },
  { id: 'p_pass_premium', name: '프리미엄 탐험 패스', category: 'pass', tier: '프리미엄', price: 12900, grants: [], available: false, desc: '재방문율 검증 후 도입 예정.' },
];

export function productById(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
