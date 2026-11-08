import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCK_GESTURE, createLockGesture } from '../src/lockGesture.js'

const DT = 1000 / 30

/** Alimenta `frames` quadros com a pose `present` e devolve o último veredito. */
function feed(gesture: ReturnType<typeof createLockGesture>, present: boolean, frames: number): boolean {
    let held = false
    for (let i = 0; i < frames; i++) held = gesture.update(present, DT)
    return held
}

const framesFor = (ms: number) => Math.ceil(ms / DT)

describe('createLockGesture', () => {
    it('começa sem travar', () => {
        expect(createLockGesture().update(false, DT)).toBe(false)
    })

    it('só trava depois da pose mantida por onsetMs', () => {
        const gesture = createLockGesture()
        expect(feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) - 2)).toBe(false)
        expect(feed(gesture, true, 3)).toBe(true)
    })

    it('uma pose passageira nunca trava', () => {
        const gesture = createLockGesture()
        expect(feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) - 3)).toBe(false)
        expect(feed(gesture, false, 3)).toBe(false)
        // A contagem recomeça: de novo uma pose curta não trava.
        expect(feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) - 3)).toBe(false)
    })

    it('segura a trava por uma perda curta da pose (um quadro ruim)', () => {
        const gesture = createLockGesture()
        expect(feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) + 2)).toBe(true)
        expect(feed(gesture, false, 2)).toBe(true)
        expect(feed(gesture, true, 1)).toBe(true)
    })

    it('solta depois de releaseGraceMs sem a pose', () => {
        const gesture = createLockGesture()
        feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) + 2)
        expect(feed(gesture, false, framesFor(DEFAULT_LOCK_GESTURE.releaseGraceMs) - 1)).toBe(true)
        expect(feed(gesture, false, 3)).toBe(false)
    })

    it('depois de soltar, travar de novo exige a pose mantida outra vez', () => {
        const gesture = createLockGesture()
        feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) + 2)
        feed(gesture, false, framesFor(DEFAULT_LOCK_GESTURE.releaseGraceMs) + 3)
        expect(feed(gesture, true, 2)).toBe(false)
        expect(feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs))).toBe(true)
    })

    it('reset desfaz a trava e a contagem', () => {
        const gesture = createLockGesture()
        feed(gesture, true, framesFor(DEFAULT_LOCK_GESTURE.onsetMs) + 2)
        gesture.reset()
        expect(gesture.update(true, DT)).toBe(false)
    })
})
