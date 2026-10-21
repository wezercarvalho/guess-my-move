/**
 * Motor da rodada: máquina de estados pura e determinística (relógio injetável).
 * Orquestra carta, captura, adivinhador (injetado), árbitro e histórico de
 * palpites rejeitados. Nunca marca acerto a partir de erro de provedor e nunca
 * trata um palpite correto como prova visual de execução.
 */
import type { CapturedFrame, GuesserInput, GuesserResult } from '../contracts.js'
import { judgeWithFallback } from '../referee/index.js'
import type {
    AttemptOutcome,
    Clock,
    Round,
    RoundAttempt,
    RoundConfig,
    RoundState,
} from './types.js'

/** Normaliza um palpite para deduplicar o histórico de rejeitados. */
function normalizeGuess(guess: string): string {
    return guess.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Executa a promessa do provedor com um timeout opcional. Rejeita com um erro
 * marcado `timeout` quando o tempo estoura, abortando o signal injetado.
 */
async function withTimeout(
    run: (signal: AbortSignal) => Promise<GuesserResult>,
    timeoutMs: number | undefined,
): Promise<GuesserResult> {
    const controller = new AbortController()
    if (timeoutMs === undefined) {
        return run(controller.signal)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            controller.abort()
            const err = new Error('tempo de requisição esgotado')
            err.name = 'TimeoutError'
            reject(err)
        }, timeoutMs)
    })
    try {
        return await Promise.race([run(controller.signal), timeout])
    } finally {
        if (timer !== undefined) clearTimeout(timer)
    }
}

class RoundMachine implements Round {
    state: RoundState = 'idle'
    private readonly config: RoundConfig
    private readonly clock: Clock
    private readonly startedAt: number
    private readonly attemptLog: RoundAttempt[] = []
    private readonly rejected: string[] = []
    private readonly rejectedSeen = new Set<string>()

    constructor(config: RoundConfig) {
        if (config.maxAttempts < 1) {
            throw new Error('maxAttempts deve ser >= 1')
        }
        this.config = config
        this.clock = config.clock ?? Date.now
        this.startedAt = this.clock()
    }

    get finished(): boolean {
        return (
            this.state === 'correct' ||
            this.state === 'finished' ||
            this.state === 'user_cancelled' ||
            this.state === 'camera_denied'
        )
    }

    get attempts(): number {
        return this.attemptLog.length
    }

    get history(): readonly RoundAttempt[] {
        return this.attemptLog
    }

    get rejectedGuesses(): readonly string[] {
        return this.rejected
    }

    revealCard(): void {
        this.transitionGuard(['idle'], 'revealCard')
        this.state = 'card_revealed'
    }

    cameraReady(): void {
        this.transitionGuard(['card_revealed'], 'cameraReady')
        this.state = 'camera_ready'
    }

    denyCamera(): void {
        this.transitionGuard(
            ['card_revealed', 'camera_ready'],
            'denyCamera',
        )
        this.state = 'camera_denied'
    }

    cancel(): void {
        if (this.finished) {
            throw new Error(
                `transição inválida: cancel a partir de "${this.state}"`,
            )
        }
        this.state = 'user_cancelled'
    }

    async attempt(frames: CapturedFrame[]): Promise<AttemptOutcome> {
        // Só é possível tentar a partir de um estado pronto para capturar.
        this.transitionGuard(
            ['camera_ready', 'retry', 'capturing', 'guessing'],
            'attempt',
        )

        // Limite de tempo da rodada.
        if (this.isTimeExhausted()) {
            this.state = 'finished'
            return this.outcome(
                {
                    isCorrect: false,
                    method: 'undetermined',
                    reason: 'tempo da rodada esgotado',
                },
                'tempo da rodada esgotado',
            )
        }

        this.state = 'capturing'
        this.state = 'guessing'

        let result: GuesserResult
        try {
            result = await withTimeout(
                (signal) =>
                    this.config.provider.guess(this.buildInput(frames), signal),
                this.config.requestTimeoutMs,
            )
        } catch (error) {
            // Timeout e erro de provedor mantêm o estado íntegro, sem acerto.
            if (error instanceof Error && error.name === 'TimeoutError') {
                this.state = 'request_timeout'
                return this.outcome({
                    isCorrect: false,
                    method: 'undetermined',
                    reason: 'timeout do provedor',
                })
            }
            this.state = 'provider_error'
            const detail = error instanceof Error ? error.message : 'erro'
            return this.outcome({
                isCorrect: false,
                method: 'undetermined',
                reason: `erro de provedor: ${detail}`,
            })
        }

        // Resposta inválida do modelo: palpite vazio ou sem evidência.
        if (
            typeof result.guess !== 'string' ||
            result.guess.trim() === '' ||
            result.insufficientEvidence === true
        ) {
            this.state = 'invalid_model_response'
            return this.outcome({
                isCorrect: false,
                method: 'undetermined',
                reason: 'resposta do modelo vazia ou sem evidência',
            })
        }

        this.state = 'judging'
        const verdict = await judgeWithFallback(
            this.config.card.evaluation,
            result.guess,
            this.config.resolver !== undefined
                ? { resolver: this.config.resolver }
                : {},
        )

        this.attemptLog.push({
            guess: result.guess,
            result: verdict,
            at: this.clock(),
        })

        if (verdict.isCorrect) {
            this.state = 'correct'
            return this.outcome(verdict)
        }

        // Incorreto: acumula o palpite do modelo no histórico de rejeitados.
        this.recordRejected(result.guess)

        // Esgotou as tentativas → encerra sem acerto.
        if (this.attemptLog.length >= this.config.maxAttempts) {
            this.state = 'finished'
            return this.outcome(verdict, 'limite de tentativas atingido')
        }

        this.state = 'retry'
        return this.outcome(verdict)
    }

    /** Monta a entrada do adivinhador: frames + rejeitados, nunca a carta. */
    private buildInput(frames: CapturedFrame[]): GuesserInput {
        return this.rejected.length > 0
            ? { frames, rejectedGuesses: [...this.rejected] }
            : { frames }
    }

    private recordRejected(guess: string): void {
        const key = normalizeGuess(guess)
        if (key === '' || this.rejectedSeen.has(key)) return
        this.rejectedSeen.add(key)
        this.rejected.push(guess)
    }

    private isTimeExhausted(): boolean {
        const { maxDurationMs } = this.config
        if (maxDurationMs === undefined) return false
        return this.clock() - this.startedAt >= maxDurationMs
    }

    private outcome(
        result: RoundAttempt['result'],
        reason?: string,
    ): AttemptOutcome {
        return {
            isCorrect: result.isCorrect,
            result,
            state: this.state,
            ...(reason !== undefined ? { reason } : {}),
        }
    }

    private transitionGuard(from: RoundState[], action: string): void {
        if (!from.includes(this.state)) {
            throw new Error(
                `transição inválida: ${action} a partir de "${this.state}"`,
            )
        }
    }
}

/** Cria uma rodada no estado `idle`. */
export function createRound(config: RoundConfig): Round {
    return new RoundMachine(config)
}
