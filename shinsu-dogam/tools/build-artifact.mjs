// Claude 아티팩트용 페이지 생성: dist-artifact/index.html (게임 코드 인라인) + assets/{mounts,monsters,backgrounds,ui}/*.png
// 사용법: node tools/build-artifact.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, cpSync } from 'node:fs';

execSync('npx vite build --config vite.artifact.config.ts', { stdio: 'inherit' });
const js = readFileSync('dist-artifact/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
mkdirSync('dist-artifact/assets/mounts', { recursive: true });
for (const f of readdirSync('public/assets/mounts')) if (f.endsWith('.png')) copyFileSync(`public/assets/mounts/${f}`, `dist-artifact/assets/mounts/${f}`);
// 몬스터 그림, 참고 화면 원경 파노라마, HUD 초상
for (const dir of ['monsters', 'backgrounds', 'ui', 'scenery', 'rider']) {
  mkdirSync(`dist-artifact/assets/${dir}`, { recursive: true });
  for (const f of readdirSync(`public/assets/${dir}`)) if (f.endsWith('.png') || f.endsWith('.json')) copyFileSync(`public/assets/${dir}/${f}`, `dist-artifact/assets/${dir}/${f}`);
}
// 받은 그림(프레임 시트·배경)도 함께
cpSync('public/assets/sprites', 'dist-artifact/assets/sprites', { recursive: true });

const html = `<title>신수도감</title>
<meta name="description" content="영물을 타고, 동방의 세계를 누비다 — 한국 전통 영물 2D 횡스크롤 라이딩 게임">
<meta name="theme-color" content="#14121d">
<style>
  /* 한 가지 화면(어두운 먹색 무대)으로 고정한 게임 페이지 */
  :root { --stage: #14121d; --ink: #f3e6c8; --gold: #e2b14c; color-scheme: dark; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--stage); color: var(--ink); overflow: hidden; touch-action: none;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #frame { position: fixed; inset: 0; box-sizing: border-box; background: var(--stage);
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
  #game { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  #game canvas { display: block; }
  #rotate { display: none; position: fixed; inset: 0; z-index: 10; background: var(--stage); color: var(--ink);
    font-family: "Gowun Dodum", sans-serif; align-items: center; justify-content: center; flex-direction: column; gap: 16px; text-align: center; padding: 24px; }
  #rotate .phone { width: 46px; height: 78px; border: 3px solid var(--gold); border-radius: 9px; animation: rot 2.4s ease-in-out infinite; }
  @keyframes rot { 0%, 30% { transform: rotate(0deg); } 60%, 100% { transform: rotate(-90deg); } }
  @media (prefers-reduced-motion: reduce) { #rotate .phone { animation: none; } }
  @media (orientation: portrait) and (pointer: coarse) { #rotate { display: flex; } }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&family=Noto+Serif+KR:wght@700&display=swap">
<div id="frame"><div id="game"></div></div>
<div id="rotate"><div class="phone"></div><div>화면을 가로로 돌려 주세요<br><small>신수도감은 가로 화면에 맞춰 제작되었습니다.</small></div></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js"></script>
<script>
${js}
</script>
`;
writeFileSync('dist-artifact/index.html', html);
console.log('dist-artifact/index.html', (html.length / 1024).toFixed(0) + 'KB');
