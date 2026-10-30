import { describe, expect, it } from 'vitest'

import { KEYS, STEPS, currentStep, gripStatusLine, guideHint, headStatusLine, statusLine } from './guide.js'

const ok = {
    cameraActive: true,
    trackerStatus: 'ready' as const,
    handVisible: true,
    gestureHeld: true,
    gripped: false,
    lastThrow: null,
    cue: 'swing' as const,
}

describe('currentStep', () => {
    it('destaca a etapa da próxima ação', () => {
        expect(currentStep('start')).toBe(1)
        expect(currentStep('throw')).toBe(1)
        expect(currentStep('low')).toBe(1)
        expect(currentStep('ground')).toBe(1)
        expect(currentStep('swing')).toBe(3)
        expect(currentStep('release')).toBe(4)
        expect(currentStep('wall')).toBe(5)
        expect(currentStep('grip')).toBe(5)
        expect(STEPS).toHaveLength(5)
    })
})

describe('statusLine', () => {
    it('diz em uma linha o que fazer agora', () => {
        expect(statusLine('start')).toMatch(/pose de teia/i)
        expect(statusLine('throw')).toMatch(/lance a teia/i)
        expect(statusLine('swing')).toMatch(/balançando/i)
        expect(statusLine('release')).toMatch(/abra a mão/i)
        expect(statusLine('swing')).toMatch(/punho/i)
        expect(statusLine('low')).toMatch(/chão/i)
        expect(statusLine('ground')).toMatch(/subir/i)
    })

    it('encostado na parede, manda abrir a mão para agarrar', () => {
        expect(statusLine('wall')).toMatch(/parede/i)
        expect(statusLine('wall')).toMatch(/abra a mão/i)
        expect(statusLine('wall')).toMatch(/agarrar/i)
    })

    it('agarrado, ensina a descer uma mão por vez e que o punho solta', () => {
        expect(statusLine('grip')).toMatch(/agarrado/i)
        expect(statusLine('grip')).toMatch(/desça uma mão/i)
        expect(statusLine('grip')).toMatch(/punho/i)
        expect(statusLine('grip')).toMatch(/solta/i)
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
        expect(hint).toMatch(/C puxa/)
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

    it('agarrado, se a mão some pede para mostrar a palma de novo', () => {
        const hint = guideHint({ ...ok, gripped: true, cue: 'grip', handVisible: false })
        expect(hint).toMatch(/palma/i)
    })

    it('com a mão à vista e sem a pose, descreve a pose', () => {
        const hint = guideHint({ ...ok, gestureHeld: false, cue: 'throw' })
        expect(hint).toMatch(/polegar/i)
        expect(hint).toMatch(/mindinho/i)
        expect(hint).toMatch(/médio e anelar/i)
    })

    it('na subida do arco, lembra de soltar', () => {
        expect(guideHint({ ...ok, cue: 'release' })).toMatch(/palma aberta/i)
    })

    it('encostado na parede, ensina a abrir a mão para agarrar', () => {
        const hint = guideHint({ ...ok, cue: 'wall', gestureHeld: false })
        expect(hint).toMatch(/parede/i)
        expect(hint).toMatch(/abra a mão/i)
    })

    it('agarrado, explica como subir e soltar', () => {
        const hint = guideHint({ ...ok, gripped: true, cue: 'grip' })
        expect(hint).toMatch(/desça uma mão/i)
        expect(hint).toMatch(/punho/i)
    })

    it('o teclado sem câmera menciona V para agarrar', () => {
        const hint = guideHint({ ...ok, cameraActive: false, trackerStatus: 'idle' })
        expect(hint).toMatch(/V agarra/)
    })
})

describe('gripStatusLine', () => {
    it('diz que está agarrado e como subir/soltar', () => {
        expect(gripStatusLine()).toMatch(/agarrado/i)
        expect(gripStatusLine()).toMatch(/subir/i)
    })
})

describe('headStatusLine', () => {
    it('é vazia sem câmera ou com o detector de rosto inativo', () => {
        expect(headStatusLine({ cameraActive: false, faceTrackerStatus: 'idle', faceVisible: false })).toBe('')
        expect(headStatusLine({ cameraActive: true, faceTrackerStatus: 'idle', faceVisible: false })).toBe('')
    })

    it('avisa quando o detector de rosto está carregando', () => {
        expect(headStatusLine({ cameraActive: true, faceTrackerStatus: 'loading', faceVisible: false })).toMatch(
            /rosto/i,
        )
    })

    it('pede para centralizar quando o rosto some', () => {
        const line = headStatusLine({ cameraActive: true, faceTrackerStatus: 'ready', faceVisible: false })
        expect(line).toMatch(/rosto fora do quadro/i)
        expect(line).toMatch(/centralize/i)
    })

    it('fica vazia quando o rosto está à vista', () => {
        expect(headStatusLine({ cameraActive: true, faceTrackerStatus: 'ready', faceVisible: true })).toBe('')
    })

    it('diz que a cabeça não está disponível quando o detector de rosto falha', () => {
        const line = headStatusLine({ cameraActive: true, faceTrackerStatus: 'error', faceVisible: false })
        expect(line).toMatch(/cabeça/i)
    })
})

describe('KEYS', () => {
    it('lista as teclas por grupo, uma linha cada, com as teclas e o que fazem', () => {
        expect(KEYS.length).toBeGreaterThanOrEqual(4)
        for (const group of KEYS) {
            expect(group.keys.length).toBeGreaterThan(0)
            expect(group.action.length).toBeGreaterThan(0)
        }
        const all = KEYS.flatMap((group) => group.keys)
        expect(all).toContain('Espaço')
        expect(all).toContain('Z')
        expect(all).toContain('X')
        expect(all).toContain('C')
        // As quatro setas aparecem.
        expect(all).toEqual(expect.arrayContaining(['←', '→', '↑', '↓']))
        // O agarre à parede tem a sua tecla e as setas sobem/descem.
        expect(all).toContain('V')
        const climb = KEYS.find((group) => group.keys.includes('V'))
        expect(climb?.action).toMatch(/agarra/i)
        expect(KEYS.some((group) => /sobem|sobe/i.test(group.action))).toBe(true)
    })
})
