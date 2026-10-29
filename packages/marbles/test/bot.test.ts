import { describe, expect, it } from 'vitest'

import { DEFAULT_BOT, createBotPlanner, directionTo, speedToStop } from '../src/bot/index.js'
import { type Body, DEFAULT_PHYSICS, isAtRest, stepBodies } from '../src/physics.js'
import { DEFAULT_SHOT } from '../src/shot.js'

const TETO = DEFAULT_SHOT.gain * DEFAULT_SHOT.maxPull // 1100

/** Simula uma bolinha única com a velocidade dada e devolve onde ela para. */
function pararEm(origem: { x: number; y: number }, velocidade: { x: number; y: number }): { x: number; y: number } {
    let campo: Body[] = [{ pos: { ...origem }, vel: { ...velocidade }, radius: 14 }]
    let passos = 0
    while (!isAtRest(campo, DEFAULT_PHYSICS) && passos < 10_000) {
        campo = stepBodies(campo, DEFAULT_PHYSICS).bodies
        passos++
    }
    return campo[0].pos
}

/** Distância entre dois pontos. */
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('bot: erro zero (parada por simulação)', () => {
    it('para a no máximo 1 unidade do ponto entre 50 e 700 unidades numa trajetória livre', () => {
        // Diagonal canto a canto (campo 800 x 600): um trajeto reto de até 700 unidades cabe sem tocar a parede.
        const origem = { x: 74, y: 74 }
        const dlen = Math.hypot(786 - 74, 586 - 74)
        const dir = { x: (786 - 74) / dlen, y: (586 - 74) / dlen }
        for (const d of [50, 120, 250, 400, 550, 700]) {
            const alvo = { x: origem.x + dir.x * d, y: origem.y + dir.y * d }
            const velocidade = speedToStop(origem, alvo, DEFAULT_PHYSICS, 14)
            const parada = pararEm(origem, velocidade)
            expect(dist(parada, alvo)).toBeLessThanOrEqual(1)
        }
    })

    it('a direção aponta da origem para o ponto', () => {
        const dir = directionTo({ x: 100, y: 300 }, { x: 200, y: 400 })
        expect(dir.x).toBeCloseTo(Math.SQRT1_2, 6)
        expect(dir.y).toBeCloseTo(Math.SQRT1_2, 6)
    })
})

describe('bot: erro por semente', () => {
    it('a mesma semente e o mesmo campo dão o tiro idêntico; sementes diferentes diferem', () => {
        const alvo = { x: 500, y: 300 }
        const origem = { x: 100, y: 300 }
        const tiro = (semente: number) =>
            createBotPlanner(DEFAULT_BOT).planShot(origem, alvo, semente, DEFAULT_PHYSICS, 14)
        const a = tiro(42)
        const b = tiro(42)
        const c = tiro(43)
        expect(a).toEqual(b)
        expect(a.x === c.x && a.y === c.y).toBe(false)
    })
})

/*
 * Os parâmetros de DEFAULT_BOT (desvio angular e de força) são PALPITES
 * INICIAIS a calibrar com uso real. A faixa de 30% a 60% abaixo é PROTEÇÃO DE
 * REGRESSÃO, não equilíbrio medido nem prova de diversão: trava a mira do bot
 * contra mudanças acidentais, não afirma que o jogo está balanceado.
 */
describe('bot: DEFAULT_BOT (faixa de acerto e teto)', () => {
    it('acerta entre 30% e 60% em 1000 tiros a 400 unidades, raio 14, e nenhum tiro excede gain·maxPull', () => {
        const origem = { x: 100, y: 300 }
        const alvoCentro = { x: 500, y: 300 }
        const planejador = createBotPlanner(DEFAULT_BOT)
        let acertos = 0
        let maiorVel = 0
        for (let s = 0; s < 1000; s++) {
            const tiro = planejador.planShot(origem, alvoCentro, s * 2654435761 + 1, DEFAULT_PHYSICS, 14)
            maiorVel = Math.max(maiorVel, Math.hypot(tiro.x, tiro.y))
            // Simula o tiro com o alvo parado presente; acerto = contato.
            let campo: Body[] = [
                { pos: { ...origem }, vel: { x: tiro.x, y: tiro.y }, radius: 14 },
                { pos: { ...alvoCentro }, vel: { x: 0, y: 0 }, radius: 14 },
            ]
            let bateu = false
            let passos = 0
            while (!isAtRest(campo, DEFAULT_PHYSICS) && passos < 10_000) {
                const r = stepBodies(campo, DEFAULT_PHYSICS)
                campo = r.bodies
                if (r.contacts.some(([a, b]) => a === 0 && b === 1)) bateu = true
                passos++
            }
            if (bateu) acertos++
        }
        const taxa = acertos / 1000
        expect(taxa).toBeGreaterThanOrEqual(0.3)
        expect(taxa).toBeLessThanOrEqual(0.6)
        expect(maiorVel).toBeLessThanOrEqual(TETO + 1e-9)
    })
})
