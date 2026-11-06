import { describe, expect, it } from 'vitest'
import { MarblesHandInput } from './handInput.js'
import {
    pinchHand,
    OPEN_RATIO,
    CLOSED_RATIO,
    FAKE_ASPECT,
} from '../test-utils/fakeHand.js'
import type { Vec } from '@guess-my-move/marbles'
function pinch(input: MarblesHandInput, awaiting = true) {
    let time = 0
    const shots: Vec[] = []
    for (const sample of [
        { ratio: OPEN_RATIO, x: 400 },
        { ratio: CLOSED_RATIO, x: 400 },
        { ratio: CLOSED_RATIO, x: 250 },
        { ratio: CLOSED_RATIO, x: 250 },
        { ratio: OPEN_RATIO, x: 250 },
    ]) {
        time += 33
        const shot = input.update(
            pinchHand({ ...sample, y: 300 }),
            FAKE_ASPECT,
            time,
            { x: 400, y: 300 },
            awaiting,
            'pinch',
        )
        if (shot) shots.push(shot)
    }
    return shots
}
describe('entrada de mão independente de captura', () => {
    it('produz um vetor de pinça e encerra a mira ao soltar', () => {
        const input = new MarblesHandInput(),
            shots = pinch(input)
        expect(shots).toHaveLength(1)
        expect(shots[0].x).toBeGreaterThan(0)
        expect(shots[0].y).toBeCloseTo(0)
        expect(input.aimView).toBeNull()
    })
    it('atualiza leitura sem atirar fora da própria vez e neutraliza perda de mão', () => {
        const input = new MarblesHandInput()
        expect(pinch(input, false)).toEqual([])
        expect(
            input.update(
                null,
                FAKE_ASPECT,
                200,
                { x: 400, y: 300 },
                true,
                'pinch',
            ),
        ).toBeNull()
        expect(input.reading?.handVisible).toBe(false)
        input.clearReadings()
        expect(input.reading).toBeNull()
    })
    it('mantém estalo e feedback, mas reset de sessão limpa o histórico', () => {
        const input = new MarblesHandInput(),
            shots: Vec[] = []
        let now = 1000
        for (const sample of [
            { ratio: 0.8, x: 300 },
            { ratio: 0.8, x: 220 },
            { ratio: 0.8, x: 220 },
            { ratio: 1.5, x: 220 },
            { ratio: 1.5, x: 220 },
            { ratio: 1.5, x: 220 },
        ]) {
            now += 67
            const shot = input.update(
                pinchHand({ ...sample, y: 300 }),
                FAKE_ASPECT,
                now,
                { x: 400, y: 300 },
                true,
                'flick',
            )
            if (shot) shots.push(shot)
        }
        expect(shots).toHaveLength(1)
        expect(input.lastFlick?.result).toBe('disparado')
        input.resetForTurn()
        expect(input.lastFlick).not.toBeNull()
        input.resetForSession()
        expect(input.lastFlick).toBeNull()
        expect(input.aimView).toBeNull()
    })
})
