import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'scripts/templates/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, __PWA__: 'readonly', __BENCH__: 'readonly', __DEBUG_KEY__: 'readonly', __VERSION__: 'readonly' },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.js', 'tests/**/*.mjs', '*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
];
