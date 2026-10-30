import { describe, expect, it } from 'vitest'

import {
    ChordStability,
    type FingerPress,
    chordById,
    evaluateChord,
} from '../src/index.js'

const press = (finger: 1 | 2 | 3 | 4, string: 1 | 2 | 3 | 4 | 5 | 6, fret: 1 | 2 | 3 | 4 | 5): FingerPress => ({
    finger,
    string,
    fret,
})

const EM_OK = [press(2, 5, 2), press(3, 4, 2)]

describe('evaluateChord', () => {
    const em = chordById('Em')

    it('o Em com os dedos 2 e 3 nas cordas 5 e 4, casa 2, está completo e sem correção', () => {
        const result = evaluateChord(em, EM_OK)
        expect(result.complete).toBe(true)
        expect(result.correction).toBeNull()
        expect(result.strings.map((entry) => entry.state)).toEqual(Array(6).fill('ok'))
    })

    it('só o dedo 2 na corda 5: falta o dedo 3 na corda 4, casa 2', () => {
        const result = evaluateChord(em, [press(2, 5, 2)])
        expect(result.complete).toBe(false)
        expect(result.strings.find((entry) => entry.string === 4)?.state).toBe('missing')
        expect(result.correction).toEqual({ action: 'place', finger: 3, string: 4, fret: 2 })
    })

    it('um dedo estável numa corda que deve ficar solta é erro e a correção é tirá-lo', () => {
        const result = evaluateChord(em, [press(2, 3, 2)])
        expect(result.strings.find((entry) => entry.string === 3)?.state).toBe('wrong')
        // corrigir o que está errado vem antes de colocar o que falta
        expect(result.correction).toEqual({ action: 'remove', finger: 2, string: 3, fret: 2 })
    })

    it('a casa errada pede mover o dedo para a casa certa', () => {
        const result = evaluateChord(em, [press(2, 5, 3), press(3, 4, 2)])
        expect(result.strings.find((entry) => entry.string === 5)?.state).toBe('wrong')
        expect(result.correction).toEqual({ action: 'move', finger: 2, string: 5, fret: 2 })
    })

    it('cordas abafadas no alvo ignoram qualquer dedo', () => {
        const d = chordById('D')
        const dFingers = [press(1, 3, 2), press(3, 2, 3), press(2, 1, 2)]
        const withStray = evaluateChord(d, [...dFingers, press(4, 6, 1)])
        expect(withStray.strings.find((entry) => entry.string === 6)?.state).toBe('muted')
        expect(withStray.complete).toBe(true)
        expect(withStray.sounding.map((note) => note.string)).toEqual([4, 3, 2, 1])
    })

    it('dois dedos na mesma corda valem pela casa mais alta', () => {
        const result = evaluateChord(em, [press(1, 5, 1), press(2, 5, 2), press(3, 4, 2)])
        expect(result.complete).toBe(true)
        const high = evaluateChord(em, [press(1, 5, 1), press(4, 5, 3), press(3, 4, 2)])
        expect(high.strings.find((entry) => entry.string === 5)?.detectedFret).toBe(3)
        expect(high.strings.find((entry) => entry.string === 5)?.state).toBe('wrong')
    })

    it('as cordas que soam refletem o que a mão está formando, não o alvo', () => {
        const result = evaluateChord(em, [press(2, 5, 3)])
        const byString = Object.fromEntries(result.sounding.map((note) => [note.string, note.fret]))
        // casa 3 na corda 5 (errada); corda 4 sem dedo soa solta; as demais soltas
        expect(byString).toEqual({ 6: 0, 5: 3, 4: 0, 3: 0, 2: 0, 1: 0 })
    })

    it('ignoreExtraFingers trata o dedo sobre corda solta como se não existisse', () => {
        const result = evaluateChord(em, [...EM_OK, press(4, 3, 2)], { ignoreExtraFingers: true })
        expect(result.complete).toBe(true)
        expect(result.sounding.find((note) => note.string === 3)?.fret).toBe(0)
        const strict = evaluateChord(em, [...EM_OK, press(4, 3, 2)])
        expect(strict.complete).toBe(false)
    })

    it('com a mesma entrada devolve sempre a mesma saída', () => {
        const input = [press(2, 5, 3), press(4, 1, 1)]
        expect(evaluateChord(em, input)).toEqual(evaluateChord(em, input))
    })

    it('com vários erros, corrige primeiro a corda errada de número maior', () => {
        const g = chordById('G')
        // G: 6 casa 3 (dedo 2), 5 casa 2 (dedo 1), 1 casa 3 (dedo 3); coloca dedos nas cordas erradas
        const result = evaluateChord(g, [press(1, 4, 1), press(2, 3, 1)])
        expect(result.correction).toEqual({ action: 'remove', finger: 1, string: 4, fret: 1 })
    })

    it('sem nenhum dedo, a primeira correção é colocar o dedo da corda grave que o acorde pede', () => {
        const result = evaluateChord(chordById('G'), [])
        expect(result.correction).toEqual({ action: 'place', finger: 2, string: 6, fret: 3 })
    })
})

describe('ChordStability', () => {
    it('só vira certo depois de sustentado e não pisca com um quadro ruim', () => {
        const stability = new ChordStability()
        let t = 0
        const step = (complete: boolean) => stability.update(complete, (t += 33))
        expect(step(true)).toBe(false)
        for (let i = 0; i < 10; i++) step(true)
        expect(step(true)).toBe(true)
        // um único quadro errado não derruba
        expect(step(false)).toBe(true)
        expect(step(true)).toBe(true)
    })

    it('um acerto de passagem não conta', () => {
        const stability = new ChordStability()
        let t = 0
        const frames = [true, true, true, false, true, true, true, false, true, true]
        const results = frames.map((complete) => stability.update(complete, (t += 33)))
        expect(results.every((value) => value === false)).toBe(true)
    })

    it('volta a errado só depois da tolerância', () => {
        const stability = new ChordStability({ holdMs: 100, releaseMs: 200 })
        let t = 0
        for (let i = 0; i < 6; i++) stability.update(true, (t += 33))
        expect(stability.update(true, t + 33)).toBe(true)
        t += 33
        const outcomes: boolean[] = []
        for (let i = 0; i < 8; i++) outcomes.push(stability.update(false, (t += 33)))
        expect(outcomes[0]).toBe(true)
        expect(outcomes[outcomes.length - 1]).toBe(false)
    })

    it('reset volta ao estado inicial', () => {
        const stability = new ChordStability({ holdMs: 50, releaseMs: 50 })
        stability.update(true, 0)
        stability.update(true, 100)
        stability.reset()
        expect(stability.update(true, 200)).toBe(false)
    })
})
