/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pacotes workspace: `source` aponta para o código-fonte (sem build prévio).
export default defineConfig({
    plugins: [react()],
    resolve: { conditions: ['source'] },
    // Duas entradas: o jogo de cartas (index.html) e o bete (marbles.html).
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                marbles: 'marbles.html',
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test-setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
})
