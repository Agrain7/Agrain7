// 생성 텍스처 등록 (필요할 때만 만들어 모바일 GPU 메모리를 아낀다)
import Phaser from 'phaser';
import { buildSheet } from '../art/sheet.ts';
import { ANIM_TIMING, type AnimName } from '../art/types.ts';
import { MONSTER_PAINTERS } from '../art/monsters.ts';
import { drawRider, OUTFITS, RIDER_BOX, RIDER_ANIMS } from '../art/rider.ts';
import { drawRefRider, recolorOutfit, refRiderBox, type RefRiderMeta } from '../art/riderRef.ts';
import { makeCanvas } from '../art/paint.ts';
import { readPixels, silhouette, tintedImage } from '../art/mountFrames.ts';
import { rigJob, type RigJob, type RigResult } from '../art/rig.ts';
import { rigFor } from '../data/mountRigs.ts';
import { rigInWorker } from '../art/rigClient.ts';
import { MOUNT_ART, artKey } from '../data/mountArt.ts';
import { MONSTER_ART, monsterImageKey } from '../data/monsterArt.ts';
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

// ---------- 받은 그림(프레임 시트) 우선 사용 ----------
// tools/pack_sprites.py 가 만든 public/assets/sprites/index.json 을 부팅 때 읽는다.
export interface SpriteSet {
  category: 'mounts' | 'riders' | 'monsters';
  key: string; file: string; fw: number; fh: number; cols: number;
  anims: Record<string, number>; origin: [number, number]; contentH: number;
  idleBox: [number, number, number, number]; seat: [number, number] | null;
}
export const spriteSets = new Map<string, SpriteSet>();
export const bgOverrides = new Set<string>();
export const sheetKey = (s: SpriteSet) => `spr_${s.category}_${s.key}`;

/** 시트 → 프레임·애니메이션 등록. want: 꼭 있어야 하는 동작 (없으면 비슷한 동작으로 대체) */
function registerSheet(scene: Phaser.Scene, texKey: string, set: SpriteSet, source: CanvasImageSource, timing: Record<string, { fps: number; repeat: number }>, want: string[]) {
  if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
  const [c, ctx] = makeCanvas((source as HTMLCanvasElement).width, (source as HTMLCanvasElement).height);
  ctx.drawImage(source, 0, 0);
  scene.textures.addCanvas(texKey, c);
  const tex = scene.textures.get(texKey);
  let k = 0;
  const names: Record<string, string[]> = {};
  for (const [anim, n] of Object.entries(set.anims)) {
    names[anim] = [];
    for (let i = 0; i < n; i++, k++) {
      const fx = (k % set.cols) * set.fw, fy = Math.floor(k / set.cols) * set.fh;
      tex.add(`${anim}_${i}`, 0, fx, fy, set.fw, set.fh);
      names[anim].push(`${anim}_${i}`);
    }
  }
  const fallback: Record<string, string[]> = { fly: ['run', 'idle'], atk: ['run', 'idle'], attack: ['run', 'idle'], hit: ['idle'], cast: ['attack', 'idle'], jump: ['run', 'idle'], fall: ['idle'], run: ['idle'], idle: ['run'] };
  for (const anim of new Set([...want, ...Object.keys(names)])) {
    let fr = names[anim];
    if (!fr) for (const alt of fallback[anim] ?? []) if (names[alt]) { fr = names[alt]; break; }
    if (!fr) continue;
    const akey = `${texKey}:${anim}`;
    if (scene.anims.exists(akey)) scene.anims.remove(akey);
    const tm = timing[anim] ?? { fps: 10, repeat: -1 };
    scene.anims.create({ key: akey, frames: fr.map((f) => ({ key: texKey, frame: f })), frameRate: tm.fps, repeat: tm.repeat });
    // 대체 동작은 프레임 이름도 맞춰 둔다 (예: fly_0 → run_0)
    if (!names[anim]) fr.forEach((f, i) => { if (!tex.has(`${anim}_${i}`)) { const src = tex.get(f); tex.add(`${anim}_${i}`, 0, src.cutX, src.cutY, src.cutWidth, src.cutHeight); } });
  }
}

