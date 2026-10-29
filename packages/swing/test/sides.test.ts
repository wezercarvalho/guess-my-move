import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { createSwingWorld } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const PITCH = (10 * Math.PI) / 180

describe('teia por lado (mão esquerda e direita)', () => {
    const towers = [box(-60, -90, -15, -70, 150), box(15, -90, 60, -70, 150)]

    function airborne() {
        const world = createSwingWorld(createCityIndex(cityOf(...towers)))
        world.state.position = { x: 0, y: 60, z: 0 }
        world.state.yaw = 0
        world.state.pitch = PITCH
        world.state.started = true
        return world
    }

    const press = (side: -1 | 0 | 1) => ({ webHeld: true, webSide: side, yawRate: 0, pitchRate: 0 })
    const release = { webHeld: false, yawRate: 0, pitchRate: 0 }

    it('a mão esquerda prende à esquerda e a direita prende à direita', () => {
        const left = airborne()
        left.step(press(-1), 1 / 120)
        expect(left.state.web?.anchor.x).toBeLessThan(left.state.position.x)
        const right = airborne()
        right.step(press(1), 1 / 120)
        expect(right.state.web?.anchor.x).toBeGreaterThan(right.state.position.x)
    })

    it('trocar de mão com a teia presa lança uma teia nova do outro lado', () => {
        const world = airborne()
        world.step(press(-1), 1 / 120)
        world.step(press(1), 1 / 120)
        expect(world.state.stats.webs).toBe(2)
        expect(world.state.web?.anchor.x).toBeGreaterThan(world.state.position.x)
    })

    it('com as duas mãos um instante, largar a que lançou passa a teia para a outra', () => {
        const world = airborne()
        world.step(press(-1), 1 / 120)
        world.step(press(0), 1 / 120)
        expect(world.state.stats.webs).toBe(1)
        world.step(press(1), 1 / 120)
        expect(world.state.stats.webs).toBe(2)
        expect(world.state.web?.side).toBe(1)
    })

    it('uma troca que erra conta um erro só, não um por passo', () => {
        const world = createSwingWorld(createCityIndex(cityOf(box(-60, -90, -15, -70, 150))))
        world.state.position = { x: 0, y: 60, z: 0 }
        world.state.pitch = PITCH
        world.state.started = true
        world.step(press(-1), 1 / 120)
        const misses = world.state.stats.misses
        for (let i = 0; i < 10; i++) world.step(press(1), 1 / 120)
        expect(world.state.stats.misses).toBeLessThanOrEqual(misses + 1)
    })

    it('soltar uma das duas mãos mantém a teia, sem lançar outra', () => {
        const world = airborne()
        world.step(press(0), 1 / 120)
        const before = world.state.stats.webs + world.state.stats.misses
        world.step(press(-1), 1 / 120)
        expect(world.state.stats.webs + world.state.stats.misses).toBe(before)
    })

    it('mostra de antemão onde a teia prenderia, sem lançá-la', () => {
        const world = airborne()
        const preview = world.aim(1)
        expect(preview?.x).toBeGreaterThan(0)
        expect(world.state.web).toBeNull()
        expect(world.state.stats.webs).toBe(0)
        world.step(press(1), 1 / 120)
        expect(world.state.web?.anchor).toEqual(preview)
        world.step(release, 1 / 120)
        expect(world.state.web).toBeNull()
    })

    it('sem o campo de lado, a teia sai para a frente como antes', () => {
        const world = createSwingWorld(createCityIndex(cityOf(box(-20, -90, 20, -70, 150))))
        world.state.position = { x: 0, y: 60, z: 0 }
        world.state.pitch = PITCH
        world.state.started = true
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        expect(world.state.web).not.toBeNull()
    })
})

describe('câmera acompanha o movimento', () => {
    function flying() {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.started = true
        world.state.position = { x: 0, y: 120, z: 0 }
        world.state.velocity = { x: 30, y: 0, z: 0 }
        world.state.yaw = 0
        return world
    }
    const idle = { webHeld: false, yawRate: 0, pitchRate: 0 }

    it('em voo, a guinada se aproxima da direção em que o jogador se move', () => {
        const world = flying()
        for (let i = 0; i < 120; i++) world.step(idle, 1 / 120)
        expect(world.state.yaw).toBeGreaterThan(0.5)
        expect(world.state.yaw).toBeLessThan(Math.PI / 2 + 0.01)
    })

    it('não gira sozinha enquanto o jogador está girando a câmera', () => {
        const world = flying()
        world.step({ ...idle, yawRate: -1 }, 1 / 120)
        expect(world.state.yaw).toBeLessThan(0)
    })

    it('antes do primeiro gesto a câmera fica onde o jogador olha', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.velocity = { x: 30, y: 0, z: 0 }
        for (let i = 0; i < 60; i++) world.step(idle, 1 / 120)
        expect(world.state.yaw).toBe(0)
    })
})
