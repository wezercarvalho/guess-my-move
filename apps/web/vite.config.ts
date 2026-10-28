/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pacotes workspace: `source` aponta para o código-fonte (sem build prévio).
export default defineConfig({
    plugins: [react()],
    resolve: { conditions: ['source'] },
    // Entradas: o menu (index.html), o jogo de cartas, o bete (marbles.html) e o Arranha-Teia.
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                cards: 'cards.html',
                marbles: 'marbles.html',
                swing: 'swing.html',
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
