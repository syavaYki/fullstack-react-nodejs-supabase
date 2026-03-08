import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Provide stub env vars so modules with Zod env validation don't call process.exit
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      FRONTEND_URL: 'http://localhost:5173',
      BACKEND_URL: 'http://localhost:3001',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/__tests__/mocks/**',
        'src/index.ts',
        'src/config/stripe.ts',
        'src/config/supabase.ts',
        'src/config/swagger.ts',
      ],
    },
  },
  resolve: {
    alias: [
      // Map .js imports to their TypeScript source files.
      // NodeNext requires .js extensions in source imports, but Vitest
      // runs TypeScript files directly — stripping .js lets Vite find them.
      {
        find: /^(\.{1,2}\/.*)\.js$/,
        replacement: '$1',
      },
    ],
  },
});
