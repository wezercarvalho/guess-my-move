import { type CityIndex } from './cityIndex.js'
import { DEFAULT_GRIP, type GripConfig, type WallGrip, stepGrip } from './climb.js'
import { type Vec3, forwardFromAngles } from './vec.js'
import { DEFAULT_WEB, type WebConfig } from './web.js'

const degrees = (value: number) => (value * Math.PI) / 180

/** Valores de jogo (não são realistas): ajustados para o balanço ficar rápido e legível. */
/** Teia no céu: sem prédio alcançável, prende num ponto à frente e acima do jogador. */
export interface SkyWebConfig {
    /** Distância horizontal do ponto, em metros. */
    distance: number
    /** Altura do ponto acima do jogador, em metros. */
    rise: number
    /** Acima desta altura do jogador, a teia no céu não existe, em metros. */
    maxAltitude: number
}

export interface SwingConfig {
    /** Gravidade, em m/s². */
    gravity: number
    /** Arrasto no ar: a velocidade é multiplicada por `exp(-drag * dt)`. */
    drag: number
    /** Velocidade máxima, em m/s. */
    maxSpeed: number
    /** Altura do olho acima do chão, em metros. */
    eyeHeight: number
    /** Raio da esfera de colisão ao redor do olho, em metros. */
    radius: number
    /** Quanto a corda encurta por segundo enquanto a teia está presa, em m/s. */
    reelSpeed: number
    /** Comprimento mínimo da corda, em metros. */
    minRope: number
    /** Fração da velocidade que volta ao bater numa parede. */
    restitution: number
    /** Atrito na parede: a velocidade ao longo dela é multiplicada por `exp(-wallFriction * dt)`. */
    wallFriction: number
    /** Aceleração, em m/s², que a corda aplica em direção ao ponto de ancoragem enquanto está presa. */
    assist: number
    /** O mesmo com o punho fechado (puxar). */
    pullAssist: number
    /** Recolhimento da corda com o punho fechado, em m/s. */
    pullReel: number
    /** Impulso, em m/s, em direção ao ponto de ancoragem ao fechar o punho. */
    pullImpulse: number
    /** Impulso, em m/s, em direção ao ponto de ancoragem ao lançar a teia saindo do chão. */
    launchBoost: number
    /** Impulso extra para cima, em m/s, ao lançar a teia saindo do chão. */
    launchLift: number
    /** Rapidez, por segundo, com que o chão leva a velocidade horizontal à corrida automática. */
    groundBlend: number
    /** Velocidade da corrida automática no chão ou no telhado, em m/s. */
    runSpeed: number
    /** Distância mantida da borda do mapa, em metros. */
    boundsMargin: number
    /** Taxa máxima de giro da câmera, em rad/s. */
    yawRate: number
    pitchRate: number
    /** Limite da inclinação, em radianos. */
    pitchLimit: number
    web: WebConfig
    /** Passo fixo da simulação e maior tempo de quadro aceito, em segundos. */
    step: number
    maxFrame: number
    /** Desvio lateral da mira da teia lançada pela mão esquerda ou direita, em radianos. */
    sideYaw: number
    /** Rapidez, por segundo, com que a câmera passa a olhar para onde o jogador se move. */
    headingFollow: number
    /** Velocidade horizontal mínima, em m/s, para a câmera acompanhar o movimento. */
    headingMinSpeed: number
    /** Inclinação da câmera automática: valor base e limites, em radianos. */
    followPitchBase: number
    followPitchMin: number
    followPitchMax: number
    /** Teia no céu quando nenhum prédio é alcançável; `null` desliga. */
    skyWeb: SkyWebConfig | null
    /** Agarre à parede: velocidade de escalada, zona morta, tolerância e limite de profundidade. */
    grip: GripConfig
    /** Altura do ponto de partida, em metros. */
    spawnHeight: number
    /** Velocidade para a frente ao começar, em m/s. */
    spawnSpeed: number
}

