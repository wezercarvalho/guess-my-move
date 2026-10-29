/**
 * Modo Bete da partida: uma bolinha de tiro contra um alvo parado. É o antigo
 * treino do bete levado ao motor, agora com limite de tiros, rodadas e
 * adversário (meta ou bot). O alvo ocupa uma de três posições fixas, uma por
 * rodada e igual para os dois competidores; depois de um tiro errado a bolinha
 * de tiro volta ao ponto de partida e o alvo à posição da rodada. Puro e
 * determinístico: nenhuma geometria vaza para o motor, que só conhece o
 * contrato de modo.
 */
import {
    type Competitor,
    type EvaluationContext,
    type Evaluation,
    type Mode,
    type Opponent,
} from '../../match/index.js'
import { type Body, type Vec } from '../../physics.js'

export interface BeteConfig {
    /** Raio das duas bolinhas. */
    radius: number
    /** Ponto de partida da bolinha de tiro (índice 0). */
    shooterStart: Vec
    /** As três posições do alvo, uma por rodada. */
    targetPositions: readonly [Vec, Vec, Vec]
    /** Rodadas por partida (padrão de produto: 3). */
    roundsPerMatch: number
    /** Limite de tiros do competidor contra a meta. */
    shotLimitTarget: number
    /** Limite de tiros por competidor contra o bot. */
    shotLimitBot: number
    /** Até este número de tiros (inclusive) o acerto contra a meta é vitória; depois, empate. */
    winByShot: number
}

/**
 * Valores iniciais a calibrar com uso real, fixados em configuração (NFR-002):
 * 5 tiros, vitória ao acertar em até 3. Nenhuma afirmação de equilíbrio.
 */
export const DEFAULT_BETE_CONFIG: BeteConfig = {
    radius: 14,
    shooterStart: { x: 150, y: 300 },
    targetPositions: [
        { x: 550, y: 300 },
        { x: 600, y: 180 },
        { x: 600, y: 420 },
    ],
    roundsPerMatch: 3,
    shotLimitTarget: 5,
    shotLimitBot: 5,
    winByShot: 3,
}

const HELP_TEXT =
    'Puxe a pinça e solte para lançar a bolinha no alvo. Contra a meta: acertar logo é vitória, ' +
    'acertar tarde é empate e errar os cinco tiros é derrota. Contra o bot: quem acerta primeiro vence, ' +
    'o outro leva a derrota e dez tiros sem acerto dão empate.'

export const DEFAULT_BETE_MODE: Mode = createBeteMode()

export function createBeteMode(overrides: Partial<BeteConfig> = {}): Mode {
    const cfg: BeteConfig = { ...DEFAULT_BETE_CONFIG, ...overrides }

    /** Estado por rodada, reconstruído a cada `buildRound`. */
    let roundIndex = 0
    let playerShots = 0
    let opponentShots = 0

    function targetFor(n: number): Vec {
        return cfg.targetPositions[n % cfg.targetPositions.length]
    }

    function initialField(n: number): Body[] {
        return [
            { pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
            { pos: { ...targetFor(n) }, vel: { x: 0, y: 0 }, radius: cfg.radius },
        ]
    }

    function buildRound(n: number): Body[] {
        roundIndex = n
        playerShots = 0
        opponentShots = 0
        return initialField(n)
    }

    function shotLimit(_competitor: Competitor, opponent: Opponent): number {
        return opponent === 'target' ? cfg.shotLimitTarget : cfg.shotLimitBot
    }

    function evaluate(context: EvaluationContext): Evaluation {
        const { competitor, opponent, shotsSpent, contactsInRound } = context
        if (competitor === 'player') playerShots = shotsSpent
        else opponentShots = shotsSpent

        const hit = contactsInRound.some(([a, b]) => a === 0 && b === 1)
        // O campo volta à posição da rodada depois do tiro (acertou ou errou).
        const reset = initialField(roundIndex)

        if (hit) {
            if (opponent === 'target') {
                const outcome = shotsSpent <= cfg.winByShot ? 'win' : 'draw'
                return { yield: 1, finished: true, outcome, field: reset }
            }
            // Contra o bot: quem acerta primeiro decide a rodada.
            const outcome = competitor === 'player' ? 'win' : 'loss'
            return { yield: 1, finished: true, outcome, field: reset }
        }

        // Sem acerto: se este tiro esgotou a rodada, decide aqui (empate contra o bot).
        if (exhausted(opponent)) {
            const outcome = opponent === 'bot' ? 'draw' : 'loss'
            return { yield: 0, finished: true, outcome, field: reset }
        }
        return { yield: 0, finished: false, outcome: null, field: reset }
    }

    /** `true` quando o tiro recém-avaliado foi o último possível da rodada. */
    function exhausted(opponent: Opponent): boolean {
        if (opponent === 'target') return playerShots >= cfg.shotLimitTarget
        return playerShots >= cfg.shotLimitBot && opponentShots >= cfg.shotLimitBot
    }

    return {
        name: 'Bete',
        helpText: HELP_TEXT,
        roundsPerMatch: cfg.roundsPerMatch,
        buildRound,
        shotLimit,
        evaluate,
    }
}
