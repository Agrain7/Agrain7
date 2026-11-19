import type { QuestDef } from './types.ts';

export const QUESTS: QuestDef[] = [
  { id: 'q_first_steps', name: '첫걸음', desc: '영물을 타고 300m를 달려 보자.', goal: { type: 'distance', meters: 300 }, reward: { gold: 50, items: { yakgwa: 1 } } },
  { id: 'q_hunt', name: '산짐승 사냥', desc: '어둠에 물든 몬스터 5마리를 물리치자.', goal: { type: 'defeat', count: 5 }, reward: { gold: 80, items: { spirit_stone: 2 } } },
  { id: 'q_treasure', name: '숨은 보물', desc: '보물 상자 2개를 찾아 열자.', goal: { type: 'chest', count: 2 }, reward: { gold: 60, items: { spirit_stone: 1 } } },
  { id: 'q_hawk', name: '다친 매', desc: '월하산맥 1-2를 돌파하자.', goal: { type: 'clear', stage: '1-2' }, reward: { mount: 'hawk' } },
  { id: 'q_pearls', name: '용의 여의주', desc: '여의주 조각 3개를 모아 1-3의 용신 사당에 바치자.', goal: { type: 'collect', item: 'pearl_shard', count: 3 }, reward: { mount: 'cheongryong' }, requires: ['q_first_steps'] },
  { id: 'q_level10', name: '성장의 시작', desc: '영물 하나를 10레벨까지 키우자.', goal: { type: 'level', level: 10 }, reward: { gold: 150, items: { spirit_stone: 3 } } },
  { id: 'q_evolve', name: '첫 진화', desc: '영물 하나를 성장체로 진화시키자.', goal: { type: 'evolve', stage: 1 }, reward: { gold: 200 } },
  { id: 'q_sky', name: '구름 위로', desc: '월하산맥 1-4 비행 구간을 돌파하자.', goal: { type: 'clear', stage: '1-4' }, reward: { gold: 120, items: { spirit_stone: 2 } } },
  { id: 'q_boss', name: '월하산맥의 수호자', desc: '흑운 산군을 정화하자.', goal: { type: 'boss', boss: 'boss' }, reward: { gold: 500, items: { spirit_stone: 5 } } },
  { id: 'q_awaken', name: '각성', desc: '영물 하나를 각성체로 진화시키자.', goal: { type: 'evolve', stage: 2 }, reward: { gold: 800 } },
  // 2~6지역
  { id: 'q_unmu', name: '안개를 걷어 내다', desc: '운무협곡의 안개에 갇힌 기린을 정화하자.', goal: { type: 'boss', boss: 'boss_girin' }, reward: { gold: 600, items: { spirit_stone: 6 } } },
  { id: 'q_yonggung', name: '용궁의 수문', desc: '용궁 깊은 곳의 흑현무를 정화하자.', goal: { type: 'boss', boss: 'boss_hyeonmu' }, reward: { gold: 800, items: { spirit_stone: 8 } } },
  { id: 'q_jujak', name: '주작의 불씨', desc: '화염 계곡 4-3 "주작의 불씨 터"를 돌파하자.', goal: { type: 'clear', stage: '4-3' }, reward: { mount: 'jujak' } },
  { id: 'q_hwayeom', name: '꺼지지 않는 불', desc: '화염 계곡의 해태를 정화하자.', goal: { type: 'boss', boss: 'boss_haetae' }, reward: { gold: 1000, items: { spirit_stone: 10 } } },
  { id: 'q_bongnae', name: '빛의 귀환', desc: '봉래산의 봉황을 정화하자.', goal: { type: 'boss', boss: 'boss_bonghwang' }, reward: { gold: 1200, items: { spirit_stone: 12 } } },
  { id: 'q_final', name: '어둠의 근원', desc: '설원의 신전에서 흑룡을 정화하자.', goal: { type: 'boss', boss: 'boss_dragon' }, reward: { gold: 3000, items: { spirit_stone: 25, moon_petal: 20 } } },
  { id: 'q_all9', name: '신수도감 완성', desc: '영물 9종을 모두 동료로 맞이하자.', goal: { type: 'collect_mounts', count: 9 }, reward: { gold: 2000, items: { spirit_stone: 20 } } },
];
