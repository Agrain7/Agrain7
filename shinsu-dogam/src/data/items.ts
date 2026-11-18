import type { ItemDef } from './types.ts';

export const ITEMS: Record<string, ItemDef> = {
  gold: { id: 'gold', name: '금화', kind: 'currency', desc: '동방 세계에서 두루 쓰이는 금화. 영물 진화에 쓰인다.', icon: 'gold' },
  spirit_stone: { id: 'spirit_stone', name: '영기석', kind: 'material', desc: '영물의 기운이 맺힌 푸른 돌. 진화와 수련(경험치)에 쓰인다.', icon: 'stone' },
  silk_thread: { id: 'silk_thread', name: '오색 비단실', kind: 'material', desc: '장식을 엮는 데 쓰는 비단실. (장식 제작은 추후 업데이트)', icon: 'silk' },
  moon_petal: { id: 'moon_petal', name: '월하 꽃잎', kind: 'collectible', desc: '달빛을 머금은 매화 꽃잎. 모으면 특별한 기록이 열린다.', icon: 'petal' },
  pearl_shard: { id: 'pearl_shard', name: '여의주 조각', kind: 'quest', desc: '청룡의 힘이 깃든 여의주의 조각. 3개를 모아 용신 사당에 바치자.', icon: 'pearl' },
  yakgwa: { id: 'yakgwa', name: '약과', kind: 'consumable', desc: '달콤한 전통 과자. 체력을 40% 회복한다. (메뉴 > 소지품)', icon: 'yakgwa' },
  lore_page: { id: 'lore_page', name: '고서 조각', kind: 'collectible', desc: '영물의 옛 이야기가 적힌 낡은 종이. 도감 기록이 늘어난다.', icon: 'page' },
};
