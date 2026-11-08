import type { Card } from '../contracts.js'
import type { RoundState } from '../round/index.js'

export function cardMaxDurationMs(card: Card): number {
    return card.evaluation.maxDurationMs ?? 10000
}

/** Server calls this only with its own final state and elapsed time. */
export function scoreCardRound(
    card: Card,
    state: RoundState,
    elapsedMs: number,
): number {
    const duration = cardMaxDurationMs(card)
    if (
        state !== 'recognized' ||
        !Number.isFinite(elapsedMs) ||
        elapsedMs < 0 ||
        elapsedMs >= duration
    )
        return 0
    const base = card.evaluation.basePoints ?? 100
    return Math.round(base * (1 - elapsedMs / (2 * duration)))
}
