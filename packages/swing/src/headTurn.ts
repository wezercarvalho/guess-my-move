import { HEAD_LOOK_SENSITIVITY } from './headLook.js'

/** Giro horizontal contínuo após manter a cabeça de lado; sem DOM, câmera ou rede. */
export const DEFAULT_HEAD_TURN = {
    dwellMs: 1000,
    yawStart: (12 * Math.PI) / 180,
    yawHold: (7 * Math.PI) / 180,
    rate: Math.PI / 6,
    accelerationStartMs: 2500,
    accelerationRampMs: 2500,
    maxSpeedMultiplier: 2,
    maxSampleAgeMs: 250,
    maxFrameMs: 100,
}

export interface HeadTurnState {
    intent: 'left' | 'right' | null
    progress: number
    turning: boolean
    yawDelta: number
    speedMultiplier: number
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
        return { intent: null, progress: 0, turning: false, yawDelta: 0, speedMultiplier: 1 }
    }

    /** Integral da parcela extra da taxa, em ms equivalentes à velocidade base. */
    function accelerationArea(heldMs: number): number {
        const sinceStart = Math.max(0, heldMs - config.accelerationStartMs)
        const ramp = Math.min(sinceStart, config.accelerationRampMs)
        return (config.maxSpeedMultiplier - 1) * (
            ramp * ramp / (2 * config.accelerationRampMs) +
            Math.max(0, sinceStart - config.accelerationRampMs)
        )
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
            const acceleration = Math.min(1, Math.max(0, dwell - config.accelerationStartMs) / config.accelerationRampMs)
            const speedMultiplier = 1 + acceleration * (config.maxSpeedMultiplier - 1)
            const weightedMs = elapsed + accelerationArea(dwell) - accelerationArea(dwell - elapsed)
            const gain = Number.isFinite(input.sensitivity)
                ? Math.max(HEAD_LOOK_SENSITIVITY.min, Math.min(HEAD_LOOK_SENSITIVITY.max, input.sensitivity))
                : HEAD_LOOK_SENSITIVITY.initial
            return {
                intent,
                progress: Math.min(1, dwell / config.dwellMs),
                turning,
                speedMultiplier,
                yawDelta: turning
                    ? (intent === 'right' ? 1 : -1) * config.rate * gain * weightedMs / 1000
                    : 0,
            }
        },
    }
}
