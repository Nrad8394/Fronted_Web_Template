import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Next.js build output and node_modules would otherwise be scanned for
    // test files on every run.
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Config, generated types and the example route are not logic worth
      // measuring; including them makes the number look worse than the code is
      // and pushes people to write tests that only execute lines.
      exclude: [
        'node_modules',
        '.next',
        '**/*.config.*',
        '**/*.d.ts',
        'app/**',
        'vitest.setup.ts',
      ],
    },
  },
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.json. Vitest does not read
      // tsconfig paths on its own, so this has to be kept in step.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
