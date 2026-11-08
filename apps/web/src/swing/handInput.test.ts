import { expect, it } from 'vitest'
import { deriveSwingHands } from './handInput.js'
it('perda das mãos neutraliza pedidos sem alterar o pulso anterior', () => {
    const previous = { left: 0.5, right: 0.7 },
        result = deriveSwingHands([], true, previous)
    expect(result).toMatchObject({
        signals: { left: null, right: null },
        grabs: { left: false, right: false },
        releaseFist: false,
        lockPose: false,
        climb: 0,
        wrist: { left: null, right: null },
        debug: [],
    })
    expect(previous).toEqual({ left: 0.5, right: 0.7 })
})
