import { describe, expect, it } from 'vitest'

import { MockGuesserProvider } from '../src/mock-provider.js'
import {
    createDefaultRegistry,
    GuesserProviderRegistry,
} from '../src/registry.js'

describe('GuesserProviderRegistry', () => {
    it('traz o mock por padrão e não o codex', () => {
        const registry = createDefaultRegistry()
        expect(registry.has('mock')).toBe(true)
        expect(registry.has('codex')).toBe(false)
        expect(registry.create('mock')).toBeInstanceOf(MockGuesserProvider)
    })

    it('lança ao criar um provedor não registrado', () => {
        const registry = new GuesserProviderRegistry()
        expect(() => registry.create('codex')).toThrow(/não está registrado/)
    })

    it('permite registrar um provedor adicional por configuração', () => {
        const registry = createDefaultRegistry().register('codex', () => ({
            id: 'codex',
            guess: () => Promise.resolve({ guess: 'acenar' }),
        }))
        expect(registry.has('codex')).toBe(true)
        expect(registry.create('codex').id).toBe('codex')
    })
})
