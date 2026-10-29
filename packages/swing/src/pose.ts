import { type TriggerGesture } from './trigger.js'

/** Ponto de um landmark do MediaPipe; `z` é a profundidade relativa ao pulso, quando existe. */
export interface HandPoint {
    x: number
    y: number
    z?: number
}

/** Landmarks do MediaPipe: pulso, polegar, e (base, junta, ponta) de cada dedo. */
const WRIST = 0
const THUMB_TIP = 4
const INDEX = { mcp: 5, tip: 8 } as const
const MIDDLE = { mcp: 9, tip: 12 } as const
const RING = { mcp: 13, tip: 16 } as const
const PINKY = { mcp: 17, tip: 20 } as const

/** Dedo esticado: a ponta está bem mais longe do pulso que a base. Dobrado: perto da base. */
const EXTENDED_RATIO = 1.5
const CURLED_RATIO = 1.3
/** Polegar aberto: a ponta se afasta da base do indicador, em frações do tamanho da palma. */
const THUMB_OUT = 0.6

/**
 * Distância entre dois landmarks. Com a profundidade (`z`), um dedo apontado para a câmera
 * continua contando como esticado, o que a distância só no plano da imagem não consegue.
 */
const distance = (a: HandPoint, b: HandPoint) =>
    Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

/**
 * Medidas da mão, todas por distâncias entre landmarks (valem em qualquer orientação e em
 * qualquer das duas mãos): o alcance de cada dedo (ponta do dedo ao pulso, dividida pela
 * base do dedo ao pulso; esticado passa de 1,5, dobrado fica abaixo de 1,3) e o quanto o
 * polegar se afasta da base do indicador, em frações da palma.
 */
export interface HandMetrics {
    index: number
    middle: number
    ring: number
    pinky: number
    thumb: number
}

/** Medidas da mão; `null` com landmarks incompletos ou degenerados. */
export function handMetrics(landmarks: readonly HandPoint[]): HandMetrics | null {
    if (landmarks.length < 21) return null
    const wrist = landmarks[WRIST]
    const thumbTip = landmarks[THUMB_TIP]
    const indexMcp = landmarks[INDEX.mcp]
    const middleMcp = landmarks[MIDDLE.mcp]
    if (!wrist || !thumbTip || !indexMcp || !middleMcp) return null
    const palm = distance(wrist, middleMcp)
    if (palm <= 0) return null

    const reach = (finger: { mcp: number; tip: number }): number | null => {
        const mcp = landmarks[finger.mcp]
        const tip = landmarks[finger.tip]
        if (!mcp || !tip) return null
        const base = distance(wrist, mcp)
        return base > 0 ? distance(wrist, tip) / base : null
    }
    const index = reach(INDEX)
    const middle = reach(MIDDLE)
    const ring = reach(RING)
    const pinky = reach(PINKY)
    if (index === null || middle === null || ring === null || pinky === null) return null
    return { index, middle, ring, pinky, thumb: distance(thumbTip, indexMcp) / palm }
}

/**
 * Pose de lançar teia (polegar, indicador e mindinho abertos; médio e anelar dobrados).
 * Landmarks incompletos nunca contam.
 */
export function isWebPose(landmarks: readonly HandPoint[]): boolean {
    const m = handMetrics(landmarks)
    return (
        m !== null &&
        m.index >= EXTENDED_RATIO &&
        m.pinky >= EXTENDED_RATIO &&
        m.middle <= CURLED_RATIO &&
        m.ring <= CURLED_RATIO &&
        m.thumb >= THUMB_OUT
    )
}

/** Palma aberta: os quatro dedos esticados. Solta a teia. */
export function isOpenPalm(landmarks: readonly HandPoint[]): boolean {
    const m = handMetrics(landmarks)
    return (
        m !== null &&
        m.index >= EXTENDED_RATIO &&
        m.middle >= EXTENDED_RATIO &&
        m.ring >= EXTENDED_RATIO &&
        m.pinky >= EXTENDED_RATIO
    )
}

/** Punho fechado: os quatro dedos dobrados. Com a teia presa, puxa. */
export function isFist(landmarks: readonly HandPoint[]): boolean {
    const m = handMetrics(landmarks)
    return (
        m !== null &&
        m.index <= CURLED_RATIO &&
        m.middle <= CURLED_RATIO &&
        m.ring <= CURLED_RATIO &&
        m.pinky <= CURLED_RATIO
    )
}

const PALM_POINTS = [0, 5, 9, 13, 17] as const

/**
 * Lado da tela espelhada em que a mão aparece. A imagem da câmera é invertida, então a
 * mão com x pequeno aparece à direita.
 */
export function handSide(landmarks: readonly HandPoint[]): 'left' | 'right' {
    let x = 0
    let count = 0
    for (const index of PALM_POINTS) {
        const point = landmarks[index]
        if (!point) continue
        x += point.x
        count++
    }
    const mirrored = count === 0 ? 0.5 : 1 - x / count
    return mirrored < 0.5 ? 'left' : 'right'
}

/**
 * Gesto de uma mão para o jogo. A geometria decide primeiro e vale com pontuação máxima:
 * a pose de teia vira `ILoveYou`, a palma aberta `Open_Palm` e o punho `Closed_Fist`. Fora
 * delas vale o rótulo do reconhecedor, salvo `Open_Palm`: só a geometria solta a teia, para
 * um rótulo errado numa pose de lado não soltar a teia sem querer.
 */
export function webSignal(
    landmarks: readonly HandPoint[],
    gesture: TriggerGesture | null | undefined,
): TriggerGesture | null {
    if (isWebPose(landmarks)) return { name: 'ILoveYou', score: 1 }
    if (isOpenPalm(landmarks)) return { name: 'Open_Palm', score: 1 }
    if (isFist(landmarks)) return { name: 'Closed_Fist', score: 1 }
    if (!gesture || gesture.name === 'Open_Palm') return null
    return gesture
}
