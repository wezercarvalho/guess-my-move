import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING, createSwingState, stepPlayer } from '../src/physics.js'
import { box, cityOf } from './helpers.js'

const DT = 1 / 120

/** Roda `seconds` de simulação e devolve os eventos do último passo. */
function run(
    index: ReturnType<typeof createCityIndex>,
    state: ReturnType<typeof createSwingState>,
    seconds: number,
    each?: () => void,
) {
    let wallHits = 0
    for (let i = 0; i < Math.round(seconds / DT); i++) {
        if (stepPlayer(index, state, DT).wallHit) wallHits++
        each?.()
    }
    return { wallHits }
}

describe('queda livre', () => {
    it('acelera para baixo com a gravidade menos o arrasto', () => {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 0, y: 100, z: 0 })
        run(index, state, 1)
        expect(state.velocity.y).toBeLessThan(-17)
        expect(state.velocity.y).toBeGreaterThan(-20)
        expect(state.position.y).toBeLessThan(92)
        expect(state.position.y).toBeGreaterThan(88)
        expect(state.grounded).toBe(false)
    })

    it('limita a velocidade ao máximo', () => {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 0, y: 5000, z: 0 })
        state.velocity = { x: 0, y: -500, z: 0 }
        stepPlayer(index, state, DT)
        expect(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)).toBeCloseTo(
            DEFAULT_SWING.maxSpeed,
        )
    })
})

describe('chão', () => {
    it('para na altura do olho, zera a queda e corre para a frente', () => {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 0, y: 20, z: 0 })
        run(index, state, 4)
        expect(state.position.y).toBeCloseTo(DEFAULT_SWING.eyeHeight)
        expect(state.velocity.y).toBe(0)
        expect(state.grounded).toBe(true)
        // Guinada 0 olha para -Z: a corrida automática leva a velocidade para perto de 8 m/s.
        expect(state.velocity.z).toBeLessThan(-7)
        expect(state.velocity.z).toBeGreaterThan(-9)
    })
})

describe('teia', () => {
    function pendulum() {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 30, y: 60, z: 0 })
        state.web = { anchor: { x: 0, y: 60, z: 0 }, length: 30 }
        return { index, state }
    }

    it('mantém o jogador à distância da corda e o balança em arco', () => {
        const { index, state } = pendulum()
        let lowest = Infinity
        let fastest = 0
        run(index, state, 3, () => {
            const web = state.web
            expect(web).not.toBeNull()
            const dx = state.position.x - (web?.anchor.x ?? 0)
            const dy = state.position.y - (web?.anchor.y ?? 0)
            const dz = state.position.z - (web?.anchor.z ?? 0)
            expect(Math.hypot(dx, dy, dz)).toBeLessThanOrEqual((web?.length ?? 0) + 0.01)
            lowest = Math.min(lowest, state.position.y)
            fastest = Math.max(
                fastest,
                Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
            )
        })
        expect(lowest).toBeLessThan(40)
        expect(fastest).toBeGreaterThan(25)
    })

    it('encurta a corda 4 m/s até o mínimo de 10 m', () => {
        const { index, state } = pendulum()
        run(index, state, 1)
        expect(state.web?.length).toBeCloseTo(26, 0)
        run(index, state, 10)
        expect(state.web?.length).toBeCloseTo(DEFAULT_SWING.minRope, 5)
    })
})

describe('colisão', () => {
    it('amortece na parede, solta a teia e informa o choque', () => {
        const index = createCityIndex(cityOf(box(20, -50, 30, 50, 200)))
        const state = createSwingState({ x: 5, y: 100, z: 0 })
        state.velocity = { x: 30, y: 0, z: 0 }
        state.web = { anchor: { x: 5, y: 180, z: -60 }, length: 120 }
        const { wallHits } = run(index, state, 1)
        expect(wallHits).toBeGreaterThanOrEqual(1)
        expect(state.web).toBeNull()
        expect(state.velocity.x).toBeLessThan(0)
        expect(state.position.x).toBeLessThanOrEqual(20 - DEFAULT_SWING.radius + 0.01)
    })

    it('pousa no telhado e fica em pé', () => {
        const index = createCityIndex(cityOf(box(20, -50, 30, 50, 50)))
        const state = createSwingState({ x: 25, y: 70, z: 0 })
        run(index, state, 3)
        expect(state.grounded).toBe(true)
        expect(state.position.y).toBeCloseTo(50 + DEFAULT_SWING.radius, 1)
        expect(state.velocity.y).toBe(0)
    })

    it('não deixa sair do mapa', () => {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 195, y: 100, z: 0 })
        state.velocity = { x: 40, y: 0, z: 0 }
        run(index, state, 1)
        expect(state.position.x).toBeLessThanOrEqual(200 - DEFAULT_SWING.boundsMargin + 1e-6)
        expect(state.velocity.x).toBeLessThanOrEqual(0)
    })
})

describe('estatísticas', () => {
    it('soma a distância horizontal percorrida e guarda a velocidade máxima', () => {
        const index = createCityIndex(cityOf())
        const state = createSwingState({ x: 0, y: 100, z: 0 })
        state.velocity = { x: 10, y: 0, z: 0 }
        run(index, state, 1)
        expect(state.stats.distance).toBeGreaterThan(8)
        expect(state.stats.topSpeed).toBeGreaterThan(10)
    })
})
