// 신수도감 공통 데이터 타입 (Phaser와 독립 — 단위 테스트에서 직접 import 가능)

export type MountId =
  | 'wolf' | 'hawk' | 'cheongryong' | 'jujak' | 'baekho' | 'hyeonmu' | 'girin' | 'haetae' | 'bonghwang';

export type Element = '바람' | '하늘' | '번개' | '불' | '쇠' | '물' | '자연' | '정의' | '빛';

export interface MovementProfile {
  runSpeed: number;
  accel: number;
  decel: number;
  airAccel: number;
  jumpVelocity: number;
  /** 공중 추가 점프 횟수 (매의 날갯짓, 늑대의 이단 점프) */
  airJumps: number;
  airJumpVelocity?: number;
  /** 활공: 점프 키를 누른 채 낙하할 때의 최대 낙하 속도 */
  glide?: { fallSpeed: number; speedBonus: number; maxTime?: number };
  /** 자유 비행 */
  flight?: { speed: number; vertSpeed: number };
  dash: { speed: number; time: number; cooldown: number; air: boolean; damage?: number };
  gravityScale?: number;
}

export type SkillKind = 'melee' | 'projectile' | 'lightning' | 'aoe' | 'beam' | 'dashStrike' | 'dive' | 'shield' | 'heal';

export type FxKind =
  | 'claw' | 'bite' | 'peck' | 'horn' | 'slash' | 'feather' | 'fire' | 'water' | 'light' | 'thunder' | 'howl'
  | 'shock' | 'breath' | 'spirit' | 'shield' | 'heal';

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  desc: string;
  /** 공격력 배율 */
  power: number;
  cooldown: number;
  fx: FxKind;
  range?: number;
  radius?: number;
  count?: number;
  spread?: number;
  speed?: number;
  duration?: number;
  knockback?: number;
  /** 회복 비율 / 보호막 피해 감소율 */
  amount?: number;
  /** 공중에서 쓰면 대신 발동하는 기술 */
  airAlt?: string;
}

export interface StageDef {
  /** 0 유체, 1 성장체, 2 각성체 */
  stage: 0 | 1 | 2;
  name: '유체' | '성장체' | '각성체';
  minLevel: number;
  movement: MovementProfile;
  attack: string;
  special: string;
  abilities: string[];
  evolveCost?: { spiritStone: number; gold: number };
  /** 몸 충돌 상자 (월드 px) */
  body: { w: number; h: number };
}

export interface MountDef {
  id: MountId;
  name: string;
  hanja: string;
  title: string;
  category: 'basic' | 'legend';
  element: Element;
  symbol: string;
  color: string;
  /** 현재 빌드에서 획득 가능한가 (월하산맥) */
  obtainable: boolean;
  acquisition: string;
  lore: string;
  base: { hp: number; atk: number; def: number };
  growth: { hp: number; atk: number; def: number };
  stages: [StageDef, StageDef, StageDef];
}

export interface MonsterDef {
  id: string;
  name: string;
  desc: string;
  ai: 'patrol' | 'charger' | 'hopper' | 'flyer' | 'caster' | 'golem' | 'boss';
  hp: number;
  atk: number;
  def: number;
  exp: number;
  gold: [number, number];
  speed: number;
  body: { w: number; h: number };
  drops: { item: string; chance: number; qty: [number, number] }[];
  elite?: boolean;
  flying?: boolean;
  knockbackImmune?: boolean;
}

export type ItemKind = 'currency' | 'material' | 'decor' | 'collectible' | 'consumable' | 'quest';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  icon: string;
}

export type ProductCategory = 'skin' | 'decor' | 'outfit' | 'package' | 'pass';

export interface ProductDef {
  id: string;
  name: string;
  category: ProductCategory;
  tier: string;
  /** 소비자 가격 (원, 부가세 포함) */
  price: number;
  desc: string;
  /** 영물 스킨이면 대상 영물 */
  mount?: MountId;
  /** 실제 지급되는 꾸미기 아이템 id 목록 */
  grants: string[];
  /** 현재 빌드에서 사용 가능한 상품인가 */
  available: boolean;
  /** 1회 한정 */
  oncePerAccount?: boolean;
  /** 꾸미기 대신 계정 효과 (수행록 프리미엄·정기권) */
  effect?: 'pass_premium' | 'monthly';
}

export interface CosmeticDef {
  id: string;
  kind: 'skin' | 'decor' | 'outfit' | 'trail';
  name: string;
  mount?: MountId;
  /** 스킨: 색조 변환 (hue 회전 도, 채도 배율, 밝기 배율) 또는 틴트 */
  tint?: { hue: number; sat: number; light: number };
  /** 장식: 위치 */
  slot?: 'neck' | 'tail' | 'trail' | 'foot';
  color?: string;
  free?: boolean;
}

export type QuestGoal =
  | { type: 'distance'; meters: number }
  | { type: 'defeat'; count: number; monster?: string }
  | { type: 'chest'; count: number }
  | { type: 'reach'; stage: string }
  | { type: 'collect'; item: string; count: number }
  | { type: 'level'; level: number }
  | { type: 'evolve'; stage: number }
  | { type: 'boss'; boss: string }
  | { type: 'clear'; stage: string }
  | { type: 'collect_mounts'; count: number };

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  goal: QuestGoal;
  reward: { gold?: number; items?: Record<string, number>; mount?: MountId; exp?: number };
  requires?: string[];
}
