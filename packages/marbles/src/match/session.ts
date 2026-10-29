/**
 * Sessão de partida passo a passo: a ÚNICA implementação das regras de vez,
 * limite de tiros, avaliação, fim de rodada e resultado. Avança por quantidade
 * de tempo/passos fixos e expõe um retrato do estado para a tela desenhar
 * (campo, rodada, vez, tiros restantes, resultados, fase). Não conhece DOM,
 * MediaPipe nem relógio: o tempo entra por `advance(dtMs)`. A física
 * (`stepBodies`, `isAtRest`) é reaproveitada intacta.
 *
 * O condutor "de uma vez" (`createMatch`) é um laço fino sobre esta mesma
 * sessão (ver `./index.ts`), de modo que as regras existam num só lugar.
 */
import {
    type Body,
    DEFAULT_PHYSICS,
    type PhysicsConfig,
    type Vec,
    isAtRest,
    stepBodies,
} from '../physics.js'
import {
    type Competitor,
    type FieldDecor,
    type Mode,
    type Opponent,
    type Outcome,
    type ShotSource,
    computeMatchOutcome,
} from './index.js'

/** Fase da partida, do ponto de vista da tela. */
export type MatchPhase =
    | 'choosing'
    | 'player-turn'
    | 'bot-turn'
    | 'rolling'
    | 'round-over'
    | 'match-over'

/** Foto imutável da partida para a tela desenhar. */
export interface MatchSnapshot {
    /** Identificador do modo escolhido. */
    modeId: string
    opponent: Opponent
    phase: MatchPhase
    /** Rodada corrente (0..roundsPerMatch-1); na última fase, a última jogada. */
    round: number
    roundsPerMatch: number
    /** Resultado de cada rodada já encerrada. */
    roundOutcomes: Outcome[]
    /** Resultado da rodada que acabou de encerrar (só em `round-over`). */
    lastRoundOutcome: Outcome | null
    /** Resultado da partida (só em `match-over`). */
    matchOutcome: Outcome | null
    /** De quem é a vez (`null` fora de uma partida em andamento). */
    turn: Competitor | null
    /** Tiros restantes do jogador na rodada. */
    playerShotsLeft: number
    /** Corpos do campo em repouso/animação, para o desenho. */
    field: Body[]
    /** Geometria extra do modo (círculo, covas com a ativa); `null` quando o modo não tem. */
    decor: FieldDecor | null
}

export interface MatchSessionConfig {
    modeId: string
    mode: Mode
    opponent: Opponent
    /** Fonte do tiro do bot (semente por partida); só usada contra o bot. */
    bot: ShotSource
    physics: PhysicsConfig
    /** Teto de passos por rolagem, trava contra rolagem infinita. */
    maxStepsPerShot: number
    /** Teto do intervalo simulado por `advance`. */
    maxAdvanceMs: number
}

export const DEFAULT_MAX_STEPS_PER_SHOT = 10_000

export interface MatchSession {
    snapshot(): MatchSnapshot
    /** O campo preparado para o competidor da vez (bolinha de tiro no ponto certo), para a mira. */
    shooter(): Vec | null
    /** `true` quando a tela deve alimentar a mão: vez do jogador, parado, à espera do tiro. */
    awaitingPlayerShot(): boolean
    /** Dispara o tiro do jogador (vetor de velocidade vindo do controlador de mira). */
    firePlayerShot(velocity: Vec): void
    /** Avança a física em `dtMs`; anima a rolagem e, na vez do bot, dispara o tiro do bot. */
    advance(dtMs: number): void
    /** Começa a próxima rodada após `round-over` (a tela decide quando, depois de mostrar o resultado). */
    beginNextRound(): void
    /** Tiros gastos na rodada que acabou de encerrar (para provar o encerramento antecipado). */
    shotsSpentInPreviousRound(): number
    /** Total do que o competidor rendeu na partida (capturas/acertos/covas). */
    yieldOf(competitor: Competitor): number
}

const other = (c: Competitor): Competitor => (c === 'player' ? 'opponent' : 'player')

