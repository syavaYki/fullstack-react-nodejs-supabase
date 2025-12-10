/**
 * ESLint configuration for the frontend package.
 * Extends root config with React-specific rules.
 */
module.exports = {
  extends: ['../../.eslintrc.cjs', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: ['react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
  },
  rules: {
    // React 17+ doesn't require React in scope for JSX
    'react/react-in-jsx-scope': 'off',
    // TypeScript handles prop types
    'react/prop-types': 'off',
    // Allow spreading props (common with MUI)
    'react/jsx-props-no-spreading': 'off',
    // Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // Allow apostrophes and quotes in JSX text (common in English)
    'react/no-unescaped-entities': 'off',
  },
};
