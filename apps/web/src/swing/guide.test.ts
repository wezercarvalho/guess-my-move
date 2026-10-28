import { describe, expect, it } from 'vitest'

import { STEPS, currentStep, guideHint } from './guide.js'

const ok = {
    cameraActive: true,
    trackerStatus: 'ready' as const,
    handVisible: true,
    lastThrow: null,
}

describe('currentStep', () => {
    it('destaca lançar a teia e, com ela presa, soltar', () => {
        expect(currentStep(false)).toBe(2)
        expect(currentStep(true)).toBe(3)
        expect(STEPS).toHaveLength(3)
    })
})

describe('guideHint', () => {
    it('fica vazia quando está tudo certo', () => {
        expect(guideHint(ok)).toBe('')
    })

    it('manda usar o teclado quando o detector falha', () => {
        expect(guideHint({ ...ok, trackerStatus: 'error' })).toMatch(/Espaço e as setas/)
    })

    it('manda usar o teclado quando a câmera está desligada', () => {
        expect(guideHint({ ...ok, cameraActive: false, trackerStatus: 'idle' })).toMatch(/Sem câmera/)
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
})
