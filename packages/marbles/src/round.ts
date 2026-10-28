import { DEFAULT_FLICK, type FlickConfig, type FlickReading, flickPower } from './flick.js'
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
    /** Onde a pinça fechou (campo); a mira conta o deslocamento a partir daqui. */
    let aimAnchor: Vec | null = null
    /** Pinça virtual: a bolinha de tiro mais o arrasto da mão, já na escala do campo. */
    let aimPinch: Vec | null = null
    /** Qual modo está mirando (a pinça mostra o elástico; o estalo, só a seta). */
    let aimKind: 'pinch' | 'flick' | null = null
    let lastSeenMs = 0
    /** A leitura anterior tinha a mão à vista e a pinça aberta. */
    let prevOpen = false
    let accumulatorMs = 0

    function initialBodies(): Body[] {
        return [
            { pos: { ...cfg.shooterStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
            { pos: { ...cfg.targetStart }, vel: { x: 0, y: 0 }, radius: cfg.radius },
        ]
    }

    const shooterPos = (): Vec => bodies[0].pos

    function cancelAim(): void {
        aimAnchor = null
        aimPinch = null
        aimKind = null
        state = 'ready'
    }

    function fire(velocity: Vec): void {
        const shooter = bodies[0]
        bodies = [{ ...shooter, vel: { ...velocity } }, bodies[1]]
        shots++
        aimAnchor = null
        aimPinch = null
        aimKind = null
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
        const openNow = point !== null && !reading.closed

        if (state === 'ready') {
            // A mira começa ao fechar a pinça (aberta na leitura anterior), em qualquer lugar.
            if (closedNow && prevOpen && point) {
                aimAnchor = point
                aimPinch = { ...shooterPos() }
                aimKind = 'pinch'
                lastSeenMs = nowMs
                state = 'aiming'
            }
        } else if (state === 'aiming' && aimKind === 'pinch') {
            if (!point) {
                if (nowMs - lastSeenMs > cfg.lostHandMs) cancelAim()
            } else {
                lastSeenMs = nowMs
                if (closedNow) {
                    aimPinch = virtualPinch(point)
                } else {
                    // Ao abrir a pinça, vale a última posição com a pinça fechada.
                    const shot = aimPinch ? computeShot(shooterPos(), aimPinch, cfg.shot) : null
                    if (shot) fire(shot.velocity)
                    else cancelAim()
                }
            }
        }
        prevOpen = openNow
    }

    /** Pinça virtual: a bolinha de tiro mais o deslocamento da mão desde que armou, na escala do campo. */
    function virtualPinch(point: Vec): Vec {
        const anchor = aimAnchor ?? point
        return {
            x: shooterPos().x + (point.x - anchor.x) * cfg.aimScale,
            y: shooterPos().y + (point.y - anchor.y) * cfg.aimScale,
        }
    }

    /** Direção unitária do estilingue (da pinça virtual para a bolinha); `null` se o arrasto é curto. */
    function aimDirection(pinch: Vec): Vec | null {
        const shot = computeShot(shooterPos(), pinch, cfg.shot)
        if (!shot) return null
        const length = Math.hypot(shot.velocity.x, shot.velocity.y)
        return { x: shot.velocity.x / length, y: shot.velocity.y / length }
    }

    /** Mira relativa, como na pinça; a força vem do polegar e a direção do deslocamento da mão. */
    function observeFlickReading(reading: FlickReading, nowMs: number): void {
        const point = fieldPoint(reading)
        const armedNow = reading.closed && point !== null

        if (state === 'ready') {
            if (armedNow && point) {
                aimAnchor = point
                aimPinch = { ...shooterPos() }
                aimKind = 'flick'
                lastSeenMs = nowMs
                state = 'aiming'
            }
        } else if (state === 'aiming' && aimKind === 'flick') {
            if (!point) {
                if (nowMs - lastSeenMs > cfg.lostHandMs) cancelAim()
                return
            }
            lastSeenMs = nowMs
            if (reading.release) {
                // A mira trava na posição da mão antes de o polegar subir.
                const strength = flickPower(reading.release, cfg.flick)
                const locked = {
                    x: reading.release.point.x * cfg.physics.width,
                    y: reading.release.point.y * cfg.physics.height,
                }
                const direction = strength ? aimDirection(virtualPinch(locked)) : null
                if (strength && direction) {
                    fire({ x: direction.x * strength.speed, y: direction.y * strength.speed })
                } else {
                    cancelAim()
                }
            } else if (armedNow) {
                // Enquanto o polegar sobe (confirmando), a posição da mão perturbada não mexe na mira.
                if (reading.phase !== 'pending') aimPinch = virtualPinch(point)
            } else {
                // O detector zerou o armado sem soltura (por exemplo, a mão sumiu e voltou esticada).
                cancelAim()
            }
        }
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
            const flickPreview = (pinch: Vec): { direction: Vec } | null => {
                const direction = aimDirection(pinch)
                return direction ? { direction } : null
            }
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
                flick: aimKind === 'flick' && aimPinch ? flickPreview(aimPinch) : null,
                hitShots,
                failureReason,
            }
        },

        cameraReady() {
            cameraOk = true
            if (state === 'idle' || state === 'camera_denied') {
                state = 'ready'
                prevOpen = false
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
            aimAnchor = null
            aimPinch = null
            aimKind = null
            failureReason = reason
            state = 'tracker_error'
        },

        observePinch(reading, nowMs) {
            observe(reading, nowMs)
        },

        observeFlick(reading, nowMs) {
            observeFlickReading(reading, nowMs)
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
            aimAnchor = null
            aimPinch = null
            aimKind = null
            prevOpen = false
            state = cameraOk ? 'ready' : 'idle'
        },
    }
}
