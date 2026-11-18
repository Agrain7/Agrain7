// 현재 리깅 모션을 프레임별 PNG(data URL)로 내보낸다 → tools/export_poses.mjs 가 파일로 저장
import { rigJob } from '../src/art/rig.ts';
import { rigFor } from '../src/data/mountRigs.ts';
import { MOUNT_ART } from '../src/data/mountArt.ts';
const q = new URLSearchParams(location.search);
const key = q.get('k') ?? 'hawk_2';
const scale = Number(q.get('s') ?? 3);
const info = MOUNT_ART[key];
const img = new Image();
img.onload = () => {
  const c = document.createElement('canvas'); c.width = info.w; c.height = info.h;
  const cx = c.getContext('2d')!; cx.drawImage(img, 0, 0);
  const res = rigJob(cx.getImageData(0, 0, info.w, info.h), rigFor(key, info.motion), info.seat).finish();
  const out: Record<string, string> = {};
  for (const f of res.frames) {
    const fc = document.createElement('canvas'); fc.width = Math.round(f.w * scale); fc.height = Math.round(f.h * scale);
    const g = fc.getContext('2d')!; g.imageSmoothingQuality = 'high';
    g.drawImage(res.canvas, f.x, f.y, f.w, f.h, 0, 0, fc.width, fc.height);
    out[f.name] = fc.toDataURL('image/png');
  }
  (window as any).__poses = { frames: out, seat: [(res.padX + info.seat[0] * info.w) * scale, (res.padTop + info.seat[1] * info.h) * scale] };
  document.title = 'ready';
};
img.src = `/public/assets/mounts/${key}.png`;
