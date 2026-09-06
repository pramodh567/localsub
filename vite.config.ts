import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'index.html',
        offscreen: 'src/offscreen/offscreen.html',
        background: 'src/background/service-worker.ts',
        content: 'src/content/content.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
