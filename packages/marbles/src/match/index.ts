/**
 * Motor de partida puro e determinístico. Conduz uma partida de várias rodadas
 * sobre um contrato de modo: registra o competidor do tiro corrente, avança a
 * física até o repouso, pede ao modo a avaliação do campo e decide a próxima
 * vez e o resultado. Não conhece a geometria de nenhum modo, não importa DOM,
 * MediaPipe nem relógio: o acaso e o tempo entram pelo modo e pelas fontes de
 * tiro. A física (`stepBodies`, `isAtRest`) é reaproveitada intacta.
 */
import { type Body, DEFAULT_PHYSICS, type PhysicsConfig, type Vec } from '../physics.js'
import { createMatchSession } from './session.js'

/** O jogador ou o adversário automático. */
export type Competitor = 'player' | 'opponent'

/** Quem o jogador enfrenta: a meta (solo, sem vez) ou o bot (dois competidores com vez). */
export type Opponent = 'target' | 'bot'

/** Resultado de uma rodada ou da partida, do ponto de vista do jogador. */
export type Outcome = 'win' | 'draw' | 'loss'

/** Decisão de vez devolvida pelo modo: alterna, ou mantém com o competidor atual. */
export type NextTurn = Competitor | 'keep'

/**
 * Geometria do modo para a tela desenhar além dos corpos: o círculo do
 * triângulo e as covas (com a ativa destacada). É só apresentação — o motor não
 * a usa. Ausente num modo que não tem geometria extra (o Bete).
 */
