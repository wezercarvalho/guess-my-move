/**
 * Modo Cova da partida: um percurso de 3 covas numeradas, jogadas em ordem; só
 * a cova da vez captura. A bolinha de tiro parte de um ponto fixo e fica onde
 * parou entre os tiros. Entra na cova ativa quando o centro está dentro do raio
 * e a velocidade é menor que o limite de entrada (sempre maior que `stopSpeed`),
 * avaliado a cada passo da física e no repouso; ao entrar, fixa no centro da
 * cova, sai da simulação e a próxima cova passa a valer. A cova é geometria do
 * modo — a física (`stepBodies`) não a conhece. Puro e determinístico.
 */
import {
    type Competitor,
    type EvaluationContext,
    type Evaluation,
    type Mode,
    type Outcome,
} from '../../match/index.js'
import { type Body, type Vec } from '../../physics.js'

export interface HoleConfig {
    /** Raio da bolinha. */
    marbleRadius: number
    /** Raio de cada cova. */
    holeRadius: number
    /** Ponto de partida da bolinha de tiro de cada competidor. */
    shooterStart: Vec
    /** Velocidade máxima de entrada (sempre maior que `stopSpeed`); acima, passa por cima. */
    entrySpeed: number
    roundsPerMatch: number
    /** Covas por rodada. */
    holesPerRound: number
    /** Limite de tiros por competidor. */
    shotLimit: number
    /** Até este número de tiros (inclusive) completar as covas é vitória (contra a meta). */
    winShots: number
    /** Os 3 percursos fixos (um por rodada), iguais para os dois competidores. */
    layouts: readonly (readonly Vec[])[]
}

/** Valores iniciais a calibrar com uso real, fixados em configuração (NFR-002). */
export const DEFAULT_HOLE_CONFIG: HoleConfig = {
    marbleRadius: 14,
    holeRadius: 22,
    shooterStart: { x: 90, y: 300 },
    entrySpeed: 120,
    roundsPerMatch: 3,
    holesPerRound: 3,
    shotLimit: 9,
    winShots: 6,
    layouts: [
        [
            { x: 300, y: 300 },
            { x: 520, y: 180 },
            { x: 680, y: 420 },
        ],
        [
            { x: 260, y: 440 },
            { x: 480, y: 300 },
            { x: 700, y: 160 },
        ],
        [
            { x: 340, y: 160 },
            { x: 560, y: 440 },
            { x: 720, y: 300 },
        ],
    ],
}

const HELP_TEXT =
    'Lance a bolinha devagar para ela cair na cova da vez e siga as três em ordem. Contra a meta: completar ' +
    'cedo é vitória, completar tarde é empate e não completar é derrota. Contra o bot: completar vence quem ' +
    'não completou, senão menos tiros (ou mais covas) é vitória, derrota ao perder esse critério e empate na igualdade.'

/** Estado de um competidor na rodada corrente. */
interface State {
    pos: Vec
    activeHole: number
    holesDone: number
    shots: number
    done: boolean
    enteredThisShot: boolean
}

/** Resumo do progresso de um competidor, para resolver a rodada contra o bot. */
export interface HoleProgress {
    done: boolean
    shots: number
    holes: number
}

/** O modo Cova com os auxiliares do bot além do contrato base. */
export interface HoleMode extends Mode {
    /** Índice da cova ativa do competidor (0..holesPerRound). */
    activeHole(competitor: Competitor): number
    /** Centro da cova ativa do competidor (ponto de chegada do bot). */
    botAimPoint(competitor: Competitor): Vec
    /** Resultado da rodada contra o bot pela precedência completou > menos tiros > mais covas. */
    resolveBotRound(player: HoleProgress, opponent: HoleProgress): Outcome
}

export const DEFAULT_HOLE_MODE: HoleMode = createHoleMode()

