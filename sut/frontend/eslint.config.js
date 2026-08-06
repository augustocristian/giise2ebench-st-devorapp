import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'e2e', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // API responses are untyped at the boundary — allow any at service/model layer
      '@typescript-eslint/no-explicit-any': 'off',
      // Ignore _-prefixed vars (intentionally unused) and all catch-clause bindings
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // Hook exported alongside component is intentional in NotificationSystem
      'react-refresh/only-export-components': 'warn',
      // setState in effect is a known pattern here; enforce as warning not error
      'react-hooks/set-state-in-effect': 'warn',
      // Allow empty catch blocks (silent error suppression is explicit)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
])
