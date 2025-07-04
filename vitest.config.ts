import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Specify the environment for your tests
    // 'happy-dom' or 'jsdom' for browser-like environment
    // 'node' for Node.js environment
    // For Cloudflare Workers, 'miniflare' is an option if you want to simulate the environment more closely,
    // but for Hono unit/integration tests, 'node' or 'happy-dom' might be sufficient.
    // Let's start with 'happy-dom' as it's common for web framework tests.
    environment: 'happy-dom',
    globals: true, // Use if you want Vitest to inject global variables like describe, it, expect
    // You can also specify test file patterns
    // include: ['src/**/*.test.ts'],
    // Setup files to run before each test file
    // setupFiles: ['./vitest.setup.ts'],

    // Cloudflare Workers specific settings might be needed if tests interact deeply with CF features.
    // For Hono request/response testing, this basic setup should work.
    // If your code uses specific Cloudflare runtime APIs (like KV, DO, R2),
    // you might need to mock them or use miniflare.
    // For now, we are mocking these at the test file level.
  },
  // If you're using TypeScript, Vitest should pick up your tsconfig.json automatically.
  // You can specify tsconfig path if it's non-standard.
  // resolve: {
  //   alias: {
  //      // Add any aliases you use in your project
  //   }
  // }
});
