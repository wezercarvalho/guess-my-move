import { chordById, evaluateChord } from '@guess-my-move/guitar'
import { describe, expect, it } from 'vitest'

import {
    type GuideInput,
    STEPS,
    chordDescription,
    correctionText,
    currentStep,
    guideHint,
    nextChord,
    statusLine,
} from './guide.js'

const em = chordById('Em')
const EM_PRESSES = [
    { finger: 2 as const, string: 5 as const, fret: 2 as const },
    { finger: 3 as const, string: 4 as const, fret: 2 as const },
]

function input(overrides: Partial<GuideInput> = {}): GuideInput {
    return {
        cameraActive: true,
        trackerStatus: 'ready',
        trackerFailure: null,
        fretVisible: true,
        strumVisible: true,
        leftHanded: false,
        chord: 'Em',
        evaluation: evaluateChord(em, []),
        stable: false,
        completed: [],
        audioStatus: 'running',
        ...overrides,
    }
}

describe('textos de correção', () => {
    it('colocar, mover e tirar viram uma frase curta com dedo, corda e casa', () => {
        expect(correctionText({ action: 'place', finger: 3, string: 4, fret: 2 })).toBe(
            'Coloque o dedo 3 na corda 4, casa 2.',
        )
        expect(correctionText({ action: 'move', finger: 2, string: 5, fret: 2 })).toBe(
            'Mova o dedo 2 para a casa 2 da corda 5.',
        )
        expect(correctionText({ action: 'remove', finger: 2, string: 3, fret: 1 })).toBe(
            'Tire o dedo 2 da corda 3.',
        )
    })
})

describe('statusLine (uma linha com a próxima ação)', () => {
    it('sem câmera, manda ativar a câmera', () => {
        expect(statusLine(input({ cameraActive: false }))).toMatch(/ative a câmera/i)
    })

    it('enquanto o detector carrega e quando falha', () => {
        expect(statusLine(input({ trackerStatus: 'loading' }))).toMatch(/carregando/i)
        expect(statusLine(input({ trackerStatus: 'error', trackerFailure: 'GPU falhou' }))).toMatch(
            /não foi possível/i,
        )
    })

    it('sem a mão do braço, diz qual mão mostrar (destro e canhoto)', () => {
        expect(statusLine(input({ fretVisible: false }))).toMatch(/mão esquerda/i)
        expect(statusLine(input({ fretVisible: false, leftHanded: true }))).toMatch(/mão direita/i)
    })

    it('com o acorde errado, mostra a única correção', () => {
        const evaluation = evaluateChord(em, [EM_PRESSES[0]])
        expect(statusLine(input({ evaluation }))).toBe('Coloque o dedo 3 na corda 4, casa 2.')
    })

    it('com o formato completo mas ainda não estável, pede para segurar', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(statusLine(input({ evaluation, stable: false }))).toMatch(/segure/i)
    })

    it('certo e estável: manda bater, ou mostrar a outra mão', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(statusLine(input({ evaluation, stable: true }))).toMatch(/bata/i)
        expect(statusLine(input({ evaluation, stable: true, strumVisible: false }))).toMatch(
            /outra mão/i,
        )
    })

    it('acorde concluído aponta o próximo na ordem de ensino', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(statusLine(input({ evaluation, stable: true, completed: ['Em'] }))).toBe(
            'Em concluído. Próximo: Am.',
        )
    })

    it('com os cinco concluídos, diz que acabou', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        const completed = ['Em', 'Am', 'D', 'C', 'G'] as const
        expect(statusLine(input({ evaluation, stable: true, completed }))).toMatch(/cinco/i)
    })

    it('o status é sempre uma única linha, sem quebra', () => {
        for (const overrides of [
            {},
            { cameraActive: false },
            { fretVisible: false },
            { trackerStatus: 'loading' as const },
        ]) {
            expect(statusLine(input(overrides))).not.toMatch(/\n/)
        }
    })
})

describe('guideHint', () => {
    it('sem câmera, lembra o teclado', () => {
        expect(guideHint(input({ cameraActive: false }))).toMatch(/espaço/i)
    })

    it('com o som ligado e o acorde certo, a dica é bater', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(guideHint(input({ evaluation, stable: true }))).toMatch(/desça a mão/i)
    })

    it('com o acorde certo e o som desligado, a dica é ligar o som', () => {
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(guideHint(input({ evaluation, stable: true, audioStatus: 'idle' }))).toMatch(
            /som/i,
        )
    })

    it('sem a mão do braço, diz como posicionar a mão', () => {
        expect(guideHint(input({ fretVisible: false }))).toMatch(/palma/i)
    })

    it('com correção pendente, lembra de segurar o dedo na casa', () => {
        expect(guideHint(input({ evaluation: evaluateChord(em, []) }))).toMatch(/segure/i)
    })

    it('é curta: no máximo uma frase de até 80 caracteres', () => {
        for (const overrides of [{}, { cameraActive: false }, { fretVisible: false }]) {
            const hint = guideHint(input(overrides))
            expect(hint.length).toBeLessThanOrEqual(80)
        }
    })
})

describe('etapas', () => {
    it('são três e a atual acompanha o estado', () => {
        expect(STEPS).toHaveLength(3)
        expect(currentStep(input({ fretVisible: false }))).toBe(1)
        expect(currentStep(input())).toBe(2)
        const evaluation = evaluateChord(em, EM_PRESSES)
        expect(currentStep(input({ evaluation, stable: true }))).toBe(3)
        expect(currentStep(input({ cameraActive: false }))).toBeNull()
    })
})

describe('próximo acorde', () => {
    it('segue a ordem Em, Am, D, C, G e pula os já concluídos', () => {
        expect(nextChord('Em', ['Em'])).toBe('Am')
        expect(nextChord('Em', ['Em', 'Am'])).toBe('D')
        expect(nextChord('G', ['G'])).toBe('Em')
        expect(nextChord('Em', ['Em', 'Am', 'D', 'C', 'G'])).toBeNull()
    })
})

describe('chordDescription (alternativa em texto do diagrama)', () => {
    it('descreve corda por corda, da 6 à 1', () => {
        expect(chordDescription(chordById('Em'))).toBe(
            'Diagrama do Em (Mi menor): corda 6 solta; corda 5 casa 2, dedo 2; corda 4 casa 2, dedo 3; corda 3 solta; corda 2 solta; corda 1 solta.',
        )
        expect(chordDescription(chordById('D'))).toContain('corda 6 abafada')
    })
})
