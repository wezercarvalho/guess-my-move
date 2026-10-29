import { describe, expect, it } from 'vitest'

import { createBotPlanner, DEFAULT_BOT } from '../src/bot/index.js'
import {
    type Competitor,
    type Opponent,
    type Outcome,
    type ShotSource,
    createMatch,
} from '../src/match/index.js'
import { type MatchSession, createMatchSession } from '../src/match/session.js'
import { type Body, DEFAULT_PHYSICS } from '../src/physics.js'
import { type Mode } from '../src/match/index.js'
import { createBeteMode } from '../src/modes/bete/index.js'
import { createHoleMode } from '../src/modes/hole/index.js'
import {
    createTriangleMode,
    DEFAULT_TRIANGLE_CONFIG,
    triangleBotAimPoint,
} from '../src/modes/triangle/index.js'

/**
 * Equivalência do condutor único: o mesmo modo, a mesma sequência de tiros do
 * jogador e a mesma semente do bot produzem o MESMO resultado tanto rolando por
 * `createMatch` (um tiro de uma vez) quanto avançando a sessão quadro a quadro
 * (`createMatchSession.advance`). Como existe uma só implementação das regras, a
 * tela animada e o condutor "de uma vez" não podem divergir.
 */

type AimPoint = (field: readonly Body[], competitor: Competitor) => { x: number; y: number } | null

interface EquivMode {
    id: string
    makeMode: () => Mode
    aimPoint: (mode: Mode) => AimPoint
}

/** Entradas por modo: cada partida recria o modo (estado por rodada próprio). */
const EQUIV_MODES: readonly EquivMode[] = [
    {
        id: 'bete',
        makeMode: () => createBeteMode(),
        aimPoint: () => (field) => (field.length > 1 ? { ...field[1].pos } : null),
    },
    {
        id: 'triangle',
        makeMode: () => createTriangleMode(),
        aimPoint: () => (field) => triangleBotAimPoint(field, DEFAULT_TRIANGLE_CONFIG),
    },
    {
        id: 'hole',
        makeMode: () => createHoleMode(),
        aimPoint: (mode) => (_field, competitor) =>
            (mode as ReturnType<typeof createHoleMode>).botAimPoint(competitor),
    },
]

/** Fonte de tiro determinística (planejador de semente fixa) para um competidor. */
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

/** Resultado por `createMatch` (rola cada tiro de uma vez). */
function runViaMatch(entry: EquivMode, opponent: Opponent): Outcome[] {
    const mode = entry.makeMode()
    const aim = entry.aimPoint(mode)
    const match = createMatch({
        mode,
        opponent,
        sources: {
            player: plannedSource(aim, 'player', 1000),
            bot: plannedSource(aim, 'opponent', 7000),
        },
        physics: DEFAULT_PHYSICS,
    })
    let guard = 0
    while (!match.finished() && guard++ < 10_000) match.nextStep()
    return match.roundOutcomes()
}

/** Resultado avançando a sessão quadro a quadro (como a tela faz). */
function runViaSession(entry: EquivMode, opponent: Opponent): Outcome[] {
    const mode = entry.makeMode()
    const aim = entry.aimPoint(mode)
    const player = plannedSource(aim, 'player', 1000)
    const bot = plannedSource(aim, 'opponent', 7000)
    // Intervalo por quadro pequeno (≈ 60 fps) para animar a rolagem de verdade.
    const session: MatchSession = createMatchSession({
        modeId: entry.id,
        mode,
        opponent,
        bot,
        physics: DEFAULT_PHYSICS,
        maxAdvanceMs: 250,
    })

    const DT = 16
    let guard = 0
    while (session.snapshot().phase !== 'match-over' && guard++ < 1_000_000) {
        const snap = session.snapshot()
        if (snap.phase === 'round-over') {
            session.beginNextRound()
            continue
        }
        if (snap.phase === 'player-turn') {
            // Prepara a vez e lê o tiro do jogador com o mesmo campo que o motor usa.
            session.shooter()
            const shot = player.nextShot(session.snapshot().field)
            if (!shot) break
            session.firePlayerShot(shot)
            continue
        }
        // bot-turn / rolling: só o tempo precisa correr, quadro a quadro.
        session.advance(DT)
    }
    return session.snapshot().roundOutcomes
}

describe('equivalência: createMatch e a sessão quadro a quadro convergem', () => {
    const opponents: readonly Opponent[] = ['target', 'bot']
    for (const entry of EQUIV_MODES) {
        for (const opponent of opponents) {
            it(`modo ${entry.id} contra ${opponent}: mesmos resultados por rodada e de partida`, () => {
                const viaMatch = runViaMatch(entry, opponent)
                const viaSession = runViaSession(entry, opponent)
                expect(viaSession).toEqual(viaMatch)
            })
        }
    }
})
