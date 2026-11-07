import { HEAD_LOOK_SENSITIVITY } from './headLook.js'

/** Giro horizontal contínuo após manter a cabeça de lado; sem DOM, câmera ou rede. */
export const DEFAULT_HEAD_TURN = {
    dwellMs: 1000,
    yawStart: (12 * Math.PI) / 180,
    yawHold: (7 * Math.PI) / 180,
    rate: Math.PI / 6,
    maxSampleAgeMs: 250,
    maxFrameMs: 100,
}

export interface HeadTurnState {
    intent: 'left' | 'right' | null
    progress: number
    turning: boolean
    yawDelta: number
}

export interface HeadTurnInput {
    /** Sinal sem suavização, com ganho padrão do HeadLook, independente da preferência visual. */
    yaw: number
    active: boolean
    fresh: boolean
    sensitivity: number
}

export interface HeadTurn {
    update(input: HeadTurnInput, dtMs: number): HeadTurnState
    reset(): void
}

export function createHeadTurn(config = DEFAULT_HEAD_TURN): HeadTurn {
    let intent: HeadTurnState['intent'] = null
    let dwell = 0
    let age = Infinity

    function stop(): HeadTurnState {
        intent = null
        dwell = 0
        return { intent: null, progress: 0, turning: false, yawDelta: 0 }
    }

    return {
        reset() {
            age = Infinity
            stop()
        },
        update(input, dtMs) {
            age = input.fresh ? 0 : age + Math.max(0, dtMs)
            if (
                !input.active ||
                !Number.isFinite(input.yaw) ||
                !Number.isFinite(dtMs) ||
                age > config.maxSampleAgeMs ||
                dtMs > config.maxSampleAgeMs
            ) return stop()

            let direction: HeadTurnState['intent'] = null
            if (intent === 'left' && input.yaw < -config.yawHold) direction = 'left'
            else if (intent === 'right' && input.yaw > config.yawHold) direction = 'right'
            else if (input.yaw < -config.yawStart) direction = 'left'
            else if (input.yaw > config.yawStart) direction = 'right'
            if (!direction) return stop()

            const elapsed = Math.min(config.maxFrameMs, Math.max(0, dtMs))
            if (direction !== intent) {
                intent = direction
                dwell = 0
            } else dwell += elapsed

            const turning = dwell >= config.dwellMs
            const gain = Number.isFinite(input.sensitivity)
                ? Math.max(HEAD_LOOK_SENSITIVITY.min, Math.min(HEAD_LOOK_SENSITIVITY.max, input.sensitivity))
                : HEAD_LOOK_SENSITIVITY.initial
            return {
                intent,
                progress: Math.min(1, dwell / config.dwellMs),
                turning,
                yawDelta: turning
                    ? (intent === 'right' ? 1 : -1) * config.rate * gain * elapsed / 1000
                    : 0,
            }
        },
    }
}
