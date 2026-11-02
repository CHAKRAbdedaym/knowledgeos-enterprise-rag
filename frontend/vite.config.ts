import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            if (/\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id))
              return 'animation';
            if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          }
        },
      },
    },
  },
  server: {
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // Keep DOM-heavy interaction suites stable on the local 8 GB demo machine.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
  },
});
