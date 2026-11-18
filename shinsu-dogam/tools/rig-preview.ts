// 개발용 리그 미리보기: /tools/rig-preview.html?k=wolf_2,hawk_2&mode=overlay|frames&anims=run,fly
import { rigJob, RIG_FRAMES, type RigAnim } from '../src/art/rig.ts';
import { rigFor, MOUNT_RIGS } from '../src/data/mountRigs.ts';
import { MOUNT_ART } from '../src/data/mountArt.ts';

const q = new URLSearchParams(location.search);
const keys = (q.get('k') ?? 'wolf_2').split(',');
const mode = q.get('mode') ?? 'frames';
const anims = (q.get('anims') ?? 'idle,run,fly,atk').split(',') as RigAnim[];
const scale = Number(q.get('s') ?? 1);
const out = document.getElementById('out')!;
const load = (src: string) => new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
const times: Record<string, number> = {};
(async () => {
  for (const key of keys) {
    const info = MOUNT_ART[key];
    const img = await load(`/public/assets/mounts/${key}.png`);
    const c = document.createElement('canvas'); c.width = info.w; c.height = info.h;
    const cx = c.getContext('2d')!; cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, info.w, info.h);
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('div'); lab.className = 'lab'; lab.textContent = key; row.appendChild(lab);
    if (mode === 'overlay') {
      const o = document.createElement('canvas'); o.width = info.w * 2; o.height = info.h * 2;
      const g = o.getContext('2d')!; g.drawImage(img, 0, 0, o.width, o.height);
      const cols = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324', '#000075', '#808000'];
      (MOUNT_RIGS[key] ?? []).forEach((b, i) => {
        g.strokeStyle = cols[i % cols.length]; g.lineWidth = 2; g.fillStyle = cols[i % cols.length] + '33';
        g.beginPath(); b.poly.forEach(([x, y], j) => (j ? g.lineTo(x * o.width, y * o.height) : g.moveTo(x * o.width, y * o.height))); g.closePath(); g.fill(); g.stroke();
        const pts = b.path ?? (b.pivot ? [b.pivot] : []);
        g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x * o.width, y * o.height) : g.moveTo(x * o.width, y * o.height))); g.stroke();
        for (const [x, y] of pts) { g.fillStyle = cols[i % cols.length]; g.fillRect(x * o.width - 3, y * o.height - 3, 6, 6); }
        g.fillStyle = '#000'; g.font = '11px sans-serif'; g.fillText(b.id, (pts[0]?.[0] ?? 0) * o.width + 4, (pts[0]?.[1] ?? 0) * o.height - 4);
      });
      row.appendChild(o);
    } else {
      const t0 = performance.now();
      const res = rigJob(data, rigFor(key, info.motion), info.seat).finish();
      times[key] = Math.round(performance.now() - t0);
      for (const a of anims) {
        const n = RIG_FRAMES[a];
        const fr = res.frames.filter((f) => f.anim === a);
        const pick = fr.filter((_, i) => i % (n > 4 ? 2 : 1) === 0);
        for (const f of pick) {
          const cv = document.createElement('canvas'); cv.width = f.w * scale; cv.height = f.h * scale;
          const g = cv.getContext('2d')!; g.drawImage(res.canvas, f.x, f.y, f.w, f.h, 0, 0, cv.width, cv.height);
          g.fillStyle = '#0006'; g.font = '10px sans-serif'; g.fillText(`${a}${f.i}`, 2, 10);
          row.appendChild(cv);
        }
      }
    }
    out.appendChild(row);
  }
  (window as any).__times = times;
  document.title = 'ready';
})();
