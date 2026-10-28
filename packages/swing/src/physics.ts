import { type CityIndex } from './cityIndex.js'
import { type Vec3, forwardFromAngles } from './vec.js'
import { DEFAULT_WEB, type WebConfig } from './web.js'

const degrees = (value: number) => (value * Math.PI) / 180

/** Valores de jogo (não são realistas): ajustados para o balanço ficar rápido e legível. */
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
    restitution: 0.3,
    groundBlend: 6,
    runSpeed: 8,
    boundsMargin: 2,
    yawRate: degrees(90),
    pitchRate: degrees(60),
    pitchLimit: degrees(60),
    web: DEFAULT_WEB,
    step: 1 / 120,
    maxFrame: 0.05,
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

/** A teia presa: ponto de ancoragem e comprimento atual da corda. */
export interface ActiveWeb {
    anchor: Vec3
    length: number
}

export interface SwingState {
    position: Vec3
    velocity: Vec3
    yaw: number
    pitch: number
    web: ActiveWeb | null
    /** Em pé no chão ou num telhado no último passo. */
    grounded: boolean
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
        web: null,
        grounded: false,
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
 * limites do mapa. Altera `state` no lugar.
 */
export function stepPlayer(
    index: CityIndex,
    state: SwingState,
    dt: number,
    config: SwingConfig = DEFAULT_SWING,
): StepEvents {
    const { position, velocity } = state
    const before = { x: position.x, z: position.z }

    if (state.web) state.web.length = Math.max(config.minRope, state.web.length - config.reelSpeed * dt)

    velocity.y -= config.gravity * dt
    if (state.grounded) {
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

    if (state.web) {
        const { anchor, length } = state.web
        const dx = position.x - anchor.x
        const dy = position.y - anchor.y
        const dz = position.z - anchor.z
        const distance = Math.hypot(dx, dy, dz)
        if (distance > length) {
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
            wallHit = true
            state.web = null
        }
    }

    if (position.y < config.eyeHeight) {
        position.y = config.eyeHeight
        if (velocity.y < 0) velocity.y = 0
        state.grounded = true
    }

    const { bounds } = index.city
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

    state.stats.distance += Math.hypot(position.x - before.x, position.z - before.z)
    state.stats.topSpeed = Math.max(
        state.stats.topSpeed,
        Math.hypot(velocity.x, velocity.y, velocity.z),
    )
    return { wallHit }
}