export const DEFAULT_SWING: SwingConfig = {
    gravity: 20,
    drag: 0.1,
    maxSpeed: 60,
    eyeHeight: 1.7,
    radius: 1.7,
    reelSpeed: 4,
    minRope: 10,
    restitution: 0.1,
    wallFriction: 2,
    assist: 12,
    pullAssist: 40,
    pullReel: 16,
    pullImpulse: 9,
    launchBoost: 14,
    launchLift: 6,
    groundBlend: 6,
    runSpeed: 8,
    boundsMargin: 2,
    yawRate: degrees(90),
    pitchRate: degrees(60),
    pitchLimit: degrees(60),
    web: DEFAULT_WEB,
    step: 1 / 120,
    maxFrame: 0.05,
    sideYaw: degrees(28),
    headingFollow: 1.2,
    headingMinSpeed: 8,
    followPitchBase: degrees(12),
    followPitchMin: degrees(-20),
    followPitchMax: degrees(35),
    skyWeb: { distance: 60, rise: 70, maxAltitude: 220 },
    grip: DEFAULT_GRIP,
    spawnHeight: 90,
    spawnSpeed: 10,
}

export interface SwingStats {
    /** Distância horizontal percorrida, em metros. */
    distance: number
    /** Teias lançadas que prenderam. */
    webs: number
    /** Teias lançadas que erraram. */
    misses: number
    /** Maior velocidade, em m/s. */
    topSpeed: number
}

/** Lado da mão que lança a teia: -1 esquerda, 0 centro (as duas mãos ou o teclado), 1 direita. */
export type WebSide = -1 | 0 | 1

/** Uma teia presa: ponto de ancoragem, comprimento atual da corda e a mão que a lançou. */
export interface ActiveWeb {
    anchor: Vec3
    length: number
    side: WebSide
    /** O punho dessa mão está fechado: a corda puxa mais forte e recolhe mais rápido. */
    pulling?: boolean
    /** Ponto no céu, sem prédio: a teia prende no ar. */
    virtual?: boolean
}

export interface SwingState {
    position: Vec3
    velocity: Vec3
    yaw: number
    pitch: number
    /** Teias presas, no máximo uma por lado (esquerda, centro, direita). */
    webs: ActiveWeb[]
    /** Em pé no chão ou num telhado no último passo. */
    grounded: boolean
    /** Agarrado a uma parede; `null` fora do agarre. */
    grip: WallGrip | null
    /** Encostado numa parede de prédio no último passo (desambigua a palma aberta na tela). */
    touchingWall: boolean
    /** O jogo começou (primeiro gesto de teia); antes disso o jogador fica parado no início. */
    started: boolean
    stats: SwingStats
}

export function createSwingState(position: Vec3, yaw = 0, pitch = degrees(10)): SwingState {
    return {
        position: { ...position },
        velocity: { x: 0, y: 0, z: 0 },
        yaw,
        pitch,
        webs: [],
        grounded: false,
        grip: null,
        touchingWall: false,
        started: false,
        stats: { distance: 0, webs: 0, misses: 0, topSpeed: 0 },
    }
}

export interface StepEvents {
    /** O jogador bateu de lado num prédio neste passo. */
    wallHit: boolean
}

/**
 * Avança o jogador `dt` segundos: corda, gravidade, arrasto, colisão com prédios, chão e
 * limites do mapa. Com o jogador agarrado à parede, a gravidade e a corda não agem: ele
 * sobe/desce colado à fachada. Altera `state` no lugar. `input` traz o pedido de agarre,
 * o sinal de escalada e o de soltar; omiti-lo mantém o comportamento sem agarre.
 */
