import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

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
    },
    rules: {
      // Type safety (basic rules without project-level typechecking)
      '@typescript-eslint/no-explicit-any': 'warn', // Warn, not error (allow for interop)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
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
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'build/',
      'coverage/',
      '.nyc_output/',
      'migrations/',
      'docs/',
      '*.config.js',
      '*.config.mjs',
      '*.min.js',
      '*.bundle.js',
      '**/__snapshots__/',
      '.env',
      '.env.*',
    ],
  },
];
