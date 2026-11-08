import { describe, expect, it } from 'vitest'
import { createCityIndex, DEFAULT_SWING, findSpawn, pickAnchor } from '@guess-my-move/swing'
import { createTrainingCity, TRAINING_MAP, advanceTraining, EMPTY_TRAINING } from './training.js'

describe('Aurora: cenário local de treino', () => {
    it('oferece primeira âncora, parede larga, telhados e alturas variadas', () => {
        const city = createTrainingCity()
        const index = createCityIndex(city)
        const config = { ...DEFAULT_SWING, spawnHeight: TRAINING_MAP.spawnHeight }
        const spawn = findSpawn(index, config)
        expect(index.resolve(spawn, 1)).toBeNull()
        expect(spawn).toEqual({ x: 0, y: 90, z: 0 })
        expect(pickAnchor(index, spawn, 0, Math.PI / 18)).not.toBeNull()
        expect(new Set(city.buildings.map((b) => b.height)).size).toBeGreaterThan(4)
        expect(index.supportHeight(-180, -90)).toBeGreaterThan(100)
        expect(index.raycast({ x: 0, y: 60, z: -80 }, { x: -1, y: 0, z: 0 }, 160)?.kind).toBe('wall')
        expect(city.visual?.theme).toBe('aurora')
    })
    it('não contém dependência de mídia nem fonte remota', () => {
        expect(JSON.stringify(createTrainingCity())).not.toMatch(/https?:|\.png|\.jpg|\.glb/)
        expect(createTrainingCity()).toEqual(createTrainingCity())
    })
})

describe('exercícios cumulativos, sem tempo nem pontuação', () => {
    it('conta cada teia presa e só puxar enquanto há teia', () => {
        const left = advanceTraining(EMPTY_TRAINING, { webSides: [-1], pulling: false, gripped: false, headClimbing: false, locked: false, released: true })
        expect(left).toMatchObject({ left: true, right: false, pull: false, release: false })
        const both = advanceTraining(left, { webSides: [-1, 1], pulling: true, gripped: false, headClimbing: false, locked: false, released: true })
        expect(both).toMatchObject({ left: true, right: true, pull: true })
        expect(advanceTraining(both, { webSides: [], pulling: true, gripped: false, headClimbing: false, locked: false, released: true }).release).toBe(true)
        expect(advanceTraining(EMPTY_TRAINING, { webSides: [], pulling: true, gripped: false, headClimbing: true, locked: false, released: true }).pull).toBe(false)
    })
    it('não confunde perda automática de teia com soltar intencionalmente', () => {
        expect(advanceTraining({ ...EMPTY_TRAINING, attached: true }, { webSides: [], pulling: false, gripped: false, headClimbing: false, locked: false, released: false }).release).toBe(false)
        expect(advanceTraining({ ...EMPTY_TRAINING, attached: true }, { webSides: [], pulling: false, gripped: true, headClimbing: false, locked: false, released: true }).release).toBe(false)
    })
    it('reconhece agarre, escalada pelo olhar e trava, preservando conquistas', () => {
        const done = advanceTraining(EMPTY_TRAINING, { webSides: [], pulling: false, gripped: true, headClimbing: true, locked: true, released: true })
        expect(done).toMatchObject({ grab: true, climb: true, lock: true })
        expect(advanceTraining(done, { webSides: [], pulling: false, gripped: false, headClimbing: false, locked: false, released: true })).toMatchObject({ grab: true, climb: true, lock: true })
    })
})
