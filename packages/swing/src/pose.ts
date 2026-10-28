import { type HandPoint } from './steering.js'
import { type TriggerGesture } from './trigger.js'

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

const distance = (a: HandPoint, b: HandPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Pose de lançar teia (polegar, indicador e mindinho abertos; médio e anelar dobrados),
 * medida só por distâncias entre landmarks. Por isso vale com a mão em qualquer
 * orientação e em qualquer das duas mãos. Landmarks incompletos nunca contam.
 */
export function isWebPose(landmarks: readonly HandPoint[]): boolean {
    if (landmarks.length < 21) return false
    const wrist = landmarks[WRIST]
    const thumbTip = landmarks[THUMB_TIP]
    const indexMcp = landmarks[INDEX.mcp]
    const middleMcp = landmarks[MIDDLE.mcp]
    if (!wrist || !thumbTip || !indexMcp || !middleMcp) return false
    const palm = distance(wrist, middleMcp)
    if (palm <= 0) return false

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
    if (index === null || middle === null || ring === null || pinky === null) return false

    return (
        index >= EXTENDED_RATIO &&
        pinky >= EXTENDED_RATIO &&
        middle <= CURLED_RATIO &&
        ring <= CURLED_RATIO &&
        distance(thumbTip, indexMcp) / palm >= THUMB_OUT
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
 * Gesto de teia de uma mão: a pose medida pelos landmarks vale como `ILoveYou` com
 * pontuação máxima; sem a pose, vale o rótulo do reconhecedor, se houver.
 */
export function webSignal(
    landmarks: readonly HandPoint[],
    gesture: TriggerGesture | null | undefined,
): TriggerGesture | null {
    if (isWebPose(landmarks)) return { name: 'ILoveYou', score: 1 }
    return gesture ?? null
}
