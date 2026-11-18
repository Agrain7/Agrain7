// 생성 텍스처 등록 (필요할 때만 만들어 모바일 GPU 메모리를 아낀다)
import Phaser from 'phaser';
import { buildSheet } from '../art/sheet.ts';
import { ANIM_TIMING, type AnimName } from '../art/types.ts';
import { MONSTER_PAINTERS } from '../art/monsters.ts';
import { drawRider, OUTFITS, RIDER_BOX, RIDER_ANIMS } from '../art/rider.ts';
import { buildMountFrames, silhouette, tintedImage } from '../art/mountFrames.ts';
import { MOUNT_ART, artKey } from '../data/mountArt.ts';
import { COSMETICS } from '../data/cosmetics.ts';
import * as W from '../art/world.ts';
import * as O from '../art/objects.ts';

export function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function addFramesAndAnims(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, frames: { name: string; x: number; y: number; w: number; h: number }[], anims: Record<string, number>) {
  addCanvas(scene, key, canvas);
  const tex = scene.textures.get(key);
  for (const f of frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
  for (const [anim, n] of Object.entries(anims)) {
    const akey = `${key}:${anim}`;
    if (scene.anims.exists(akey)) scene.anims.remove(akey);
    const timing = ANIM_TIMING[anim as AnimName] ?? { fps: 10, repeat: -1 };
    scene.anims.create({
      key: akey,
      frames: Array.from({ length: n }, (_, i) => ({ key, frame: `${anim}_${i}` })),
      frameRate: timing.fps,
      repeat: timing.repeat,
    });
  }
}

// ---------- 영물 ----------
export interface MountTex { key: string; padX: number; padTop: number; fw: number; fh: number; scale: number }
const mountCache = new Map<string, MountTex>();
const MOUNT_CACHE_MAX = 5;

export function mountImageKey(mountId: string, stage: number) {
  return `img_${artKey(mountId, stage)}`;
}

export function ensureMount(scene: Phaser.Scene, mountId: string, stage: number, skin?: string): MountTex {
  const key = `mount_${mountId}_${stage}_${skin ?? 'base'}`;
  const hit = mountCache.get(key);
  if (hit && scene.textures.exists(key)) return hit;
  const info = MOUNT_ART[artKey(mountId, stage)];
  const img = scene.textures.get(mountImageKey(mountId, stage)).getSourceImage() as HTMLImageElement;
  const tint = skin ? COSMETICS[skin]?.tint : undefined;
  const built = buildMountFrames(img, info, tint);
  addFramesAndAnims(scene, key, built.canvas, built.frames, built.anims);
  const mt: MountTex = { key, padX: built.padX, padTop: built.padTop, fw: built.fw, fh: built.fh, scale: info.scale };
  mountCache.set(key, mt);
  // 오래된 텍스처 정리
  if (mountCache.size > MOUNT_CACHE_MAX) {
    const oldest = mountCache.keys().next().value as string;
    if (oldest !== key) {
      mountCache.delete(oldest);
      for (const a of ['idle', 'run', 'fly']) scene.anims.remove(`${oldest}:${a}`);
      if (scene.textures.exists(oldest)) scene.textures.remove(oldest);
    }
  }
  return mt;
}

/** 도감·상점용 정지 일러스트 (실루엣/스킨) */
export function ensurePortrait(scene: Phaser.Scene, mountId: string, stage: number, mode: 'normal' | 'silhouette', skin?: string): string {
  const key = `portrait_${mountId}_${stage}_${mode}_${skin ?? 'base'}`;
  if (scene.textures.exists(key)) return key;
  const info = MOUNT_ART[artKey(mountId, stage)];
  const img = scene.textures.get(mountImageKey(mountId, stage)).getSourceImage() as HTMLImageElement;
  const tint = skin ? COSMETICS[skin]?.tint : undefined;
  addCanvas(scene, key, mode === 'silhouette' ? silhouette(img, info.w, info.h) : tintedImage(img, info.w, info.h, tint));
  return key;
}

// ---------- 라이더 ----------
export function ensureRider(scene: Phaser.Scene, outfit: string): string {
  const key = `rider_${outfit}`;
  if (scene.textures.exists(key)) return key;
  const o = OUTFITS[outfit] ?? OUTFITS.outfit_default;
  const sheet = buildSheet(RIDER_BOX, RIDER_ANIMS, (ctx, pose) => drawRider(ctx, pose, o));
  addFramesAndAnims(scene, key, sheet.canvas, sheet.frames, RIDER_ANIMS as Record<string, number>);
  return key;
}

// ---------- 몬스터 ----------
export function ensureMonster(scene: Phaser.Scene, id: string): string {
  const key = `mon_${id}`;
  if (scene.textures.exists(key)) return key;
  const p = MONSTER_PAINTERS[id];
  const sheet = buildSheet(p.box, p.anims, (ctx, pose) => p.draw(ctx, pose));
  addFramesAndAnims(scene, key, sheet.canvas, sheet.frames, p.anims as Record<string, number>);
  return key;
}
export function monsterBox(id: string) {
  return MONSTER_PAINTERS[id].box;
}

// ---------- 하늘/배경 ----------
export function ensureSky(scene: Phaser.Scene, sky: W.SkyKind) {
  const k = (n: string) => `bg_${sky}_${n}`;
  if (scene.textures.exists(k('sky'))) return;
  addCanvas(scene, k('sky'), W.paintSky(sky));
  addCanvas(scene, k('moon'), W.paintMoon(sky));
  addCanvas(scene, k('clouds'), W.paintCloudBand(sky));
  addCanvas(scene, k('mount0'), W.paintMountains(sky, 0));
  addCanvas(scene, k('mount1'), W.paintMountains(sky, 1));
  addCanvas(scene, k('cliffs'), W.paintCliffs(sky).canvas);
  addCanvas(scene, k('grove'), W.paintGrove(sky));
}

/** 부팅 시 한 번 생성하는 공용 텍스처 */
export function generateCommon(scene: Phaser.Scene) {
  const jobs: [string, () => HTMLCanvasElement][] = [
    ['waterfall', () => W.paintWaterfall()],
    ['pavilion', () => W.paintPavilion()],
    ['lantern_off', () => W.paintLantern(false)],
    ['lantern_on', () => W.paintLantern(true)],
    ['tree_cherry', () => W.paintTreeDecor('cherry', 5)],
    ['tree_plum', () => W.paintTreeDecor('plum', 9)],
    ['pine', () => W.paintPineDecor(3)],
    ['rock', () => W.paintRock(4)],
    ['grass', () => W.paintGrassTuft(6)],
    ['arch', () => W.paintArch()],
    ['shrine', () => W.paintShrine()],
    ['ground_grass', () => W.paintGroundBody('grass')],
    ['ground_stone', () => W.paintGroundBody('stone')],
    ['ground_cave', () => W.paintGroundBody('cave')],
    ['top_grass', () => W.paintGroundTop('grass')],
    ['top_stone', () => W.paintGroundTop('stone')],
    ['top_cave', () => W.paintGroundTop('cave')],
    ['plat_wood', () => W.paintPlatform('wood')],
    ['plat_cloud', () => W.paintPlatform('cloud')],
    ['plat_stone', () => W.paintPlatform('stone')],
    ['plat_bridge', () => W.paintPlatform('bridge')],
    ['chest', () => O.paintChest(false)],
    ['chest_open', () => O.paintChest(true)],
    ['coin', () => O.paintCoin()],
    ['pearl', () => O.paintPearl()],
    ['lore', () => O.paintLorePage()],
    ['petal', () => O.paintPetal()],
    ['petal_red', () => O.paintPetal('#e9768f')],
    ['goal', () => O.paintGoalGate()],
    ['thorns', () => O.paintThorns()],
    ['wisp', () => O.paintWisp()],
    ['wisp_gold', () => O.paintWisp('#ffe08a')],
    ['fx_slash', () => O.paintSlash()],
    ['fx_claw', () => O.paintClaw()],
    ['fx_dust', () => O.paintDust()],
    ['fx_feather', () => O.paintFeather()],
    ['fx_fire', () => O.paintFireball()],
    ['fx_water', () => O.paintOrb('#7fd0ff', '#2f7fb8')],
    ['fx_light', () => O.paintOrb('#fff3b0', '#ffc94a')],
    ['fx_dark', () => O.paintOrb('#d08aff', '#5a1f8a', 16)],
    ['fx_bolt', () => O.paintBolt()],
    ['fx_ring_white', () => O.paintRing('#ffffff')],
    ['fx_ring_blue', () => O.paintRing('#8fe3ff')],
    ['fx_ring_fire', () => O.paintRing('#ff9a3c')],
    ['fx_ring_gold', () => O.paintRing('#ffe08a')],
    ['fx_ring_dark', () => O.paintRing('#9a5aff')],
    ['fx_breath', () => O.paintBreath()],
    ['fx_shield', () => O.paintShield('#8fe3ff')],
    ['fx_spark', () => O.paintHitSpark()],
    ['fx_plus', () => O.paintPlus()],
    ['fx_rock', () => O.paintRockShot()],
    ['ui_panel', () => O.paintPanel(false)],
    ['ui_panel_dark', () => O.paintPanel(true)],
    ['ui_btn', () => O.paintButton('normal')],
    ['ui_btn_primary', () => O.paintButton('primary')],
    ['ui_btn_disabled', () => O.paintButton('disabled')],
  ];
  for (const icon of ['left', 'right', 'down', 'jump', 'attack', 'skill', 'dash', 'pause', 'menu', 'swap']) {
    jobs.push([`btn_${icon}`, () => O.paintRoundButton(icon)]);
  }
  for (const icon of ['gold', 'stone', 'silk', 'petal', 'pearl', 'yakgwa', 'page', 'knot', 'jade', 'bell', 'cloud', 'foot', 'outfit', 'package', 'skin']) {
    jobs.push([`icon_${icon}`, () => O.paintItemIcon(icon)]);
  }
  return jobs;
}

export function runJobs(scene: Phaser.Scene, jobs: [string, () => HTMLCanvasElement][]) {
  for (const [k, fn] of jobs) addCanvas(scene, k, fn());
}
