import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING, createSwingState, stepPlayer } from '../src/physics.js'
import { createSwingWorld, type SwingInput } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const DT = 1 / 120

/** Prédio alto logo à frente/ao lado, para o jogador encostar na fachada. */
const wall = box(-5, -40, 60, 40, 200)

/** Entrada mínima; por padrão, nada pedido. */
const input = (over: Partial<SwingInput> = {}): SwingInput => ({
    held: {},
    yawRate: 0,
    pitchRate: 0,
    ...over,
})

/** Põe o jogador encostado na face oeste do prédio (x = -5), já em contato. */
function againstWall(y = 80) {
    const index = createCityIndex(cityOf(wall))
    const state = createSwingState({ x: -5 - DEFAULT_SWING.radius + 0.2, y, z: 0 })
    state.started = true
    // Empurra levemente contra a parede para gerar contato no primeiro passo.
    state.velocity = { x: 5, y: 0, z: 0 }
    return { index, state }
}

describe('contato com a parede', () => {
    it('marca touchingWall ao encostar num prédio e não ao cair no vazio', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT)
        expect(state.touchingWall).toBe(true)

        const open = createCityIndex(cityOf())
        const free = createSwingState({ x: 0, y: 80, z: 0 })
        stepPlayer(open, free, DT)
        expect(free.touchingWall).toBe(false)
    })
})

describe('agarrar a parede', () => {
    it('só agarra com contato de parede mais o pedido de agarrar', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        expect(state.grip).not.toBeNull()
        // No vazio, pedir agarre não faz nada.
        const open = createCityIndex(cityOf())
        const air = createSwingState({ x: 0, y: 80, z: 0 })
        air.started = true
        stepPlayer(open, air, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        expect(air.grip).toBeNull()
    })

    it('ao agarrar, zera a velocidade e solta as teias presas', () => {
        const { index, state } = againstWall()
        state.webs = [{ anchor: { x: 100, y: 180, z: 0 }, length: 120, side: 1 }]
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        expect(state.grip).not.toBeNull()
        expect(state.webs).toHaveLength(0)
        expect(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)).toBeLessThan(1)
    })

    it('agarrado, não cai (a gravidade não age)', () => {
        const { index, state } = againstWall()
        for (let i = 0; i < 120; i++) {
            stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        }
        expect(state.grip).not.toBeNull()
        expect(state.position.y).toBeGreaterThan(79)
    })

    it('agarrado, sobe com climb positivo e desce com climb negativo', () => {
        const up = againstWall()
        const down = againstWall()
        for (let i = 0; i < 120; i++) {
            stepPlayer(up.index, up.state, DT, DEFAULT_SWING, input({ grab: { left: true }, climb: 1 }))
            stepPlayer(down.index, down.state, DT, DEFAULT_SWING, input({ grab: { left: true }, climb: -1 }))
        }
        expect(up.state.position.y).toBeGreaterThan(81)
        expect(down.state.position.y).toBeLessThan(79)
    })

    it('climb nulo mantém a altura', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        const y = state.position.y
        for (let i = 0; i < 120; i++) {
            stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true }, climb: 0 }))
        }
        expect(Math.abs(state.position.y - y)).toBeLessThan(0.5)
    })
})

describe('sair do agarre', () => {
    it('solta quando o pedido de agarre some', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        expect(state.grip).not.toBeNull()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({}))
        expect(state.grip).toBeNull()
    })

    it('solta com o sinal de soltar (puxar a mão para trás)', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true }, release: true }))
        expect(state.grip).toBeNull()
    })

    it('lançar uma teia encerra o agarre', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        state.webs = [{ anchor: { x: 100, y: 180, z: 0 }, length: 120, side: 1 }]
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        expect(state.grip).toBeNull()
    })

    it('solta sozinho sem movimento de escalada por tempo acima da tolerância', () => {
        const { index, state } = againstWall()
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        const steps = Math.ceil(DEFAULT_SWING.grip.gripIdleMs / (DT * 1000)) + 10
        for (let i = 0; i < steps; i++) {
            stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true }, climb: 0 }))
        }
        expect(state.grip).toBeNull()
    })

    it('ao chegar ao topo, sai para o telhado em pé', () => {
        // prédio de 90 m: subindo da altura 80, passa do topo e fica grounded.
        const index = createCityIndex(cityOf(box(-5, -40, 60, 40, 90)))
        const state = createSwingState({ x: -5 - DEFAULT_SWING.radius + 0.2, y: 80, z: 0 })
        state.started = true
        state.velocity = { x: 5, y: 0, z: 0 }
        stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
        for (let i = 0; i < 120 * 6; i++) {
            stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true }, climb: 1 }))
        }
        expect(state.grip).toBeNull()
        expect(state.grounded).toBe(true)
        expect(state.position.y).toBeGreaterThan(89)
    })
})

describe('o world expõe o agarre', () => {
    it('agarra pelo SwingInput e sobe', () => {
        const world = createSwingWorld(createCityIndex(cityOf(wall)))
        world.state.position = { x: -5 - DEFAULT_SWING.radius + 0.2, y: 80, z: 0 }
        world.state.started = true
        world.state.velocity = { x: 5, y: 0, z: 0 }
        for (let i = 0; i < 120; i++) world.step(input({ grab: { left: true }, climb: 1 }), DT)
        expect(world.state.grip).not.toBeNull()
        expect(world.state.position.y).toBeGreaterThan(81)
    })
})

describe('propriedade: nunca fica preso no agarre', () => {
    it('sai do agarre em tempo finito para qualquer sequência de entradas', () => {
        // Gerador determinístico simples (sem dependências): LCG.
        let seed = 12345
        const rnd = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff
            return seed / 0x7fffffff
        }
        const maxSteps = Math.ceil(DEFAULT_SWING.grip.gripIdleMs / (DT * 1000)) + 2000
        for (let trial = 0; trial < 300; trial++) {
            const index = createCityIndex(cityOf(box(-5, -40, 60, 40, 60 + rnd() * 200)))
            const state = createSwingState({ x: -5 - DEFAULT_SWING.radius + 0.2, y: 20 + rnd() * 60, z: 0 })
            state.started = true
            state.velocity = { x: 5, y: 0, z: 0 }
            // Entra no agarre.
            stepPlayer(index, state, DT, DEFAULT_SWING, input({ grab: { left: true } }))
            let released = state.grip === null
            let stepsTaken = 0
            for (let i = 0; i < maxSteps && !released; i++) {
                const grabbing = rnd() > 0.15
                const over: Partial<SwingInput> = {
                    grab: grabbing ? { left: rnd() > 0.5, right: rnd() > 0.5 } : {},
                    climb: rnd() * 2 - 1,
                    release: rnd() > 0.9,
                }
                stepPlayer(index, state, DT, DEFAULT_SWING, input(over))
                stepsTaken = i + 1
                if (state.grip === null) released = true
            }
            expect(released, `preso após ${stepsTaken} passos no ensaio ${trial}`).toBe(true)
        }
    })
})
