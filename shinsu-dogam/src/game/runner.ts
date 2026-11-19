// 달리는 영물 + 하람 (타이틀·서장·엔딩에서 배경만 흐르게 하고 제자리 달리기)
import Phaser from 'phaser';
import { store } from './ctx.ts';
import { ensureMount, ensureRider, riderMeta } from './textures.ts';
import { MOUNT_ART, artKey } from '../data/mountArt.ts';
import type { MountId } from '../data/types.ts';

export function makeRunner(scene: Phaser.Scene, x: number, y: number, scale = 1.25, mountId?: MountId) {
  const st = store.state;
  const id = mountId ?? st.data.activeMount;
  const ms = st.data.mounts[id];
  const stage = ms?.stage ?? 0;
  const mt = ensureMount(scene, id, stage, ms?.skin);
  const info = MOUNT_ART[artKey(id, stage)];
  const spr = scene.add.sprite(0, 0, mt.key, 'run_0').setOrigin(mt.originX, mt.originY).setScale(scale * mt.scale);
  spr.play(`${mt.key}:run`);
  const rk = ensureRider(scene, st.data.cosmetics.outfit);
  const rm = riderMeta(rk);
  const seatX = mt.seatPx ? mt.seatPx[0] * mt.scale * scale : (info.seat[0] - 0.5) * info.w * scale * info.scale;
  const seatY = mt.seatPx ? mt.seatPx[1] * mt.scale * scale : -(1 - info.seat[1]) * info.h * scale * info.scale;
  const rider = scene.add.sprite(seatX, seatY, rk, 'run_0').setOrigin(rm.ox, rm.oy).setScale(Math.max(0.56, Math.min(0.86, (info.h * info.scale) / 150)) * scale * rm.scaleMul);
  rider.play(`${rk}:run`);
  return scene.add.container(x, y, [spr, rider]);
}
