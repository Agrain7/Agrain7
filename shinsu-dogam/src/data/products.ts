// 상점 상품 (소비자가, 부가세 포함, 원). 확률형 없음 — 모두 정해진 보상.
// 외형·꾸미기 상품 + 수행록 프리미엄·달빛 정기권(영기석 포함: 성장 시간 단축, docs/ECONOMY_DESIGN.md 2.5절).
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
  { id: 'p_skin_baekho_snow', name: '설산 백호', category: 'skin', tier: '특별', price: 9900, mount: 'baekho', grants: ['skin_baekho_snow'], available: true, desc: '눈빛 털을 두른 백호. (월하산맥 1-6 정화 후 장착)' },
  { id: 'p_skin_jujak_lotus', name: '홍련 주작', category: 'skin', tier: '특별', price: 9900, mount: 'jujak', grants: ['skin_jujak_lotus'], available: true, desc: '붉은 연꽃빛 깃털의 주작.' },
  { id: 'p_skin_bh_five', name: '오색 봉황', category: 'skin', tier: '프리미엄', price: 14900, mount: 'bonghwang', grants: ['skin_bonghwang_five'], available: true, desc: '오방색으로 빛나는 봉황.' },
  { id: 'p_skin_hm_jade', name: '청옥 현무', category: 'skin', tier: '희귀', price: 7900, mount: 'hyeonmu', grants: ['skin_hyeonmu_jade'], available: true, desc: '푸른 옥빛 등껍질의 현무.' },
  { id: 'p_skin_gr_sakura', name: '벚꽃 기린', category: 'skin', tier: '특별', price: 9900, mount: 'girin', grants: ['skin_girin_sakura'], available: true, desc: '벚꽃빛 갈기의 기린.' },
  { id: 'p_skin_ht_gold', name: '황금 해태', category: 'skin', tier: '프리미엄', price: 14900, mount: 'haetae', grants: ['skin_haetae_gold'], available: true, desc: '금빛 갈기의 해태.' },
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
  // 수행록·정기권 (확률 없이 정해진 보상)
  { id: 'p_pass_premium', name: '영물 수행록 프리미엄', category: 'pass', tier: '시즌', price: 9900, grants: [], effect: 'pass_premium', available: true, oncePerAccount: true,
    desc: '이번 시즌 수행록의 프리미엄 보상(30단계)을 모두 열어요. 한정 스킨 월광 백호·월광 늑대, 의상·장식, 영기석. 이미 오른 단계 보상도 받을 수 있어요.' },
  { id: 'p_monthly', name: '달빛 정기권 (30일)', category: 'pass', tier: '정기권', price: 4900, grants: [], effect: 'monthly', available: true,
    desc: '바로 영기석 10, 30일 동안 매일 접속하면 영기석 3·금화 100. (자동 결제 아님)' },
];

export function productById(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
