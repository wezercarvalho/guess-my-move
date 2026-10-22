import type { GuessLimits } from '@guess-my-move/core'
import type { ConfigService } from '@nestjs/config'

import type { EnvironmentVariables } from '../config/environment.js'

/** Folga do corpo JSON sobre o base64 dos frames (chaves, MIME, palpites). */
const JSON_OVERHEAD_BYTES = 64 * 1024

/** Limites de payload da rota `POST /api/guess`, derivados da configuração. */
export function guessLimitsFromConfig(
    config: ConfigService<EnvironmentVariables, true>,
): GuessLimits {
    const maxFrames = config.get('MAX_FRAMES', { infer: true })
    return {
        maxFrames,
        maxFrameBytes: config.get('MAX_FRAME_BYTES', { infer: true }),
        maxTotalBytes: config.get('MAX_TOTAL_BYTES', { infer: true }),
        maxRejectedGuesses: maxFrames,
    }
}

/**
 * Limite do parser JSON. O padrão do Express (100 kB) recusaria frames
 * legítimos; o corpo precisa caber o total de bytes em base64 (4/3) mais a
 * folga do envelope JSON. Acima disso, o parser responde 413.
 */
export function jsonBodyLimitBytes(limits: GuessLimits): number {
    return Math.ceil((limits.maxTotalBytes * 4) / 3) + JSON_OVERHEAD_BYTES
}
