// 그림 작업용 안내 이미지 생성: 프레임 템플릿 + 동작 참고 시트 (tools/art_kit.mjs 가 PNG로 저장)
import '@fontsource/gowun-dodum/400.css';
import '@fontsource/gowun-batang/700.css';
import { rigJob, RIG_FRAMES, type RigAnim } from '../src/art/rig.ts';
import { rigFor } from '../src/data/mountRigs.ts';
import { MOUNT_ART } from '../src/data/mountArt.ts';
import { MOUNTS } from '../src/data/mounts.ts';

const F = '"Gowun Dodum", sans-serif', T = '"Gowun Batang", serif';
const out: Record<string, string> = {};

function frameTemplate(name: string, w: number, h: number, ground: number, opts: { seat?: [number, number]; seatLabel: string; title: string; notes: string[] }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(80,120,200,0.18)'; g.lineWidth = 1;
  for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const m = Math.round(w * 0.06);
  g.setLineDash([10, 8]); g.strokeStyle = 'rgba(40,160,90,0.8)'; g.lineWidth = 3; g.strokeRect(m, m, w - m * 2, h - m * 2); g.setLineDash([]);
  g.strokeStyle = '#c3352c'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, ground); g.lineTo(w, ground); g.stroke();
  g.strokeStyle = 'rgba(40,40,80,0.55)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#1d1a2b'; g.font = `bold ${Math.round(w / 26)}px ${T}`; g.fillText(opts.title, m + 8, m + w / 22);
  g.font = `${Math.round(w / 44)}px ${F}`;
  opts.notes.forEach((t, i) => g.fillText(t, m + 8, m + w / 22 + 14 + (i + 1) * (w / 36)));
  g.fillStyle = '#c3352c'; g.fillText('지면선: 서 있는 동작(대기·달리기·공격)은 발이 모두 이 선에 닿게', 16, ground - 10);
  g.fillStyle = 'rgba(40,40,80,0.8)'; g.fillText('좌우 중심선', w / 2 + 8, h - 18);
  // 진행 방향 화살표
  g.fillStyle = '#e2b14c'; g.strokeStyle = '#7a5a1e'; g.lineWidth = 2;
  const ax = w - m - 150, ay = m + 40;
  g.beginPath(); g.moveTo(ax, ay - 10); g.lineTo(ax + 100, ay - 10); g.lineTo(ax + 100, ay - 26); g.lineTo(ax + 140, ay); g.lineTo(ax + 100, ay + 26); g.lineTo(ax + 100, ay + 10); g.lineTo(ax, ay + 10); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#7a5a1e'; g.fillText('오른쪽을 봄', ax, ay + 50);
  if (opts.seat) {
    const [sx, sy] = opts.seat;
    g.strokeStyle = '#8a2be2'; g.lineWidth = 3; g.beginPath(); g.arc(sx, sy, 16, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(sx - 26, sy); g.lineTo(sx + 26, sy); g.moveTo(sx, sy - 26); g.lineTo(sx, sy + 26); g.stroke();
    g.fillStyle = '#8a2be2'; g.fillText(opts.seatLabel, sx + 24, sy - 20);
  }
  out[name] = c.toDataURL('image/png');
}

function bgTemplate() {
  const w = 2048, h = 760;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const layers: [string, number, number, string][] = [
    ['sky (하늘) — 1280×720, 불투명, 달은 따로 그려도 됨', 0, 720, '#cfd6ff'],
    ['clouds (구름 띠) — 높이 260, 가로 반복, 빈 곳 투명', 30, 260, '#f5ead6'],
    ['mount0 (먼 산) — 높이 460, 가로 반복, 위쪽 투명', 120, 460, '#b9b2d8'],
    ['mount1 (가까운 산) — 높이 460, 가로 반복, 위쪽 투명', 190, 460, '#9c95c4'],
    ['cliffs (절벽·궁궐·폭포) — 높이 620, 가로 반복, 위쪽 투명', 150, 620, '#8a90a8'],
    ['grove (꽃나무 숲) — 높이 440, 가로 반복, 위쪽 투명', 330, 440, '#c99aa8'],
  ];
  g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, w, h);
  layers.forEach(([label, y, lh, col], i) => {
    g.fillStyle = col + '88'; g.fillRect(40 + i * 18, y, w - 80 - i * 36, Math.min(lh, h - y));
    g.strokeStyle = '#1d1a2b'; g.lineWidth = 2; g.strokeRect(40 + i * 18, y, w - 80 - i * 36, Math.min(lh, h - y));
    g.fillStyle = '#1d1a2b'; g.font = `24px ${F}`; g.fillText(label, 60 + i * 18, y + 30 + i * 4);
  });
  g.font = `bold 34px ${T}`; g.fillText('월하산맥 배경 층 (화면 1280×720 기준 위치) — 각 층은 따로 그린 PNG', 40, h - 24);
  out['background_layers_template'] = c.toDataURL('image/png');
}

