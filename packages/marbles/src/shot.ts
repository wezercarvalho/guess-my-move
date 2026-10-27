import { type Vec } from './physics.js'

/** Parâmetros do tiro; os valores padrão são palpites a calibrar com uso real. */
export interface ShotConfig {
    /** Velocidade (unid/s) por unidade de arrasto. */
    gain: number
    /** Arrasto máximo considerado, em unidades do campo. */
    maxPull: number
    /** Arrasto mínimo; abaixo dele o tiro é cancelado. */
    minPull: number
}

export const DEFAULT_SHOT: ShotConfig = { gain: 5, maxPull: 220, minPull: 30 }

/** Tiro calculado a partir do arrasto. */
export interface Shot {
    velocity: Vec
    /** Arrasto efetivo, já limitado a `maxPull`. */
    pull: number
    /** Força relativa, de 0 a 1. */
    power: number
}

/**
 * Tiro de estilingue: a direção vai do ponto da pinça para a bolinha e a
 * velocidade é o ganho vezes o arrasto limitado. Devolve `null` quando o
 * arrasto é menor que o mínimo (tiro cancelado).
 */
export function computeShot(
    marble: Vec,
    pinch: Vec,
    config: Partial<ShotConfig> = {},
): Shot | null {
    const { gain, maxPull, minPull } = { ...DEFAULT_SHOT, ...config }
    const dx = marble.x - pinch.x
    const dy = marble.y - pinch.y
    const length = Math.hypot(dx, dy)
    if (!(length >= minPull) || !(length > 0)) return null

    const pull = Math.min(length, maxPull)
    const speed = gain * pull
    return {
        velocity: { x: (dx / length) * speed, y: (dy / length) * speed },
        pull,
        power: pull / maxPull,
    }
}
