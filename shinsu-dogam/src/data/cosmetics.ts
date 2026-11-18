// 꾸미기 아이템 정의 (능력치 변화 없음). 스킨은 원본 일러스트의 색조를 바꿔 표현한다.
import type { CosmeticDef } from './types.ts';

export const COSMETICS: Record<string, CosmeticDef> = {
  // 영물 스킨 (현재 빌드: 늑대·매·청룡)
  skin_cheongryong_maehwa: { id: 'skin_cheongryong_maehwa', kind: 'skin', name: '매화 청룡', mount: 'cheongryong', tint: { hue: 140, sat: 0.9, light: 1.06 } },
  skin_cheongryong_gold: { id: 'skin_cheongryong_gold', kind: 'skin', name: '황금 청룡', mount: 'cheongryong', tint: { hue: -150, sat: 1.25, light: 1.05 } },
  skin_cheongryong_moon: { id: 'skin_cheongryong_moon', kind: 'skin', name: '월광 청룡', mount: 'cheongryong', tint: { hue: 40, sat: 0.55, light: 1.1 } },
  skin_wolf_snow: { id: 'skin_wolf_snow', kind: 'skin', name: '설원 늑대', mount: 'wolf', tint: { hue: -15, sat: 0.6, light: 1.12 } },
  skin_wolf_obsidian: { id: 'skin_wolf_obsidian', kind: 'skin', name: '흑요 늑대', mount: 'wolf', tint: { hue: 0, sat: 0.35, light: 0.58 } },
  skin_hawk_ruby: { id: 'skin_hawk_ruby', kind: 'skin', name: '홍옥 매', mount: 'hawk', tint: { hue: -30, sat: 1.5, light: 1.0 } },
  skin_hawk_indigo: { id: 'skin_hawk_indigo', kind: 'skin', name: '청람 매', mount: 'hawk', tint: { hue: 180, sat: 1.2, light: 1.0 } },
  // 장식
  decor_knot: { id: 'decor_knot', kind: 'decor', name: '전통 매듭', slot: 'neck', color: '#c8352e' },
  decor_jade: { id: 'decor_jade', kind: 'decor', name: '옥 장식', slot: 'neck', color: '#4fb39a' },
  decor_bell: { id: 'decor_bell', kind: 'decor', name: '금색 방울', slot: 'neck', color: '#e3b14a' },
  trail_cloud: { id: 'trail_cloud', kind: 'trail', name: '구름 꼬리', slot: 'trail', color: '#f4ecd8' },
  trail_petal: { id: 'trail_petal', kind: 'trail', name: '꽃잎 이동 효과', slot: 'trail', color: '#f2a7bd' },
  trail_footprint: { id: 'trail_footprint', kind: 'trail', name: '특별 발자국', slot: 'foot', color: '#9be3ff' },
  // 라이더 의상
  outfit_default: { id: 'outfit_default', kind: 'outfit', name: '하람의 여행복', free: true },
  outfit_saekdong: { id: 'outfit_saekdong', kind: 'outfit', name: '색동 한복' },
  outfit_warrior: { id: 'outfit_warrior', kind: 'outfit', name: '무사 의상' },
  outfit_fairy: { id: 'outfit_fairy', kind: 'outfit', name: '선녀 의상' },
  outfit_royal: { id: 'outfit_royal', kind: 'outfit', name: '궁중 예복' },
  outfit_winter: { id: 'outfit_winter', kind: 'outfit', name: '겨울 털배자' },
};
