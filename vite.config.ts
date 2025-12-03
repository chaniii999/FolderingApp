import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  base: './',
  build: {
    outDir: 'dist',
    minify: 'esbuild', // esbuild는 기본 포함되어 있고 빠름
    sourcemap: false, // 소스맵 비활성화로 용량 절감
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': ['react-markdown', 'remark-gfm'],
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000, // 청크 크기 경고 임계값
    reportCompressedSize: false, // 압축 크기 보고 비활성화로 빌드 속도 향상
  },
});

