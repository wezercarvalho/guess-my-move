import { type SoundingString, type StringNumber } from './theory.js'

/** Uma nota agendada da batida. */
export interface PlannedNote {
    readonly string: StringNumber
    readonly midi: number
    /** Atraso depois do início da batida (ms). */
    readonly delayMs: number
    /** De 0 (exclusive) a 1. */
    readonly gain: number
}

export interface StrumPlanConfig {
    /** Atraso entre uma corda e a seguinte (ms). */
    readonly stringDelayMs: number
    /** Ganho de uma batida de força 0. */
    readonly minGain: number
    /** Ganho de uma batida de força 1. */
    readonly maxGain: number
}

/** Valores iniciais: hipóteses a calibrar de ouvido (ver plan.md). */
export const DEFAULT_STRUM_PLAN: StrumPlanConfig = { stringDelayMs: 18, minGain: 0.25, maxGain: 1 }

/**
 * Plano de uma batida: as cordas que soam, da grave à aguda numa batida para baixo e o
 * inverso para cima, com atraso crescente e ganho pela força (0 a 1). Quem chama passa as
 * cordas **que a mão está formando**; as abafadas do acorde já ficam de fora.
 */
export function planStrum(
    sounding: readonly SoundingString[],
    direction: 'down' | 'up',
    force: number,
    config: StrumPlanConfig = DEFAULT_STRUM_PLAN,
): PlannedNote[] {
    const ordered = [...sounding].sort((a, b) =>
        direction === 'down' ? b.string - a.string : a.string - b.string,
    )
    const clamped = Math.min(1, Math.max(0, force))
    const gain = config.minGain + (config.maxGain - config.minGain) * clamped
    return ordered.map((note, index) => ({
        string: note.string,
        midi: note.midi,
        delayMs: index * config.stringDelayMs,
        gain,
    }))
}
