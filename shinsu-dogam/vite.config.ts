import { defineConfig } from 'vite';

// 신수도감 빌드 설정
// - base: './' 로 두면 Cloudflare Pages 등 어떤 경로에 올려도 동작합니다.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
});
