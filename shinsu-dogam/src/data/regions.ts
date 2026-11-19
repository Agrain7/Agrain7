// 지역(지도) 정의. 1 월하산맥은 손으로 만든 구간(maps/wolha.ts), 2~6은 규칙 생성기(maps/generate.ts)로 만든다.
// 각 지역의 마지막 구간(x-6)에는 어둠에 물든 수호 영물이 있고, 정화하면 그 영물이 동료가 된다.
import type { MountId } from './types.ts';

export type ThemeKind = 'dusk' | 'night' | 'mist' | 'sea' | 'fire' | 'paradise' | 'snow';

export interface RegionDef {
  n: number;
  key: string;
  name: string;
  hanja: string;
  subtitle: string;
  intro: string;
  sky: ThemeKind;
  /** 지형·장식·몬스터에 곱하는 색 (지역 분위기) */
  groundTint: number;
  /** 'screen' 이면 밝게 덮는다 (설원: 눈 덮인 느낌) */
  groundMode?: 'multiply' | 'screen';
  monsterTint: number;
  moonTint: number;
  /** 보스 정화 시 동료가 되는 영물 */
  guardian: MountId | null;
  bossId: string;
  bossName: string;
  /** 생성기 특징 비율 */
  features: Partial<Record<Feature, number>>;
  /** 등장 몬스터 비율 (지상) */
  monsters: Partial<Record<string, number>>;
  /** 몬스터 강함 시작 단계 */
  tier0: number;
}

export type Feature = 'flat' | 'step' | 'gap' | 'bridge' | 'clouds' | 'block' | 'stairs' | 'hazard' | 'updraft';

export const REGIONS: RegionDef[] = [
  {
    n: 1, key: 'wolha', name: '월하산맥', hanja: '月下山脈', subtitle: '첫 번째 지역',
    intro: '달빛이 내려앉는 산맥. 어둠에 물든 수호신 흑운 산군을 정화하자.',
    sky: 'dusk', groundTint: 0xffffff, monsterTint: 0xffffff, moonTint: 0xffffff,
    guardian: 'baekho', bossId: 'boss', bossName: '흑운 산군', features: {}, monsters: {}, tier0: 0,
  },
  {
    n: 2, key: 'unmu', name: '운무협곡', hanja: '雲霧峽谷', subtitle: '두 번째 지역',
    intro: '구름과 안개가 흐르는 깊은 협곡. 구름 발판과 상승 기류를 타고 건너자.',
    sky: 'mist', groundTint: 0xf0f2ff, monsterTint: 0xe8ecff, moonTint: 0xfff6e0,
    guardian: 'girin', bossId: 'boss_girin', bossName: '안개에 갇힌 기린',
    features: { flat: 3, step: 2, gap: 2, clouds: 3, bridge: 2, updraft: 1, stairs: 1 },
    monsters: { boar: 3, dokkaebi: 3, fox: 2, bat: 2 }, tier0: 4,
  },
  {
    n: 3, key: 'yonggung', name: '용궁', hanja: '龍宮', subtitle: '세 번째 지역',
    intro: '바다 깊은 곳 용왕의 궁. 물기둥을 타고 산호 다리를 건너자.',
    sky: 'sea', groundTint: 0xd4f0f2, monsterTint: 0xc8ecf4, moonTint: 0xd8fbff,
    guardian: 'hyeonmu', bossId: 'boss_hyeonmu', bossName: '심해의 흑현무',
    features: { flat: 3, step: 2, gap: 2, bridge: 3, updraft: 2, block: 2, stairs: 2 },
    monsters: { boar: 3, dokkaebi: 2, fox: 3, rock: 1 }, tier0: 8,
  },
  {
    n: 4, key: 'hwayeom', name: '화염 계곡', hanja: '火焰溪谷', subtitle: '네 번째 지역',
    intro: '땅이 끓어오르는 붉은 계곡. 불길을 피해 뛰어넘자. 4-3을 지나면 주작이 기다린다.',
    sky: 'fire', groundTint: 0xffd6c0, monsterTint: 0xffc0a0, moonTint: 0xffc890,
    guardian: 'haetae', bossId: 'boss_haetae', bossName: '불길에 삼켜진 해태',
    features: { flat: 2, step: 3, gap: 3, hazard: 3, block: 2, stairs: 2, bridge: 1 },
    monsters: { boar: 3, dokkaebi: 3, fox: 2, rock: 2 }, tier0: 12,
  },
  {
    n: 5, key: 'bongnae', name: '봉래산', hanja: '蓬萊山', subtitle: '다섯 번째 지역',
    intro: '신선이 산다는 구름 위의 산. 하늘 높이 오르는 길이 이어진다.',
    sky: 'paradise', groundTint: 0xfff4e8, monsterTint: 0xfff0f0, moonTint: 0xffffff,
    guardian: 'bonghwang', bossId: 'boss_bonghwang', bossName: '빛을 잃은 봉황',
    features: { flat: 2, step: 2, clouds: 4, updraft: 3, stairs: 3, gap: 2, bridge: 1 },
    monsters: { boar: 2, dokkaebi: 2, fox: 3, bat: 3, rock: 1 }, tier0: 16,
  },
  {
    n: 6, key: 'seolwon', name: '설원의 신전', hanja: '雪原神殿', subtitle: '여섯 번째 지역',
    intro: '눈보라 너머 잊힌 신전. 모든 어둠의 근원, 흑룡이 잠들어 있다.',
    sky: 'snow', groundTint: 0x8c96ae, groundMode: 'screen', monsterTint: 0xdfeaff, moonTint: 0xf2f8ff,
    guardian: null, bossId: 'boss_dragon', bossName: '설원의 흑룡',
    features: { flat: 2, step: 3, gap: 3, hazard: 2, block: 2, stairs: 2, clouds: 2, bridge: 2, updraft: 1 },
    monsters: { boar: 3, dokkaebi: 3, fox: 3, rock: 2, bat: 2 }, tier0: 20,
  },
];

export const regionOf = (stageId: string) => REGIONS[Math.max(0, Number(stageId.split('-')[0]) - 1)] ?? REGIONS[0];
export const regionByN = (n: number) => REGIONS[n - 1];
