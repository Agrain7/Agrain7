// 개발용 아트 미리보기: /tools/art-preview.html?m=wolf  (빌드에 포함되지 않음)
import { buildSheet } from '../src/art/sheet.ts';
import { MOUNT_PAINTERS } from '../src/art/registry.ts';

const q = new URLSearchParams(location.search);
const m = q.get('m') ?? 'wolf';
const scale = Number(q.get('scale') ?? 1);
const stages = (q.get('s') ?? '0,1,2').split(',').map(Number);
const skin = q.get('skin') ?? undefined;
const out = document.getElementById('out')!;
if (q.get('dark')) document.body.classList.add('dark');
(async () => {
  const entry = (MOUNT_PAINTERS as any)[m];
  if (entry) {
    for (const s of stages) {
      const pal = { ...entry.palette, ...(skin ? entry.skins?.[skin] ?? {} : {}) };
      const sheet = buildSheet(entry.painter.box(s), entry.painter.anims, (ctx, pose) => entry.painter.draw(ctx, pose, s, pal));
      const c = document.createElement('canvas');
      c.width = sheet.canvas.width * scale; c.height = sheet.canvas.height * scale;
      const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; x.scale(scale, scale); x.drawImage(sheet.canvas, 0, 0);
      // 원점/좌석 표시
      x.fillStyle = 'red';
      for (const f of sheet.frames) {
        const info: any = sheet.infos[f.name];
        x.fillRect(f.x + sheet.box.ox - 1, f.y + sheet.box.oy - 1, 2, 2);
        if (info?.seat) { x.fillStyle = 'magenta'; x.fillRect(f.x + sheet.box.ox + info.seat.x - 2, f.y + sheet.box.oy + info.seat.y - 2, 4, 4); x.fillStyle='red'; }
      }
      out.appendChild(c);
    }
  }
  const extra = (window as any).__extraPreview;
  if (extra) await extra(out, q);
  document.title = 'ready';
})();
