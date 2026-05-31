import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
      // `server-only` is a build-time guard with no runtime resolution; stub it so
      // server modules that import it (e.g. digital_goods/server-api.ts) are testable.
      'server-only': path.resolve(__dirname, './test/stubs/server-only.ts'),
    },
  },
});
