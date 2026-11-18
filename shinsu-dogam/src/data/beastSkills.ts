// 영물별 원거리 공격(공격 버튼: 적이 멀면 자동 발사)과 필살기
import type { MountId } from './types.ts';

export interface RangedDef {
  name: string;
  tex: string;
  tint?: number;
  /** 단계별(유체·성장체·각성체) 발사 수 */
  count: [number, number, number];
  speed: number;
  power: number;
  spread: number;
  /** 유도 (초당 회전 라디안) */
  homing?: number;
  pierce?: boolean;
  /** 맞으면 폭발 반경 */
  explode?: number;
  /** 포물선 (중력) */
  gravity?: number;
  /** 땅을 타고 나아감 */
  ground?: boolean;
  /** 맞은 뒤 근처 적에게 튀는 횟수 (단계별) */
  chain?: [number, number, number];
  scale?: number;
  cd: number;
  life?: number;
}

export const RANGED: Record<MountId, RangedDef> = {
  wolf: { name: '월광 참격', tex: 'fx_crescent', tint: 0xa8e6ff, count: [1, 1, 2], speed: 820, power: 0.9, spread: 0.16, pierce: true, cd: 0.5, life: 0.75 },
  hawk: { name: '깃털 표창', tex: 'fx_feather', count: [2, 3, 4], speed: 900, power: 0.55, spread: 0.22, homing: 2.6, cd: 0.42 },
  cheongryong: { name: '뇌운주', tex: 'fx_thunderball', count: [1, 1, 2], speed: 640, power: 1.0, spread: 0.2, homing: 3, chain: [0, 1, 2], cd: 0.55 },
  jujak: { name: '화염탄', tex: 'fx_fire', count: [1, 2, 3], speed: 720, power: 0.85, spread: 0.14, explode: 70, cd: 0.5 },
  baekho: { name: '금강 조파', tex: 'fx_clawwave', count: [1, 1, 1], speed: 700, power: 1.15, spread: 0, pierce: true, ground: true, cd: 0.6, life: 1.1 },
  hyeonmu: { name: '물방울 탄', tex: 'fx_water', count: [2, 3, 3], speed: 560, power: 0.6, spread: 0.36, cd: 0.5 },
  girin: { name: '서광구', tex: 'fx_light', count: [1, 2, 2], speed: 700, power: 0.8, spread: 0.2, homing: 4, cd: 0.5 },
  haetae: { name: '심판의 불덩이', tex: 'fx_fire', tint: 0xffd36a, count: [1, 1, 2], speed: 640, power: 1.4, spread: 0.12, gravity: 1300, explode: 110, scale: 1.3, cd: 0.7 },
  bonghwang: { name: '오색 깃털', tex: 'fx_feather', count: [2, 3, 5], speed: 860, power: 0.5, spread: 0.5, homing: 4.2, cd: 0.45 },
};

export interface UltDef { name: string; hanja: string; desc: string; color: number; ink: string }

export const ULTS: Record<MountId, UltDef> = {
  wolf: { name: '천랑 월광참', hanja: '天狼月光斬', desc: '달빛을 두르고 화면을 가로지르며 모든 적을 연속으로 벤다.', color: 0x8fd8ff, ink: '#1c3d66' },
  hawk: { name: '천공 깃털폭풍', hanja: '天空羽嵐', desc: '하늘 높이 솟아올라 깃털의 비를 쏟아붓는다.', color: 0xf3d58a, ink: '#3a2a16' },
  cheongryong: { name: '청룡 뇌우', hanja: '靑龍雷雨', desc: '먹구름을 부르고 번개 열두 줄기를 내리꽂는다.', color: 0x7fd6ff, ink: '#10324a' },
  jujak: { name: '주작 염화강림', hanja: '朱雀炎火降臨', desc: '불꽃 운석을 떨어뜨려 땅을 불바다로 만든다.', color: 0xff8a3c, ink: '#4a1206' },
  baekho: { name: '백호 금강포효', hanja: '白虎金剛咆哮', desc: '포효의 충격파와 함께 땅에서 쇠 칼날이 솟구친다.', color: 0xffe08a, ink: '#2a2a3a' },
  hyeonmu: { name: '현무 대해일', hanja: '玄武大海溢', desc: '거대한 해일로 앞의 적을 쓸어버리고 물의 결계를 두른다.', color: 0x6fd0e8, ink: '#0e2f36' },
  girin: { name: '기린 서광', hanja: '麒麟瑞光', desc: '하늘에서 빛기둥을 내려 적을 벌하고 체력을 모두 회복한다.', color: 0xfff1a8, ink: '#2f4a2a' },
  haetae: { name: '해태 심판화', hanja: '獬豸審判火', desc: '심판의 불기둥이 앞으로 연이어 솟아오른다.', color: 0xff6a3c, ink: '#3a1010' },
  bonghwang: { name: '봉황 천상광', hanja: '鳳凰天上光', desc: '날개를 펼쳐 오색 빛줄기로 모든 적을 꿰뚫고 축복을 내린다.', color: 0xffd0f0, ink: '#4a1a3a' },
};

/** 필살기 게이지 증가량 */
export const ULT_GAIN = { melee: 4, ranged: 2.2, kill: 7, hurt: 5 };
