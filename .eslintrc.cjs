/**
 * ESLint configuration for the monorepo.
 * Provides base TypeScript rules that can be extended by packages.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Allow unused vars that start with underscore (common pattern)
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Allow explicit any as warning (too many to fix immediately)
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow empty functions (common in stubs/mocks)
    '@typescript-eslint/no-empty-function': 'off',
    // Prefer const
    'prefer-const': 'error',
    // Allow console.log in backend (common for debugging/logging)
    'no-console': 'off',
    // Allow empty object patterns (common in React Router loaders)
    'no-empty-pattern': 'off',
  },
  ignorePatterns: ['dist', 'build', 'node_modules', '.react-router', '*.d.ts'],
};