const DESC: Record<string, Record<RigAnim, string>> = {
  quad: { idle: '대기: 숨쉬기, 꼬리·갈기 살랑 (반복)', run: '달리기: 네 다리 엇갈린 질주, 몸 들썩임 (반복)', fly: '점프: 앞다리 뻗고 뒷다리 접은 도약 자세', atk: '공격: 머리를 내밀며 물기·할퀴기 (1회)' },
  bird: { idle: '대기: 날개 살짝 들썩, 꼬리깃 흔들림', run: '걷기: 다리 번갈아, 날개 반쯤 접음', fly: '비행: 날개 위→아래→위, 끝 깃털이 한 박자 늦게 휨 (반복)', atk: '공격: 날개 크게 펼치며 발톱 내밀기 (1회)' },
  serpent: { idle: '대기: 몸·꼬리·수염 물결', run: '달리기: 다리 번갈아, 몸통 물결', fly: '비행: 몸 전체가 S자로 물결치며 헤엄치듯 (반복)', atk: '공격: 머리 내밀며 물기 (1회)' },
  shell: { idle: '대기: 느린 숨쉬기, 뱀 목 흔들림', run: '걷기: 느린 네 다리 걸음', fly: '(점프) 다리 접기', atk: '공격: 뱀 머리 내밀기 (1회)' },
};

async function motionRef(key: string) {
  const info = MOUNT_ART[key];
  const img = await new Promise<HTMLImageElement>((r) => { const i = new Image(); i.onload = () => r(i); i.src = `/public/assets/mounts/${key}.png`; });
  const c0 = document.createElement('canvas'); c0.width = info.w; c0.height = info.h;
  const x0 = c0.getContext('2d')!; x0.drawImage(img, 0, 0);
  const res = rigJob(x0.getImageData(0, 0, info.w, info.h), rigFor(key, info.motion), info.seat).finish();
  const sc = Math.min(1.4, 300 / res.fw);
  const fw = Math.round(res.fw * sc), fh = Math.round(res.fh * sc);
  const anims = Object.keys(RIG_FRAMES) as RigAnim[];
  const W = 260 + 8 * (fw + 6), H = 90 + anims.length * (fh + 40);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, W, H);
  const [id, st] = key.split('_');
  const def = MOUNTS[id as keyof typeof MOUNTS];
  g.fillStyle = '#1d1a2b'; g.font = `bold 34px ${T}`;
  g.fillText(`${def.name} ${def.stages[Number(st)].name} — 동작 참고 (현재 게임 움직임, 타이밍·자세 기준)`, 20, 46);
  g.font = `18px ${F}`; g.fillStyle = '#7a5a3a';
  g.fillText('같은 디자인으로 프레임마다 다시 그려 주세요 · 투명 배경 · 오른쪽 방향 · 라이더 없이 · 파일 이름 예: run_0.png ~ run_7.png', 20, 76);
  anims.forEach((a, r) => {
    const y = 90 + r * (fh + 40);
    g.fillStyle = '#1d1a2b'; g.font = `bold 22px ${T}`; g.fillText(`${a} (${RIG_FRAMES[a]}장)`, 20, y + 30);
    g.font = `16px ${F}`; g.fillStyle = '#5a4a3a';
    const words = DESC[info.motion][a];
    words.split(/(?<=[,:])\s*/).reduce((yy, part) => { g.fillText(part, 20, yy); return yy + 22; }, y + 58);
    res.frames.filter((f) => f.anim === a).forEach((f, i) => {
      const x = 250 + i * (fw + 6);
      g.fillStyle = '#e9e3d6'; g.fillRect(x, y, fw, fh);
      g.drawImage(res.canvas, f.x, f.y, f.w, f.h, x, y, fw, fh);
      g.fillStyle = '#7a5a3a'; g.font = `14px ${F}`; g.fillText(`${a}_${i}`, x + 4, y + fh + 16);
    });
  });
  out[`motion_${key}`] = c.toDataURL('image/jpeg', 0.85);
}

(async () => {
  await document.fonts.load(`20px "Gowun Dodum"`, '가나다');
  await document.fonts.load(`bold 20px "Gowun Batang"`, '가나다');
  frameTemplate('mount_frame_template', 1024, 1024, 920, { seat: [512, 420], seatLabel: '안장(라이더 자리)', title: '영물 프레임 템플릿 1024×1024', notes: ['초록 점선 안에 그리기 (날개·꼬리 포함)', '모든 프레임 같은 캔버스·같은 위치', '라이더는 그리지 말 것 (게임이 얹음)', '안장 높이는 모든 프레임에서 비슷하게', '투명 배경 PNG'] });
  frameTemplate('rider_frame_template', 512, 512, 470, { seat: [256, 360], seatLabel: '엉덩이(안장 닿는 점)', title: '라이더 프레임 템플릿 512×512', notes: ['앉은 자세 · 다리는 영물 옆구리로', '모든 프레임에서 엉덩이 위치 고정', '투명 배경 PNG'] });
  frameTemplate('monster_frame_template', 768, 768, 700, { seatLabel: '', title: '몬스터 프레임 템플릿 768×768', notes: ['오른쪽을 봄 (게임이 뒤집어 씀)', '발은 지면선 · 비행 몬스터는 가운데', '투명 배경 PNG'] });
  bgTemplate();
  for (const k of ['wolf_0', 'wolf_1', 'wolf_2', 'hawk_0', 'hawk_1', 'hawk_2', 'cheongryong_0', 'cheongryong_1', 'cheongryong_2']) await motionRef(k);
  (window as any).__kit = out;
  document.title = 'ready';
})();
