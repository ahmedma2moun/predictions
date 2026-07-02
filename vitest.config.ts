import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/helpers/global-setup.ts',
    setupFiles: ['./tests/helpers/setup-env.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
