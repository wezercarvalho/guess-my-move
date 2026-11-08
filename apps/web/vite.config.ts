/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pacotes workspace: `source` aponta para o código-fonte (sem build prévio).
export default defineConfig({
    plugins: [react()],
    resolve: { conditions: ['source'] },
    server: {
        proxy: {
            '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
            '/api': 'http://127.0.0.1:3000',
        },
    },
    // Entradas: o menu (index.html), o jogo de cartas, as bolinhas, o Arranha-Teia e o Violão no Ar.
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                cards: 'cards.html',
                marbles: 'marbles.html',
                swing: 'swing.html',
                guitar: 'guitar.html',
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
