/**
 * Modo Triângulo da partida: 6 bolinhas em triângulo (fileiras de 1, 2 e 3)
 * dentro de um círculo; a bolinha de tiro parte de um ponto fixo fora e volta a
 * ele após cada tiro. Uma bolinha é capturada quando, com o campo em repouso,
 * seu centro está totalmente fora do círculo (a pelo menos raio do círculo +
 * raio da bolinha); a captura é do competidor do tiro, inclusive em cadeia. O
 * círculo é geometria do modo — a física (`stepBodies`) não o conhece: o modo
 * retira da lista a bolinha capturada. Puro e determinístico.
 */
import {
    type Competitor,
    type EvaluationContext,
    type Evaluation,
    type Mode,
    type NextTurn,
    type Opponent,
    type Outcome,
} from '../../match/index.js'
import { type Body, type Vec } from '../../physics.js'

export interface TriangleConfig {
    /** Raio de cada bolinha. */
    radius: number
    /** Centro e raio do círculo (geometria do modo). */
    circleCenter: Vec
    circleRadius: number
    /** Ponto de partida da bolinha de tiro; ela volta aqui após cada tiro. */
    shooterStart: Vec
    roundsPerMatch: number
    /** Quantas bolinhas capturar para encerrar (formação cheia). */
    marbleCount: number
    /** Limite de tiros contra a meta. */
    shotLimitTarget: number
    /** Limite de tiros por competidor contra o bot (contando os extras). */
    shotLimitBot: number
    /** Capturas (contra a meta) para vitória e para empate; abaixo, derrota. */
    winCaptures: number
    drawMinCaptures: number
    /** Fábrica da formação das 6 bolinhas (sobrescrevível em teste). */
    formation?: (cfg: TriangleConfig) => Body[]
}

/** Valores iniciais a calibrar com uso real, fixados em configuração (NFR-002). */
export const DEFAULT_TRIANGLE_CONFIG: TriangleConfig = {
    radius: 14,
    circleCenter: { x: 560, y: 300 },
    circleRadius: 120,
    shooterStart: { x: 90, y: 300 },
    roundsPerMatch: 3,
    marbleCount: 6,
    shotLimitTarget: 8,
    shotLimitBot: 5,
    winCaptures: 6,
    drawMinCaptures: 4,
}

const HELP_TEXT =
    'Lance a bolinha de tiro para empurrar as seis de dentro do círculo para fora. Contra a meta: tirar ' +
    'as seis é vitória, quatro ou cinco é empate e três ou menos é derrota. Contra o bot: cada captura ' +
    'mantém a sua vez e, ao fim, mais capturas é vitória, menos é derrota e empate quando empatam.'

/** Regras curtas por adversário (no máximo 2 frases cada). */
const RULES = {
    target: 'Tirar as seis bolinhas do círculo é vitória e quatro ou cinco é empate. Três ou menos é derrota.',
    bot: 'Cada captura mantém a sua vez; ao fim, mais capturas é vitória e menos é derrota. Empatar as capturas é empate.',
}

/** Formação padrão: fileiras de 1, 2 e 3 com folga entre centros, toda dentro do círculo. */
function defaultFormation(cfg: TriangleConfig): Body[] {
    const c = cfg.circleCenter
    const dx = 32
    const dy = 36
    const b = (x: number, y: number): Body => ({ pos: { x, y }, vel: { x: 0, y: 0 }, radius: cfg.radius })
    return [
        b(c.x - dx, c.y),
        b(c.x, c.y - dy / 2),
        b(c.x, c.y + dy / 2),
        b(c.x + dx, c.y),
        b(c.x + dx, c.y - dy),
        b(c.x + dx, c.y + dy),
    ]
}

/** Distância do centro da bolinha ao centro do círculo. */
function distToCenter(b: Body, cfg: TriangleConfig): number {
    return Math.hypot(b.pos.x - cfg.circleCenter.x, b.pos.y - cfg.circleCenter.y)
}

/** `true` quando a bolinha está totalmente fora do círculo (capturada). */
function isOutside(b: Body, cfg: TriangleConfig): boolean {
    return distToCenter(b, cfg) >= cfg.circleRadius + cfg.radius
}

/**
 * Ponto de chegada do bot: a bolinha dentro do círculo mais próxima da borda
 * (maior distância ao centro). `null` quando não há bolinha dentro.
 */
