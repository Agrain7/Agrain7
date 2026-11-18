// 9종 영물 데이터. 새 영물은 이 파일에 데이터만 추가하면 공통 시스템(이동·전투·성장·도감)이 처리한다.
import type { MountDef, MovementProfile, StageDef, SkillDef, MountId } from './types.ts';

const mv = (o: Partial<MovementProfile> & Pick<MovementProfile, 'runSpeed' | 'jumpVelocity'>): MovementProfile => ({
  accel: 2400,
  decel: 2800,
  airAccel: 1700,
  airJumps: 0,
  dash: { speed: 720, time: 0.18, cooldown: 0.9, air: true },
  ...o,
});

const STAGE_NAMES = ['유체', '성장체', '각성체'] as const;
const LEVELS = [1, 10, 30];
const EVOLVE = [undefined, { spiritStone: 5, gold: 200 }, { spiritStone: 20, gold: 1200 }];

function stages(defs: Omit<StageDef, 'stage' | 'name' | 'minLevel' | 'evolveCost'>[]): [StageDef, StageDef, StageDef] {
  return defs.map((d, i) => ({ ...d, stage: i as 0 | 1 | 2, name: STAGE_NAMES[i], minLevel: LEVELS[i], evolveCost: EVOLVE[i] })) as [StageDef, StageDef, StageDef];
}

