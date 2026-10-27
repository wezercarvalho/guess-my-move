import { type PinchReading } from './pinch.js'
import {
    type Body,
    DEFAULT_PHYSICS,
    type PhysicsConfig,
    type Vec,
    isAtRest,
    stepBodies,
} from './physics.js'
import { DEFAULT_SHOT, type Shot, type ShotConfig, computeShot } from './shot.js'

/** Estados da rodada do bete solo. */
export type BeteState =
    | 'idle'
    | 'ready'
    | 'aiming'
    | 'rolling'
    | 'hit'
    | 'camera_denied'
    | 'tracker_error'

/** Parâmetros da rodada; os valores padrão são palpites a calibrar com uso real. */
export interface BeteConfig {
    physics: PhysicsConfig
    shot: ShotConfig
    /** Raio das duas bolinhas. */
    radius: number
    shooterStart: Vec
    targetStart: Vec
    /** Distância máxima da pinça à bolinha de tiro para pegá-la. */
    grabRadius: number
    /** Tempo sem a mão, durante a mira, que cancela o tiro. */
    lostHandMs: number
    /** Teto do intervalo simulado por chamada de `advance`. */
    maxAdvanceMs: number
}

export const DEFAULT_BETE: BeteConfig = {
    physics: DEFAULT_PHYSICS,
    shot: DEFAULT_SHOT,
    radius: 14,
    shooterStart: { x: 150, y: 300 },
    targetStart: { x: 550, y: 300 },
    grabRadius: 70,
    lostHandMs: 300,
    maxAdvanceMs: 250,
}

/** Foto imutável da rodada, para a interface desenhar. */
export interface BeteSnapshot {
    state: BeteState
    shooter: Vec
    target: Vec
    shots: number
    /** Mira em andamento: ponto da pinça no campo e a previsão do tiro (ou `null` se curto). */
    aim: { pinch: Vec; shot: Shot | null } | null
    /** Número de tiros que acertou o alvo; `null` enquanto não houve acerto. */
    hitShots: number | null
    failureReason: string | null
}

export interface BeteRound {
    readonly state: BeteState
    snapshot(): BeteSnapshot
    cameraReady(): void
    denyCamera(): void
    trackerFailed(reason: string): void
    /** Leitura da pinça; `nowMs` é o relógio monotônico do chamador. */
    observePinch(reading: PinchReading, nowMs: number): void
    /** Avança a física em `dtMs` (só em `rolling` e `hit`). */
    advance(dtMs: number): void
    newRound(): void
}

/**
 * Rodada do bete solo: uma bolinha de tiro contra um alvo parado, tiros
 * ilimitados; termina no primeiro contato com o alvo. Pura e determinística:
 * o tempo entra só pelos argumentos, nada de relógio ou DOM.
 */
export function createBeteRound(overrides: Partial<BeteConfig> = {}): BeteRound {
    const cfg: BeteConfig = { ...DEFAULT_BETE, ...overrides }
    const stepMs = cfg.physics.fixedStep * 1000

    let state: BeteState = 'idle'
    let cameraOk = false
    let bodies = initialBodies()
    let shots = 0
    let hitShots: number | null = null
    let failureReason: string | null = null
    let aimPinch: Vec | null = null
    let lastSeenMs = 0
    let prevClosed = false
    let accumulatorMs = 0

    function initialBodies(): Body[] {
        return [
            { pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
            { pos: { ...cfg.targetStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
        ]
    }

    const shooterPos = (): Vec => bodies[0].pos
    const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

    function cancelAim(): void {
        aimPinch = null
        state = 'ready'
    }

    function fire(shot: Shot): void {
        const shooter = bodies[0]
        bodies = [{ ...shooter, vel: { ...shot.velocity } }, bodies[1]]
        shots++
        aimPinch = null
        accumulatorMs = 0
        state = 'rolling'
    }

    function fieldPoint(reading: PinchReading): Vec | null {
        if (!reading.handVisible || !reading.point) return null
        return { x: reading.point.x * cfg.physics.width, y: reading.point.y * cfg.physics.height }
    }

    function observe(reading: PinchReading, nowMs: number): void {
        const point = fieldPoint(reading)
        const closedNow = reading.closed && point !== null

        if (state === 'ready') {
            if (
                closedNow &&
                !prevClosed &&
                point &&
                distance(point, shooterPos()) <= cfg.grabRadius
            ) {
                aimPinch = point
                lastSeenMs = nowMs
                state = 'aiming'
            }
        } else if (state === 'aiming') {
            if (!point) {
                if (nowMs - lastSeenMs > cfg.lostHandMs) cancelAim()
            } else {
                lastSeenMs = nowMs
                if (closedNow) {
                    aimPinch = point
                } else {
                    // Ao abrir a pinça, vale o último ponto com a pinça fechada.
                    const shot = aimPinch ? computeShot(shooterPos(), aimPinch, cfg.shot) : null
                    if (shot) fire(shot)
                    else cancelAim()
                }
            }
        }
        prevClosed = closedNow
    }

    function resetPositions(): void {
        bodies = initialBodies()
        accumulatorMs = 0
    }

    return {
        get state() {
            return state
        },

        snapshot(): BeteSnapshot {
            return {
                state,
                shooter: { ...shooterPos() },
                target: { ...bodies[1].pos },
                shots,
                aim: aimPinch
                    ? {
                          pinch: { ...aimPinch },
                          shot: computeShot(shooterPos(), aimPinch, cfg.shot),
                      }
                    : null,
                hitShots,
                failureReason,
            }
        },

        cameraReady() {
            cameraOk = true
            if (state === 'idle' || state === 'camera_denied') {
                state = 'ready'
                prevClosed = false
            }
        },

        denyCamera() {
            if (state === 'idle' || state === 'ready') {
                cameraOk = false
                state = 'camera_denied'
            }
        },

        trackerFailed(reason: string) {
            if (state === 'hit') return
            aimPinch = null
            failureReason = reason
            state = 'tracker_error'
        },

        observePinch(reading, nowMs) {
            observe(reading, nowMs)
        },

        advance(dtMs: number) {
            if (state !== 'rolling' && state !== 'hit') return
            accumulatorMs += Math.min(Math.max(dtMs, 0), cfg.maxAdvanceMs)
            while (accumulatorMs >= stepMs) {
                accumulatorMs -= stepMs
                const result = stepBodies(bodies, cfg.physics)
                bodies = result.bodies
                if (state === 'rolling' && result.contacts.some(([a, b]) => a === 0 && b === 1)) {
                    state = 'hit'
                    hitShots = shots
                }
            }
            if (state === 'rolling' && isAtRest(bodies, cfg.physics)) {
                resetPositions()
                state = 'ready'
            }
        },

        newRound() {
            resetPositions()
            shots = 0
            hitShots = null
            failureReason = null
            aimPinch = null
            prevClosed = false
            state = cameraOk ? 'ready' : 'idle'
        },
    }
}