/** 부팅 때 호출: 받은 그림 목록을 읽고 이미지를 불러온다 (없으면 아무 일도 하지 않음) */
export async function loadSpriteOverrides(scene: Phaser.Scene) {
  let index: { sets?: SpriteSet[]; backgrounds?: { key: string; file: string }[] } | null = null;
  try {
    const res = await fetch('assets/sprites/index.json', { cache: 'no-cache' });
    if (res.ok) index = await res.json();
  } catch {
    index = null;
  }
  if (!index) return;
  const sets = index.sets ?? [];
  const bgs = index.backgrounds ?? [];
  if (!sets.length && !bgs.length) return;
  for (const s of sets) scene.load.image(sheetKey(s), s.file);
  for (const b of bgs) scene.load.image(b.key, b.file);
  await new Promise<void>((resolve) => {
    scene.load.once('complete', () => resolve());
    scene.load.start();
  });
  for (const s of sets) if (scene.textures.exists(sheetKey(s))) spriteSets.set(`${s.category}/${s.key}`, s);
  for (const b of bgs) if (scene.textures.exists(b.key)) bgOverrides.add(b.key);
}

// ---------- 영물 (원화 리깅 애니메이션) ----------
export interface MountTex {
  key: string; originX: number; originY: number; scale: number;
  /** 프레임별 라이더 위치 보정 (원화 대비 비율) */
  seat: Record<string, [number, number]>;
  /** 받은 그림: 원점 기준 라이더 위치 (텍스처 px) */
  seatPx?: [number, number];
}
const mountCache = new Map<string, MountTex>();
const mountJobs = new Map<string, RigJob>();
const MOUNT_CACHE_MAX = 6;
const MOUNT_TIMING: Record<string, { fps: number; repeat: number }> = {
  idle: { fps: 8, repeat: -1 }, run: { fps: 13, repeat: -1 }, fly: { fps: 11, repeat: -1 }, atk: { fps: 16, repeat: 0 },
};

export function mountImageKey(mountId: string, stage: number) {
  return `img_${artKey(mountId, stage)}`;
}
const mountTexKey = (mountId: string, stage: number, skin?: string) => `mount_${mountId}_${stage}_${skin ?? 'base'}`;

function mountJob(scene: Phaser.Scene, mountId: string, stage: number, skin?: string): RigJob {
  const key = mountTexKey(mountId, stage, skin);
  let job = mountJobs.get(key);
  if (!job) {
    const ak = artKey(mountId, stage);
    const info = MOUNT_ART[ak];
    const img = scene.textures.get(mountImageKey(mountId, stage)).getSourceImage() as HTMLImageElement;
    const tint = skin ? COSMETICS[skin]?.tint : undefined;
    job = rigJob(readPixels(img, info.w, info.h, tint), rigFor(ak, info.motion), info.seat);
    mountJobs.set(key, job);
  }
  return job;
}

function registerMount(scene: Phaser.Scene, mountId: string, stage: number, skin: string | undefined, res: RigResult): MountTex {
  const key = mountTexKey(mountId, stage, skin);
  const info = MOUNT_ART[artKey(mountId, stage)];
  addCanvas(scene, key, res.canvas);
  const tex = scene.textures.get(key);
  const seat: Record<string, [number, number]> = {};
  for (const f of res.frames) { tex.add(f.name, 0, f.x, f.y, f.w, f.h); seat[f.name] = f.seat; }
  for (const [anim, n] of Object.entries(res.anims)) {
    const akey = `${key}:${anim}`;
    if (scene.anims.exists(akey)) scene.anims.remove(akey);
    const tm = MOUNT_TIMING[anim];
    scene.anims.create({ key: akey, frames: Array.from({ length: n }, (_, i) => ({ key, frame: `${anim}_${i}` })), frameRate: tm.fps, repeat: tm.repeat });
  }
  const mt: MountTex = { key, originX: 0.5, originY: (res.padTop + info.h) / res.fh, scale: info.scale, seat };
  mountCache.set(key, mt);
  mountJobs.delete(key);
  if (mountCache.size > MOUNT_CACHE_MAX) {
    const oldest = mountCache.keys().next().value as string;
    if (oldest !== key) {
      mountCache.delete(oldest);
      for (const a of Object.keys(MOUNT_TIMING)) scene.anims.remove(`${oldest}:${a}`);
      if (scene.textures.exists(oldest)) scene.textures.remove(oldest);
    }
  }
  return mt;
}

