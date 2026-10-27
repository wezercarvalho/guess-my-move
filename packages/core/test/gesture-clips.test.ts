import { describe, expect, it } from 'vitest'

import { acenarCard, evaluateOscillation, type HandSample } from '../src/index.js'
import clipAngles from './fixtures/clip-angles.json'

interface ClipFixture {
    clip: string
    expected: 'recognized' | 'rejected'
    durationMs: number
    samples: [number, number][]
}

const fixtures = clipAngles as unknown as { aspect: number; clips: ClipFixture[] }

/** Reproduz o clipe amostra a amostra e devolve o instante do primeiro reconhecimento. */
function firstRecognitionMs(clip: ClipFixture): number | null {
    const seen: HandSample[] = []
    for (const [t, angleDeg] of clip.samples) {
        seen.push({ t, angleDeg })
        if (evaluateOscillation(acenarCard.evaluation.criterion, seen, t).recognized) {
            return t
        }
    }
    return null
}

describe('clipes de referência (regressão do spike; não é medida de acurácia geral)', () => {
    it('tem 5 acenos e 7 confusores', () => {
        expect(fixtures.clips.filter((c) => c.expected === 'recognized')).toHaveLength(5)
        expect(fixtures.clips.filter((c) => c.expected === 'rejected')).toHaveLength(7)
    })

    it('contém apenas números de tempo e ângulo', () => {
        for (const clip of fixtures.clips) {
            for (const sample of clip.samples) {
                expect(sample).toHaveLength(2)
                expect(sample.every(Number.isFinite)).toBe(true)
            }
        }
    })

    it.each(fixtures.clips.map((c) => [c.clip, c] as const))(
        '%s',
        (_name, clip) => {
            const recognizedAt = firstRecognitionMs(clip)
            if (clip.expected === 'recognized') {
                expect(recognizedAt).not.toBeNull()
                expect(recognizedAt ?? Infinity).toBeLessThanOrEqual(clip.durationMs)
            } else {
                expect(recognizedAt).toBeNull()
            }
        },
    )
})
