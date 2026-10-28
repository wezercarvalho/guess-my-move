import { type CityIndex } from './cityIndex.js'
import { type Vec3, forwardFromAngles } from './vec.js'

/** Parâmetros da mira assistida da teia. */
export interface WebConfig {
    /** Alcance da teia, em metros. */
    range: number
    /** Subidas, em radianos, somadas à inclinação da câmera; tentadas nesta ordem. */
    pitchOffsets: readonly number[]
    /** O ponto de ancoragem precisa estar pelo menos isto acima do jogador, em metros. */
    minRise: number
    /** O ponto precisa estar pelo menos isto longe na horizontal, em metros. */
    minHorizontal: number
}

const degrees = (value: number) => (value * Math.PI) / 180

export const DEFAULT_WEB: WebConfig = {
    range: 140,
    pitchOffsets: [degrees(35), degrees(20), degrees(8)],
    minRise: 25,
    minHorizontal: 30,
}

/** Inclinação máxima de um raio, para não apontar além do zênite. */
const MAX_RAY_PITCH = degrees(85)

/**
 * Escolhe onde a teia prende. Lança até três raios a partir do olho, cada um mais
 * inclinado para cima que a câmera, e fica com o primeiro que acerta um prédio alto e
 * longe o bastante. Devolve `null` quando a teia erra.
 */
export function pickAnchor(
    index: CityIndex,
    eye: Vec3,
    yaw: number,
    pitch: number,
    config: WebConfig = DEFAULT_WEB,
): Vec3 | null {
    for (const offset of config.pitchOffsets) {
        const direction = forwardFromAngles(yaw, Math.min(pitch + offset, MAX_RAY_PITCH))
        const hit = index.raycast(eye, direction, config.range)
        if (!hit) continue
        const rise = hit.point.y - eye.y
        const horizontal = Math.hypot(hit.point.x - eye.x, hit.point.z - eye.z)
        if (rise >= config.minRise && horizontal >= config.minHorizontal) return hit.point
    }
    return null
}