export function hasMount(scene: Phaser.Scene, mountId: string, stage: number, skin?: string) {
  const key = mountTexKey(mountId, stage, skin);
  return mountCache.has(key) && scene.textures.exists(key);
}

/** 받은 프레임 그림으로 영물 텍스처 만들기 */
function registerMountSheet(scene: Phaser.Scene, mountId: string, stage: number, skin: string | undefined, set: SpriteSet): MountTex {
  const key = mountTexKey(mountId, stage, skin);
  const info = MOUNT_ART[artKey(mountId, stage)];
  const src = scene.textures.get(sheetKey(set)).getSourceImage() as HTMLImageElement;
  const tint = skin ? COSMETICS[skin]?.tint : undefined;
  let source: CanvasImageSource = src;
  if (tint) {
    const [c, ctx] = makeCanvas(src.width, src.height);
    ctx.putImageData(readPixels(src, src.width, src.height, tint), 0, 0);
    source = c;
  }
  registerSheet(scene, key, set, source, MOUNT_TIMING, ['idle', 'run', 'fly', 'atk']);
  const [ox, oy] = set.origin;
  const ib = set.idleBox;
  const seatPx: [number, number] = set.seat
    ? [set.seat[0] - ox * set.fw, set.seat[1] - oy * set.fh]
    : [ib[0] + info.seat[0] * ib[2] - ox * set.fw, ib[1] + info.seat[1] * ib[3] - oy * set.fh];
  const mt: MountTex = { key, originX: ox, originY: oy, scale: (info.h * info.scale) / Math.max(1, set.contentH), seat: {}, seatPx };
  mountCache.set(key, mt);
  return mt;
}

/** 즉시 필요할 때 (남은 계산을 한 번에 끝냄) */
export function ensureMount(scene: Phaser.Scene, mountId: string, stage: number, skin?: string): MountTex {
  const key = mountTexKey(mountId, stage, skin);
  const hit = mountCache.get(key);
  if (hit && scene.textures.exists(key)) { mountCache.delete(key); mountCache.set(key, hit); return hit; }
  const set = spriteSets.get(`mounts/${artKey(mountId, stage)}`);
  if (set) return registerMountSheet(scene, mountId, stage, skin, set);
  return registerMount(scene, mountId, stage, skin, mountJob(scene, mountId, stage, skin).finish());
}

/** 미리 만들어 두기: 프레임마다 몇 ms씩 나눠 계산해 끊김 없이 준비 */
const mountInflight = new Set<string>();
export function prewarmMount(scene: Phaser.Scene, mountId: string, stage: number, skin?: string, onDone?: () => void) {
  if (hasMount(scene, mountId, stage, skin)) { onDone?.(); return; }
  if (spriteSets.has(`mounts/${artKey(mountId, stage)}`)) { ensureMount(scene, mountId, stage, skin); onDone?.(); return; }
  const key = mountTexKey(mountId, stage, skin);
  if (mountInflight.has(key)) return;
  // 1) 작업자(다른 CPU 코어)에서 그린다 → 게임 화면은 멈추지 않는다
  const ak = artKey(mountId, stage);
  const info = MOUNT_ART[ak];
  const img = scene.textures.get(mountImageKey(mountId, stage)).getSourceImage() as HTMLImageElement;
  const tint = skin ? COSMETICS[skin]?.tint : undefined;
  const req = rigInWorker(readPixels(img, info.w, info.h, tint), ak, info.motion, info.seat);
  if (req) {
    mountInflight.add(key);
    req.then((res) => {
      mountInflight.delete(key);
      if (hasMount(scene, mountId, stage, skin)) { onDone?.(); return; } // 그 사이 바로 필요해서 이미 만들었음
      if (res) { registerMount(scene, mountId, stage, skin, res); onDone?.(); }
      else prewarmMountSliced(scene, mountId, stage, skin, onDone);
    });
    return;
  }
  prewarmMountSliced(scene, mountId, stage, skin, onDone);
}

