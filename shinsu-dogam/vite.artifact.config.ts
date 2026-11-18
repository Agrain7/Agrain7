import { defineConfig } from 'vite';

// 아티팩트용 단일 스크립트 빌드: Phaser는 외부(전역 Phaser) → tools/build-artifact.mjs 가 HTML에 인라인
export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    target: 'es2022',
    lib: { entry: 'src/main-artifact.ts', name: 'ShinsuDogam', formats: ['iife'], fileName: () => 'game.js' },
    rollupOptions: { external: ['phaser'], output: { globals: { phaser: 'Phaser' } } },
  },
});
