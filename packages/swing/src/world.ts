import { type CityIndex } from './cityIndex.js'
import {
    DEFAULT_SWING,
    type StepEvents,
    type SwingConfig,
    type SwingState,
    createSwingState,
    stepPlayer,
} from './physics.js'
import { findSpawn } from './spawn.js'
import { forwardFromAngles } from './vec.js'
import { pickAnchor } from './web.js'

/** O que o jogador pede a cada passo. As taxas vão de -1 a 1. */
export interface SwingInput {
    /** A teia deve estar presa (gesto ou tecla seguros). */
    webHeld: boolean
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
    let accumulator = 0

    function start(): void {
        Object.assign(state, createSwingState(spawn))
        previousHeld = false
        accumulator = 0
    }
    start()

    function step(input: SwingInput, dt: number): StepEvents {
        state.yaw += input.yawRate * config.yawRate * dt
        state.pitch = Math.max(
            -config.pitchLimit,
            Math.min(config.pitchLimit, state.pitch + input.pitchRate * config.pitchRate * dt),
        )

        if (!input.webHeld) {
            state.web = null
        } else if (!previousHeld) {
            const anchor = pickAnchor(index, state.position, state.yaw, state.pitch, config.web)
            if (anchor) {
                const length = Math.hypot(
                    anchor.x - state.position.x,
                    anchor.y - state.position.y,
                    anchor.z - state.position.z,
                )
                state.web = { anchor, length }
                state.stats.webs++
            } else {
                state.stats.misses++
            }
        }
        previousHeld = input.webHeld

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
        reset: start,
    }
}