/** 작업자를 못 쓸 때: 프레임마다 몇 ms씩 나눠 계산 */
function prewarmMountSliced(scene: Phaser.Scene, mountId: string, stage: number, skin?: string, onDone?: () => void) {
  const job = mountJob(scene, mountId, stage, skin);
  const ev = scene.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      if (hasMount(scene, mountId, stage, skin)) { ev.remove(); onDone?.(); return; }
      const res = job.step(4);
      if (res) { ev.remove(); registerMount(scene, mountId, stage, skin, res); onDone?.(); }
    },
  });
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
export interface RiderMeta { ox: number; oy: number; scaleMul: number; face: [number, number, number] }
const riderMetas = new Map<string, RiderMeta>();
const RIDER_DEFAULT: RiderMeta = { ox: 94 / 160, oy: 104 / 130, scaleMul: 1, face: [96, 46, 32] };
export function riderMeta(key: string): RiderMeta {
  return riderMetas.get(key) ?? RIDER_DEFAULT;
}

export function ensureRider(scene: Phaser.Scene, outfit: string): string {
  const key = `rider_${outfit}`;
  if (scene.textures.exists(key)) return key;
  const set = spriteSets.get(`riders/${outfit}`) ?? spriteSets.get('riders/outfit_default');
  if (set && (set.key === outfit || !OUTFITS[outfit])) {
    registerSheet(scene, key, set, scene.textures.get(sheetKey(set)).getSourceImage() as HTMLImageElement, ANIM_TIMING as Record<string, { fps: number; repeat: number }>, Object.keys(RIDER_ANIMS));
    const ib = set.idleBox;
    const sx = set.seat ? set.seat[0] : ib[0] + ib[2] / 2, sy = set.seat ? set.seat[1] : ib[1] + ib[3] * 0.8;
    riderMetas.set(key, { ox: sx / set.fw, oy: sy / set.fh, scaleMul: 105 / Math.max(1, set.contentH), face: [ib[0] + ib[2] / 2, ib[1] + ib[2] * 0.32, ib[2] * 0.36] });
    return key;
  }
  const o = OUTFITS[outfit] ?? OUTFITS.outfit_default;
  // 참고 화면의 소녀 그림이 있으면 그것으로 (tools/extract_rider.py), 없으면 코드 그림
  const meta = scene.cache.json.get('rider_meta') as RefRiderMeta | undefined;
  if (meta && scene.textures.exists('rider_body') && scene.textures.exists('rider_tail')) {
    const isDef = outfit === 'outfit_default' || !OUTFITS[outfit];
    const body = recolorOutfit(scene.textures.get('rider_body').getSourceImage() as HTMLImageElement, meta, o, isDef);
    const tail = scene.textures.get('rider_tail').getSourceImage() as HTMLImageElement;
    const box = refRiderBox(meta);
    const sheet = buildSheet(box, RIDER_ANIMS, (ctx, pose) => drawRefRider(ctx, pose, meta, body, tail, o));
    addFramesAndAnims(scene, key, sheet.canvas, sheet.frames, RIDER_ANIMS as Record<string, number>);
    // 그림 높이(머리끝~발끝) 약 meta.h → 기존 라이더(약 105px)와 같은 화면 크기 기준
    riderMetas.set(key, {
      ox: box.ox / box.w, oy: box.oy / box.h,
      scaleMul: 116 / meta.h,
      face: [box.ox - meta.seat[0] + meta.face[0], box.oy - meta.seat[1] + meta.face[1], meta.face[2]],
    });
    return key;
  }
  const sheet = buildSheet(RIDER_BOX, RIDER_ANIMS, (ctx, pose) => drawRider(ctx, pose, o));
  addFramesAndAnims(scene, key, sheet.canvas, sheet.frames, RIDER_ANIMS as Record<string, number>);
  return key;
}