// ---------------- 기술 ----------------
export const SKILLS: Record<string, SkillDef> = {
  // 공통 기본 공격
  bite: { id: 'bite', name: '물기', kind: 'melee', desc: '앞의 적을 문다.', power: 1, cooldown: 0.34, fx: 'bite', range: 70, knockback: 160 },
  claw: { id: 'claw', name: '할퀴기', kind: 'melee', desc: '날카로운 발톱으로 벤다.', power: 1, cooldown: 0.32, fx: 'claw', range: 78, knockback: 170 },
  peck: { id: 'peck', name: '발톱 낚아채기', kind: 'melee', desc: '부리와 발톱으로 빠르게 공격한다.', power: 0.9, cooldown: 0.26, fx: 'peck', range: 66, knockback: 120 },
  horn: { id: 'horn', name: '뿔 받기', kind: 'melee', desc: '뿔로 들이받는다.', power: 1.05, cooldown: 0.36, fx: 'horn', range: 74, knockback: 220 },
  // 늑대
  galeClaw: { id: 'galeClaw', name: '질풍 할퀴기', kind: 'melee', desc: '넓게 휘두르는 2연속 할퀴기.', power: 1.7, cooldown: 2.6, fx: 'slash', range: 110, knockback: 260 },
  moonHowl: { id: 'moonHowl', name: '월광 포효', kind: 'aoe', desc: '달빛 포효로 주변 적을 밀쳐낸다.', power: 1.5, cooldown: 4.5, fx: 'howl', radius: 190, knockback: 420 },
  blueFlameSoul: { id: 'blueFlameSoul', name: '청염 늑대혼', kind: 'dashStrike', desc: '푸른 영기 불꽃이 되어 적을 꿰뚫고 질주한다.', power: 2.3, cooldown: 5.5, fx: 'spirit', range: 380, duration: 0.32 },
  // 매
  featherShot: { id: 'featherShot', name: '깃털 날리기', kind: 'projectile', desc: '날카로운 깃털 3개를 부채꼴로 날린다.', power: 0.8, cooldown: 1.8, fx: 'feather', count: 3, spread: 0.32, speed: 760 },
  galeFeathers: { id: 'galeFeathers', name: '질풍 깃털', kind: 'projectile', desc: '깃털 5개를 넓게 날린다.', power: 0.85, cooldown: 1.8, fx: 'feather', count: 5, spread: 0.5, speed: 820 },
  skyDive: { id: 'skyDive', name: '급강하', kind: 'dive', desc: '공중에서 땅으로 내리꽂혀 충격파를 일으킨다. (지상에서는 질풍 깃털)', power: 2.4, cooldown: 3.5, fx: 'shock', radius: 150, speed: 1100, airAlt: 'skyDive' },
  // 청룡
  waterSpit: { id: 'waterSpit', name: '물방울 숨결', kind: 'projectile', desc: '작은 물방울 탄을 뱉는다.', power: 1.2, cooldown: 1.6, fx: 'water', count: 1, speed: 700 },
  blueThunder: { id: 'blueThunder', name: '청뢰', kind: 'lightning', desc: '앞쪽의 적 2마리에게 번개를 내린다.', power: 1.9, cooldown: 3.0, fx: 'thunder', range: 560, count: 2 },
  dragonBreath: { id: 'dragonBreath', name: '용의 숨결', kind: 'beam', desc: '앞으로 청백의 숨결을 내뿜어 계속 피해를 준다. (공중에서는 광역 번개)', power: 0.55, cooldown: 4.0, fx: 'breath', range: 330, duration: 1.0, airAlt: 'stormCall' },
  stormCall: { id: 'stormCall', name: '광역 번개', kind: 'lightning', desc: '화면의 적 최대 6마리에게 번개를 내린다.', power: 2.0, cooldown: 4.0, fx: 'thunder', range: 900, count: 6 },
  // 주작
  emberShot: { id: 'emberShot', name: '불씨', kind: 'projectile', desc: '불꽃 탄을 날린다.', power: 1.3, cooldown: 1.6, fx: 'fire', count: 1, speed: 680 },
  flameRush: { id: 'flameRush', name: '화염 돌진', kind: 'dashStrike', desc: '불길이 되어 돌진한다.', power: 2.0, cooldown: 4.5, fx: 'fire', range: 320, duration: 0.28 },
  flameBurst: { id: 'flameBurst', name: '염화 폭발', kind: 'aoe', desc: '주변을 불꽃으로 터뜨린다.', power: 2.4, cooldown: 5, fx: 'fire', radius: 220, knockback: 300 },
  // 백호
  heavyClaw: { id: 'heavyClaw', name: '발톱 일격', kind: 'melee', desc: '묵직한 일격.', power: 2.0, cooldown: 2.2, fx: 'slash', range: 110, knockback: 360 },
  tigerLeap: { id: 'tigerLeap', name: '맹호 도약', kind: 'dive', desc: '높이 도약해 내려찍는다.', power: 2.2, cooldown: 4, fx: 'shock', radius: 160, speed: 1000 },
  metalShock: { id: 'metalShock', name: '금강 충격파', kind: 'aoe', desc: '쇠의 기운으로 넓은 충격파를 일으킨다.', power: 2.6, cooldown: 5, fx: 'shock', radius: 260, knockback: 460 },
  // 현무
  waterShield: { id: 'waterShield', name: '물의 보호막', kind: 'shield', desc: '잠시 받는 피해를 크게 줄인다.', power: 0, cooldown: 7, fx: 'shield', duration: 4, amount: 0.6 },
  tideShot: { id: 'tideShot', name: '물살', kind: 'projectile', desc: '물살 3줄기를 쏜다.', power: 1.0, cooldown: 2, fx: 'water', count: 3, spread: 0.25, speed: 620 },
  blackTortoiseWard: { id: 'blackTortoiseWard', name: '현무 결계', kind: 'aoe', desc: '물의 결계로 주변을 밀어내고 보호막을 두른다.', power: 1.8, cooldown: 6, fx: 'water', radius: 220, knockback: 380, amount: 0.5, duration: 3 },
  // 기린
  natureBreath: { id: 'natureBreath', name: '자연의 기운', kind: 'heal', desc: '체력을 회복한다.', power: 0, cooldown: 8, fx: 'heal', amount: 0.2 },
  auspiciousLight: { id: 'auspiciousLight', name: '서기 광채', kind: 'projectile', desc: '상서로운 빛 구슬을 쏜다.', power: 1.4, cooldown: 1.8, fx: 'light', count: 1, speed: 720 },
  lifeLight: { id: 'lifeLight', name: '생명의 빛', kind: 'heal', desc: '크게 회복하고 주변 적에게 빛 피해를 준다.', power: 1.4, cooldown: 8, fx: 'heal', amount: 0.35, radius: 200 },
  // 해태
  guardStance: { id: 'guardStance', name: '수호의 자세', kind: 'shield', desc: '피해를 줄이고 밀려나지 않는다.', power: 0, cooldown: 6, fx: 'shield', duration: 3, amount: 0.5 },
  judgeRush: { id: 'judgeRush', name: '심판 돌진', kind: 'dashStrike', desc: '정의의 돌진.', power: 2.1, cooldown: 4.5, fx: 'horn', range: 300, duration: 0.3 },
  haetaeJudgement: { id: 'haetaeJudgement', name: '해태의 심판', kind: 'aoe', desc: '넓은 범위에 심판의 불꽃을 내린다.', power: 2.8, cooldown: 6, fx: 'fire', radius: 280, knockback: 420 },
  // 봉황
  lightFeathers: { id: 'lightFeathers', name: '빛 깃털', kind: 'projectile', desc: '빛나는 깃털 3개를 날린다.', power: 0.9, cooldown: 1.8, fx: 'light', count: 3, spread: 0.3, speed: 760 },
  blessing: { id: 'blessing', name: '축복', kind: 'heal', desc: '체력을 회복한다.', power: 0, cooldown: 8, fx: 'heal', amount: 0.25 },
  heavenlyLight: { id: 'heavenlyLight', name: '천상의 빛', kind: 'aoe', desc: '넓은 빛의 폭발로 적을 공격하고 체력을 회복한다.', power: 2.4, cooldown: 6, fx: 'light', radius: 280, knockback: 300, amount: 0.2 },
};

