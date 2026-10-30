import { describe, expect, it } from 'vitest'

import {
    ChordRecognition,
    type FingerPress,
    recognizeChord,
} from '../src/index.js'

const press = (finger: 1 | 2 | 3 | 4, string: 1 | 2 | 3 | 4 | 5 | 6, fret: 1 | 2 | 3 | 4 | 5): FingerPress => ({
    finger,
    string,
    fret,
})

const EM = [press(2, 5, 2), press(3, 4, 2)]

describe('recognizeChord', () => {
    it('reconhece o acorde pela combinação de corda e casa, sem depender do dedo usado', () => {
        expect(recognizeChord([press(1, 5, 2), press(4, 4, 2)])).toBe('Em')
        expect(recognizeChord([press(4, 5, 2), press(1, 4, 2)])).toBe('Em')
    })

    it('reconhece cada um dos cinco formatos disponíveis', () => {
        expect(recognizeChord(EM)).toBe('Em')
        expect(recognizeChord([press(1, 4, 2), press(2, 3, 2), press(3, 2, 1)])).toBe('Am')
        expect(recognizeChord([press(1, 3, 2), press(2, 2, 3), press(3, 1, 2)])).toBe('D')
        expect(recognizeChord([press(1, 5, 3), press(2, 4, 2), press(3, 2, 1)])).toBe('C')
        expect(recognizeChord([press(1, 6, 3), press(2, 5, 2), press(3, 1, 3)])).toBe('G')
    })

    it('não inventa acorde com formato parcial ou dedo extra', () => {
        expect(recognizeChord([press(1, 5, 2)])).toBeNull()
        expect(recognizeChord([...EM, press(4, 3, 2)])).toBeNull()
        expect(recognizeChord([])).toBeNull()
    })

    it('mantém o acorde durante um quadro ruim e troca só após a nova forma permanecer', () => {
        const recognition = new ChordRecognition({ holdMs: 100, releaseMs: 180 })
        expect(recognition.update(EM, 0)).toBeNull()
        expect(recognition.update(EM, 120)).toBe('Em')
        expect(recognition.update([], 153)).toBe('Em')
        expect(recognition.update(EM, 186)).toBe('Em')

        const am = [press(1, 4, 2), press(2, 3, 2), press(3, 2, 1)]
        expect(recognition.update(am, 220)).toBe('Em')
        expect(recognition.update(am, 340)).toBe('Am')
    })

    it('remove o acorde somente depois da tolerância sem formato reconhecido', () => {
        const recognition = new ChordRecognition({ holdMs: 50, releaseMs: 100 })
        recognition.update(EM, 0)
        expect(recognition.update(EM, 60)).toBe('Em')
        expect(recognition.update([], 100)).toBe('Em')
        expect(recognition.update([], 210)).toBeNull()
        recognition.reset()
        expect(recognition.update(EM, 300)).toBeNull()
    })
})
