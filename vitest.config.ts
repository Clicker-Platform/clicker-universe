import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./clicker-platform-v2/vitest.setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'clicker-platform-v2/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['clicker-platform-v2/**/*.{ts,tsx}'],
      exclude: [
        'clicker-platform-v2/node_modules/**',
        'clicker-platform-v2/.next/**',
        'clicker-platform-v2/**/*.d.ts',
        'clicker-platform-v2/legacy/**',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './clicker-platform-v2'),
    },
  },
});
