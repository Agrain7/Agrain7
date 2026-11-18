import type { Ctx } from './paint.ts';

export type AnimName =
  | 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'attack' | 'hit' | 'dash' | 'glide' | 'fly' | 'cast';

export interface Pose {
  anim: AnimName;
  /** 프레임 인덱스 */
  i: number;
  /** 애니메이션 총 프레임 수 */
  n: number;
  /** 0..1 위상 */
  t: number;
}

export interface Anchor { x: number; y: number; rot: number }

/** 프레임마다 반환되는 부착점 (오른쪽을 보는 기준, 원점 = 발 중심 지면) */
export interface MountFrameInfo {
  /** 라이더 엉덩이 위치 */
  seat: Anchor;
  /** 목 장식(매듭/옥/방울) 위치 */
  neck: { x: number; y: number };
  /** 입 (숨결/투사체 발사 위치) */
  mouth: { x: number; y: number };
}

export interface FrameBox { w: number; h: number; ox: number; oy: number }

export type Palette = Record<string, string>;

export interface MountPainter {
  /** 단계별 프레임 크기와 원점(발 중심) */
  box(stage: number): FrameBox;
  /** 이 영물이 사용하는 애니메이션 프레임 수 */
  anims: Partial<Record<AnimName, number>>;
  draw(ctx: Ctx, pose: Pose, stage: number, pal: Palette): MountFrameInfo;
}

export interface AnimSpec { frames: number; fps: number; repeat: number }

export const ANIM_TIMING: Record<AnimName, { fps: number; repeat: number }> = {
  idle: { fps: 7, repeat: -1 },
  run: { fps: 14, repeat: -1 },
  jump: { fps: 10, repeat: 0 },
  fall: { fps: 8, repeat: -1 },
  land: { fps: 16, repeat: 0 },
  attack: { fps: 22, repeat: 0 },
  hit: { fps: 10, repeat: 0 },
  dash: { fps: 18, repeat: -1 },
  glide: { fps: 8, repeat: -1 },
  fly: { fps: 11, repeat: -1 },
  cast: { fps: 12, repeat: 0 },
};
