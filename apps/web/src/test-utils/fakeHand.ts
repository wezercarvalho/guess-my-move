import { type TrackedHand } from '../tracker/handTracker.js'

/** Proporção da imagem simulada (640 x 480). */
export const FAKE_ASPECT = 640 / 480

/** Campo do bete, em unidades (igual ao padrão do pacote marbles). */
const FIELD = { width: 800, height: 600 }

/**
 * Mão simulada com 21 landmarks: a escala (pulso até a base do dedo médio) vale
 * 0,2 e a pinça tem a razão pedida. O ponto da pinça cai em (`x`, `y`) do campo,
 * já considerando o espelhamento horizontal que o detector aplica.
 */
export function pinchHand(options: { ratio: number; x: number; y: number }): TrackedHand {
    const { ratio, x, y } = options
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[0] = { x: 0.5, y: 0.8 }
    points[9] = { x: 0.5, y: 0.6 }
    const centerX = 1 - x / FIELD.width
    const centerY = y / FIELD.height
    const gap = (ratio * 0.2) / FAKE_ASPECT
    points[4] = { x: centerX - gap / 2, y: centerY }
    points[8] = { x: centerX + gap / 2, y: centerY }
    return { landmarks: points }
}

export const OPEN_RATIO = 0.8
export const CLOSED_RATIO = 0.2