/**
 * Cria a sessão. Começa já na primeira rodada, com a vez de quem o modo mandar
 * começar. A tela controla o início (escolha de modo/adversário) montando a
 * sessão só quando a partida começa.
 */
export function createMatchSession(
    overrides: Partial<MatchSessionConfig> &
        Pick<MatchSessionConfig, 'modeId' | 'mode' | 'opponent' | 'bot'>,
): MatchSession {
    const cfg: MatchSessionConfig = {
        physics: DEFAULT_PHYSICS,
        maxStepsPerShot: DEFAULT_MAX_STEPS_PER_SHOT,
        maxAdvanceMs: 250,
        ...overrides,
    }
    const { mode, opponent } = cfg
    const stepMs = cfg.physics.fixedStep * 1000

    let round = 0
    let field: Body[] = mode.buildRound(0, opponent)
    let turn: Competitor = startsRound(0)
    const shotsSpent: Record<Competitor, number> = { player: 0, opponent: 0 }
    const outcomes: Outcome[] = []
    const yielded: Record<Competitor, number> = { player: 0, opponent: 0 }
    let shotsSpentPrevious = 0
    let lastRoundOutcome: Outcome | null = null
    let phase: MatchPhase = turnPhase()
    let rollingBy: Competitor | null = null
    let accumulatorMs = 0
    let prepared = false

    function startsRound(n: number): Competitor {
        if (opponent === 'target') return 'player'
        return n % 2 === 0 ? 'player' : 'opponent'
    }

    function limitReached(competitor: Competitor): boolean {
        return shotsSpent[competitor] >= mode.shotLimit(competitor, opponent)
    }

    function roundExhausted(): boolean {
        if (opponent === 'target') return limitReached('player')
        return limitReached('player') && limitReached('opponent')
    }

    /** A fase de espera da vez corrente (quem atira é o jogador ou o bot). */
    function turnPhase(): MatchPhase {
        return turn === 'player' ? 'player-turn' : 'bot-turn'
    }

    /** Garante que o campo foi preparado para o competidor da vez antes de ele atirar. */
    function prepareForTurn(): void {
        if (prepared) return
        if (mode.prepareShot) field = mode.prepareShot(field, turn, opponent)
        prepared = true
    }

    /** Pula quem já esgotou os tiros; fecha a rodada quando os dois esgotaram. */
    function settleTurn(): void {
        while (!roundExhausted() && limitReached(turn)) {
            turn = other(turn)
        }
        if (roundExhausted() && limitReached(turn)) {
            endRound('loss')
            return
        }
        prepared = false
        phase = turnPhase()
    }

    function nextTurnAfter(yieldedNow: number): Competitor {
        if (opponent === 'target') return 'player'
        const alternate = other(turn)
        const decision = mode.nextTurn ? mode.nextTurn(alternate, yieldedNow) : alternate
        const target: Competitor = decision === 'keep' ? turn : decision
        if (limitReached(target) && !limitReached(other(target))) return other(target)
        return target
    }

    function endRound(outcome: Outcome): void {
        outcomes.push(outcome)
        lastRoundOutcome = outcome
        shotsSpentPrevious = shotsSpent[turn]
        rollingBy = null
        round++
        if (round >= mode.roundsPerMatch) {
            phase = 'match-over'
            return
        }
        phase = 'round-over'
    }

    /** Começa a próxima rodada (chamado pela tela após `round-over`). */
    function beginNextRound(): void {
        field = mode.buildRound(round, opponent)
        shotsSpent.player = 0
        shotsSpent.opponent = 0
        turn = startsRound(round)
        prepared = false
        lastRoundOutcome = null
        settleTurn()
    }

    /** Dispara: põe a velocidade na bolinha de tiro e entra em rolagem. */
    function fire(velocity: Vec): void {
        prepareForTurn()
        field = [{ ...field[0], vel: { x: velocity.x, y: velocity.y } }, ...field.slice(1)]
        shotsSpent[turn]++
        rollingBy = turn
        accumulatorMs = 0
        phase = 'rolling'
    }

    /** Avalia o campo em repouso e decide a próxima vez ou o fim da rodada. */
    function resolveRoll(): void {
        const competitor = rollingBy ?? turn
        const contacts = lastContacts
        lastContacts = []
        const evaluation = mode.evaluate({
            field,
            contactsInRound: contacts,
            competitor,
            shotsSpent: shotsSpent[competitor],
            opponent,
        })
        if (evaluation.field) field = evaluation.field
        yielded[competitor] += evaluation.yield
        rollingBy = null

        if (evaluation.finished && evaluation.outcome) {
            endRound(evaluation.outcome)
            return
        }
        if (roundExhausted()) {
            endRound('loss')
            return
        }
        turn = nextTurnAfter(evaluation.yield)
        settleTurn()
    }

    /** Contatos acumulados durante a rolagem corrente. */
    let lastContacts: (readonly [number, number])[] = []

    function rollStep(): void {
        const competitor = rollingBy ?? turn
        const result = stepBodies(field, cfg.physics)
        field = result.bodies
        for (const pair of result.contacts) lastContacts.push(pair)
        if (mode.onStep) {
            const replaced = mode.onStep(field, competitor, opponent)
            if (replaced) field = replaced
        }
    }

    return {
        snapshot(): MatchSnapshot {
            return {
                modeId: cfg.modeId,
                opponent,
                phase,
                round: Math.min(round, mode.roundsPerMatch - 1),
                roundsPerMatch: mode.roundsPerMatch,
                roundOutcomes: [...outcomes],
                lastRoundOutcome,
                matchOutcome: phase === 'match-over' ? computeMatchOutcome(outcomes) : null,
                turn:
                    phase === 'player-turn' || phase === 'bot-turn' || phase === 'rolling'
                        ? (rollingBy ?? turn)
                        : null,
                playerShotsLeft: Math.max(
                    0,
                    mode.shotLimit('player', opponent) - shotsSpent.player,
                ),
                field: field.map((b) => ({
                    pos: { ...b.pos },
                    vel: { ...b.vel },
                    radius: b.radius,
                })),
                decor: mode.describe ? mode.describe(rollingBy ?? turn, opponent) : null,
            }
        },

        shooter(): Vec | null {
            if (phase !== 'player-turn' && phase !== 'bot-turn') return null
            prepareForTurn()
            return field.length > 0 ? { ...field[0].pos } : null
        },

        awaitingPlayerShot(): boolean {
            return phase === 'player-turn'
        },

        firePlayerShot(velocity: Vec): void {
            if (phase !== 'player-turn') return
            fire(velocity)
        },

        advance(dtMs: number): void {
            if (phase === 'round-over' || phase === 'match-over') return

            // Vez do bot: produz o tiro e entra em rolagem (a física anima a seguir).
            if (phase === 'bot-turn') {
                prepareForTurn()
                const shot = cfg.bot.nextShot(field)
                if (!shot) {
                    // Sem tiro: conta como esgotado e segue.
                    shotsSpent[turn]++
                    if (roundExhausted()) {
                        endRound('loss')
                        return
                    }
                    turn = nextTurnAfter(0)
                    settleTurn()
                    return
                }
                fire(shot)
                return
            }

            if (phase !== 'rolling') return

            accumulatorMs += Math.min(Math.max(dtMs, 0), cfg.maxAdvanceMs)
            let steps = 0
            while (
                accumulatorMs >= stepMs &&
                !isAtRest(field, cfg.physics) &&
                steps < cfg.maxStepsPerShot
            ) {
                accumulatorMs -= stepMs
                rollStep()
                steps++
            }
            if (isAtRest(field, cfg.physics)) {
                resolveRoll()
            }
        },

        beginNextRound(): void {
            if (phase !== 'round-over') return
            beginNextRound()
        },

        shotsSpentInPreviousRound(): number {
            return shotsSpentPrevious
        },

        yieldOf(competitor: Competitor): number {
            return yielded[competitor]
        },
    }
}
