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
    'acertar tarde é empate e errar os cinco tiros é derrota. Contra o bot: os dois atiram o mesmo número ' +
    'de vezes; acertar num tiro antes do outro é vitória, o outro leva a derrota, e acertar no mesmo ' +
    'número de tiro ou errar os cinco dá empate.'

/** Regras curtas por adversário (no máximo 2 frases cada). */
const RULES = {
    target: 'Acertar o alvo logo é vitória e acertar tarde é empate. Errar os cinco tiros é derrota.',
    bot: 'Os dois atiram o mesmo número de vezes: quem acerta em menos tiros vence e o outro leva a derrota. Acertar no mesmo tiro ou errar os cinco dá empate.',
}

export const DEFAULT_BETE_MODE: Mode = createBeteMode()

export function createBeteMode(overrides: Partial<BeteConfig> = {}): Mode {
    const cfg: BeteConfig = { ...DEFAULT_BETE_CONFIG, ...overrides }

    /** Estado por rodada, reconstruído a cada `buildRound`. */
    let roundIndex = 0
    let playerShots = 0
    let opponentShots = 0
    /** Quem já acertou o alvo nesta rodada (contra o bot, a rodada só fecha com os tiros emparelhados). */
    let playerHit = false
    let opponentHit = false

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
        playerHit = false
        opponentHit = false
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
            // Contra o bot: o acerto vale, mas a rodada só fecha com os tiros emparelhados (abaixo).
            if (competitor === 'player') playerHit = true
            else opponentHit = true
        }

        if (opponent === 'bot') {
            // Os dois atiram o mesmo número de vezes: com o par de tiros completo, quem acertou vence;
            // se os dois acertaram no mesmo número de tiro, empata.
            if (playerShots === opponentShots && (playerHit || opponentHit)) {
                const outcome = playerHit && opponentHit ? 'draw' : playerHit ? 'win' : 'loss'
                return { yield: hit ? 1 : 0, finished: true, outcome, field: reset }
            }
            if (exhausted(opponent)) {
                return { yield: hit ? 1 : 0, finished: true, outcome: 'draw', field: reset }
            }
            return { yield: hit ? 1 : 0, finished: false, outcome: null, field: reset }
        }

        // Contra a meta, sem acerto: se este tiro esgotou a rodada, é derrota.
        if (exhausted(opponent)) {
            return { yield: 0, finished: true, outcome: 'loss', field: reset }
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
        rules: RULES,
        roundsPerMatch: cfg.roundsPerMatch,
        buildRound,
        shotLimit,
        evaluate,
    }
}