export function stepPlayer(
    index: CityIndex,
    state: SwingState,
    dt: number,
    config: SwingConfig = DEFAULT_SWING,
    input: PlayerStep = {},
): StepEvents {
    const { position, velocity } = state
    const before = { x: position.x, z: position.z }
    const grab = SLOT_KEYS.some((slot) => input.grab?.[slot])
    let exitedGrip = false

    // Regime de agarre: colado à parede, sem gravidade nem corda. Move na vertical por climb,
    // resolve a colisão para ficar encostado e sai por uma das quatro condições.
    if (state.grip !== null) {
        const stepResult = stepGrip(
            state,
            { grab, climb: input.climb ?? 0, release: Boolean(input.release), hasWeb: state.webs.length > 0 },
            dt,
            latestContact(index, state, config),
            config.grip,
            () => wallTop(index, state, config, state.grip?.normal),
            config.radius,
        )
        if (stepResult.gripped) {
            // Mantém o jogador encostado na fachada (resolve só a posição horizontal).
            const contact = index.resolve(position, config.radius)
            if (contact && contact.kind !== 'roof') {
                position.x = contact.position.x
                position.z = contact.position.z
                state.touchingWall = true
            } else if (contact && contact.kind === 'roof') {
                position.y = contact.position.y
            }
            clampToBounds(index, state, config)
            state.stats.distance += Math.hypot(position.x - before.x, position.z - before.z)
            return { wallHit: false }
        }
        // Saiu do agarre neste passo: segue para a física normal (sem reentrar agora).
        exitedGrip = true
    }

    // Com mais de uma teia, a assistência de cada uma é dividida: duas cordas seguram, não aceleram em dobro.
    const share = 1 / Math.max(1, state.webs.length)
    for (const web of state.webs) {
        const reel = web.pulling ? config.pullReel : config.reelSpeed
        web.length = Math.max(config.minRope, web.length - reel * dt)
        // A corda não só limita a distância: ela puxa o jogador para o ponto de ancoragem.
        const { anchor } = web
        const ax = anchor.x - position.x
        const ay = anchor.y - position.y
        const az = anchor.z - position.z
        const away = Math.hypot(ax, ay, az)
        if (away > config.minRope) {
            const pull = (web.pulling ? config.pullAssist : config.assist) * share * dt
            velocity.x += (ax / away) * pull
            velocity.y += (ay / away) * pull
            velocity.z += (az / away) * pull
        }
    }

    velocity.y -= config.gravity * dt
    if (state.grounded && state.webs.length === 0) {
        const forward = forwardFromAngles(state.yaw, 0)
        const blend = 1 - Math.exp(-config.groundBlend * dt)
        velocity.x += (forward.x * config.runSpeed - velocity.x) * blend
        velocity.z += (forward.z * config.runSpeed - velocity.z) * blend
    }
    const drag = Math.exp(-config.drag * dt)
    velocity.x *= drag
    velocity.y *= drag
    velocity.z *= drag
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
    if (speed > config.maxSpeed) {
        const k = config.maxSpeed / speed
        velocity.x *= k
        velocity.y *= k
        velocity.z *= k
    }

    position.x += velocity.x * dt
    position.y += velocity.y * dt
    position.z += velocity.z * dt

    // Cada corda limita a distância ao seu ponto. Com duas, uma segunda passada acerta o que a primeira desfez.
    for (let pass = 0; pass < (state.webs.length > 1 ? 3 : 1); pass++) {
        for (const web of state.webs) {
            const { anchor, length } = web
            const dx = position.x - anchor.x
            const dy = position.y - anchor.y
            const dz = position.z - anchor.z
            const distance = Math.hypot(dx, dy, dz)
            if (distance <= length) continue
            const nx = dx / distance
            const ny = dy / distance
            const nz = dz / distance
            position.x = anchor.x + nx * length
            position.y = anchor.y + ny * length
            position.z = anchor.z + nz * length
            const outward = velocity.x * nx + velocity.y * ny + velocity.z * nz
            if (outward > 0) {
                velocity.x -= outward * nx
                velocity.y -= outward * ny
                velocity.z -= outward * nz
            }
        }
    }

    state.grounded = false
    state.touchingWall = false
    let wallHit = false
    const contact = index.resolve(position, config.radius)
    if (contact) {
        position.x = contact.position.x
        position.y = contact.position.y
        position.z = contact.position.z
        const into = velocity.x * contact.normal.x + velocity.y * contact.normal.y + velocity.z * contact.normal.z
        if (contact.kind === 'roof') {
            if (velocity.y < 0) velocity.y = 0
            state.grounded = true
        } else {
            if (into < 0) {
                const k = (1 + config.restitution) * into
                velocity.x -= k * contact.normal.x
                velocity.y -= k * contact.normal.y
                velocity.z -= k * contact.normal.z
            }
            // Desliza pela parede, com atrito; a teia continua presa.
            const normal = velocity.x * contact.normal.x + velocity.y * contact.normal.y + velocity.z * contact.normal.z
            const slide = Math.exp(-config.wallFriction * dt)
            velocity.x = contact.normal.x * normal + (velocity.x - contact.normal.x * normal) * slide
            velocity.y = contact.normal.y * normal + (velocity.y - contact.normal.y * normal) * slide
            velocity.z = contact.normal.z * normal + (velocity.z - contact.normal.z * normal) * slide
            wallHit = true
            state.touchingWall = true
        }
    }

    // Agarrar: contato de parede neste passo mais o pedido de agarrar. Entra no regime,
    // zera a velocidade e solta as teias presas (um regime de cada vez). Não reentra no
    // mesmo passo em que saiu (ex.: saída por teia lançada).
    if (state.grip === null && !exitedGrip && grab && state.touchingWall && contact && contact.kind !== 'roof') {
        state.grip = { normal: { ...contact.normal }, wallTop: wallTop(index, state, config, contact.normal), idleMs: 0 }
        state.velocity = { x: 0, y: 0, z: 0 }
        state.webs = []
    }

    if (position.y < config.eyeHeight) {
        position.y = config.eyeHeight
        if (velocity.y < 0) velocity.y = 0
        state.grounded = true
    }

    clampToBounds(index, state, config)

    state.stats.distance += Math.hypot(position.x - before.x, position.z - before.z)
    state.stats.topSpeed = Math.max(
        state.stats.topSpeed,
        Math.hypot(velocity.x, velocity.y, velocity.z),
    )
    return { wallHit }
}

