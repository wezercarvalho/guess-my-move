import { describe, expect, it } from 'vitest'

import { STEPS, currentStep, guideHint, statusLine } from './guide.js'

const ok = {
    cameraActive: true,
    trackerStatus: 'ready' as const,
    handVisible: true,
    gestureHeld: true,
    lastThrow: null,
    cue: 'swing' as const,
}

describe('currentStep', () => {
    it('destaca a etapa da próxima ação', () => {
        expect(currentStep('start')).toBe(1)
        expect(currentStep('throw')).toBe(2)
        expect(currentStep('low')).toBe(2)
        expect(currentStep('ground')).toBe(2)
        expect(currentStep('swing')).toBe(3)
        expect(currentStep('release')).toBe(4)
        expect(STEPS).toHaveLength(4)
    })
})

describe('statusLine', () => {
    it('diz em uma linha o que fazer agora', () => {
        expect(statusLine('start')).toMatch(/pose de teia/i)
        expect(statusLine('throw')).toMatch(/lance a teia/i)
        expect(statusLine('swing')).toMatch(/balançando/i)
        expect(statusLine('release')).toMatch(/solte/i)
        expect(statusLine('low')).toMatch(/chão/i)
        expect(statusLine('ground')).toMatch(/subir/i)
    })
})

describe('guideHint', () => {
    it('fica vazia quando está tudo certo', () => {
        expect(guideHint(ok)).toBe('')
    })

    it('manda usar o teclado quando o detector falha', () => {
        expect(guideHint({ ...ok, trackerStatus: 'error' })).toMatch(/Espaço/)
    })

    it('explica o teclado quando a câmera está desligada', () => {
        const hint = guideHint({ ...ok, cameraActive: false, trackerStatus: 'idle' })
        expect(hint).toMatch(/Sem câmera/)
        expect(hint).toMatch(/Z/)
        expect(hint).toMatch(/X/)
    })

    it('avisa que o detector está carregando', () => {
        expect(guideHint({ ...ok, trackerStatus: 'loading' })).toMatch(/Carregando/)
    })

    it('diz o que fazer quando a teia errou', () => {
        expect(guideHint({ ...ok, lastThrow: 'miss' })).toMatch(/errou/)
    })

    it('pede a mão inteira quando ela não aparece', () => {
        expect(guideHint({ ...ok, handVisible: false })).toMatch(/mão inteira/)
    })

    it('com a mão à vista e sem a pose, descreve a pose', () => {
        const hint = guideHint({ ...ok, gestureHeld: false, cue: 'throw' })
        expect(hint).toMatch(/polegar/i)
        expect(hint).toMatch(/mindinho/i)
        expect(hint).toMatch(/médio e anelar/i)
    })

    it('na subida do arco, lembra de soltar', () => {
        expect(guideHint({ ...ok, cue: 'release' })).toMatch(/soltar|solte/i)
    })
})
