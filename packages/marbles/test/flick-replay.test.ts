import { describe, expect, it } from 'vitest'

import { createFlickDetector, flickShot } from '../src/flick.js'
import { type Point } from '../src/pinch.js'
import { FIST_MOVING_SESSION, THUMB_FLICK_SESSION, type Sample } from './fixtures/flick-sessions.js'

/** Mão com escala 0,2 e a razão pedida entre as pontas, apontando para a direita da imagem. */
function hand(ratio: number): Point[] {
    const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[0] = { x: 0.3, y: 0.5 }
    points[9] = { x: 0.5, y: 0.5 }
    points[4] = { x: 0.5, y: 0.4 }
    points[8] = { x: 0.5, y: 0.4 + ratio * 0.2 }
    return points
}

/** Reproduz uma sessão gravada e devolve os instantes (s) dos estalos por veredito. */
function replay(session: readonly Sample[]) {
    const detector = createFlickDetector()
    const found: { t: number; verdict: string; power: number | null }[] = []
    for (const [t, ratio] of session) {
        const reading = detector.update(ratio === null ? null : hand(ratio), 1, t)
        if (reading.release) {
            found.push({
                t: t / 1000,
                verdict: reading.release.verdict,
                power: flickShot(reading.release)?.power ?? null,
            })
        }
    }
    return found
}

/*
 * Os limiares do detector foram escolhidos olhando estas duas sessões, então o
 * replay documenta a calibração e protege contra regressão; NÃO prova que o
 * estalo funciona com outra mão, outra webcam ou outra pessoa.
 */
describe('replay das sessões gravadas', () => {
    it('mão fechada em movimento: de 9 disparos falsos restou um, que é a mão se abrindo', () => {
        const confirmed = replay(FIST_MOVING_SESSION).filter((item) => item.verdict === 'confirmed')
        expect(confirmed).toHaveLength(1)
        expect(confirmed[0]?.t).toBeGreaterThan(8.5)
        expect(confirmed[0]?.t).toBeLessThan(9.5)
    })

    it('oscilações do rastreamento da mão fechada aparecem como não sustentadas, sem tiro', () => {
        const found = replay(FIST_MOVING_SESSION)
        expect(found.filter((item) => item.verdict === 'unsustained').length).toBeGreaterThanOrEqual(5)
        for (const item of found.filter((entry) => entry.verdict !== 'confirmed')) expect(item.power).toBeNull()
    })

    it('estalos do polegar com a mão de lado: os seis do fim da gravação disparam, em forças diferentes', () => {
        const confirmed = replay(THUMB_FLICK_SESSION).filter((item) => item.verdict === 'confirmed')
        expect(confirmed.map((item) => Math.round(item.t))).toEqual([22, 26, 28, 30, 32, 34])
        const powers = confirmed.map((item) => item.power ?? -1)
        expect(Math.min(...powers)).toBeGreaterThan(0)
        expect(Math.max(...powers)).toBeLessThanOrEqual(1)
        expect(Math.max(...powers) - Math.min(...powers)).toBeGreaterThan(0.3)
    })
})
