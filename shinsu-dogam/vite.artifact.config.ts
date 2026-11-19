import { defineConfig } from 'vite';

// 아티팩트용 단일 스크립트 빌드: Phaser는 외부(전역 Phaser) → tools/build-artifact.mjs 가 HTML에 인라인
export default defineConfig({
  base: './',
  publicDir: false,
  // 플레이테스트 선물 (영물 9종 각성체). id를 바꾸면 이미 받은 저장 데이터에도 다시 지급된다
  // 플레이테스트: 모든 지역 열기 (정식 빌드에는 없음)
  define: { 'import.meta.env.VITE_PLAYTEST_GIFT': JSON.stringify('2026-11-19-all9'), 'import.meta.env.VITE_PLAYTEST_OPEN': JSON.stringify('1') },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    target: 'es2022',
    lib: { entry: 'src/main-artifact.ts', name: 'ShinsuDogam', formats: ['iife'], fileName: () => 'game.js' },
    rollupOptions: { external: ['phaser'], output: { globals: { phaser: 'Phaser' } } },
  },
});
