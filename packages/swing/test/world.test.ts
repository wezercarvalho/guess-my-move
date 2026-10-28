import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { pickAnchor } from '../src/web.js'
import { DEFAULT_SWING } from '../src/physics.js'
import { findSpawn } from '../src/spawn.js'
import { createSwingWorld } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const RIGHT = Math.PI / 2

describe('findSpawn', () => {
    it('começa na origem quando não há prédio por perto', () => {
        const spawn = findSpawn(createCityIndex(cityOf()))
        expect(spawn).toEqual({ x: 0, y: DEFAULT_SWING.spawnHeight, z: 0 })
    })

    it('afasta o ponto de partida de qualquer prédio em pelo menos 15 m', () => {
        const index = createCityIndex(cityOf(box(-20, -20, 20, 20, 60)))
        const spawn = findSpawn(index)
        expect(index.clearance(spawn.x, spawn.z)).toBeGreaterThanOrEqual(15)
        expect(spawn.y).toBe(DEFAULT_SWING.spawnHeight)
        expect(Math.abs(spawn.x)).toBeLessThan(200)
        expect(Math.abs(spawn.z)).toBeLessThan(200)
    })
    it('prefere um ponto de partida de onde a teia alcança um prédio alto à frente', () => {
        const index = createCityIndex(cityOf(box(-20, 60, 20, 80, 200)))
        const spawn = findSpawn(index)
        expect(spawn.y).toBe(DEFAULT_SWING.spawnHeight)
        expect(pickAnchor(index, spawn, 0, (10 * Math.PI) / 180)).not.toBeNull()
    })
})

describe('createSwingWorld', () => {
    const tall = box(40, -5, 50, 5, 120)

    function worldWithTower() {
        const world = createSwingWorld(createCityIndex(cityOf(tall)))
        world.state.position = { x: 0, y: 40, z: 0 }
        world.state.yaw = RIGHT
        world.state.pitch = (10 * Math.PI) / 180
        return world
    }

    it('começa parado no ponto de partida, olhando para a frente', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        expect(world.state.position.y).toBe(DEFAULT_SWING.spawnHeight)
        expect(world.state.velocity).toEqual({ x: 0, y: 0, z: 0 })
        expect(world.state.yaw).toBe(0)
    })

    it('ao começar, sai com a velocidade de partida para onde a câmera olha', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.yaw = Math.PI / 2
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        expect(world.state.velocity.x).toBeGreaterThan(DEFAULT_SWING.spawnSpeed * 0.9)
        expect(Math.abs(world.state.velocity.z)).toBeLessThan(0.5)
    })

    it('lança a teia ao apertar e prende no prédio à frente', () => {
        const world = worldWithTower()
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        expect(world.state.web).not.toBeNull()
        expect(world.state.web?.anchor.x).toBeCloseTo(40)
        expect(world.state.stats.webs).toBe(1)
    })

    it('solta a teia ao soltar e só lança de novo no próximo aperto', () => {
        const world = worldWithTower()
        const hold = { webHeld: true, yawRate: 0, pitchRate: 0 }
        world.step(hold, 1 / 120)
        world.step({ ...hold, webHeld: false }, 1 / 120)
        expect(world.state.web).toBeNull()
        world.step(hold, 1 / 120)
        expect(world.state.web).not.toBeNull()
        expect(world.state.stats.webs).toBe(2)
    })

    it('conta a teia que errou e não tenta de novo enquanto o gesto continua', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        const hold = { webHeld: true, yawRate: 0, pitchRate: 0 }
        world.step(hold, 1 / 120)
        world.step(hold, 1 / 120)
        expect(world.state.web).toBeNull()
        expect(world.state.stats.misses).toBe(1)
        expect(world.state.stats.webs).toBe(0)
    })

    it('gira a câmera pelas taxas e limita a inclinação a 60°', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.yaw = 0
        for (let i = 0; i < 120; i++) world.step({ webHeld: false, yawRate: 1, pitchRate: 1 }, 1 / 120)
        expect(world.state.yaw).toBeCloseTo(Math.PI / 2, 1)
        expect(world.state.pitch).toBeCloseTo(DEFAULT_SWING.pitchLimit)
    })

    it('fica parado no ponto de partida até o primeiro gesto de teia, mas a câmera já gira', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.position.y = 50
        const start = { ...world.state.position }
        for (let i = 0; i < 60; i++) world.step({ webHeld: false, yawRate: 1, pitchRate: 0 }, 1 / 120)
        expect(world.state.started).toBe(false)
        expect(world.state.position).toEqual(start)
        expect(world.state.yaw).toBeGreaterThan(0.5)
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        expect(world.state.started).toBe(true)
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        expect(world.state.position.y).toBeLessThan(start.y)
    })

    it('advance acumula passos fixos e limita o tempo de quadro', () => {
        const world = createSwingWorld(createCityIndex(cityOf()))
        world.state.started = true
        world.state.position.y = 80
        world.state.velocity = { x: 0, y: 0, z: 0 }
        world.advance({ webHeld: false, yawRate: 0, pitchRate: 0 }, 10)
        // Só 0,05 s de simulação: a queda chega a cerca de 1 m/s.
        expect(world.state.velocity.y).toBeLessThan(-0.9)
        expect(world.state.velocity.y).toBeGreaterThan(-1.1)
    })

    it('reset volta ao início e zera as estatísticas', () => {
        const world = worldWithTower()
        world.step({ webHeld: true, yawRate: 0, pitchRate: 0 }, 1 / 120)
        world.reset()
        expect(world.state.started).toBe(false)
        expect(world.state.web).toBeNull()
        expect(world.state.stats.webs).toBe(0)
        expect(world.state.position.y).toBe(DEFAULT_SWING.spawnHeight)
    })
})