/** Pedido do jogador que o passo precisa para o agarre (subconjunto de SwingInput). */
export interface PlayerStep {
    grab?: Partial<Record<'left' | 'center' | 'right', boolean>> | undefined
    climb?: number | undefined
    release?: boolean | undefined
}

const SLOT_KEYS = ['left', 'center', 'right'] as const

/** Contato de parede mais recente, sem alterar o estado (para o agarre acompanhar a fachada). */
function latestContact(index: CityIndex, state: SwingState, config: SwingConfig) {
    return index.resolve(state.position, config.radius)
}

/** Altura do prédio agarrado: amostra o apoio um pouco para dentro da fachada (contra a normal). */
function wallTop(index: CityIndex, state: SwingState, config: SwingConfig, normal: Vec3 | undefined): number {
    if (!normal) return Infinity
    const inX = state.position.x - normal.x * (config.radius + 1)
    const inZ = state.position.z - normal.z * (config.radius + 1)
    const top = index.supportHeight(inX, inZ)
    return top > 0 ? top + config.radius : Infinity
}

/** Mantém o jogador dentro da área jogável (parede invisível no limite). */
function clampToBounds(index: CityIndex, state: SwingState, config: SwingConfig): void {
    const { position, velocity } = state
    const bounds = index.playBounds
    const minX = bounds.minX + config.boundsMargin
    const maxX = bounds.maxX - config.boundsMargin
    const minZ = bounds.minZ + config.boundsMargin
    const maxZ = bounds.maxZ - config.boundsMargin
    if (position.x < minX) {
        position.x = minX
        if (velocity.x < 0) velocity.x = 0
    } else if (position.x > maxX) {
        position.x = maxX
        if (velocity.x > 0) velocity.x = 0
    }
    if (position.z < minZ) {
        position.z = minZ
        if (velocity.z < 0) velocity.z = 0
    } else if (position.z > maxZ) {
        position.z = maxZ
        if (velocity.z > 0) velocity.z = 0
    }
}
