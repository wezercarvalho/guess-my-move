import { describe, expect, it } from 'vitest'

import { createSwingState } from '../src/physics.js'
import { swingCue } from '../src/cue.js'

function state(patch: Partial<ReturnType<typeof createSwingState>> = {}) {
    return { ...createSwingState({ x: 0, y: 80, z: 0 }), started: true, ...patch }
}

const web = { anchor: { x: 0, y: 150, z: -40 }, length: 80, side: 0 as const }

describe('swingCue', () => {
    it('antes do primeiro gesto, pede para começar', () => {
        expect(swingCue({ ...state(), started: false })).toBe('start')
    })

    it('com a teia presa e descendo, pede para continuar balançando', () => {
        expect(swingCue(state({ webs: [web], velocity: { x: 0, y: -10, z: -20 } }))).toBe('swing')
    })

    it('com a teia presa, subindo e rápido, pede para soltar e voar', () => {
        expect(swingCue(state({ webs: [web], velocity: { x: 0, y: 8, z: -25 } }))).toBe('release')
    })

    it('subindo devagar, ainda não é hora de soltar', () => {
        expect(swingCue(state({ webs: [web], velocity: { x: 0, y: 8, z: -3 } }))).toBe('swing')
    })

    it('no ar sem teia e com altura, pede para lançar outra', () => {
        expect(swingCue(state({ velocity: { x: 0, y: 3, z: -20 } }))).toBe('throw')
    })

    it('perto do chão sem teia, avisa para lançar já', () => {
        expect(swingCue(state({ position: { x: 0, y: 20, z: 0 }, velocity: { x: 0, y: -15, z: -20 } }))).toBe('low')
    })

    it('em pé no chão ou num telhado, orienta a lançar para subir', () => {
        expect(swingCue(state({ position: { x: 0, y: 2, z: 0 }, grounded: true }))).toBe('ground')
    })
})
