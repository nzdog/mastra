import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      // Type safety (basic rules without project-level typechecking)
      '@typescript-eslint/no-explicit-any': 'warn', // Warn, not error (allow for interop)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // General code quality
      'no-console': 'off', // Allow console.log for logging
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Error handling
      'no-throw-literal': 'error',

      // Import organization
      'import/order': [
        'warn', // Changed from 'error' to 'warn' to avoid blocking on edge cases
        {
          groups: [
            'builtin', // Node built-ins
            'external', // npm packages
            'internal', // Project imports
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.cjs', '*.mjs'],
  },
];