export interface FieldDecor {
    /** Círculo do modo Triângulo (centro e raio). */
    circle?: { x: number; y: number; radius: number }
    /** Covas numeradas do modo Cova, na ordem; `active` é o índice da cova da vez. */
    holes?: { positions: readonly Vec[]; radius: number; active: number }
    /**
     * Bolinhas paradas de quem NÃO está na vez (a do outro competidor na Cova),
     * só para desenhar com a cor do dono. Não entram na física.
     */
    resting?: { pos: Vec; radius: number; owner: Competitor }[]
}

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
    /**
     * Campo persistido para o próximo tiro, quando o modo quer reposicionar as
     * bolinhas (bete que volta ao ponto de partida, triângulo que remove a
     * bolinha capturada). Ausente = o motor mantém o campo em repouso.
     */
    field?: Body[]
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
    /**
     * Regras curtas por adversário para o painel "Como jogar" (no máximo 2
     * frases cada), citando vitória, derrota e empate. Ausente = a tela cai no
     * `helpText`.
     */
    rules?: { target: string; bot: string }
    /**
     * Nome do que o tiro rende neste modo ("Capturas", "Covas"), para o placar
     * da rodada. Ausente = o modo não tem contagem a mostrar (Bete).
     */
    scoreLabel?: string
    /** Quantas rodadas tem a partida (padrão de produto: 3). */
    roundsPerMatch: number
    /** Campo inicial da rodada `n` (0..roundsPerMatch-1) para o adversário dado. */
    buildRound(n: number, opponent: Opponent): Body[]
    /** Limite de tiros do competidor por adversário. */
    shotLimit(competitor: Competitor, opponent: Opponent): number
    /**
     * Prepara o campo imediatamente antes de o competidor da vez atirar: o modo
     * pode reposicionar a bolinha de tiro (índice 0) ou trocar a bolinha visível
     * pela do competidor da vez (cova contra o bot). Ausente = atira no campo
     * corrente sem mudança.
     */
    prepareShot?(field: readonly Body[], competitor: Competitor, opponent: Opponent): Body[]
    /**
     * Observa cada passo da física durante a rolagem do tiro e, opcionalmente,
     * devolve um campo substituto (cova que fixa a bolinha ao entrar, avaliada a
     * cada passo). Ausente = o motor só rola e avalia no repouso.
     */
    onStep?(field: readonly Body[], competitor: Competitor, opponent: Opponent): Body[] | undefined
    /**
     * `true` quando o competidor já cumpriu o objetivo da rodada e não recebe
     * mais vez (cova completa), mesmo com tiros sobrando. Sem isso ele seguiria
     * atirando sem sentido e a contagem de tiros do desempate inflaria. Ausente
     * = só o limite de tiros tira o competidor da disputa.
     */
    isFinished?(competitor: Competitor): boolean
    /** Avalia o campo em repouso após um tiro. */
    evaluate(context: EvaluationContext): Evaluation
    /**
     * De quem é a próxima vez. `defaultAlternate` é o outro competidor (a
     * alternância padrão); `yielded` é o que o tiro corrente rendeu. Ausente =
     * alterna sempre.
     */
    nextTurn?(defaultAlternate: Competitor, yielded: number): NextTurn
    /**
     * Geometria extra para a tela desenhar (círculo, covas com a ativa), do
     * ponto de vista do competidor da vez. Ausente = só os corpos do campo.
     */
    describe?(competitor: Competitor, opponent: Opponent): FieldDecor
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

    function startsRound(n: number): Competitor {
        if (opponent === 'target') return 'player'
        return n % 2 === 0 ? 'player' : 'opponent'
    }

    // Fonte de reserva do bot: quando a partida é contra a meta não há bot, mas
    // a sessão sempre exige uma fonte. Nunca é consultada contra a meta.
    const botSource: ShotSource = sources.bot ?? { nextShot: () => null }

    // UMA só implementação das regras: a sessão passo a passo. O condutor "de
    // uma vez" apenas pede o tiro do jogador à fonte dada e rola cada tiro até o
    // repouso num passo só (`advance` com um intervalo grande o bastante).
    const session = createMatchSession({
        modeId: mode.name,
        mode,
        opponent,
        bot: botSource,
        physics: cfg.physics,
        maxStepsPerShot: cfg.maxStepsPerShot,
        // Intervalo amplo: rola a partida inteira de um tiro até o repouso por
        // chamada de `advance`, sem fatiar por quadro.
        maxAdvanceMs: Number.MAX_SAFE_INTEGER,
    })

    // Sinaliza o fim quando a fonte do jogador seca antes de a partida acabar
    // (equivale ao antigo `over = true` sem registrar rodadas restantes).
    let starved = false

    /** Rola a física corrente até sair da fase `rolling` (um tiro inteiro). */
    function rollToRest(): void {
        // Cada `advance` gasta até `maxStepsPerShot` passos; poucas passagens
        // bastam para qualquer rolagem real. A trava evita laço infinito se a
        // rolagem nunca repousar dentro do orçamento de passos.
        let guard = 0
        while (session.snapshot().phase === 'rolling' && guard++ < 64) {
            session.advance(Number.MAX_SAFE_INTEGER)
        }
    }

    function nextStep(): void {
        if (starved) return
        const phase = session.snapshot().phase
        if (phase === 'match-over') return

        // Transição de rodada: encerra o `round-over` imediatamente, como o
        // condutor antigo fazia dentro de `endRound`.
        if (phase === 'round-over') {
            session.beginNextRound()
            return
        }

        if (phase === 'player-turn') {
            // Prepara o campo da vez e lê o tiro do jogador da fonte dada.
            session.shooter()
            const shot = sources.player.nextShot(session.snapshot().field)
            if (!shot) {
                // Sem tiro do jogador: a rodada não é presa; a partida para.
                starved = true
                return
            }
            session.firePlayerShot(shot)
            rollToRest()
            return
        }

        if (phase === 'bot-turn') {
            // A sessão produz o tiro do bot pela fonte e entra em rolagem.
            session.advance(Number.MAX_SAFE_INTEGER)
            rollToRest()
            return
        }

        if (phase === 'rolling') {
            rollToRest()
        }
    }

    return {
        currentRound: () => session.snapshot().round,
        nextStep,
        finished: () => starved || session.snapshot().phase === 'match-over',
        roundOutcomes: () => session.snapshot().roundOutcomes,
        matchOutcome: () => computeMatchOutcome(session.snapshot().roundOutcomes),
        computeOutcome: (rounds) => computeMatchOutcome(rounds),
        startsRound,
        shotsSpentInPreviousRound: () => session.shotsSpentInPreviousRound(),
        yieldOf: (competitor) => session.yieldOf(competitor),
    }
}
