import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING, createSwingState, stepPlayer } from '../src/physics.js'
import { createSwingWorld } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const DT = 1 / 120
const PITCH = (10 * Math.PI) / 180

/** Dois prédios altos à frente, um de cada lado (guinada 0 olha para -Z). */
const towers = [box(-60, -90, -15, -70, 150), box(15, -90, 60, -70, 150)]

function airborne(position = { x: 0, y: 60, z: 0 }) {
    const world = createSwingWorld(createCityIndex(cityOf(...towers)))
    world.state.position = { ...position }
    world.state.yaw = 0
    world.state.pitch = PITCH
    world.state.started = true
    return world
}

const input = (held: { left?: boolean; center?: boolean; right?: boolean }, pull = {}) => ({
    held,
    pull,
    yawRate: 0,
    pitchRate: 0,
})

const sideOf = (world: ReturnType<typeof airborne>, side: -1 | 0 | 1) =>
    world.state.webs.find((web) => web.side === side)

describe('uma teia por mão', () => {
    it('lançar com a esquerda e depois com a direita deixa as duas presas', () => {
        const world = airborne()
        world.step(input({ left: true }), DT)
        world.step(input({ left: true, right: true }), DT)
        expect(world.state.webs).toHaveLength(2)
        expect(sideOf(world, -1)?.anchor.x).toBeLessThan(world.state.position.x)
        expect(sideOf(world, 1)?.anchor.x).toBeGreaterThan(world.state.position.x)
        expect(world.state.stats.webs).toBe(2)
    })

    it('lançar a segunda não troca nem recria a primeira', () => {
        const world = airborne()
        world.step(input({ left: true }), DT)
        const first = sideOf(world, -1)
        const anchor = { ...first?.anchor }
        for (let i = 0; i < 30; i++) world.step(input({ left: true, right: true }), DT)
        expect(sideOf(world, -1)?.anchor).toEqual(anchor)
        expect(world.state.stats.webs).toBe(2)
    })

    it('as duas mãos no mesmo passo lançam as duas teias', () => {
        const world = airborne()
        world.step(input({ left: true, right: true }), DT)
        expect(world.state.webs).toHaveLength(2)
        expect(world.state.stats.webs).toBe(2)
    })

    it('soltar uma mão solta só a teia dela', () => {
        const world = airborne()
        world.step(input({ left: true, right: true }), DT)
        world.step(input({ right: true }), DT)
        expect(sideOf(world, -1)).toBeUndefined()
        expect(sideOf(world, 1)).toBeDefined()
        world.step(input({}), DT)
        expect(world.state.webs).toHaveLength(0)
    })

    it('soltar e lançar de novo a mesma mão cria uma teia nova só dela', () => {
        const world = airborne()
        world.step(input({ left: true, right: true }), DT)
        world.step(input({ right: true }), DT)
        world.step(input({ left: true, right: true }), DT)
        expect(world.state.webs).toHaveLength(2)
        expect(world.state.stats.webs).toBe(3)
    })

    it('o centro (teclado) convive com as teias das mãos', () => {
        const world = airborne()
        world.step(input({ center: true, left: true }), DT)
        expect(world.state.webs.map((web) => web.side).sort((a, b) => a - b)).toEqual([-1, 0])
    })

    it('uma teia que erra conta um erro só, por mão', () => {
        const world = createSwingWorld(createCityIndex(cityOf(towers[0])))
        world.state.position = { x: 0, y: 400, z: 0 }
        world.state.pitch = PITCH
        world.state.started = true
        for (let i = 0; i < 10; i++) world.step(input({ left: true, right: true }), DT)
        expect(world.state.stats.misses).toBeLessThanOrEqual(2)
    })
})

describe('puxar a teia da mão', () => {
    it('o punho de uma mão puxa só a teia dela', () => {
        const world = airborne()
        world.step(input({ left: true, right: true }), DT)
        world.step(input({ left: true, right: true }, { left: true }), DT)
        expect(sideOf(world, -1)?.pulling).toBe(true)
        expect(sideOf(world, 1)?.pulling).toBeFalsy()
    })

    it('o impulso do punho vai para o ponto da teia dessa mão, uma vez por fechada', () => {
        const world = airborne()
        world.step(input({ left: true, right: true }), DT)
        const vx = world.state.velocity.x
        world.step(input({ left: true, right: true }, { right: true }), DT)
        expect(world.state.velocity.x - vx).toBeGreaterThan(DEFAULT_SWING.pullImpulse * 0.2)
        const after = world.state.velocity.x
        world.step(input({ left: true, right: true }, { right: true }), DT)
        expect(world.state.velocity.x - after).toBeLessThan(1)
    })

    it('puxar sem teia daquele lado não faz nada', () => {
        const world = airborne()
        world.step(input({ left: true }), DT)
        world.step(input({ left: true }, { right: true }), DT)
        expect(sideOf(world, -1)?.pulling).toBeFalsy()
    })
})

describe('suspenso entre as duas teias', () => {
    it('com as duas presas o jogador não cai e as duas cordas seguram', () => {
        const world = airborne({ x: 0, y: 80, z: 0 })
        world.state.velocity = { x: 0, y: 0, z: 0 }
        for (let i = 0; i < 120 * 8; i++) {
            world.step(input({ left: true, right: true }), DT)
            for (const web of world.state.webs) {
                const { x, y, z } = world.state.position
                const distance = Math.hypot(x - web.anchor.x, y - web.anchor.y, z - web.anchor.z)
                expect(distance).toBeLessThanOrEqual(web.length + 0.05)
            }
        }
        expect(world.state.webs).toHaveLength(2)
        expect(world.state.position.y).toBeGreaterThan(20)
    })
})

describe('a corda de cada teia (física)', () => {
    const open = createCityIndex(cityOf())
    const anchor = { x: 0, y: 80, z: -30 }

    function playerWith(webs: number) {
        const state = createSwingState({ x: 0, y: 50, z: 0 })
        state.started = true
        state.webs = Array.from({ length: webs }, (_, index) => ({
            anchor: { ...anchor },
            length: 40,
            side: index === 0 ? -1 : 1,
        }))
        return state
    }

    it('duas teias no mesmo ponto puxam como uma só: a assistência é dividida', () => {
        const one = playerWith(1)
        const two = playerWith(2)
        stepPlayer(open, one, DT, DEFAULT_SWING)
        stepPlayer(open, two, DT, DEFAULT_SWING)
        expect(two.velocity.y).toBeCloseTo(one.velocity.y, 6)
        expect(two.velocity.z).toBeCloseTo(one.velocity.z, 6)
    })

    it('cada teia recolhe a própria corda, mais rápido se estiver puxando', () => {
        const state = playerWith(2)
        state.webs[0].pulling = true
        for (let i = 0; i < 60; i++) stepPlayer(open, state, DT, DEFAULT_SWING)
        const [pulled, normal] = state.webs
        expect(pulled.length).toBeLessThan(normal.length)
    })
})
