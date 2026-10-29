/**
 * Motor de partida puro e determinístico. Conduz uma partida de várias rodadas
 * sobre um contrato de modo: registra o competidor do tiro corrente, avança a
 * física até o repouso, pede ao modo a avaliação do campo e decide a próxima
 * vez e o resultado. Não conhece a geometria de nenhum modo, não importa DOM,
 * MediaPipe nem relógio: o acaso e o tempo entram pelo modo e pelas fontes de
 * tiro. A física (`stepBodies`, `isAtRest`) é reaproveitada intacta.
 */
import { type Body, DEFAULT_PHYSICS, type PhysicsConfig, isAtRest, stepBodies } from '../physics.js'

/** O jogador ou o adversário automático. */
export type Competitor = 'player' | 'opponent'

/** Quem o jogador enfrenta: a meta (solo, sem vez) ou o bot (dois competidores com vez). */
export type Opponent = 'target' | 'bot'

/** Resultado de uma rodada ou da partida, do ponto de vista do jogador. */
export type Outcome = 'win' | 'draw' | 'loss'

/** Decisão de vez devolvida pelo modo: alterna, ou mantém com o competidor atual. */
export type NextTurn = Competitor | 'keep'

/** Contexto que o motor entrega ao modo para avaliar o campo em repouso. */
export interface EvaluationContext {
    /** O campo em repouso (corpos restantes) após o tiro. */
    field: readonly Body[]
    /** Pares `[i, j]` em contato acumulados durante toda a rolagem deste tiro. */
    contactsInRound: readonly (readonly [number, number])[]
    /** Quem deu o tiro corrente. */
    competitor: Competitor
    /** Tiros já gastos por este competidor nesta rodada, incluindo o corrente. */
    shotsSpent: number
    /** Adversário desta partida. */
    opponent: Opponent
}

/** O que o tiro rendeu e se a rodada terminou. */
export interface Evaluation {
    /** Quanto o tiro rendeu ao competidor do tiro (acertos, capturas, covas). */
    yield: number
    /** `true` quando a rodada terminou por decisão do modo (encerra sem gastar tiros restantes). */
    finished: boolean
    /** Resultado da rodada quando ela terminou por decisão do modo; `null` enquanto não terminou. */
    outcome: Outcome | null
}

/**
 * Contrato que cada modo implementa. Declara só o que Bete, Triângulo e Cova
 * precisam: montar o campo, o limite de tiros por competidor e adversário, a
 * avaliação do campo em repouso e, opcionalmente, de quem é a próxima vez.
 */
export interface Mode {
    name: string
    /** Ajuda não vazia, que cita vitória, derrota e empate. */
    helpText: string
    /** Quantas rodadas tem a partida (padrão de produto: 3). */
    roundsPerMatch: number
    /** Campo inicial da rodada `n` (0..roundsPerMatch-1) para o adversário dado. */
    buildRound(n: number, opponent: Opponent): Body[]
    /** Limite de tiros do competidor por adversário. */
    shotLimit(competitor: Competitor, opponent: Opponent): number
    /** Avalia o campo em repouso após um tiro. */
    evaluate(context: EvaluationContext): Evaluation
    /**
     * De quem é a próxima vez. `defaultAlternate` é o outro competidor (a
     * alternância padrão); `yielded` é o que o tiro corrente rendeu. Ausente =
     * alterna sempre.
     */
    nextTurn?(defaultAlternate: Competitor, yielded: number): NextTurn
}

/** Fonte do tiro: entrega o próximo vetor de velocidade, ou `null` quando não há tiro. */
export interface ShotSource {
    /** `field` é o estado corrente; devolve o tiro ou `null` (sem tiro disponível). */
    nextShot(field?: readonly Body[]): { x: number; y: number } | null
}

export interface MatchConfig {
    mode: Mode
    opponent: Opponent
    sources: { player: ShotSource; bot?: ShotSource }
    physics: PhysicsConfig
    /** Teto de passos de física por rolagem, trava de segurança contra rolagem infinita. */
    maxStepsPerShot: number
}

export const DEFAULT_MAX_STEPS_PER_SHOT = 10_000

export interface Match {
    /** Índice da rodada corrente (0..n-1). */
    currentRound(): number
    /** Processa um tiro completo: dispara, rola até o repouso, avalia e avança. */
    nextStep(): void
    /** `true` quando todas as rodadas acabaram. */
    finished(): boolean
    roundOutcomes(): Outcome[]
    matchOutcome(): Outcome
    /** Computa o resultado da partida a partir de resultados de rodada dados (sem jogar). */
    computeOutcome(rounds: readonly Outcome[]): Outcome
    /** Quem começa a rodada `n`: jogador na 1ª contra o bot, alternando; sempre jogador contra a meta. */
    startsRound(n: number): Competitor
    /** Tiros gastos na rodada que acabou de encerrar (para provar o encerramento antecipado). */
    shotsSpentInPreviousRound(): number
    /** Total do que o competidor rendeu na partida (capturas/acertos/covas). */
    yieldOf(competitor: Competitor): number
}

