import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['**/*.test.ts'],
    silent: true,
    coverage: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.js',
        '**/vitest.config.*',
        '**/consts.ts',
        'src/services/index.ts',
        'src/tests/**',
        'test/**',
        '**/mocks/**',
        '**/*.d.ts',
      ],
    },
  },
});
