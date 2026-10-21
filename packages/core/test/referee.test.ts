import { describe, expect, it } from 'vitest'

import { acenarCard, judge, normalize } from '../src/index.js'

const evaluation = acenarCard.evaluation

describe('árbitro — normalização (#13)', () => {
    it('minúsculas, acentos, pontuação e espaços', () => {
        expect(normalize('  Acenar!!! ')).toBe('acenar')
        expect(normalize('ACENANDO')).toBe('acenando')
        expect(normalize('Dar  Tchau.')).toBe('dar tchau')
        expect(normalize('Waving   Goodbye')).toBe('waving goodbye')
        expect(normalize('é, à, ç, ã, õ')).toBe('e a c a o')
    })

    it('trata vazio, só pontuação e só espaços como string vazia', () => {
        expect(normalize('')).toBe('')
        expect(normalize('   ')).toBe('')
        expect(normalize('!?.,;')).toBe('')
    })
})

describe('árbitro — veredito determinístico (#13)', () => {
    it('palpite canônico acerta com método canonical', () => {
        const r = judge(evaluation, 'acenar')
        expect(r.isCorrect).toBe(true)
        expect(r.method).toBe('canonical')
        expect(r.matchedAnswer).toBe('acenar')
    })

    it('"dar tchau" acerta por alias', () => {
        const r = judge(evaluation, 'dar tchau')
        expect(r.isCorrect).toBe(true)
        expect(r.method).toBe('alias')
        expect(r.matchedAnswer).toBe('dar tchau')
    })

    it('"waving" acerta por alias (variante em inglês)', () => {
        const r = judge(evaluation, 'waving')
        expect(r.isCorrect).toBe(true)
        expect(r.method).toBe('alias')
    })

    it('acerta ignorando caixa, acento e pontuação', () => {
        expect(judge(evaluation, 'Acenando!').isCorrect).toBe(true)
        expect(judge(evaluation, '  DAR TCHAU  ').isCorrect).toBe(true)
    })

    it('"levantar a mão" é incorreto (insuficiente)', () => {
        const r = judge(evaluation, 'levantar a mão')
        expect(r.isCorrect).toBe(false)
        expect(r.method).toBe('insufficient')
    })

    it('NÃO casa por substring', () => {
        // "acenar" não deve casar como substring de outra expressão.
        const r = judge(evaluation, 'estou pensando em acenar para alguém depois')
        expect(r.isCorrect).toBe(false)
        expect(r.method).not.toBe('canonical')
        expect(r.method).not.toBe('alias')
        // "waving" dentro de outra palavra não conta.
        expect(judge(evaluation, 'unwavingly').isCorrect).toBe(false)
    })

    it('palpite desconhecido e não insuficiente → none', () => {
        const r = judge(evaluation, 'dançar balé')
        expect(r.isCorrect).toBe(false)
        expect(r.method).toBe('none')
    })

    it('palpite vazio/só pontuação → undetermined, nunca acerto', () => {
        expect(judge(evaluation, '').method).toBe('undetermined')
        expect(judge(evaluation, '   ').method).toBe('undetermined')
        expect(judge(evaluation, '!?').isCorrect).toBe(false)
    })

    it('registra um motivo resumido no veredito', () => {
        expect(judge(evaluation, 'acenar').reason).toBeTruthy()
        expect(judge(evaluation, 'levantar a mão').reason).toBeTruthy()
    })

    it('"acenando para a câmera" é tratado como insuficiente/none, não acerto', () => {
        // Decisão documentada: contém "acenando" mas a expressão como um todo
        // não é equivalente ao canônico nem a um alias cadastrado; sem
        // correspondência por substring, não conta como acerto.
        const r = judge(evaluation, 'acenando para a câmera')
        expect(r.isCorrect).toBe(false)
    })
})
