import { describe, expect, it } from 'vitest'

import {
    type Body,
    DEFAULT_PHYSICS,
    type PhysicsConfig,
    isAtRest,
    stepBodies,
} from '../src/physics.js'

const R = 14
const body = (x: number, y: number, vx = 0, vy = 0): Body => ({
    pos: { x, y },
    vel: { x: vx, y: vy },
    radius: R,
})
const noFriction: PhysicsConfig = { ...DEFAULT_PHYSICS, friction: 0 }

function run(bodies: Body[], steps: number, config: PhysicsConfig) {
    let current = bodies
    const contacts: (readonly [number, number])[] = []
    for (let i = 0; i < steps; i++) {
        const result = stepBodies(current, config)
        current = result.bodies
        contacts.push(...result.contacts)
    }
    return { bodies: current, contacts }
}

describe('stepBodies: movimento e atrito', () => {
    it('avança com velocidade constante quando não há atrito', () => {
        const { bodies } = run([body(100, 300, 120, 60)], 120, noFriction)
        expect(bodies[0]?.pos.x).toBeCloseTo(220, 6)
        expect(bodies[0]?.pos.y).toBeCloseTo(360, 6)
        expect(bodies[0]?.vel).toEqual({ x: 120, y: 60 })
    })

    it('o atrito reduz a velocidade de forma linear (400 unid/s² por padrão)', () => {
        const { bodies } = run([body(50, 300, 700, 0)], 120, DEFAULT_PHYSICS)
        expect(bodies[0]?.vel.x).toBeCloseTo(300, 6)
        expect(bodies[0]?.vel.y).toBeCloseTo(0, 9)
    })

    it('para por completo abaixo da velocidade de parada e permanece parada', () => {
        const { bodies } = run([body(100, 300, 40, 0)], 60, DEFAULT_PHYSICS)
        expect(bodies[0]?.vel).toEqual({ x: 0, y: 0 })
        const stopped = bodies[0]?.pos.x
        const again = run(bodies, 30, DEFAULT_PHYSICS)
        expect(again.bodies[0]?.pos.x).toBe(stopped)
        expect(isAtRest(again.bodies, DEFAULT_PHYSICS)).toBe(true)
    })

    it('isAtRest é falso enquanto alguma bolinha se move', () => {
        expect(isAtRest([body(100, 300), body(300, 300, 50, 0)], DEFAULT_PHYSICS)).toBe(false)
        expect(isAtRest([body(100, 300), body(300, 300)], DEFAULT_PHYSICS)).toBe(true)
    })

    it('não altera os corpos recebidos', () => {
        const input = [body(100, 300, 500, 0)]
        const snapshot = input.map((b) => ({ pos: { ...b.pos }, vel: { ...b.vel }, radius: b.radius }))
        stepBodies(input, DEFAULT_PHYSICS)
        expect(input).toEqual(snapshot)
    })

    it('é determinística: a mesma entrada dá a mesma saída', () => {
        const start = () => [body(150, 300, 900, 120), body(550, 310)]
        const a = run(start(), 400, DEFAULT_PHYSICS)
        const b = run(start(), 400, DEFAULT_PHYSICS)
        expect(a).toEqual(b)
    })
})

describe('stepBodies: paredes', () => {
    const { width, height } = DEFAULT_PHYSICS
    const cases: [string, Body, (b: Body) => boolean][] = [
        ['esquerda', body(R + 2, 300, -400, 0), (b) => b.vel.x > 0],
        ['direita', body(width - R - 2, 300, 400, 0), (b) => b.vel.x < 0],
        ['topo', body(400, R + 2, 0, -400), (b) => b.vel.y > 0],
        ['base', body(400, height - R - 2, 0, 400), (b) => b.vel.y < 0],
    ]
    it.each(cases)('rebate na parede %s com restituição 0,8', (_name, start, reversed) => {
        const { bodies } = run([start], 12, noFriction)
        const result = bodies[0]
        expect(reversed(result)).toBe(true)
        expect(Math.hypot(result.vel.x, result.vel.y)).toBeCloseTo(320, 6)
        expect(result.pos.x).toBeGreaterThanOrEqual(R)
        expect(result.pos.x).toBeLessThanOrEqual(width - R)
        expect(result.pos.y).toBeGreaterThanOrEqual(R)
        expect(result.pos.y).toBeLessThanOrEqual(height - R)
    })
})

describe('stepBodies: colisão entre bolinhas', () => {
    it('em cheio e elástica, a bolinha de tiro para e o alvo sai com a velocidade dela', () => {
        const { bodies, contacts } = run(
            [body(150, 300, 500, 0), body(300, 300)],
            120,
            noFriction,
        )
        expect(contacts[0]).toEqual([0, 1])
        expect(bodies[0]?.vel.x).toBeCloseTo(0, 6)
        expect(bodies[1]?.vel.x).toBeCloseTo(500, 6)
    })

    it('na colisão oblíqua conserva quantidade de movimento e energia cinética', () => {
        const start = [body(150, 300, 500, 0), body(300, 312)]
        const momentum = (list: readonly Body[]) =>
            list.reduce((sum, b) => ({ x: sum.x + b.vel.x, y: sum.y + b.vel.y }), { x: 0, y: 0 })
        const energy = (list: readonly Body[]) =>
            list.reduce((sum, b) => sum + (b.vel.x ** 2 + b.vel.y ** 2) / 2, 0)
        const { bodies, contacts } = run(start, 60, noFriction)
        expect(contacts.length).toBeGreaterThan(0)
        expect(momentum(bodies).x).toBeCloseTo(momentum(start).x, 6)
        expect(momentum(bodies).y).toBeCloseTo(momentum(start).y, 6)
        expect(energy(bodies)).toBeCloseTo(energy(start), 4)
        expect(bodies[1]?.vel.y).not.toBe(0)
    })

    it('separa bolinhas sobrepostas', () => {
        const { bodies } = run([body(300, 300, 100, 0), body(310, 300)], 1, noFriction)
        const a = bodies[0]
        const b = bodies[1]
        expect(Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y)).toBeGreaterThanOrEqual(2 * R - 1e-9)
    })

    it('não atravessa o alvo na velocidade máxima do tiro (1100 unid/s)', () => {
        const { contacts } = run([body(150, 300, 1100, 0), body(550, 300)], 240, DEFAULT_PHYSICS)
        expect(contacts[0]).toEqual([0, 1])
    })

    it('não registra contato quando as bolinhas só passam perto', () => {
        const { contacts } = run([body(150, 300, 900, 0), body(550, 340)], 240, DEFAULT_PHYSICS)
        expect(contacts).toEqual([])
    })
})
