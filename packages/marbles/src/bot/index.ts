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
    desvioAngular: number
    /** Desvio de força (desvio-padrão, fração da velocidade ideal) multiplicando a velocidade. */
    desvioForca: number
    /** Teto de velocidade do tiro: `gain · maxPull` do jogador. */
    shot: ShotConfig
}

/**
 * Nível único. desvioAngular ~3,2° e desvioForca ~9% calibrados por busca para
 * cair na faixa de 30% a 60% de acerto a 400 unidades (raio 14), ficando perto
 * do meio (~50%). Palpites a calibrar com uso real; a faixa é proteção de
 * regressão, não equilíbrio medido.
 */
export const DEFAULT_BOT: BotConfig = {
    desvioAngular: 0.055,
    desvioForca: 0.09,
    shot: DEFAULT_SHOT,
}

/** Direção unitária da origem para o ponto. */
export function direcaoPara(origem: Vec2, ponto: Vec2): Vec2 {
    const dx = ponto.x - origem.x
    const dy = ponto.y - origem.y
    const len = Math.hypot(dx, dy)
    if (!(len > 0)) return { x: 1, y: 0 }
    return { x: dx / len, y: dy / len }
}

/** Resultado da simulação de uma bolinha única: onde parou e se encostou numa parede. */
interface Parada {
    pos: Vec2
    bateuNaParede: boolean
}

/** Simula uma bolinha única e devolve onde parou e se tocou alguma parede no caminho. */
function pararEm(origem: Vec2, velocidade: Vec2, physics: PhysicsConfig, raio: number): Parada {
    let campo: Body[] = [{ pos: { ...origem }, vel: { ...velocidade }, radius: raio }]
    let bateuNaParede = false
    let passos = 0
    while (!isAtRest(campo, physics) && passos < 20_000) {
        campo = stepBodies(campo, physics).bodies
        const { x, y } = campo[0].pos
        if (x - raio <= 0 || x + raio >= physics.width || y - raio <= 0 || y + raio >= physics.height) {
            bateuNaParede = true
        }
        passos++
    }
    return { pos: campo[0].pos, bateuNaParede }
}

/**
 * Velocidade para a bolinha parar no ponto, por busca binária sobre a rapidez
 * na direção origem→ponto, medindo o repouso com `stepBodies` (trajetória
 * livre, sem parede). A distância de parada cresce monotonicamente com a
 * rapidez SÓ enquanto a bolinha não toca a parede; por isso um toque na parede
 * é tratado como "rápido demais" (limite superior), mantendo a busca no regime
 * livre. O teto da busca NÃO é o teto do tiro do bot (esse é aplicado em
 * `planejarTiro`): esta é a ferramenta de pontaria pura.
 */
export function velocidadeParaParar(
    origem: Vec2,
    ponto: Vec2,
    physics: PhysicsConfig = DEFAULT_PHYSICS,
    raio = 14,
    tetoBusca = 4000,
): Vec2 {
    const dir = direcaoPara(origem, ponto)
    const alvoDist = Math.hypot(ponto.x - origem.x, ponto.y - origem.y)

    let baixo = 0
    let alto = tetoBusca
    for (let i = 0; i < 48; i++) {
        const meio = (baixo + alto) / 2
        const { pos, bateuNaParede } = pararEm(origem, { x: dir.x * meio, y: dir.y * meio }, physics, raio)
        const distancia = Math.hypot(pos.x - origem.x, pos.y - origem.y)
        if (!bateuNaParede && distancia < alvoDist) baixo = meio
        else alto = meio
    }
    const rapidez = (baixo + alto) / 2
    return { x: dir.x * rapidez, y: dir.y * rapidez }
}

/** PRNG mulberry32: determinístico, bom o bastante para o erro do bot. */
function mulberry32(semente: number): () => number {
    let a = semente >>> 0
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

export interface PlanejadorDoBot {
    /** Devolve o tiro para o ponto, com o erro da semente; limita a velocidade ao teto. */
    planejarTiro(origem: Vec2, ponto: Vec2, semente: number, physics?: PhysicsConfig, raio?: number): Vec2
}

/** Cria o planejador para um nível. */
export function criarPlanejadorDoBot(config: BotConfig = DEFAULT_BOT): PlanejadorDoBot {
    const teto = config.shot.gain * config.shot.maxPull
    return {
        planejarTiro(origem, ponto, semente, physics = DEFAULT_PHYSICS, raio = 14): Vec2 {
            const ideal = velocidadeParaParar(origem, ponto, physics, raio)
            const rand = mulberry32(semente)
            const rapidezIdeal = Math.hypot(ideal.x, ideal.y)
            const angIdeal = Math.atan2(ideal.y, ideal.x)
            const ang = angIdeal + normal(rand) * config.desvioAngular
            const fator = 1 + normal(rand) * config.desvioForca
            const rapidez = Math.min(Math.max(rapidezIdeal * fator, 0), teto)
            return { x: Math.cos(ang) * rapidez, y: Math.sin(ang) * rapidez }
        },
    }
}
