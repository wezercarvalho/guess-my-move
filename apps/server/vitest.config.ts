import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// NestJS depende de emitDecoratorMetadata. O esbuild do Vitest não preserva os
// metadados de decorators; unplugin-swc transforma os arquivos com o SWC
// (legacyDecorator + decoratorMetadata), reproduzindo o que o tsc faz no build.
export default defineConfig({
    plugins: [
        swc.vite({
            jsc: {
                parser: { syntax: 'typescript', decorators: true },
                transform: {
                    legacyDecorator: true,
                    decoratorMetadata: true,
                },
            },
        }),
    ],
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
    },
})
