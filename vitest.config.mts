import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@/src': new URL('./src', import.meta.url).pathname,
      '@/config': new URL('./config', import.meta.url).pathname,
    },
  },
});
