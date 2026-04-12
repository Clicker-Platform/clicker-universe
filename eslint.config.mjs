// Root ESLint config for the Clicker Universe monorepo.
// Each sub-app (clicker-platform-v2, auth-gateway, etc.) has its own eslint.config.mjs.
// This root config is used for monorepo-level scripts and shared tooling.

import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.bak',
    'scripts/**',
  ]),
  {
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'warn',
    },
  },
]);

export default eslintConfig;