/** Resultado da partida: mais rodadas vencidas que perdidas é vitória; menos é derrota; igual é empate. */
export function computeMatchOutcome(rounds: readonly Outcome[]): Outcome {
    const wins = rounds.filter((r) => r === 'win').length
    const losses = rounds.filter((r) => r === 'loss').length
    if (wins > losses) return 'win'
    if (wins < losses) return 'loss'
    return 'draw'
}

export function createMatch(overrides: Partial<MatchConfig> & Pick<MatchConfig, 'mode' | 'opponent' | 'sources'>): Match {
    const cfg: MatchConfig = {
        physics: DEFAULT_PHYSICS,
        maxStepsPerShot: DEFAULT_MAX_STEPS_PER_SHOT,
        ...overrides,
    }
    const { mode, opponent, sources } = cfg
    const other = (c: Competitor): Competitor => (c === 'player' ? 'opponent' : 'player')

    let round = 0
    let field: Body[] = mode.buildRound(0, opponent)
    let turn: Competitor = startsRound(0)
    let shotsSpent: Record<Competitor, number> = { player: 0, opponent: 0 }
    const outcomes: Outcome[] = []
    const yielded: Record<Competitor, number> = { player: 0, opponent: 0 }
    let shotsSpentPrevious = 0
    let over = false

    function startsRound(n: number): Competitor {
        if (opponent === 'target') return 'player'
        return n % 2 === 0 ? 'player' : 'opponent'
    }

    function sourceOf(competitor: Competitor): ShotSource | undefined {
        return competitor === 'player' ? sources.player : sources.bot
    }

    function limitReached(competitor: Competitor): boolean {
        return shotsSpent[competitor] >= mode.shotLimit(competitor, opponent)
    }

    /** `true` quando todos os competidores da rodada esgotaram os tiros. */
    function roundExhausted(): boolean {
        if (opponent === 'target') return limitReached('player')
        return limitReached('player') && limitReached('opponent')
    }

    /** Rola a física até o repouso, acumulando os contatos de toda a rolagem. */
    function rollToRest(): (readonly [number, number])[] {
        const contacts: (readonly [number, number])[] = []
        let steps = 0
        while (!isAtRest(field, cfg.physics) && steps < cfg.maxStepsPerShot) {
            const result = stepBodies(field, cfg.physics)
            field = result.bodies
            for (const pair of result.contacts) contacts.push(pair)
            steps++
        }
        return contacts
    }

    function nextTurnAfter(yieldedNow: number): Competitor {
        if (opponent === 'target') return 'player'
        const alternate = other(turn)
        const decision: NextTurn = mode.nextTurn ? mode.nextTurn(alternate, yieldedNow) : alternate
        const target: Competitor = decision === 'keep' ? turn : decision
        // Pula quem já esgotou os tiros.
        if (limitReached(target) && !limitReached(other(target))) return other(target)
        return target
    }

    function endRound(outcome: Outcome): void {
        outcomes.push(outcome)
        shotsSpentPrevious = shotsSpent[turn]
        round++
        if (round >= mode.roundsPerMatch) {
            over = true
            return
        }
        field = mode.buildRound(round, opponent)
        shotsSpent = { player: 0, opponent: 0 }
        turn = startsRound(round)
    }

    function nextStep(): void {
        if (over) return

        // Quem tem a vez mas já esgotou os tiros é pulado; se os dois esgotaram, a rodada fecha.
        if (limitReached(turn)) {
            if (roundExhausted()) {
                endRound('loss')
                return
            }
            turn = other(turn)
            return
        }

        const source = sourceOf(turn)
        const shot = source ? source.nextShot(field) : null
        if (!shot) {
            // Sem tiro disponível: se a rodada esgotou, fecha; senão, nada a fazer neste passo.
            if (roundExhausted()) endRound('loss')
            else over = true
            return
        }

        // Dispara: o primeiro corpo é a bolinha de tiro do competidor corrente.
        field = [{ ...field[0], vel: { x: shot.x, y: shot.y } }, ...field.slice(1)]
        shotsSpent[turn]++

        const contactsInRound = rollToRest()
        const evaluation = mode.evaluate({
            field,
            contactsInRound,
            competitor: turn,
            shotsSpent: shotsSpent[turn],
            opponent,
        })
        yielded[turn] += evaluation.yield

        if (evaluation.finished && evaluation.outcome) {
            endRound(evaluation.outcome)
            return
        }
        if (roundExhausted()) {
            endRound('loss')
            return
        }
        turn = nextTurnAfter(evaluation.yield)
    }

    return {
        currentRound: () => round,
        nextStep,
        finished: () => over,
        roundOutcomes: () => [...outcomes],
        matchOutcome: () => computeMatchOutcome(outcomes),
        computeOutcome: (rounds) => computeMatchOutcome(rounds),
        startsRound,
        shotsSpentInPreviousRound: () => shotsSpentPrevious,
        yieldOf: (competitor) => yielded[competitor],
    }
}
