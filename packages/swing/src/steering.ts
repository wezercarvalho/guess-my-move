/** Ponto normalizado (0 a 1) da imagem da câmera, como os landmarks do MediaPipe. */
export interface HandPoint {
    x: number
    y: number
}

/** Taxas de giro de -1 a 1: guinada positiva vira à direita, inclinação positiva olha para cima. */
export interface LookRates {
    yawRate: number
    pitchRate: number
}

/** Zona morta e saturação, em fração da imagem, medidas a partir do centro. */
const DEAD_ZONE = 0.1
const SATURATION = 0.35

/** Pulso e bases dos dedos: o centro da palma não muda quando os dedos abrem ou fecham. */
const PALM_POINTS = [0, 5, 9, 13, 17] as const

function axis(offset: number): number {
    const size = Math.abs(offset)
    if (size <= DEAD_ZONE) return 0
    const level = Math.min(1, (size - DEAD_ZONE) / (SATURATION - DEAD_ZONE))
    return offset < 0 ? -level : level
}

/**
 * Direção pela posição da palma, como um joystick: o deslocamento em relação ao centro
 * da imagem vira a taxa de giro. O eixo x é espelhado (a imagem da câmera é invertida).
 * Sem mão, ou com a mão incompleta, a direção se mantém.
 */
export function steerFromHand(landmarks: readonly HandPoint[] | null): LookRates {
    const palm = landmarks ? PALM_POINTS.map((i) => landmarks[i]) : []
    if (palm.length === 0 || palm.some((point) => point === undefined)) {
        return { yawRate: 0, pitchRate: 0 }
    }
    let x = 0
    let y = 0
    for (const point of palm) {
        x += point?.x ?? 0
        y += point?.y ?? 0
    }
    x /= palm.length
    y /= palm.length
    return { yawRate: axis(0.5 - x), pitchRate: axis(0.5 - y) }
}
