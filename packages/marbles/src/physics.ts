/**
 * Física 2D arcade de círculos para o jogo de bolinhas de gude. Funções puras,
 * sem DOM e sem relógio: cada chamada avança um passo fixo e devolve corpos novos.
 */

/** Ponto ou vetor 2D, em unidades do campo. */
export interface Vec {
    x: number
    y: number
}

/** Bolinha: posição do centro, velocidade (unid/s) e raio. */
export interface Body {
    pos: Vec
    vel: Vec
    radius: number
}

/** Parâmetros da física; os valores padrão são palpites a calibrar com uso real. */
export interface PhysicsConfig {
    /** Largura e altura do campo, em unidades. */
    width: number
    height: number
    /** Desaceleração constante (unid/s²). */
    friction: number
    /** Abaixo desta velocidade (unid/s) a bolinha para por completo. */
    stopSpeed: number
    wallRestitution: number
    marbleRestitution: number
    /** Duração de um passo, em segundos. */
    fixedStep: number
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
    width: 800,
    height: 600,
    friction: 400,
    stopSpeed: 8,
    wallRestitution: 0.8,
    marbleRestitution: 1,
    fixedStep: 1 / 120,
}

/** Resultado de um passo: corpos novos e os pares `[i, j]` (i < j) em contato. */
export interface StepResult {
    bodies: Body[]
    contacts: (readonly [number, number])[]
}

const speedOf = (body: Body) => Math.hypot(body.vel.x, body.vel.y)

/** `true` quando nenhuma bolinha está mais rápida que o limiar de parada. */
export function isAtRest(
    bodies: readonly Body[],
    config: PhysicsConfig = DEFAULT_PHYSICS,
): boolean {
    return bodies.every((body) => speedOf(body) < config.stopSpeed)
}

/** Atrito, integração e paredes para um corpo; devolve um corpo novo. */
function moveBody(body: Body, config: PhysicsConfig): Body {
    const dt = config.fixedStep
    let { x: vx, y: vy } = body.vel
    const speed = Math.hypot(vx, vy)
    if (config.friction > 0 && speed > 0) {
        const reduced = speed - config.friction * dt
        if (reduced < config.stopSpeed) {
            vx = 0
            vy = 0
        } else {
            const k = reduced / speed
            vx *= k
            vy *= k
        }
    }

    let x = body.pos.x + vx * dt
    let y = body.pos.y + vy * dt
    const r = body.radius
    if (x - r < 0) {
        x = r
        if (vx < 0) vx = -vx * config.wallRestitution
    } else if (x + r > config.width) {
        x = config.width - r
        if (vx > 0) vx = -vx * config.wallRestitution
    }
    if (y - r < 0) {
        y = r
        if (vy < 0) vy = -vy * config.wallRestitution
    } else if (y + r > config.height) {
        y = config.height - r
        if (vy > 0) vy = -vy * config.wallRestitution
    }
    return { pos: { x, y }, vel: { x: vx, y: vy }, radius: r }
}

/**
 * Avança um passo fixo (`config.fixedStep`): atrito, movimento, paredes e
 * colisões elásticas entre bolinhas de massas iguais. Não altera a entrada.
 */
export function stepBodies(
    bodies: readonly Body[],
    config: PhysicsConfig = DEFAULT_PHYSICS,
): StepResult {
    const next = bodies.map((body) => moveBody(body, config))
    const contacts: (readonly [number, number])[] = []

    for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
            const a = next[i]
            const b = next[j]
            const dx = b.pos.x - a.pos.x
            const dy = b.pos.y - a.pos.y
            const dist = Math.hypot(dx, dy)
            const minDist = a.radius + b.radius
            if (dist > minDist) continue
            contacts.push([i, j])

            const nx = dist > 0 ? dx / dist : 1
            const ny = dist > 0 ? dy / dist : 0
            const approach = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny
            if (approach > 0) {
                const impulse = ((1 + config.marbleRestitution) * approach) / 2
                a.vel = { x: a.vel.x - impulse * nx, y: a.vel.y - impulse * ny }
                b.vel = { x: b.vel.x + impulse * nx, y: b.vel.y + impulse * ny }
            }
            if (dist < minDist) {
                const push = (minDist - dist) / 2
                a.pos = { x: a.pos.x - push * nx, y: a.pos.y - push * ny }
                b.pos = { x: b.pos.x + push * nx, y: b.pos.y + push * ny }
            }
        }
    }

    for (const body of next) {
        const r = body.radius
        body.pos = {
            x: Math.min(Math.max(body.pos.x, r), config.width - r),
            y: Math.min(Math.max(body.pos.y, r), config.height - r),
        }
    }
    return { bodies: next, contacts }
}
