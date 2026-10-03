import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Migrates and seeds template databases once; each file copies one.
    globalSetup: ['./test/global-setup.ts'],
    hookTimeout: 120_000,
    // Password hashing (bcrypt cost 12) is deliberately slow; give tests room when files run in parallel.
    testTimeout: 30_000,
  },
});