// ---------- 몬스터 ----------
// 몬스터: 받은 프레임 그림 > 몬스터 일러스트(참고 산돼지·어둠에 물든 영물) 리깅 > 코드 그림
const monsterRigInfo = new Map<string, { fw: number; fh: number; ox: number; oy: number }>();
const monsterJobs = new Map<string, RigJob>();

function monsterJob(scene: Phaser.Scene, id: string): RigJob | null {
  const art = MONSTER_ART[id];
  if (!art || !scene.textures.exists(monsterImageKey(id))) return null;
  let job = monsterJobs.get(id);
  if (!job) {
    const img = scene.textures.get(monsterImageKey(id)).getSourceImage() as HTMLImageElement;
    job = rigJob(readPixels(img, art.w, art.h), rigFor(art.rig, art.motion), [0.5, 0.5], art.frames);
    monsterJobs.set(id, job);
  }
  return job;
}

function registerMonsterRig(scene: Phaser.Scene, id: string, res: RigResult): string {
  const key = `mon_${id}`;
  const art = MONSTER_ART[id];
  addCanvas(scene, key, res.canvas);
  const tex = scene.textures.get(key);
  for (const f of res.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
  for (const [name, a] of Object.entries(art.anims)) {
    const n = res.anims[a.from];
    if (!n) continue;
    const akey = `${key}:${name}`;
    if (scene.anims.exists(akey)) scene.anims.remove(akey);
    const idx = a.frames ?? Array.from({ length: n }, (_, i) => i);
    scene.anims.create({ key: akey, frames: idx.map((i) => ({ key, frame: `${a.from}_${i}` })), frameRate: a.fps, repeat: a.repeat });
  }
  // 처음 보여 줄 프레임 이름 맞추기 (idle_0 / fly_0)
  for (const [alias, from] of [['idle', art.anims.idle?.from], ['fly', art.anims.fly?.from ?? art.anims.idle?.from]] as const) {
    if (from && !tex.has(`${alias}_0`) && tex.has(`${from}_0`)) { const f = tex.get(`${from}_0`); tex.add(`${alias}_0`, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight); }
  }
  monsterRigInfo.set(id, { fw: res.fw, fh: res.fh, ox: res.fw / 2, oy: res.padTop + art.h });
  monsterJobs.delete(id);
  return key;
}

export function ensureMonster(scene: Phaser.Scene, id: string): string {
  const key = `mon_${id}`;
  if (scene.textures.exists(key)) return key;
  const set = spriteSets.get(`monsters/${id}`);
  if (set) {
    const want = Object.keys(MONSTER_PAINTERS[id]?.anims ?? { idle: 1 });
    registerSheet(scene, key, set, scene.textures.get(sheetKey(set)).getSourceImage() as HTMLImageElement, ANIM_TIMING as Record<string, { fps: number; repeat: number }>, want);
    return key;
  }
  const job = monsterJob(scene, id);
  if (job) return registerMonsterRig(scene, id, job.finish());
  const p = MONSTER_PAINTERS[id];
  const sheet = buildSheet(p.box, p.anims, (ctx, pose) => p.draw(ctx, pose));
  addFramesAndAnims(scene, key, sheet.canvas, sheet.frames, p.anims as Record<string, number>);
  return key;
}

/** 부팅 때 몬스터 리깅을 나눠서 미리 계산 (progress: 0..1) */
/** 몬스터 리깅을 작업자에서 (실패하면 null) */
function monsterInWorker(scene: Phaser.Scene, id: string) {
  const art = MONSTER_ART[id];
  if (!art || !scene.textures.exists(monsterImageKey(id))) return null;
  const img = scene.textures.get(monsterImageKey(id)).getSourceImage() as HTMLImageElement;
  return rigInWorker(readPixels(img, art.w, art.h), art.rig, art.motion, [0.5, 0.5], art.frames);
}

export async function prewarmMonsters(scene: Phaser.Scene, progress?: (p: number) => void) {
  const ids = Object.keys(MONSTER_ART).filter((id) => !id.startsWith('boss_') && !spriteSets.has(`monsters/${id}`) && !scene.textures.exists(`mon_${id}`));
  let done = 0;
  // 작업자로 한꺼번에 (로딩이 빨라짐)
  const viaWorker = await Promise.all(ids.map(async (id) => {
    const req = monsterInWorker(scene, id);
    const res = req ? await req : null;
    if (res && !scene.textures.exists(`mon_${id}`)) registerMonsterRig(scene, id, res);
    progress?.(++done / ids.length);
    return !!res;
  }));
  done = 0;
  for (const [i, id] of ids.entries()) {
    if (viaWorker[i]) continue;
    const job = monsterJob(scene, id);
    if (!job) continue;
    await new Promise<void>((resolve) => {
      const tick = () => {
        const res = job.step(20);
        if (res) { registerMonsterRig(scene, id, res); resolve(); } else scene.time.delayedCall(1, tick);
      };
      tick();
    });
  }
}

/** 구간에 들어갈 때 보스를 미리 (작업자, 안 되면 프레임마다 몇 ms씩) */
export function prewarmMonster(scene: Phaser.Scene, id: string) {
  if (scene.textures.exists(`mon_${id}`) || spriteSets.has(`monsters/${id}`)) return;
  const req = monsterInWorker(scene, id);
  if (req) {
    req.then((res) => {
      if (scene.textures.exists(`mon_${id}`)) return;
      if (res) registerMonsterRig(scene, id, res);
      else prewarmMonsterSliced(scene, id);
    });
    return;
  }
  prewarmMonsterSliced(scene, id);
}
function prewarmMonsterSliced(scene: Phaser.Scene, id: string) {
  const job = monsterJob(scene, id);
  if (!job) return;
  const ev = scene.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      if (scene.textures.exists(`mon_${id}`)) { ev.remove(); return; }
      const res = job.step(4);
      if (res) { ev.remove(); registerMonsterRig(scene, id, res); }
    },
  });
}
/** 큰 보스 그림은 구간을 떠날 때 내려 둔다 (모바일 메모리) */
export function releaseMonster(scene: Phaser.Scene, id: string) {
  const key = `mon_${id}`;
  const art = MONSTER_ART[id];
  if (art) for (const a of Object.keys(art.anims)) scene.anims.remove(`${key}:${a}`);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  monsterRigInfo.delete(id);
  monsterJobs.delete(id);
}

