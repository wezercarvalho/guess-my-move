/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Porta do servidor configurável via VITE_SERVER_PORT (default 3000); o proxy
// encaminha /api para o servidor NestJS em desenvolvimento.
const serverPort = Number(process.env.VITE_SERVER_PORT ?? 3000)

export default defineConfig({
    plugins: [react()],
    server: {
        port: Number(process.env.VITE_PORT ?? 5173),
        proxy: {
            '/api': {
                target: `http://localhost:${serverPort}`,
                changeOrigin: true,
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
