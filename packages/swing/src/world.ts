import { type CityIndex } from './cityIndex.js'
import {
    DEFAULT_SWING,
    type ActiveWeb,
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

/** Teia de uma mão: esquerda, direita, ou o centro (só o teclado). */
export type WebSlot = 'left' | 'center' | 'right'

/** Um sim/não por teia; o que falta vale não. */
export type SlotFlags = Partial<Record<WebSlot, boolean>>

/** Os três lugares de teia e o lado de cada um. */
const SLOTS: readonly { slot: WebSlot; side: WebSide }[] = [
    { slot: 'left', side: -1 },
    { slot: 'center', side: 0 },
    { slot: 'right', side: 1 },
]

/** O que o jogador pede a cada passo. As taxas vão de -1 a 1. */
export interface SwingInput {
    /** Teias que devem estar presas: cada mão segura a sua. */
    held: SlotFlags
    /** Punho fechado: puxar a teia daquele lado, se estiver presa. */
    pull?: SlotFlags
    /** Mãos abertas em contato com a parede: agarrar a fachada. */
    grab?: SlotFlags
    /** Sinal de escalada (-1 a 1): sobe/desce quando agarrado. */
    climb?: number
    /** Punho fechado: soltar da parede (ao segurar além da tolerância). */
    releaseFist?: boolean
    yawRate: number
    pitchRate: number
    /**
     * Desvio do olhar pela cabeça neste passo (guinada e inclinação, em radianos), somado
     * direto ao olhar — já é um ângulo, não uma taxa. É a variação de um quadro para o outro,
     * calculada na camada web a partir do rastreador de rosto. Ausente = sem rosto / teclado.
     */
    lookDelta?: { yaw: number; pitch: number }
    /**
     * A cabeça está comandando o olhar agora (fora da zona morta ou voltando ao neutro). Com
     * isso ligado, o acompanhamento automático não sobrescreve o olhar neste passo.
     */
    lookActive?: boolean
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
    let previousHeld: Record<WebSlot, boolean> = { left: false, center: false, right: false }
    let previousPull: Record<WebSlot, boolean> = { left: false, center: false, right: false }
    let accumulator = 0

    function start(): void {
        Object.assign(state, createSwingState(spawn))
        previousHeld = { left: false, center: false, right: false }
        previousPull = { left: false, center: false, right: false }
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

    /** Lança a teia da mão do lado `side` e, saindo do chão, dá o salto. */
    function launch(side: WebSide): void {
        const found = aimWeb(side)
        if (!found) {
            state.stats.misses++
            return
        }
        const { anchor } = found
        const length = Math.hypot(
            anchor.x - state.position.x,
            anchor.y - state.position.y,
            anchor.z - state.position.z,
        )
        state.webs.push(found.virtual ? { anchor, length, side, virtual: true } : { anchor, length, side })
        state.stats.webs++
        // Saindo do chão, o primeiro puxão da teia dá o salto (uma vez só, mesmo com as duas mãos).
        if (state.grounded || state.position.y <= config.eyeHeight + 0.05) {
            const reach = Math.max(length, 1e-6)
            state.velocity.x += ((anchor.x - state.position.x) / reach) * config.launchBoost
            state.velocity.y += ((anchor.y - state.position.y) / reach) * config.launchBoost + config.launchLift
            state.velocity.z += ((anchor.z - state.position.z) / reach) * config.launchBoost
            state.grounded = false
        }
    }

    /** O impulso único, em direção ao ponto da teia, a cada vez que o punho fecha. */
    function pullImpulse(web: ActiveWeb): void {
        const dx = web.anchor.x - state.position.x
        const dy = web.anchor.y - state.position.y
        const dz = web.anchor.z - state.position.z
        const reach = Math.max(Math.hypot(dx, dy, dz), 1e-6)
        state.velocity.x += (dx / reach) * config.pullImpulse
        state.velocity.y += (dy / reach) * config.pullImpulse
        state.velocity.z += (dz / reach) * config.pullImpulse
    }

    function step(input: SwingInput, dt: number): StepEvents {
        state.yaw += input.yawRate * config.yawRate * dt
        // A cabeça soma um desvio direto ao olhar (já é um ângulo, não uma taxa).
        if (input.lookDelta) {
            state.yaw += input.lookDelta.yaw
            state.pitch += input.lookDelta.pitch
        }
        // O acompanhamento automático só entra quando nem o teclado nem a cabeça comandam o olhar.
        if (state.started && input.yawRate === 0 && !input.lookActive) {
            followHeading(dt, input.pitchRate === 0 && !input.lookActive)
        }
        state.pitch = Math.max(
            -config.pitchLimit,
            Math.min(config.pitchLimit, state.pitch + input.pitchRate * config.pitchRate * dt),
        )

        const anyHeld = SLOTS.some(({ slot }) => input.held[slot])
        const anyGrab = SLOTS.some(({ slot }) => input.grab?.[slot])
        for (const { slot, side } of SLOTS) {
            const held = Boolean(input.held[slot])
            if (!held) {
                state.webs = state.webs.filter((web) => web.side !== side)
            } else if (!previousHeld[slot]) {
                launch(side)
            }
            previousHeld[slot] = held

            const web = state.webs.find((candidate) => candidate.side === side)
            const pulling = Boolean(input.pull?.[slot]) && web !== undefined
            if (web) {
                web.pulling = pulling
                if (pulling && !previousPull[slot]) pullImpulse(web)
            }
            previousPull[slot] = pulling
        }

        // O jogador fica parado no início, olhando em volta, até o primeiro gesto de teia (ou agarre).
        if (!state.started) {
            if (!anyHeld && !anyGrab) return { wallHit: false }
            state.started = true
            const ahead = forwardFromAngles(state.yaw, 0)
            state.velocity = {
                x: ahead.x * config.spawnSpeed,
                y: 0,
                z: ahead.z * config.spawnSpeed,
            }
        }
        return stepPlayer(index, state, dt, config, {
            grab: input.grab,
            climb: input.climb,
            releaseFist: input.releaseFist,
        })
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
