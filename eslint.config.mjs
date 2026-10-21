import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Gate de lint do escopo `code`: cobre o código da aplicação (apps/ e
// packages/). As ferramentas de governança (scripts/, test/, workflows) têm
// gates próprios (test:gates, test:sdd) e ficam fora deste lint para preservar
// a fronteira de propriedade entre o scaffold e a governança.
export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/*.tsbuildinfo',
            'coverage/**',
            'scripts/**',
            'test/**',
            '*.mjs',
            '*.cjs',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        'apps/web/vite.config.ts',
                        'apps/server/vitest.config.ts',
                        'packages/providers/vitest.config.ts',
                        'packages/benchmark/vitest.config.ts',
                    ],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    // Frontend: React 19 + hooks.
    {
        files: ['apps/web/**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        languageOptions: {
            globals: { ...globals.browser },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
    // Servidor NestJS: decorators exigem classes vazias e metadados.
    {
        files: ['apps/server/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node },
        },
        rules: {
            '@typescript-eslint/no-extraneous-class': 'off',
        },
    },
    // Arquivos de configuração em TypeScript rodam em Node.
    {
        files: ['**/*.config.{ts,mts}'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
)
