// 구간(스테이지) 지도 데이터 형식
import type { ThemeKind } from '../regions.ts';

export type TerrainStyle = 'grass' | 'stone' | 'cave';
export type PlatformStyle = 'wood' | 'cloud' | 'stone' | 'bridge';

export interface StageMap {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  intro: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  ground: { x0: number; x1: number; top: number; style?: TerrainStyle }[];
  blocks: { x: number; y: number; w: number; h: number; style?: TerrainStyle }[];
  platforms: { x: number; y: number; w: number; style: PlatformStyle }[];
  hazards: { x: number; y: number; w: number; h: number }[];
  updrafts: { x: number; y: number; w: number; h: number }[];
  monsters: { type: string; x: number; y: number }[];
  chests: { id: string; x: number; y: number; loot: Record<string, number> }[];
  pickups: { id: string; type: 'pearl_shard' | 'lore_page' | 'moon_petal' | 'coin'; x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  decor: { type: 'pavilion' | 'lantern' | 'tree' | 'pine' | 'rock' | 'arch' | 'shrine' | 'grass' | 'waterfall'; x: number; y: number; s?: number }[];
  signs: { x: number; y: number; text: string; pc?: string }[];
  goal: { x: number; y: number };
  shrine?: { x: number; y: number };
  boss?: { x: number; y: number; arena: [number, number] };
  sky: ThemeKind;
  /** 지역 번호 (1~6) */
  region?: number;
  tier: number;
  clearExp: number;
}