// ---------------- 영물 ----------------
export const MOUNTS: Record<MountId, MountDef> = {
  wolf: {
    id: 'wolf', name: '늑대', hanja: '月下狼', title: '월하의 질주자', category: 'basic', element: '바람', symbol: '들판', color: '#6f9bd1',
    obtainable: true, acquisition: '처음부터 함께하는 영물.',
    lore: '달빛이 흐르는 밤이면 산마루를 달리는 은빛 늑대. 탐험가의 첫 길동무가 되어 준다. 자라면 푸른 영기 불꽃이 갈기에 피어난다.',
    base: { hp: 100, atk: 12, def: 4 }, growth: { hp: 12, atk: 2.2, def: 0.8 },
    stages: stages([
      { movement: mv({ runSpeed: 330, jumpVelocity: 760 }), attack: 'bite', special: 'galeClaw', abilities: ['빠른 지상 질주', '점프', '돌진'], body: { w: 64, h: 52 } },
      { movement: mv({ runSpeed: 370, jumpVelocity: 780, airJumps: 1, airJumpVelocity: 680 }), attack: 'claw', special: 'moonHowl', abilities: ['더 빠른 질주', '이단 점프', '월광 포효'], body: { w: 76, h: 60 } },
      { movement: mv({ runSpeed: 410, jumpVelocity: 800, airJumps: 1, airJumpVelocity: 720, dash: { speed: 900, time: 0.22, cooldown: 0.7, air: true, damage: 0.8 } }), attack: 'claw', special: 'blueFlameSoul', abilities: ['최고 속도 질주', '이단 점프', '공격 돌진', '청염 늑대혼'], body: { w: 88, h: 66 } },
    ]),
  },
  hawk: {
    id: 'hawk', name: '매', hanja: '靑雲鷹', title: '청운의 사냥꾼', category: 'basic', element: '하늘', symbol: '하늘', color: '#8a6a4a',
    obtainable: true, acquisition: '월하산맥 1-2를 돌파하면 다친 매가 동료가 된다.',
    lore: '구름 위를 맴도는 매. 바람을 타는 법을 알아 높은 절벽 너머로 탐험가를 데려간다.',
    base: { hp: 85, atk: 11, def: 3 }, growth: { hp: 10, atk: 2.0, def: 0.6 },
    stages: stages([
      { movement: mv({ runSpeed: 280, jumpVelocity: 700, glide: { fallSpeed: 120, speedBonus: 1.15 } }), attack: 'peck', special: 'featherShot', abilities: ['활공 (점프 키 유지)', '깃털 날리기'], body: { w: 56, h: 50 } },
      { movement: mv({ runSpeed: 300, jumpVelocity: 720, airJumps: 2, airJumpVelocity: 560, glide: { fallSpeed: 95, speedBonus: 1.25 } }), attack: 'peck', special: 'galeFeathers', abilities: ['활공', '날갯짓 2회', '공중 회피'], body: { w: 64, h: 54 } },
      { movement: mv({ runSpeed: 320, jumpVelocity: 740, airJumps: 4, airJumpVelocity: 580, glide: { fallSpeed: 70, speedBonus: 1.35 } }), attack: 'peck', special: 'skyDive', abilities: ['장시간 활공', '날갯짓 4회', '급강하', '높은 지역 접근'], body: { w: 76, h: 60 } },
    ]),
  },
  cheongryong: {
    id: 'cheongryong', name: '청룡', hanja: '靑龍', title: '동방의 구름 군주', category: 'legend', element: '번개', symbol: '동쪽', color: '#2b8fa6',
    obtainable: true, acquisition: '월하산맥에 흩어진 여의주 조각 3개를 모아 1-3의 용신 사당에 바친다.',
    lore: '동쪽 하늘의 구름과 비, 번개를 다스리던 용. 기운을 잃고 작은 몸으로 잠들어 있었다. 자라날수록 하늘을 되찾는다.',
    base: { hp: 110, atk: 14, def: 5 }, growth: { hp: 14, atk: 2.6, def: 0.9 },
    stages: stages([
      { movement: mv({ runSpeed: 300, jumpVelocity: 740 }), attack: 'bite', special: 'waterSpit', abilities: ['지상 달리기', '기본 점프', '물기', '물방울 숨결'], body: { w: 64, h: 54 } },
      { movement: mv({ runSpeed: 330, jumpVelocity: 780, airJumps: 1, airJumpVelocity: 640, glide: { fallSpeed: 150, speedBonus: 1.2, maxTime: 1.4 } }), attack: 'bite', special: 'blueThunder', abilities: ['강화된 점프', '짧은 활공', '번개 공격 (청뢰)'], body: { w: 84, h: 60 } },
      { movement: mv({ runSpeed: 360, jumpVelocity: 800, flight: { speed: 420, vertSpeed: 360 }, dash: { speed: 980, time: 0.22, cooldown: 0.7, air: true, damage: 1.0 } }), attack: 'bite', special: 'dragonBreath', abilities: ['자유 비행', '용의 숨결', '공중 돌진', '광역 번개'], body: { w: 110, h: 66 } },
    ]),
  },
  jujak: {
    id: 'jujak', name: '주작', hanja: '朱雀', title: '남쪽의 불꽃 새', category: 'legend', element: '불', symbol: '남쪽', color: '#d2452f',
    obtainable: false, acquisition: '화염 계곡 지역에서 획득 (추후 업데이트).',
    lore: '남쪽 하늘을 지키는 불의 새. 날갯짓마다 불씨가 흩날리며, 싸움에 나서면 전장의 열기를 다스린다.',
    base: { hp: 95, atk: 16, def: 3 }, growth: { hp: 11, atk: 2.9, def: 0.6 },
    stages: stages([
      { movement: mv({ runSpeed: 290, jumpVelocity: 720, glide: { fallSpeed: 130, speedBonus: 1.15 } }), attack: 'peck', special: 'emberShot', abilities: ['활공', '불씨'], body: { w: 56, h: 52 } },
      { movement: mv({ runSpeed: 310, jumpVelocity: 740, airJumps: 2, airJumpVelocity: 560, glide: { fallSpeed: 100, speedBonus: 1.25 } }), attack: 'peck', special: 'flameRush', abilities: ['날갯짓 2회', '화염 돌진'], body: { w: 70, h: 58 } },
      { movement: mv({ runSpeed: 330, jumpVelocity: 760, flight: { speed: 400, vertSpeed: 340 } }), attack: 'peck', special: 'flameBurst', abilities: ['자유 비행', '염화 폭발'], body: { w: 90, h: 64 } },
    ]),
  },
  baekho: {
    id: 'baekho', name: '백호', hanja: '白虎', title: '서쪽의 강철 맹수', category: 'legend', element: '쇠', symbol: '서쪽', color: '#d9dce6',
    obtainable: false, acquisition: '설원의 신전 지역에서 획득 (추후 업데이트).',
    lore: '서쪽 산맥을 지키는 흰 호랑이. 쇠처럼 단단한 발톱과 한 번의 도약으로 산을 넘는 힘을 지녔다.',
    base: { hp: 120, atk: 15, def: 6 }, growth: { hp: 14, atk: 2.7, def: 1.0 },
    stages: stages([
      { movement: mv({ runSpeed: 340, jumpVelocity: 820 }), attack: 'claw', special: 'heavyClaw', abilities: ['빠른 달리기', '강한 도약'], body: { w: 66, h: 54 } },
      { movement: mv({ runSpeed: 380, jumpVelocity: 880, airJumps: 1, airJumpVelocity: 700 }), attack: 'claw', special: 'tigerLeap', abilities: ['이단 도약', '맹호 도약'], body: { w: 86, h: 62 } },
      { movement: mv({ runSpeed: 420, jumpVelocity: 900, airJumps: 1, airJumpVelocity: 740, dash: { speed: 940, time: 0.22, cooldown: 0.7, air: true, damage: 1.0 } }), attack: 'claw', special: 'metalShock', abilities: ['돌진', '금강 충격파'], body: { w: 110, h: 70 } },
    ]),
  },
  hyeonmu: {
    id: 'hyeonmu', name: '현무', hanja: '玄武', title: '북쪽의 물의 수호자', category: 'legend', element: '물', symbol: '북쪽', color: '#2f5e57',
    obtainable: false, acquisition: '용궁 지역에서 획득 (추후 업데이트).',
    lore: '거북과 뱀이 한 몸을 이룬 북쪽의 수호신. 느리지만 어떤 공격도 막아 내는 등껍질을 지녔다.',
    base: { hp: 150, atk: 11, def: 10 }, growth: { hp: 18, atk: 2.0, def: 1.6 },
    stages: stages([
      { movement: mv({ runSpeed: 240, jumpVelocity: 680, accel: 1600 }), attack: 'bite', special: 'waterShield', abilities: ['높은 방어력', '물의 보호막'], body: { w: 66, h: 46 } },
      { movement: mv({ runSpeed: 260, jumpVelocity: 700, accel: 1700 }), attack: 'bite', special: 'tideShot', abilities: ['물살', '수중 이동 (추후)'], body: { w: 90, h: 58 } },
      { movement: mv({ runSpeed: 280, jumpVelocity: 720, accel: 1800 }), attack: 'bite', special: 'blackTortoiseWard', abilities: ['현무 결계', '보호막'], body: { w: 120, h: 66 } },
    ]),
  },
  girin: {
    id: 'girin', name: '기린', hanja: '麒麟', title: '상서로운 생명의 영물', category: 'legend', element: '자연', symbol: '중앙', color: '#3c9d8f',
    obtainable: false, acquisition: '봉래산 지역에서 획득 (추후 업데이트).',
    lore: '어진 이가 나타날 때 모습을 보인다는 상서로운 짐승. 풀 한 포기 밟지 않고 달리며 생명을 북돋운다.',
    base: { hp: 105, atk: 12, def: 5 }, growth: { hp: 13, atk: 2.2, def: 0.9 },
    stages: stages([
      { movement: mv({ runSpeed: 340, jumpVelocity: 900 }), attack: 'horn', special: 'natureBreath', abilities: ['높은 점프', '회복'], body: { w: 62, h: 58 } },
      { movement: mv({ runSpeed: 390, jumpVelocity: 960, airJumps: 1, airJumpVelocity: 760 }), attack: 'horn', special: 'auspiciousLight', abilities: ['빠른 질주', '이단 점프', '서기 광채'], body: { w: 84, h: 64 } },
      { movement: mv({ runSpeed: 420, jumpVelocity: 1000, airJumps: 2, airJumpVelocity: 780 }), attack: 'horn', special: 'lifeLight', abilities: ['삼단 점프', '생명의 빛'], body: { w: 104, h: 70 } },
    ]),
  },
  haetae: {
    id: 'haetae', name: '해태', hanja: '獬豸', title: '정의를 지키는 수호수', category: 'legend', element: '정의', symbol: '수호', color: '#3e5a9a',
    obtainable: false, acquisition: '운무협곡 지역에서 획득 (추후 업데이트).',
    lore: '옳고 그름을 가려 불의를 들이받는다는 수호수. 화재와 재앙을 막는 힘이 있어 궁궐을 지켜 왔다.',
    base: { hp: 135, atk: 14, def: 8 }, growth: { hp: 16, atk: 2.5, def: 1.3 },
    stages: stages([
      { movement: mv({ runSpeed: 290, jumpVelocity: 720 }), attack: 'horn', special: 'guardStance', abilities: ['방어', '수호의 자세'], body: { w: 66, h: 54 } },
      { movement: mv({ runSpeed: 320, jumpVelocity: 750 }), attack: 'horn', special: 'judgeRush', abilities: ['강력한 돌진', '반격'], body: { w: 90, h: 62 } },
      { movement: mv({ runSpeed: 350, jumpVelocity: 780, airJumps: 1, airJumpVelocity: 640 }), attack: 'horn', special: 'haetaeJudgement', abilities: ['범위 공격', '해태의 심판'], body: { w: 120, h: 70 } },
    ]),
  },
  bonghwang: {
    id: 'bonghwang', name: '봉황', hanja: '鳳凰', title: '축복을 부르는 하늘의 길조', category: 'legend', element: '빛', symbol: '길조', color: '#e0a03a',
    obtainable: false, acquisition: '봉래산 정상에서 획득 (추후 업데이트).',
    lore: '태평성대에 날아든다는 길조. 오색 깃털이 빛을 머금어, 날개를 펼치면 상처가 아물고 어둠이 걷힌다.',
    base: { hp: 100, atk: 13, def: 4 }, growth: { hp: 12, atk: 2.4, def: 0.8 },
    stages: stages([
      { movement: mv({ runSpeed: 290, jumpVelocity: 720, glide: { fallSpeed: 110, speedBonus: 1.2 } }), attack: 'peck', special: 'lightFeathers', abilities: ['활공', '빛 깃털'], body: { w: 54, h: 52 } },
      { movement: mv({ runSpeed: 310, jumpVelocity: 740, airJumps: 2, airJumpVelocity: 560, glide: { fallSpeed: 85, speedBonus: 1.3 } }), attack: 'peck', special: 'blessing', abilities: ['날갯짓 2회', '축복 (회복)'], body: { w: 70, h: 60 } },
      { movement: mv({ runSpeed: 330, jumpVelocity: 760, flight: { speed: 440, vertSpeed: 360 } }), attack: 'peck', special: 'heavenlyLight', abilities: ['장거리 비행', '천상의 빛'], body: { w: 90, h: 66 } },
    ]),
  },
};

export const MOUNT_ORDER: MountId[] = ['wolf', 'hawk', 'cheongryong', 'jujak', 'baekho', 'hyeonmu', 'girin', 'haetae', 'bonghwang'];

/** 레벨 → 성장 단계 (레벨만으로 가능한 최대 단계, 실제 진화는 재료가 필요) */
export function stageForLevel(level: number): 0 | 1 | 2 {
  return level >= 30 ? 2 : level >= 10 ? 1 : 0;
}

export function mountStats(def: MountDef, level: number, stage: number) {
  const mul = [1, 1.15, 1.35][stage];
  return {
    maxHp: Math.round((def.base.hp + def.growth.hp * (level - 1)) * mul),
    atk: Math.round((def.base.atk + def.growth.atk * (level - 1)) * mul),
    def: Math.round((def.base.def + def.growth.def * (level - 1)) * mul),
  };
}
