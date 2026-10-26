import { type TrackerDelegate } from '../tracker/handTracker.js'

/** Números mostrados no painel de depuração, atualizados durante a rodada. */
export interface DebugInfo {
    delegate: TrackerDelegate | null
    angleDeg: number | null
    reversals: number
    windowSamples: number
    /** Quadros processados pelo detector na rodada. */
    frames: number
    medianMs: number | null
    p95Ms: number | null
}

export const EMPTY_DEBUG: DebugInfo = {
    delegate: null,
    angleDeg: null,
    reversals: 0,
    windowSamples: 0,
    frames: 0,
    medianMs: null,
    p95Ms: null,
}
