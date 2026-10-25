import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['build', 'node_modules', 'playwright-report', 'test-results'] },

  // All source files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended, react.configs.flat.recommended, react.configs.flat['jsx-runtime']],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // PropTypes are not used; TypeScript covers this for .tsx files.
      'react/prop-types': 'off',
      // Plain text in JSX (e.g. "don't") is fine.
      'react/no-unescaped-entities': 'off',
      // Same as Create React App: unused function arguments, caught errors and
      // props removed via `{ a, ...rest }` are fine.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },

  // TypeScript files: type-aware rules from typescript-eslint
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
    },
  },

  // Formatting is Prettier's job: turn off ESLint rules that would conflict with it.
  prettier,

  // Config files run in Node
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
