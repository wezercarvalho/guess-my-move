/**
 * Detector de pinça (polegar e indicador juntos) a partir dos 21 landmarks da
 * mão. Função pura, sem DOM e sem dependência do MediaPipe.
 */

/** Ponto normalizado (0 a 1) de um landmark; compatível com os do MediaPipe. */
export interface Point {
    x: number
    y: number
}

const LANDMARK_COUNT = 21
const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_FINGER_MCP = 9

/** Limiares da histerese, como razão entre a abertura da pinça e a escala da mão. */
export interface PinchConfig {
    /** Fecha com razão menor ou igual a este valor. */
    closeRatio: number
    /** Abre com razão maior ou igual a este valor. */
    openRatio: number
}

/** Palpites a calibrar com uso real. */
export const DEFAULT_PINCH: PinchConfig = { closeRatio: 0.35, openRatio: 0.55 }

/** Leitura da pinça em um quadro. */
export interface PinchReading {
    handVisible: boolean
    closed: boolean
    /** Distância entre as pontas dividida pela escala da mão; `null` sem mão. */
    ratio: number | null
    /** Ponto médio das pontas, normalizado (0 a 1) e espelhado em x; `null` sem mão. */
    point: Point | null
}

export interface PinchDetector {
    /** `aspect` é largura/altura da imagem. `null` ou pontos inválidos contam como mão ausente. */
    update(landmarks: readonly Point[] | null, aspect: number): PinchReading
    reset(): void
}

/**
 * Razão entre a distância das pontas do polegar e do indicador e a escala da
 * mão (pulso até a base do dedo médio). Independe da distância à câmera.
 * Devolve `null` sem os 21 pontos, com escala degenerada ou proporção inválida.
 */
export function pinchRatio(landmarks: readonly Point[], aspect: number): number | null {
    if (landmarks.length < LANDMARK_COUNT || !Number.isFinite(aspect) || aspect <= 0) return null
    const wrist = landmarks[WRIST]
    const middle = landmarks[MIDDLE_FINGER_MCP]
    const thumb = landmarks[THUMB_TIP]
    const index = landmarks[INDEX_TIP]
    if (!wrist || !middle || !thumb || !index) return null

    const distance = (a: Point, b: Point) => Math.hypot((a.x - b.x) * aspect, a.y - b.y)
    const scale = distance(wrist, middle)
    if (!(scale > 1e-6)) return null
    const ratio = distance(thumb, index) / scale
    return Number.isFinite(ratio) ? ratio : null
}

/** Cria o detector, que guarda só o estado da histerese (fechada ou aberta). */
export function createPinchDetector(config: Partial<PinchConfig> = {}): PinchDetector {
    const { closeRatio, openRatio } = { ...DEFAULT_PINCH, ...config }
    let closed = false

    return {
        update(landmarks, aspect) {
            const ratio = landmarks ? pinchRatio(landmarks, aspect) : null
            const thumb = landmarks?.[THUMB_TIP]
            const index = landmarks?.[INDEX_TIP]
            if (ratio === null || !thumb || !index) {
                closed = false
                return { handVisible: false, closed: false, ratio: null, point: null }
            }
            if (closed) {
                if (ratio >= openRatio) closed = false
            } else if (ratio <= closeRatio) {
                closed = true
            }
            return {
                handVisible: true,
                closed,
                ratio,
                point: { x: 1 - (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
            }
        },
        reset() {
            closed = false
        },
    }
}
