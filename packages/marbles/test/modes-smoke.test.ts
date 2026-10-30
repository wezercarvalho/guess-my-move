import { describe, expect, it } from 'vitest'

import { createBotPlanner, DEFAULT_BOT } from '../src/bot/index.js'
import {
    type Competitor,
    type Match,
    type Opponent,
    type Outcome,
    type ShotSource,
    createMatch,
} from '../src/match/index.js'
import { type Body, DEFAULT_PHYSICS } from '../src/physics.js'
import { createBeteMode } from '../src/modes/bete/index.js'
import { createHoleMode } from '../src/modes/hole/index.js'
import {
    createTriangleMode,
    DEFAULT_TRIANGLE_CONFIG,
    triangleBotAimPoint,
} from '../src/modes/triangle/index.js'
import { type Mode } from '../src/match/index.js'

/**
 * Teste de fumaça: para cada modo do registro e cada adversário, uma partida
 * inteira com fontes de tiro simuladas (jogador com planejador de bot de semente
 * fixa, adversário bot) termina com resultado válido, em número finito de tiros e
 * sem lançar. Travar ou não terminar é defeito do modo. Cada entrada traz como a
 * fonte escolhe o ponto de chegada, porque o ponto bom depende da geometria do
 * modo. Deixa claro que isto prova TERMINAÇÃO, não equilíbrio nem diversão.
 */

const VALID: readonly Outcome[] = ['win', 'draw', 'loss']

/** Ponto de chegada do tiro, dado o campo preparado e de quem é a vez. */
type AimPoint = (field: readonly Body[], competitor: Competitor) => { x: number; y: number } | null

interface SmokeMode {
    id: string
    mode: Mode
    aimPoint: AimPoint
}

/** Fabrica as entradas de fumaça; cada modo é recriado por partida (estado por rodada). */
function smokeModes(): SmokeMode[] {
    const triangle = createTriangleMode()
    const hole = createHoleMode()
    return [
        {
            id: 'bete',
            mode: createBeteMode(),
            // Bete: mira o alvo (índice 1).
            aimPoint: (field) => (field.length > 1 ? { ...field[1].pos } : null),
        },
        {
            id: 'triangle',
            // Triângulo: a bolinha de dentro mais próxima da borda; empurra para fora.
            mode: triangle,
            aimPoint: (field) => triangleBotAimPoint(field, DEFAULT_TRIANGLE_CONFIG),
        },
        {
            id: 'hole',
            // Cova: o centro da cova ativa do competidor da vez.
            mode: hole,
            aimPoint: (_field, competitor) => hole.botAimPoint(competitor),
        },
    ]
}

/**
 * Fonte de tiro determinística: planeja o tiro com o bot de semente fixa, do
 * atirador (índice 0) ao ponto de chegada do modo. Sem ponto (campo vazio ou
 * nada a mirar) devolve um tiro pequeno para a frente, que o motor rola e avalia
 * sem travar.
 */
function plannedSource(aimPoint: AimPoint, competitor: Competitor, seedBase: number): ShotSource {
    const planner = createBotPlanner(DEFAULT_BOT)
    let shot = 0
    return {
        nextShot(field) {
            shot++
            if (!field || field.length === 0) return { x: 400, y: 0 }
            const origin = field[0].pos
            const point = aimPoint(field, competitor)
            if (!point) return { x: 400, y: 0 }
            return planner.planShot(origin, point, seedBase + shot * 101)
        },
    }
}

/** Joga a partida inteira com guarda de segurança e reporta se terminou. */
function playToEnd(match: Match): { finished: boolean; steps: number } {
    let steps = 0
    const LIMIT = 10_000
    while (!match.finished() && steps < LIMIT) {
        match.nextStep()
        steps++
    }
    return { finished: match.finished(), steps }
}

describe('fumaça: todos os modos terminam em tiros finitos (terminação, não equilíbrio)', () => {
    const opponents: readonly Opponent[] = ['target', 'bot']

    for (const { id, mode, aimPoint } of smokeModes()) {
        for (const opponent of opponents) {
            it(`modo ${id} contra ${opponent}: termina com resultado válido`, () => {
                const match = createMatch({
                    mode,
                    opponent,
                    sources: {
                        player: plannedSource(aimPoint, 'player', 1000),
                        bot: plannedSource(aimPoint, 'opponent', 7000),
                    },
                    physics: DEFAULT_PHYSICS,
                })

                expect(() => {
                    const { finished, steps } = playToEnd(match)
                    expect(finished).toBe(true)
                    expect(steps).toBeLessThan(10_000)
                }).not.toThrow()

                const rounds = match.roundOutcomes()
                expect(rounds).toHaveLength(mode.roundsPerMatch)
                for (const r of rounds) expect(VALID).toContain(r)
                expect(VALID).toContain(match.matchOutcome())
            })
        }
    }

    it('o motor é determinístico: a mesma semente repete o resultado em cada modo', () => {
        for (const opponent of opponents) {
            for (const { aimPoint, mode } of smokeModes()) {
                const run = () => {
                    const match = createMatch({
                        mode,
                        opponent,
                        sources: {
                            player: plannedSource(aimPoint, 'player', 1000),
                            bot: plannedSource(aimPoint, 'opponent', 7000),
                        },
                        physics: DEFAULT_PHYSICS,
                    })
                    playToEnd(match)
                    return match.roundOutcomes().join(',')
                }
                // Recria o modo entre execuções: o estado por rodada é reinicializado em buildRound.
                expect(run()).toBe(run())
            }
        }
    })
})
