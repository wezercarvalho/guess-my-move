import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING } from '../src/physics.js'
import { createSwingWorld } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const PITCH = (10 * Math.PI) / 180
const hold = { webHeld: true, webSide: 0 as const, yawRate: 0, pitchRate: 0 }

function airborne(city = cityOf(), config = DEFAULT_SWING) {
    const world = createSwingWorld(createCityIndex(city), config)
    world.state.position = { x: 0, y: 60, z: 0 }
    world.state.yaw = 0
    world.state.pitch = PITCH
    world.state.started = true
    return world
}

describe('teia no céu (sem prédio alcançável)', () => {
    it('sem prédio por perto, prende num ponto à frente e acima do jogador', () => {
        const world = airborne()
        world.step(hold, 1 / 120)
        const web = world.state.web
        expect(web).not.toBeNull()
        expect(web?.virtual).toBe(true)
        expect(web?.anchor.y).toBeGreaterThan(60 + 30)
        expect(web?.anchor.z).toBeLessThan(-30)
        expect(world.state.stats.misses).toBe(0)
    })

    it('o lado desloca o ponto do céu para esse lado', () => {
        const left = airborne()
        left.step({ ...hold, webSide: -1 }, 1 / 120)
        const right = airborne()
        right.step({ ...hold, webSide: 1 }, 1 / 120)
        expect(left.state.web?.anchor.x).toBeLessThan(0)
        expect(right.state.web?.anchor.x).toBeGreaterThan(0)
    })

    it('um prédio alcançável tem preferência sobre o céu', () => {
        const world = airborne(cityOf(box(-20, -90, 20, -70, 200)))
        world.step(hold, 1 / 120)
        expect(world.state.web?.virtual).toBeFalsy()
        expect(world.state.web?.anchor.z).toBeCloseTo(-70, 0)
    })

    it('acima da altura máxima do céu a teia erra', () => {
        const world = airborne()
        world.state.position.y = DEFAULT_SWING.skyWeb!.maxAltitude + 20
        world.step(hold, 1 / 120)
        expect(world.state.web).toBeNull()
        expect(world.state.stats.misses).toBe(1)
    })

    it('pode ser desligada na configuração', () => {
        const world = airborne(cityOf(), { ...DEFAULT_SWING, skyWeb: null })
        world.step(hold, 1 / 120)
        expect(world.state.web).toBeNull()
        expect(world.state.stats.misses).toBe(1)
    })

    it('a prévia mostra o ponto do céu quando não há prédio', () => {
        const world = airborne()
        expect(world.aim(1)).not.toBeNull()
    })

    it('balançar nela leva o jogador para a frente e o faz subir de novo', () => {
        const world = airborne()
        world.state.velocity = { x: 0, y: 0, z: -15 }
        let top = 60
        let maxSpeed = 0
        for (let i = 0; i < 120 * 6; i++) {
            world.step(hold, 1 / 120)
            top = Math.max(top, world.state.position.y)
            maxSpeed = Math.max(maxSpeed, Math.hypot(world.state.velocity.x, world.state.velocity.z))
        }
        expect(world.state.position.z).toBeLessThan(-30)
        expect(maxSpeed).toBeGreaterThan(15)
        expect(world.state.position.y).toBeGreaterThan(5)
    })
})
