import { describe, expect, it } from 'vitest'

import { HealthController } from '../src/health/health.controller.js'
import { SlidingWindowRateLimiter } from '../src/multiplayer/rate-limit.js'
import { loadServerConfig } from '../src/server-config.js'

describe('configuração do servidor', () => {
    it('usa padrões seguros e aceita valores explícitos', () => {
        expect(loadServerConfig({})).toEqual({ port: 3000, maxRooms: 100, tickMs: 33 })
        expect(loadServerConfig({ PORT: '4567', MAX_ROOMS: '25', SERVER_TICK_MS: '50' })).toEqual({
            port: 4567,
            maxRooms: 25,
            tickMs: 50,
        })
    })

    it('recusa porta, limite e tick inválidos no boot', () => {
        expect(() => loadServerConfig({ PORT: '0' })).toThrow()
        expect(() => loadServerConfig({ MAX_ROOMS: '-1' })).toThrow()
        expect(() => loadServerConfig({ SERVER_TICK_MS: 'texto' })).toThrow()
    })
})

describe('health', () => {
    it('responde sem expor configuração ou salas', () => {
        expect(new HealthController().check()).toEqual({ status: 'ok' })
    })
})

describe('SlidingWindowRateLimiter', () => {
    it('aceita 20 comandos em um segundo, recusa o 21º e libera após a janela', () => {
        let now = 1000
        const limiter = new SlidingWindowRateLimiter({ limit: 20, windowMs: 1000, now: () => now })
        for (let i = 0; i < 20; i++) expect(limiter.accept('socket-1')).toBe(true)
        expect(limiter.accept('socket-1')).toBe(false)
        expect(limiter.accept('socket-2')).toBe(true)
        now += 1001
        expect(limiter.accept('socket-1')).toBe(true)
        limiter.forget('socket-1')
        expect(limiter.accept('socket-1')).toBe(true)
    })
})