export function triangleBotAimPoint(field: readonly Body[], cfg: TriangleConfig = DEFAULT_TRIANGLE_CONFIG): Vec | null {
    const inside = field.slice(1).filter((b) => !isOutside(b, cfg))
    if (inside.length === 0) return null
    const nearest = inside.reduce((m, b) => (distToCenter(b, cfg) > distToCenter(m, cfg) ? b : m))
    return { ...nearest.pos }
}

/** O modo Triângulo com os auxiliares do bot além do contrato base. */
export interface TriangleMode extends Mode {
    /** Resultado da rodada contra o bot a partir das capturas de cada competidor. */
    resolveBotRound(playerCaptures: number, opponentCaptures: number): Outcome
}

export const DEFAULT_TRIANGLE_MODE: TriangleMode = createTriangleMode()

export function createTriangleMode(overrides: Partial<TriangleConfig> = {}): TriangleMode {
    const cfg: TriangleConfig = { ...DEFAULT_TRIANGLE_CONFIG, ...overrides }
    const makeFormation = cfg.formation ?? defaultFormation

    let captures: Record<Competitor, number> = { player: 0, opponent: 0 }
    let remaining = cfg.marbleCount
    let shots: Record<Competitor, number> = { player: 0, opponent: 0 }

    function shooter(): Body {
        return { pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.radius }
    }

    function buildRound(): Body[] {
        captures = { player: 0, opponent: 0 }
        remaining = cfg.marbleCount
        shots = { player: 0, opponent: 0 }
        return [shooter(), ...makeFormation(cfg)]
    }

    function resolveBotRound(playerCaptures: number, opponentCaptures: number): Outcome {
        if (playerCaptures > opponentCaptures) return 'win'
        if (playerCaptures < opponentCaptures) return 'loss'
        return 'draw'
    }

    function resolveTargetRound(total: number): Outcome {
        if (total >= cfg.winCaptures) return 'win'
        if (total >= cfg.drawMinCaptures) return 'draw'
        return 'loss'
    }

    function exhausted(opponent: Opponent): boolean {
        if (opponent === 'target') return shots.player >= cfg.shotLimitTarget
        return shots.player >= cfg.shotLimitBot && shots.opponent >= cfg.shotLimitBot
    }

    function evaluate(context: EvaluationContext): Evaluation {
        const { field, competitor, shotsSpent, opponent } = context
        shots[competitor] = shotsSpent

        // A bolinha de tiro é o índice 0; as demais são as do círculo.
        const marbles = field.slice(1)
        const captured = marbles.filter((b) => isOutside(b, cfg))
        const kept = marbles.filter((b) => !isOutside(b, cfg))
        captures[competitor] += captured.length
        remaining = kept.length

        // Campo persistido: atirador de volta ao ponto fixo e só as bolinhas que ficaram dentro.
        const nextField: Body[] = [shooter(), ...kept.map((b) => ({ ...b, vel: { x: 0, y: 0 } }))]

        const circleEmpty = remaining === 0
        if (opponent === 'target') {
            if (captures.player >= cfg.winCaptures) {
                return { yield: captured.length, finished: true, outcome: 'win', field: nextField }
            }
            if (exhausted('target')) {
                return { yield: captured.length, finished: true, outcome: resolveTargetRound(captures.player), field: nextField }
            }
            return { yield: captured.length, finished: false, outcome: null, field: nextField }
        }

        // Contra o bot: a rodada fecha quando o círculo esvazia ou os dois esgotam os tiros.
        if (circleEmpty || exhausted('bot')) {
            return {
                yield: captured.length,
                finished: true,
                outcome: resolveBotRound(captures.player, captures.opponent),
                field: nextField,
            }
        }
        return { yield: captured.length, finished: false, outcome: null, field: nextField }
    }

    function nextTurn(defaultAlternate: Competitor, yielded: number): NextTurn {
        // Capturar ao menos uma mantém a vez; sem captura, a vez passa.
        return yielded > 0 ? 'keep' : defaultAlternate
    }

    return {
        name: 'Triângulo',
        helpText: HELP_TEXT,
        rules: RULES,
        scoreLabel: 'Capturas',
        roundsPerMatch: cfg.roundsPerMatch,
        buildRound,
        shotLimit: (_competitor, opponent) => (opponent === 'target' ? cfg.shotLimitTarget : cfg.shotLimitBot),
        evaluate,
        nextTurn,
        describe: () => ({
            circle: { x: cfg.circleCenter.x, y: cfg.circleCenter.y, radius: cfg.circleRadius },
        }),
        resolveBotRound,
    }
}
