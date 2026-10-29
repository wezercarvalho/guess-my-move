import { type CityIndex } from './cityIndex.js'
import {
    DEFAULT_SWING,
    type StepEvents,
    type SwingConfig,
    type SwingState,
    type WebSide,
    createSwingState,
    stepPlayer,
} from './physics.js'
import { findSpawn } from './spawn.js'
import { forwardFromAngles, type Vec3 } from './vec.js'
import { pickAnchor } from './web.js'

/** Lado da mão que lança a teia. */
export { type WebSide } from './physics.js'

/** O que o jogador pede a cada passo. As taxas vão de -1 a 1. */
export interface SwingInput {
    /** A teia deve estar presa (gesto ou tecla seguros). */
    webHeld: boolean
    /** Mão que está lançando; ausente vale o centro. */
    webSide?: WebSide
    /** Punho fechado com a teia presa: puxar. */
    pull?: boolean
    yawRate: number
    pitchRate: number
}

export interface SwingWorld {
    /** Estado do jogador; o mesmo objeto o tempo todo (o render lê dele a cada quadro). */
    readonly state: SwingState
    /** Um passo de `dt` segundos: direção, teia e física. */
    step(input: SwingInput, dt: number): StepEvents
    /** Avança `frameSeconds` em passos fixos, sem passar de `maxFrame` por chamada. */
    advance(input: SwingInput, frameSeconds: number): void
    /** Onde a teia prenderia agora se a mão do lado `side` a lançasse; não altera o jogo. */
    aim(side: WebSide): Vec3 | null
    /** Volta ao ponto de partida e zera as estatísticas. */
    reset(): void
}

/** Sessão de jogo: o jogador, a cidade e a regra de lançar e soltar a teia. O jogo só começa no primeiro gesto. */
export function createSwingWorld(
    index: CityIndex,
    config: SwingConfig = DEFAULT_SWING,
): SwingWorld {
    const spawn = findSpawn(index, config)
    const state = createSwingState(spawn)
    let previousHeld = false
    let previousSide: WebSide = 0
    let previousPull = false
    let accumulator = 0

    function start(): void {
        Object.assign(state, createSwingState(spawn))
        previousHeld = false
        previousSide = 0
        previousPull = false
        accumulator = 0
    }
    start()

    /**
     * Onde a teia prenderia agora, lançada pela mão do lado `side`. O lado é uma preferência:
     * tenta o desvio inteiro, depois metade e por fim o centro, para uma teia lançada de lado
     * não errar um prédio que está bem à frente.
     */
    function aimWeb(side: WebSide): { anchor: Vec3; virtual: boolean } | null {
        const factors = side === 0 ? [0] : [1, 0.5, 0]
        for (const factor of factors) {
            const anchor = pickAnchor(
                index,
                state.position,
                state.yaw + side * factor * config.sideYaw,
                state.pitch,
                config.web,
            )
            if (anchor) return { anchor, virtual: false }
        }
        return skyAnchor(side)
    }

    /** Ponto no céu à frente e acima, quando nenhum prédio é alcançável. */
    function skyAnchor(side: WebSide): { anchor: Vec3; virtual: boolean } | null {
        const sky = config.skyWeb
        if (!sky || state.position.y > sky.maxAltitude) return null
        const ahead = forwardFromAngles(state.yaw + side * config.sideYaw, 0)
        return {
            anchor: {
                x: state.position.x + ahead.x * sky.distance,
                y: state.position.y + sky.rise,
                z: state.position.z + ahead.z * sky.distance,
            },
            virtual: true,
        }
    }

    function aim(side: WebSide): Vec3 | null {
        return aimWeb(side)?.anchor ?? null
    }

    /** A câmera passa a olhar, aos poucos, para onde o jogador se move (guinada e inclinação). */
    function followHeading(dt: number, followPitch: boolean): void {
        const { x, y, z } = state.velocity
        const horizontal = Math.hypot(x, z)
        if (horizontal < config.headingMinSpeed) return
        const follow = 1 - Math.exp(-config.headingFollow * dt)
        const target = Math.atan2(x, -z)
        let diff = target - state.yaw
        while (diff > Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        state.yaw += diff * follow
        if (followPitch) {
            const slope = Math.atan2(y, horizontal)
            const wanted = Math.max(config.followPitchMin, Math.min(config.followPitchMax, config.followPitchBase + slope * 0.5))
            state.pitch += (wanted - state.pitch) * follow
        }
    }

    function step(input: SwingInput, dt: number): StepEvents {
        state.yaw += input.yawRate * config.yawRate * dt
        if (state.started && input.yawRate === 0) followHeading(dt, input.pitchRate === 0)
        state.pitch = Math.max(
            -config.pitchLimit,
            Math.min(config.pitchLimit, state.pitch + input.pitchRate * config.pitchRate * dt),
        )

        const side = input.webSide ?? 0
        // Passar a usar a outra mão (mesmo com as duas juntas por um instante) lança do novo lado.
        const heldSide = state.web?.side ?? 0
        const switchedHand = side !== 0 && side !== previousSide && heldSide !== 0 && heldSide !== side
        if (!input.webHeld) {
            state.web = null
        } else if (!previousHeld || switchedHand) {
            const found = aimWeb(side)
            if (found) {
                const { anchor } = found
                const length = Math.hypot(
                    anchor.x - state.position.x,
                    anchor.y - state.position.y,
                    anchor.z - state.position.z,
                )
                state.web = found.virtual ? { anchor, length, side, virtual: true } : { anchor, length, side }
                state.stats.webs++
                // Saindo do chão, o primeiro puxão da teia dá o salto.
                if (state.grounded || state.position.y <= config.eyeHeight + 0.05) {
                    const reach = Math.max(length, 1e-6)
                    state.velocity.x += ((anchor.x - state.position.x) / reach) * config.launchBoost
                    state.velocity.y += ((anchor.y - state.position.y) / reach) * config.launchBoost + config.launchLift
                    state.velocity.z += ((anchor.z - state.position.z) / reach) * config.launchBoost
                    state.grounded = false
                }
            } else {
                state.stats.misses++
            }
        }
        previousHeld = input.webHeld
        previousSide = input.webHeld ? side : 0

        const pulling = Boolean(input.pull) && state.web !== null
        if (pulling && !previousPull && state.web) {
            const { anchor } = state.web
            const dx = anchor.x - state.position.x
            const dy = anchor.y - state.position.y
            const dz = anchor.z - state.position.z
            const reach = Math.max(Math.hypot(dx, dy, dz), 1e-6)
            state.velocity.x += (dx / reach) * config.pullImpulse
            state.velocity.y += (dy / reach) * config.pullImpulse
            state.velocity.z += (dz / reach) * config.pullImpulse
        }
        previousPull = pulling
        state.pulling = pulling

        // O jogador fica parado no início, olhando em volta, até o primeiro gesto de teia.
        if (!state.started) {
            if (!input.webHeld) return { wallHit: false }
            state.started = true
            const ahead = forwardFromAngles(state.yaw, 0)
            state.velocity = {
                x: ahead.x * config.spawnSpeed,
                y: 0,
                z: ahead.z * config.spawnSpeed,
            }
        }
        return stepPlayer(index, state, dt, config)
    }

    return {
        state,
        step,
        advance(input, frameSeconds) {
            accumulator += Math.min(Math.max(frameSeconds, 0), config.maxFrame)
            while (accumulator >= config.step) {
                step(input, config.step)
                accumulator -= config.step
            }
        },
        aim,
        reset: start,
    }
}