export function monsterBox(id: string) {
  const set = spriteSets.get(`monsters/${id}`);
  if (set) return { w: set.fw, h: set.fh, ox: set.origin[0] * set.fw, oy: set.origin[1] * set.fh };
  const ri = monsterRigInfo.get(id);
  if (ri) return { w: ri.fw, h: ri.fh, ox: ri.ox, oy: ri.oy };
  return MONSTER_PAINTERS[id].box;
}
/** 받은 몬스터 그림은 기존 크기에 맞춰 축소·확대 */
export function monsterScale(id: string) {
  const set = spriteSets.get(`monsters/${id}`);
  if (set) return (MONSTER_PAINTERS[id].box.h * 0.8) / Math.max(1, set.contentH);
  const art = MONSTER_ART[id];
  if (art && monsterRigInfo.has(id)) return art.displayH / art.h;
  return 1;
}
/** 화면에 보이는 몬스터 그림 높이 (체력바 위치용) */
export function monsterArtHeight(id: string) {
  const art = MONSTER_ART[id];
  if (art && monsterRigInfo.has(id)) return art.displayH;
  const set = spriteSets.get(`monsters/${id}`);
  if (set) return MONSTER_PAINTERS[id].box.h * 0.8;
  const b = MONSTER_PAINTERS[id].box;
  return b.oy * 0.85;
}

