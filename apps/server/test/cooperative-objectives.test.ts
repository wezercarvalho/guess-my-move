import { describe, expect, it } from 'vitest'
import { createSwingWorld } from '@guess-my-move/swing'
import { loadSwingCity } from '../src/swing/city-catalog.js'
import { createCooperativeObjectives } from '../src/swing/cooperative-objectives.js'

describe('objetivos independentes do ciclo de sala', () => {
    it.each(['aurora', 'midtown', 'paulista', 'santa-maria'])(
        'preserva a seleção determinística em %s',
        (id) => {
            const city = loadSwingCity(id),
                origin = createSwingWorld(city.index, city.config).state
                    .position,
                before = { ...origin }
            const one = createCooperativeObjectives(city, origin),
                two = createCooperativeObjectives(city, origin)
            expect(one).toEqual(two)
            expect(one.length).toBeGreaterThanOrEqual(3)
            expect(one.length).toBeLessThanOrEqual(5)
            expect(origin).toEqual(before)
            for (const objective of one) {
                expect(objective.collectedBy).toBeNull()
                expect(
                    city.index.clearance(
                        objective.position.x,
                        objective.position.z,
                        8,
                    ),
                ).toBeGreaterThanOrEqual(8)
            }
            one[0].position.x += 500
            expect(createCooperativeObjectives(city, origin)).toEqual(two)
        },
    )
})
