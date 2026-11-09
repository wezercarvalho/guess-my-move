import { chordById } from '@guess-my-move/guitar'
import { describe, expect, it } from 'vitest'

import { chordDescription, currentStep, guideHint, statusLine, type GuideInput } from './guide.js'

function input(overrides: Partial<GuideInput> = {}): GuideInput {
    return {
        cameraActive: true,
        trackerStatus: 'ready',
        trackerFailure: null,
        fretVisible: true,
        strumVisible: true,
        leftHanded: false,
        detectedChord: null,
        completed: [],
        audioStatus: 'running',
        ...overrides,
    }
}

describe('statusLine', () => {
    it('pede câmera, carregamento ou a mão do braço conforme o estado', () => {
        expect(statusLine(input({ cameraActive: false }))).toMatch(/ative a câmera/i)
        expect(statusLine(input({ trackerStatus: 'loading' }))).toMatch(/carregando/i)
        expect(statusLine(input({ trackerStatus: 'error' }))).toMatch(/não foi possível/i)
        expect(statusLine(input({ fretVisible: false }))).toMatch(/mão esquerda/i)
        expect(statusLine(input({ fretVisible: false, leftHanded: true }))).toMatch(/mão direita/i)
    })

    it('sem forma válida pede ajuste dos dedos, sem escolher um alvo', () => {
        expect(statusLine(input())).toBe('Ajuste os dedos até o acorde aparecer.')
    })

    it('mostra o acorde reconhecido e pede a travessia das cordas', () => {
        expect(statusLine(input({ detectedChord: 'Am' }))).toBe(
            'Am reconhecido. Atravesse as cordas.',
        )
        expect(statusLine(input({ detectedChord: 'Am', strumVisible: false }))).toBe(
            'Am reconhecido. Mostre a outra mão.',
        )
    })

    it('depois da batida pede outro acorde', () => {
        expect(statusLine(input({ detectedChord: 'G', completed: ['G'] }))).toBe(
            'G tocado. Monte outro acorde.',
        )
    })
})

describe('guideHint e currentStep', () => {
    it('explica as pontas confirmadas enquanto reconhece a forma', () => {
        expect(guideHint(input())).toMatch(/pontas verdes/i)
        expect(currentStep(input())).toBe(2)
    })

    it('explica a trajetória da batida após reconhecer', () => {
        expect(guideHint(input({ detectedChord: 'D' }))).toMatch(/cima para baixo/i)
        expect(currentStep(input({ detectedChord: 'D' }))).toBe(3)
    })

    it('mantém a orientação sem câmera e com áudio bloqueado', () => {
        expect(guideHint(input({ cameraActive: false }))).toMatch(/espaço/i)
        expect(guideHint(input({ detectedChord: 'C', audioStatus: 'idle' }))).toMatch(/ligar o som/i)
        expect(currentStep(input({ cameraActive: false }))).toBeNull()
        expect(currentStep(input({ fretVisible: false }))).toBe(1)
    })
})

describe('chordDescription', () => {
    it('descreve todas as seis cordas para leitores de tela', () => {
        const description = chordDescription(chordById('D'))
        for (let string = 1; string <= 6; string++) expect(description).toContain(`corda ${string}`)
        expect(description).toMatch(/ré maior/i)
    })
})
