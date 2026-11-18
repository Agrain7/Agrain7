// 몬스터 그림(투명 PNG) 정보 — tools/extract_boar.py, tools/make_monsters.py 가 만든다.
// boar: 참고 게임 화면의 산돼지를 그대로 잘라 냄. 나머지: 도감 원화를 같은 분위기(먹빛 몸·크림 갈기·붉은 소용돌이)로 바꿈.
import type { RigAnim } from '../art/rig.ts';
import type { MotionKind } from './mountArt.ts';

export interface MonsterArt {
  file: string;
  w: number;
  h: number;
  /** 리그 정의 키 (MOUNT_RIGS 또는 MONSTER_RIGS) */
  rig: string;
  motion: MotionKind;
  /** 화면에 보일 그림 높이(px) */
  displayH: number;
  /** 만들 리그 동작 */
  frames: Partial<Record<RigAnim, number>>;
  /** 몬스터 동작 → 리그 동작 (+재생 속도) */
  anims: Record<string, { from: RigAnim; fps: number; repeat: number; frames?: number[] }>;
}

const quadAnims = (attack: RigAnim, attackFps: number, attackRepeat = 0) => ({
  idle: { from: 'idle' as RigAnim, fps: 8, repeat: -1 },
  run: { from: 'run' as RigAnim, fps: 12, repeat: -1 },
  attack: { from: attack, fps: attackFps, repeat: attackRepeat },
  jump: { from: 'fly' as RigAnim, fps: 10, repeat: -1 },
  hit: { from: 'idle' as RigAnim, fps: 1, repeat: 0, frames: [0] },
});

export const MONSTER_ART: Record<string, MonsterArt> = {
  boar: {
    file: 'assets/monsters/boar.png', w: 250, h: 167, rig: 'mon_boar', motion: 'quad', displayH: 88,
    frames: { idle: 8, run: 8 },
    anims: quadAnims('run', 20, -1), // 돌진: 빠른 달리기
  },
  fox: {
    file: 'assets/monsters/fox.png', w: 124, h: 110, rig: 'wolf_1', motion: 'quad', displayH: 80,
    frames: { idle: 8, run: 8, atk: 4 },
    anims: quadAnims('atk', 10),
  },
  bat: {
    file: 'assets/monsters/bat.png', w: 112, h: 113, rig: 'hawk_1', motion: 'bird', displayH: 76,
    frames: { fly: 8, atk: 4 },
    anims: {
      fly: { from: 'fly', fps: 12, repeat: -1 },
      idle: { from: 'fly', fps: 12, repeat: -1 },
      attack: { from: 'atk', fps: 10, repeat: 0 },
      hit: { from: 'fly', fps: 1, repeat: 0, frames: [0] },
    },
  },
  dokkaebi: {
    file: 'assets/monsters/dokkaebi.png', w: 122, h: 112, rig: 'haetae_0', motion: 'quad', displayH: 84,
    frames: { idle: 8, fly: 8, atk: 4 },
    anims: { ...quadAnims('atk', 12), run: { from: 'idle', fps: 12, repeat: -1 } },
  },
  rock: {
    file: 'assets/monsters/rock.png', w: 176, h: 153, rig: 'hyeonmu_1', motion: 'shell', displayH: 128,
    frames: { idle: 8, run: 8, atk: 4 },
    anims: quadAnims('atk', 8),
  },
  boss: {
    file: 'assets/monsters/boss.png', w: 304, h: 176, rig: 'baekho_2', motion: 'quad', displayH: 230,
    frames: { idle: 8, run: 8, fly: 8, atk: 4 },
    anims: {
      ...quadAnims('atk', 10),
      cast: { from: 'atk', fps: 6, repeat: 0 },
      fall: { from: 'fly', fps: 10, repeat: -1 },
    },
  },
};

export const monsterImageKey = (id: string) => `monimg_${id}`;
