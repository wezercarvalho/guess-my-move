import { defineConfig } from 'vitest/config'
import base from './vitest.config.js'

export default defineConfig({
    ...base,
    test: {
        ...base.test,
        include: ['integration/**/*.test.ts'],
        testTimeout: 20000,
        hookTimeout: 5000,
    },
})
