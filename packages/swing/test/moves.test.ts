import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING } from '../src/physics.js'
import { createSwingWorld } from '../src/world.js'
import { box, cityOf } from './helpers.js'

const DT = 1 / 120
const PITCH = (10 * Math.PI) / 180
const hold = { held: { center: true }, yawRate: 0, pitchRate: 0 }
const free = { held: {}, yawRate: 0, pitchRate: 0 }

/** Prédio alto 60 m à frente (guinada 0 olha para -Z). */
const tower = box(-30, -120, 30, -60, 200)

function world(position = { x: 0, y: 1.7, z: 0 }) {
    const w = createSwingWorld(createCityIndex(cityOf(tower)))
    w.state.position = { ...position }
    w.state.yaw = 0
    w.state.pitch = PITCH
    w.state.started = true
    return w
}

const speedOf = (w: ReturnType<typeof world>) =>
    Math.hypot(w.state.velocity.x, w.state.velocity.y, w.state.velocity.z)

describe('lançar do chão', () => {
    it('sai do chão: a teia puxa o jogador para o alto', () => {
        const w = world()
        for (let i = 0; i < 180; i++) w.step(hold, DT)
        expect(w.state.webs).toHaveLength(1)
        expect(w.state.position.y).toBeGreaterThan(15)
    })

    it('o impulso só existe saindo do chão: no ar a teia não dá impulso', () => {
        const ground = world()
        const air = world({ x: 0, y: 40, z: 0 })
        ground.step(hold, DT)
        air.step(hold, DT)
        expect(speedOf(ground)).toBeGreaterThan(DEFAULT_SWING.launchBoost * 0.8)
        expect(speedOf(air)).toBeLessThan(2)
    })
})

describe('teia presa', () => {
    it('continua presa ao bater no prédio e o jogador sobe pela fachada', () => {
        const w = world({ x: 0, y: 40, z: -20 })
        w.state.velocity = { x: 0, y: 0, z: -25 }
        for (let i = 0; i < 360; i++) w.step(hold, DT)
        expect(w.state.webs).toHaveLength(1)
        expect(w.state.position.z).toBeGreaterThanOrEqual(-60 + DEFAULT_SWING.radius - 0.05)
        expect(w.state.position.y).toBeGreaterThan(40)
    })

    it('só solta quando o jogador pede', () => {
        const w = world({ x: 0, y: 40, z: -20 })
        for (let i = 0; i < 120; i++) w.step(hold, DT)
        expect(w.state.webs).toHaveLength(1)
        w.step(free, DT)
        expect(w.state.webs).toHaveLength(0)
    })
})

describe('puxar', () => {
    it('fechar o punho dá um impulso em direção ao ponto de ancoragem, uma vez por fechada', () => {
        const w = world({ x: 0, y: 40, z: 0 })
        w.step(hold, DT)
        const before = speedOf(w)
        w.step({ ...hold, pull: { center: true } }, DT)
        const after = speedOf(w)
        expect(after - before).toBeGreaterThan(DEFAULT_SWING.pullImpulse * 0.6)
        // Segurar o punho não repete o impulso.
        w.step({ ...hold, pull: { center: true } }, DT)
        expect(speedOf(w) - after).toBeLessThan(1)
        expect(w.state.webs[0]?.pulling).toBe(true)
    })

    it('abrir e fechar de novo dá outro impulso', () => {
        const w = world({ x: 0, y: 40, z: 0 })
        w.step(hold, DT)
        w.step({ ...hold, pull: { center: true } }, DT)
        w.step(hold, DT)
        const before = speedOf(w)
        w.step({ ...hold, pull: { center: true } }, DT)
        expect(speedOf(w) - before).toBeGreaterThan(DEFAULT_SWING.pullImpulse * 0.6)
    })

    it('sem teia presa, o punho não faz nada', () => {
        const w = world({ x: 0, y: 40, z: 0 })
        w.step({ ...free, pull: { center: true } }, DT)
        expect(w.state.webs).toHaveLength(0)
        expect(speedOf(w)).toBeLessThan(1)
    })
})

describe('câmera automática', () => {
    it('a inclinação acompanha o movimento sem a mão', () => {
        const w = createSwingWorld(createCityIndex(cityOf()))
        w.state.started = true
        w.state.position = { x: 0, y: 150, z: 0 }
        w.state.velocity = { x: 0, y: 0, z: -30 }
        w.state.pitch = (-50 * Math.PI) / 180
        for (let i = 0; i < 240; i++) w.step(free, DT)
        expect(w.state.pitch).toBeGreaterThan((-35 * Math.PI) / 180)
    })

    it('a guinada segue a direção do movimento', () => {
        const w = createSwingWorld(createCityIndex(cityOf()))
        w.state.started = true
        w.state.position = { x: 0, y: 150, z: 0 }
        w.state.velocity = { x: 30, y: 0, z: 0 }
        w.state.yaw = 0
        for (let i = 0; i < 360; i++) w.step(free, DT)
        expect(w.state.yaw).toBeGreaterThan(1)
    })
})
