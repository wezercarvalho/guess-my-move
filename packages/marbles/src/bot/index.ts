/**
 * Planejador de pontaria do bot, puro e determinístico. Dado um ponto de
 * chegada e o estado do campo, devolve um tiro (vetor de velocidade) com erro
 * controlado por semente. A velocidade para parar num ponto é encontrada por
 * BUSCA com `stepBodies` (simulação), não pela fórmula contínua: a física zera
 * a velocidade abaixo de `stopSpeed` num degrau que a fórmula contínua ignora.
 * O planejador não importa o motor; atende à interface de fonte do tiro do #87.
 */
import { type Body, DEFAULT_PHYSICS, type PhysicsConfig, isAtRest, stepBodies } from '../physics.js'
import { DEFAULT_SHOT, type ShotConfig } from '../shot.js'

export interface Vec2 {
    x: number
    y: number
}

/**
 * Nível do bot. Os valores padrão são PALPITES INICIAIS a calibrar com uso
 * real; a faixa de acerto do teste é proteção de regressão, não equilíbrio
 * medido. Sem seletor de dificuldade nesta entrega.
 */
export interface BotConfig {
    /** Desvio angular (desvio-padrão, radianos) somado à direção do tiro. */
    angularDeviation: number
    /** Desvio de força (desvio-padrão, fração da velocidade ideal) multiplicando a velocidade. */
    powerDeviation: number
    /** Teto de velocidade do tiro: `gain · maxPull` do jogador. */
    shot: ShotConfig
}

/**
 * Nível único. angularDeviation ~3,2° e powerDeviation ~9% calibrados por busca
 * para cair na faixa de 30% a 60% de acerto a 400 unidades (raio 14), ficando
 * perto do meio (~50%). Palpites a calibrar com uso real; a faixa é proteção de
 * regressão, não equilíbrio medido.
 */
export const DEFAULT_BOT: BotConfig = {
    angularDeviation: 0.055,
    powerDeviation: 0.09,
    shot: DEFAULT_SHOT,
}

/** Direção unitária da origem para o ponto. */
export function directionTo(origin: Vec2, point: Vec2): Vec2 {
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const len = Math.hypot(dx, dy)
    if (!(len > 0)) return { x: 1, y: 0 }
    return { x: dx / len, y: dy / len }
}

/** Resultado da simulação de uma bolinha única: onde parou e se encostou numa parede. */
interface Stop {
    pos: Vec2
    hitWall: boolean
}

/** Simula uma bolinha única e devolve onde parou e se tocou alguma parede no caminho. */
function stopAt(origin: Vec2, velocity: Vec2, physics: PhysicsConfig, radius: number): Stop {
    let field: Body[] = [{ pos: { ...origin }, vel: { ...velocity }, radius }]
    let hitWall = false
    let steps = 0
    while (!isAtRest(field, physics) && steps < 20_000) {
        field = stepBodies(field, physics).bodies
        const { x, y } = field[0].pos
        if (x - radius <= 0 || x + radius >= physics.width || y - radius <= 0 || y + radius >= physics.height) {
            hitWall = true
        }
        steps++
    }
    return { pos: field[0].pos, hitWall }
}

/**
 * Velocidade para a bolinha parar no ponto, por busca binária sobre a rapidez
 * na direção origem→ponto, medindo o repouso com `stepBodies` (trajetória
 * livre, sem parede). A distância de parada cresce monotonicamente com a
 * rapidez SÓ enquanto a bolinha não toca a parede; por isso um toque na parede
 * é tratado como "rápido demais" (limite superior), mantendo a busca no regime
 * livre. O teto da busca NÃO é o teto do tiro do bot (esse é aplicado em
 * `planShot`): esta é a ferramenta de pontaria pura.
 */
export function speedToStop(
    origin: Vec2,
    point: Vec2,
    physics: PhysicsConfig = DEFAULT_PHYSICS,
    radius = 14,
    searchCeiling = 4000,
): Vec2 {
    const dir = directionTo(origin, point)
    const targetDist = Math.hypot(point.x - origin.x, point.y - origin.y)

    let low = 0
    let high = searchCeiling
    for (let i = 0; i < 48; i++) {
        const mid = (low + high) / 2
        const { pos, hitWall } = stopAt(origin, { x: dir.x * mid, y: dir.y * mid }, physics, radius)
        const distance = Math.hypot(pos.x - origin.x, pos.y - origin.y)
        if (!hitWall && distance < targetDist) low = mid
        else high = mid
    }
    const speed = (low + high) / 2
    return { x: dir.x * speed, y: dir.y * speed }
}

/** PRNG mulberry32: determinístico, bom o bastante para o erro do bot. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Amostra normal padrão (Box–Muller) a partir de dois uniformes. */
function normal(rand: () => number): number {
    const u = Math.max(rand(), 1e-12)
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export interface BotPlanner {
    /** Devolve o tiro para o ponto, com o erro da semente; limita a velocidade ao teto. */
    planShot(origin: Vec2, point: Vec2, seed: number, physics?: PhysicsConfig, radius?: number): Vec2
}

/** Cria o planejador para um nível. */
export function createBotPlanner(config: BotConfig = DEFAULT_BOT): BotPlanner {
    const ceiling = config.shot.gain * config.shot.maxPull
    return {
        planShot(origin, point, seed, physics = DEFAULT_PHYSICS, radius = 14): Vec2 {
            const ideal = speedToStop(origin, point, physics, radius)
            const rand = mulberry32(seed)
            const idealSpeed = Math.hypot(ideal.x, ideal.y)
            const idealAngle = Math.atan2(ideal.y, ideal.x)
            const angle = idealAngle + normal(rand) * config.angularDeviation
            const factor = 1 + normal(rand) * config.powerDeviation
            const speed = Math.min(Math.max(idealSpeed * factor, 0), ceiling)
            return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
        },
    }
}
