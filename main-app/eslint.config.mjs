import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['**/.next/**', '**/node_modules/**'],
  },
  {
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'prettier',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:@tanstack/query/recommended',
  ),
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
      'react/react-in-jsx-scope': 'off', // Next.js uses the new JSX transform.
      'react-hooks/set-state-in-effect': 'off', // Allow mounted guards for client-only UI.
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/postcss.config.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
