import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  // Other sessions' worktrees live under .claude/; their tests are theirs to run.
  test: { exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'] },
});
