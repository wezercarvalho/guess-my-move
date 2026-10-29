import { type AimController, type AimVec, createAimController } from './aim/index.js'
import { DEFAULT_FLICK, type FlickConfig, type FlickReading } from './flick.js'
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
    /** Parâmetros do estalo (modo alpha). */
    flick: FlickConfig
    /** Raio das duas bolinhas. */
    radius: number
    shooterStart: Vec
    targetStart: Vec
    /**
     * Quanto o arrasto da mão vale no campo. A mira é relativa: a pinça pode
     * fechar em qualquer lugar e só o deslocamento a partir dali conta. Acima de
     * 1, o braço se move menos para o mesmo tiro.
     */
    aimScale: number
    /** Tempo sem a mão, durante a mira, que cancela o tiro. */
    lostHandMs: number
    /** Teto do intervalo simulado por chamada de `advance`. */
    maxAdvanceMs: number
}

export const DEFAULT_BETE: BeteConfig = {
    physics: DEFAULT_PHYSICS,
    shot: DEFAULT_SHOT,
    flick: DEFAULT_FLICK,
    radius: 14,
    shooterStart: { x: 150, y: 300 },
    targetStart: { x: 550, y: 300 },
    aimScale: 1.5,
    lostHandMs: 300,
    maxAdvanceMs: 250,
}

/** Foto imutável da rodada, para a interface desenhar. */
export interface BeteSnapshot {
    state: BeteState
    shooter: Vec
    target: Vec
    shots: number
    /** Mira em andamento: pinça virtual (bolinha mais o arrasto) e a previsão do tiro (ou `null` se curto). */
    aim: { pinch: Vec; shot: Shot | null } | null
    /** Modo estalo armado: direção do tiro pela mira relativa (vetor unitário do campo); `null` fora disso ou com o arrasto curto. */
    flick: { direction: Vec } | null
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
    /** Leitura do detector de estalo (modo alpha); `closed` significa armado. */
    observeFlick(reading: FlickReading, nowMs: number): void
    /** Avança a física em `dtMs` (só em `rolling` e `hit`). */
    advance(dtMs: number): void
    newRound(): void
}

/**
 * Rodada do bete solo: uma bolinha de tiro contra um alvo parado, tiros
 * ilimitados; termina no primeiro contato com o alvo. Pura e determinística:
 * o tempo entra só pelos argumentos, nada de relógio ou DOM. A leitura da mão
 * (pinça e estalo, mira relativa, mão perdida, cancelamento) é delegada ao
 * controlador de mira; aqui ficam só as regras do bete.
 */
export function createBeteRound(overrides: Partial<BeteConfig> = {}): BeteRound {
    const cfg: BeteConfig = { ...DEFAULT_BETE, ...overrides }
    const stepMs = cfg.physics.fixedStep * 1000
    const aim: AimController = createAimController({
        width: cfg.physics.width,
        height: cfg.physics.height,
        shot: cfg.shot,
        flick: cfg.flick,
        aimScale: cfg.aimScale,
        lostHandMs: cfg.lostHandMs,
    })

    let state: BeteState = 'idle'
    let cameraOk = false
    let bodies = initialBodies()
    let shots = 0
    let hitShots: number | null = null
    let failureReason: string | null = null
    /** Pinça virtual corrente, só para o desenho; vinda do controlador de mira. */
    let aimPinch: Vec | null = null
    let aimKind: 'pinch' | 'flick' | null = null
    /** Direção corrente do estalo, só para o desenho. */
    let aimDirection: Vec | null = null
    let accumulatorMs = 0

    function initialBodies(): Body[] {
        return [
            { pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
            { pos: { ...cfg.targetStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
        ]
    }

    const shooterPos = (): Vec => bodies[0].pos

    function clearAimDraw(): void {
        aimPinch = null
        aimKind = null
        aimDirection = null
    }

    function fire(velocity: AimVec): void {
        const shooter = bodies[0]
        bodies = [{ ...shooter, vel: { x: velocity.x, y: velocity.y } }, bodies[1]]
        shots++
        clearAimDraw()
        accumulatorMs = 0
        state = 'rolling'
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
                aim: aimPinch && aimKind === 'pinch'
                    ? {
                          pinch: { ...aimPinch },
                          shot: computeShot(shooterPos(), aimPinch, cfg.shot),
                      }
                    : null,
                flick: aimKind === 'flick' && aimDirection ? { direction: { ...aimDirection } } : null,
                hitShots,
                failureReason,
            }
        },

        cameraReady() {
            cameraOk = true
            if (state === 'idle' || state === 'camera_denied') {
                aim.reset()
                state = 'ready'
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
            aim.cancel()
            clearAimDraw()
            failureReason = reason
            state = 'tracker_error'
        },

        observePinch(reading, nowMs) {
            if (state !== 'ready' && state !== 'aiming') return
            const out = aim.observePinch(shooterPos(), reading, nowMs)
            if (out.fired) {
                fire(out.fired)
                return
            }
            if (out.aiming) {
                aimPinch = out.aiming.pinch
                aimKind = 'pinch'
                aimDirection = null
                state = 'aiming'
            } else if (state === 'aiming') {
                clearAimDraw()
                state = 'ready'
            }
        },

        observeFlick(reading, nowMs) {
            if (state !== 'ready' && state !== 'aiming') return
            const out = aim.observeFlick(shooterPos(), reading, nowMs)
            if (out.fired) {
                fire(out.fired)
                return
            }
            if (out.aiming) {
                aimPinch = out.aiming.pinch
                aimKind = 'flick'
                aimDirection = out.aiming.direction
                state = 'aiming'
            } else if (state === 'aiming') {
                clearAimDraw()
                state = 'ready'
            }
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
            aim.reset()
            clearAimDraw()
            state = cameraOk ? 'ready' : 'idle'
        },
    }
}
