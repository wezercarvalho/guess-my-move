import { describe, expect, it } from 'vitest'

import { matchesWaving, normalize } from '../src/semantics.js'

describe('normalize', () => {
    it('remove acentos, pontuação e colapsa espaços', () => {
        expect(normalize('  Acenar, com a MÃO!  ')).toBe('acenar com a mao')
    })
})

describe('matchesWaving', () => {
    it('casa palpites equivalentes a acenar', () => {
        for (const g of ['acenar', 'Acenando com a mão', 'dar tchau', 'waving hand']) {
            expect(matchesWaving(g).matched).toBe(true)
        }
    })

    it('rejeita genéricos conhecidos', () => {
        expect(matchesWaving('levantar a mão').matched).toBe(false)
        expect(matchesWaving('mostrar a palma').matched).toBe(false)
    })

    it('rejeita palpite vazio', () => {
        expect(matchesWaving('').matched).toBe(false)
        expect(matchesWaving('   ').matched).toBe(false)
    })

    it('expõe o alias que casou', () => {
        expect(matchesWaving('está acenando').via).toBe('acenando')
    })
})