// ---------- 하늘/배경 ----------
export type SkyLayer = 'sky' | 'moon' | 'clouds' | 'mount0' | 'mount1' | 'cliffs' | 'grove';
/** 코드로 그리는 하늘·배경 층 (필요한 층만 — 참고 화면 조각이 있으면 그 층은 그리지 않는다) */
export function ensureSky(scene: Phaser.Scene, sky: W.SkyKind, layers: SkyLayer[] = ['sky', 'moon', 'clouds', 'mount0', 'mount1', 'cliffs', 'grove']) {
  const k = (n: string) => `bg_${sky}_${n}`;
  const paint: Record<SkyLayer, () => HTMLCanvasElement> = {
    sky: () => W.paintSky(sky), moon: () => W.paintMoon(sky), clouds: () => W.paintCloudBand(sky),
    mount0: () => W.paintMountains(sky, 0), mount1: () => W.paintMountains(sky, 1), cliffs: () => W.paintCliffs(sky).canvas, grove: () => W.paintGrove(sky),
  };
  // 받은 배경 그림이 있으면 그 층은 그대로 쓰고, 없는 층만 그린다
  for (const n of layers) if (!scene.textures.exists(k(n))) addCanvas(scene, k(n), paint[n]());
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
    ['banner', () => W.paintBanner()],
    ['hang_lantern', () => W.paintHangLantern()],
    ['fg_leaves', () => W.paintForegroundLeaves()],
    ['shrine', () => W.paintShrine()],
    ['ground_grass', () => W.paintGroundBody('grass')],
    ['bridge_arch', () => W.paintBridgeArch()],
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
    ['fx_crescent', () => O.paintCrescent()],
    ['fx_thunderball', () => O.paintThunderBall()],
    ['fx_clawwave', () => O.paintClawWave()],
    ['fx_spike', () => O.paintSpike()],
    ['fx_wave', () => O.paintTidalWave()],
    ['fx_pillar', () => O.paintLightPillar()],
    ['fx_column', () => O.paintFireColumn()],
    ['fx_storm', () => O.paintStormCloud()],
    ['fx_rain', () => O.paintRainStreak()],
    ['moon_ult', () => W.paintMoon('night')],
    ['btn_lotus', () => O.paintLotusButton()],
    ['joy_base', () => O.paintJoystickBase()],
    ['fx_paw', () => O.paintPawPrint()],
    ['fx_cloudpuff', () => O.paintCloudPuff()],
    ['fly_cloud', () => O.paintFlyCloud()],
    ['orn_knot', () => O.paintOrnament('knot')],
    ['orn_jade', () => O.paintOrnament('jade')],
    ['orn_bell', () => O.paintOrnament('bell')],
    ['joy_knob', () => O.paintJoystickKnob()],
    ['btn_swirl_blue', () => O.paintSwirlButton('#4fb6ff', '#2a6fd0')],
    ['btn_swirl_red', () => O.paintSwirlButton('#ff6a4a', '#c3352c')],
    ['ui_panel', () => O.paintPanel(false)],
    ['ui_panel_dark', () => O.paintPanel(true)],
    ['ui_btn', () => O.paintButton('normal')],
    ['ui_btn_primary', () => O.paintButton('primary')],
    ['ui_btn_disabled', () => O.paintButton('disabled')],
    ['ui_card', () => O.paintCard('normal')],
    ['ui_card_sel', () => O.paintCard('sel')],
    ['ui_card_dark', () => O.paintCard('dark')],
    ['ui_card_lock', () => O.paintCard('lock')],
    ['ui_dancheong', () => O.paintDancheong()],
    ['ui_seal', () => O.paintSealButton()],
    ['ui_tab', () => O.paintTab(false)],
    ['ui_tab_on', () => O.paintTab(true)],
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
