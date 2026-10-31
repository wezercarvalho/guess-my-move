import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: { conditions: ['source'] },
    ssr: { resolve: { conditions: ['source'] } },
    plugins: [
        swc.vite({
            jsc: {
                parser: { syntax: 'typescript', decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
            },
        }),
    ],
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
    },
})
