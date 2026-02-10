import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import { plugin } from 'postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['**/.next/**', '**/node_modules/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off', // This allows the use of require() in TypeScript files.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // This allows unused variables if they start with an underscore, which is a common convention for indicating that a variable is intentionally unused.
      'no-unused-vars': 'off', // This is to avoid conflicts with the TypeScript version of the rule.
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/postcss.config.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
    plugins: [
      '@typescript-eslint',
      'prettier',
      'react',
      'react-hooks',
      'jsx-a11y',
      'import',
      'eslint-comments',
      '@tanstack/query',
    ],
  },
];

export default eslintConfig;
