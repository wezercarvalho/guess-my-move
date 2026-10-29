import { describe, expect, it } from 'vitest'

import {
    DEFAULT_TRIANGLE_CONFIG,
    DEFAULT_TRIANGLE_MODE,
    createTriangleMode,
    triangleBotAimPoint,
} from '../src/modes/triangle/index.js'
import { type Body, DEFAULT_PHYSICS, isAtRest, stepBodies } from '../src/physics.js'
import { createMatch } from '../src/match/index.js'

const cfg = DEFAULT_TRIANGLE_CONFIG
const centro = cfg.circleCenter
const distAoCentro = (b: Body) => Math.hypot(b.pos.x - centro.x, b.pos.y - centro.y)

describe('modo Triângulo: formação inicial', () => {
    it('as 6 bolinhas estão dentro do círculo e nenhum par de centros está a menos que a soma dos raios', () => {
        const mode = createTriangleMode()
        const campo = mode.buildRound(0, 'target')
        const bolas = campo.slice(1) // índice 0 é a bolinha de tiro
        expect(bolas).toHaveLength(6)
        for (const b of bolas) {
            // Totalmente dentro: centro a no máximo raio do círculo - raio da bolinha.
            expect(distAoCentro(b)).toBeLessThanOrEqual(cfg.circleRadius - cfg.radius)
        }
        for (let i = 0; i < bolas.length; i++) {
            for (let j = i + 1; j < bolas.length; j++) {
                const d = Math.hypot(bolas[i].pos.x - bolas[j].pos.x, bolas[i].pos.y - bolas[j].pos.y)
                expect(d).toBeGreaterThan(bolas[i].radius + bolas[j].radius)
            }
        }
    })

    it('estabilidade: sem tiro, nenhuma bolinha se move sozinha', () => {
        const mode = createTriangleMode()
        let campo = mode.buildRound(0, 'target')
        const antes = campo.map((b) => ({ ...b.pos }))
        for (let i = 0; i < 600; i++) campo = stepBodies(campo, DEFAULT_PHYSICS).bodies
        campo.forEach((b, i) => {
            expect(b.pos.x).toBeCloseTo(antes[i].x, 6)
            expect(b.pos.y).toBeCloseTo(antes[i].y, 6)
        })
        expect(isAtRest(campo, DEFAULT_PHYSICS)).toBe(true)
    })

    it('as 3 rodadas usam a mesma formação', () => {
        const mode = createTriangleMode()
        const r0 = mode.buildRound(0, 'target').map((b) => b.pos)
        const r1 = mode.buildRound(1, 'target').map((b) => b.pos)
        expect(r1).toEqual(r0)
    })
})