export function createHoleMode(overrides: Partial<HoleConfig> = {}): HoleMode {
    const cfg: HoleConfig = { ...DEFAULT_HOLE_CONFIG, ...overrides }

    let layout: readonly Vec[] = cfg.layouts[0]
    let state: Record<Competitor, State> = freshStates()

    function freshState(): State {
        return {
            pos: { ...cfg.shooterStart },
            activeHole: 0,
            holesDone: 0,
            shots: 0,
            done: false,
            enteredThisShot: false,
        }
    }

    function freshStates(): Record<Competitor, State> {
        return { player: freshState(), opponent: freshState() }
    }

    function buildRound(n: number): Body[] {
        layout = cfg.layouts[n % cfg.layouts.length]
        state = freshStates()
        return [{ pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.marbleRadius }]
    }

    /** Centro da cova ativa do competidor, limitado ao último índice válido. */
    function activeHoleCenter(competitor: Competitor): Vec {
        const idx = Math.min(state[competitor].activeHole, layout.length - 1)
        return layout[idx]
    }

    /** `true` quando a bolinha entra na cova ativa: centro dentro do raio e velocidade abaixo do limite. */
    function entersActiveHole(competitor: Competitor, ball: Body): boolean {
        const s = state[competitor]
        if (s.activeHole >= cfg.holesPerRound) return false
        const center = layout[s.activeHole]
        const withinRadius = Math.hypot(ball.pos.x - center.x, ball.pos.y - center.y) <= cfg.holeRadius
        const slowEnough = Math.hypot(ball.vel.x, ball.vel.y) < cfg.entrySpeed
        return withinRadius && slowEnough
    }

    /** Fixa a bolinha no centro da cova ativa, avança a cova e marca a entrada. */
    function enterHole(competitor: Competitor): Body {
        const s = state[competitor]
        const center = layout[s.activeHole]
        s.enteredThisShot = true
        s.activeHole++
        s.holesDone++
        if (s.holesDone >= cfg.holesPerRound) s.done = true
        return { pos: { ...center }, vel: { x: 0, y: 0 }, radius: cfg.marbleRadius }
    }

    /** Observa cada passo: ao detectar a entrada, fixa a bolinha (encerra a rolagem). */
    function onStep(field: readonly Body[], competitor: Competitor): Body[] | undefined {
        const s = state[competitor]
        if (s.enteredThisShot) return undefined
        if (entersActiveHole(competitor, field[0])) {
            return [enterHole(competitor), ...field.slice(1)]
        }
        return undefined
    }

    function resolveTargetRound(s: State): Outcome | null {
        if (s.done && s.shots <= cfg.winShots) return 'win'
        if (s.done) return 'draw'
        if (s.shots >= cfg.shotLimit) return 'loss'
        return null
    }

    function resolveBotRound(player: HoleProgress, opponent: HoleProgress): Outcome {
        if (player.done !== opponent.done) return player.done ? 'win' : 'loss'
        if (player.done && opponent.done) {
            if (player.shots < opponent.shots) return 'win'
            if (player.shots > opponent.shots) return 'loss'
            return 'draw'
        }
        if (player.holes > opponent.holes) return 'win'
        if (player.holes < opponent.holes) return 'loss'
        return 'draw'
    }

    function progress(competitor: Competitor): HoleProgress {
        const s = state[competitor]
        return { done: s.done, shots: s.shots, holes: s.holesDone }
    }

    function bothFinished(): boolean {
        const p = state.player
        const o = state.opponent
        return (p.done || p.shots >= cfg.shotLimit) && (o.done || o.shots >= cfg.shotLimit)
    }

    function evaluate(context: EvaluationContext): Evaluation {
        const { field, competitor, shotsSpent, opponent } = context
        const s = state[competitor]
        s.shots = shotsSpent

        let ball = field[0]
        // Entrada no repouso, caso a rolagem não a tenha capturado (tiro que já parou na cova).
        if (!s.enteredThisShot && entersActiveHole(competitor, ball)) {
            ball = enterHole(competitor)
        }
        s.pos = { ...ball.pos }

        const yielded = s.holesDone // acumulado de covas feitas, para o placar

        const persisted: Body[] = [{ pos: { ...s.pos }, vel: { x: 0, y: 0 }, radius: cfg.marbleRadius }]

        if (opponent === 'target') {
            const outcome = resolveTargetRound(s)
            if (outcome) return { yield: yielded, finished: true, outcome, field: persisted }
            return { yield: yielded, finished: false, outcome: null, field: persisted }
        }

        // Contra o bot: a rodada fecha quando os dois terminaram (completaram ou esgotaram).
        if (bothFinished()) {
            return {
                yield: yielded,
                finished: true,
                outcome: resolveBotRound(progress('player'), progress('opponent')),
                field: persisted,
            }
        }
        return { yield: yielded, finished: false, outcome: null, field: persisted }
    }

    /** Antes do tiro: apresenta a bolinha do competidor da vez na sua posição persistida. */
    function prepareShot(_field: readonly Body[], competitor: Competitor): Body[] {
        const s = state[competitor]
        s.enteredThisShot = false
        return [{ pos: { ...s.pos }, vel: { x: 0, y: 0 }, radius: cfg.marbleRadius }]
    }

    return {
        name: 'Cova',
        helpText: HELP_TEXT,
        roundsPerMatch: cfg.roundsPerMatch,
        buildRound,
        shotLimit: () => cfg.shotLimit,
        prepareShot,
        onStep: (field, competitor) => onStep(field, competitor),
        evaluate,
        activeHole: (competitor) => state[competitor].activeHole,
        botAimPoint: (competitor) => ({ ...activeHoleCenter(competitor) }),
        resolveBotRound,
    }
}
