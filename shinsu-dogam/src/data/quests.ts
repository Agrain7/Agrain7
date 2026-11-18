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
];
