/**
 * Motor da rodada: máquina de estados pura e determinística (relógio
 * injetável). Recebe o ângulo da mão a cada leitura, aplica o critério da carta
 * e encerra no primeiro reconhecimento ou no limite de tempo. Guarda só as
 * amostras da janela do critério e as descarta ao terminar.
 */
import type { Card } from '../contracts.js'
import {
    evaluateOscillation,
    type HandSample,
    type OscillationVerdict,
} from '../gesture/index.js'
import type { Clock, Round, RoundConfig, RoundState } from './types.js'

/** Duração máxima padrão de `detecting`, em ms. */
export const DEFAULT_MAX_DURATION_MS = 10_000

const FINAL_STATES: readonly RoundState[] = [
    'recognized',
    'timed_out',
    'camera_denied',
    'tracker_error',
    'user_cancelled',
]

class RoundMachine implements Round {
    state: RoundState = 'idle'
    verdict: OscillationVerdict | null = null
    failureReason: string | null = null
    private readonly card: Card
    private readonly clock: Clock
    private readonly maxDurationMs: number
    private samples: HandSample[] = []
    private startedAt: number | null = null
    private endedAt: number | null = null

    constructor(config: RoundConfig) {
        const maxDurationMs = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
        if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
            throw new Error('maxDurationMs deve ser um número positivo')
        }
        this.card = config.card
        this.clock = config.clock ?? Date.now
        this.maxDurationMs = maxDurationMs
    }

    get finished(): boolean {
        return FINAL_STATES.includes(this.state)
    }

    get elapsedMs(): number | null {
        if (this.startedAt === null) return null
        return (this.endedAt ?? this.clock()) - this.startedAt
    }

    revealCard(): void {
        this.transition('revealCard', ['idle'], 'card_revealed')
    }

    cameraReady(): void {
        this.transition('cameraReady', ['card_revealed'], 'camera_ready')
    }

    denyCamera(): void {
        this.transition('denyCamera', ['idle', 'card_revealed'], 'camera_denied')
    }

    trackerFailed(reason: string): void {
        this.transition(
            'trackerFailed',
            ['card_revealed', 'camera_ready', 'detecting'],
            'tracker_error',
        )
        this.failureReason = reason
    }

    start(): void {
        this.transition('start', ['camera_ready'], 'detecting')
        this.startedAt = this.clock()
    }

    observe(angleDeg: number): OscillationVerdict | null {
        if (this.state !== 'detecting') return null
        const now = this.clock()
        if (this.expired(now)) {
            this.timeOut()
            return null
        }
        this.samples.push({ t: now, angleDeg })
        const windowMs = this.card.evaluation.criterion.windowMs
        this.samples = this.samples.filter((sample) => sample.t > now - windowMs)
        this.verdict = evaluateOscillation(this.card.evaluation.criterion, this.samples, now)
        if (this.verdict.recognized) {
            this.state = 'recognized'
            this.finish()
        }
        return this.verdict
    }

    tick(): void {
        if (this.state === 'detecting' && this.expired(this.clock())) this.timeOut()
    }

    cancel(): void {
        if (this.finished) return
        this.state = 'user_cancelled'
        this.finish()
    }

    private expired(now: number): boolean {
        return this.startedAt !== null && now - this.startedAt >= this.maxDurationMs
    }

    private timeOut(): void {
        this.state = 'timed_out'
        this.finish()
    }

    private finish(): void {
        this.samples = []
        if (this.startedAt !== null && this.endedAt === null) this.endedAt = this.clock()
    }

    private transition(action: string, from: readonly RoundState[], to: RoundState): void {
        if (!from.includes(this.state)) {
            throw new Error(`transição inválida: ${action} em ${this.state}`)
        }
        this.state = to
        if (this.finished) this.finish()
    }
}

/** Cria uma rodada para a carta informada, no estado `idle`. */
export function createRound(config: RoundConfig): Round {
    return new RoundMachine(config)
}