describe('modo Triângulo: captura', () => {
    it('uma bolinha parada totalmente fora é capturada; dentro da margem não', () => {
        const mode = createTriangleMode()
        const dentro: Body = {
            pos: { x: centro.x, y: centro.y },
            vel: { x: 0, y: 0 },
            radius: cfg.radius,
        }
        // Centro exatamente na borda externa (raio do círculo + raio da bolinha) conta como fora.
        const fora: Body = {
            pos: { x: centro.x + cfg.circleRadius + cfg.radius + 1, y: centro.y },
            vel: { x: 0, y: 0 },
            radius: cfg.radius,
        }
        const atirador: Body = { pos: { x: 40, y: 300 }, vel: { x: 0, y: 0 }, radius: cfg.radius }

        const semCaptura = mode.evaluate({
            field: [atirador, dentro],
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(semCaptura.yield).toBe(0)

        const comCaptura = mode.evaluate({
            field: [atirador, fora],
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(comCaptura.yield).toBe(1)
        // A bolinha capturada sai do campo persistido (só resta o atirador reposicionado).
        expect(comCaptura.field?.length).toBe(1)
    })

    it('a captura em cadeia é do competidor do tiro: várias bolinhas fora saem de uma vez', () => {
        const mode = createTriangleMode()
        const atirador: Body = { pos: { x: 40, y: 300 }, vel: { x: 0, y: 0 }, radius: cfg.radius }
        const foraA: Body = { pos: { x: centro.x + cfg.circleRadius + cfg.radius + 5, y: centro.y }, vel: { x: 0, y: 0 }, radius: cfg.radius }
        const foraB: Body = { pos: { x: centro.x + cfg.circleRadius + cfg.radius + 60, y: centro.y + 10 }, vel: { x: 0, y: 0 }, radius: cfg.radius }
        const av = mode.evaluate({
            field: [atirador, foraA, foraB],
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(av.yield).toBe(2)
    })
})

describe('modo Triângulo: ponto de chegada do bot', () => {
    it('é a bolinha dentro do círculo mais próxima da borda', () => {
        const mode = createTriangleMode()
        const campo = mode.buildRound(0, 'bot')
        const ponto = triangleBotAimPoint(campo, DEFAULT_TRIANGLE_CONFIG)
        expect(ponto).not.toBeNull()
        // A mais próxima da borda é a de maior distância ao centro entre as de dentro.
        const dentro = campo.slice(1).filter((b) => distAoCentro(b) <= cfg.circleRadius)
        const maisLonge = dentro.reduce((m, b) => (distAoCentro(b) > distAoCentro(m) ? b : m))
        expect(ponto!.x).toBeCloseTo(maisLonge.pos.x, 6)
        expect(ponto!.y).toBeCloseTo(maisLonge.pos.y, 6)
    })
})

describe('modo Triângulo: contra a meta (partida simulada)', () => {
    it('capturar a 6ª bolinha é vitória e encerra a rodada sem gastar os tiros restantes', () => {
        const mode = createTriangleMode()
        mode.buildRound(0, 'target')
        const atirador: Body = { pos: { x: 90, y: 300 }, vel: { x: 0, y: 0 }, radius: cfg.radius }
        const foraDoCirculo = (i: number): Body => ({
            pos: { x: centro.x + cfg.circleRadius + cfg.radius + 2 + i, y: centro.y + i },
            vel: { x: 0, y: 0 },
            radius: cfg.radius,
        })
        // Captura 5 nos primeiros 5 tiros (uma por tiro), sem encerrar.
        let ultima: ReturnType<typeof mode.evaluate> | null = null
        for (let tiro = 1; tiro <= 5; tiro++) {
            ultima = mode.evaluate({
                field: [atirador, foraDoCirculo(tiro)],
                contactsInRound: [],
                competitor: 'player',
                shotsSpent: tiro,
                opponent: 'target',
            })
            expect(ultima.finished).toBe(false)
        }
        // O 6º tiro captura a última: vitória e encerra, bem antes dos 8 tiros.
        const sexto = mode.evaluate({
            field: [atirador, foraDoCirculo(6)],
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 6,
            opponent: 'target',
        })
        expect(sexto.finished).toBe(true)
        expect(sexto.outcome).toBe('win')
    })

    it('esgotar 8 tiros sem capturar nenhuma é derrota (partida simulada completa)', () => {
        const mode = createTriangleMode()
        const match = createMatch({
            mode,
            opponent: 'target',
            // Tiro fraco que não tira ninguém do círculo.
            sources: { player: { nextShot: () => ({ x: 0, y: -30 }) } },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 3000) match.nextStep()
        expect(match.roundOutcomes()[0]).toBe('loss')
    })
})

describe('modo Triângulo: contra o bot (resultado por capturas)', () => {
    it('mais capturas vence; iguais (inclusive 0 a 0) empatam', () => {
        // Usa a avaliação direta do contrato para montar os cenários de resultado.
        const mode = createTriangleMode()
        expect(mode.resolveBotRound(4, 2)).toBe('win')
        expect(mode.resolveBotRound(2, 4)).toBe('loss')
        expect(mode.resolveBotRound(3, 3)).toBe('draw')
        expect(mode.resolveBotRound(0, 0)).toBe('draw')
    })

    it('capturar mantém a vez; sem captura a vez passa', () => {
        const mode = createTriangleMode()
        expect(mode.nextTurn?.('opponent', 1)).toBe('keep')
        expect(mode.nextTurn?.('opponent', 0)).toBe('opponent')
    })
})

describe('modo Triângulo: ajuda', () => {
    it('declara helpText não vazio que cita vitória, derrota e empate', () => {
        const mode = createTriangleMode()
        expect(mode.helpText.toLowerCase()).toContain('vitória')
        expect(mode.helpText.toLowerCase()).toContain('derrota')
        expect(mode.helpText.toLowerCase()).toContain('empate')
        expect(DEFAULT_TRIANGLE_MODE.helpText).toBe(mode.helpText)
    })
})
