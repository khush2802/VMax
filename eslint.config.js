// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'data/**', 'versions/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Node-side code: adapters, tests, tools and config files.
    files: ['packages/*/src/adapters/**', 'packages/*/test/**', 'tools/**', '*.js', '*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The distance loops read typed arrays with `a[i]!`: a documented exception to
    // noUncheckedIndexedAccess, because the caller guarantees the bounds.
    files: ['packages/core/src/distance.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);
