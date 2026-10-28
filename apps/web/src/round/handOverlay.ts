import { type HandLandmark } from '@guess-my-move/core'

/** Conexões entre os 21 landmarks da mão (esqueleto do MediaPipe). */
export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
]

/** Retângulo do vídeo dentro da caixa quando exibido com `object-fit: contain`. */
export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

/** Área ocupada por um vídeo de `videoWidth` x `videoHeight` numa caixa, centralizado. */
export function containRect(
    boxWidth: number,
    boxHeight: number,
    videoWidth: number,
    videoHeight: number,
): Rect {
    if (videoWidth <= 0 || videoHeight <= 0) {
        return { x: 0, y: 0, width: boxWidth, height: boxHeight }
    }
    const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight)
    const width = videoWidth * scale
    const height = videoHeight * scale
    return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height }
}

/**
 * Desenha o esqueleto da mão sobre o vídeo, só para depuração local. O canvas é
 * dimensionado ao tamanho exibido do vídeo e as coordenadas normalizadas são
 * mapeadas para a área do vídeo; o espelhamento fica por conta do CSS, que é o
 * mesmo do `<video>`. Sem mão (`null`), apenas limpa. Nada é gravado nem enviado.
 */
export function drawHand(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    landmarks: readonly HandLandmark[] | null,
): void {
    drawHands(canvas, video, landmarks ? [landmarks] : [])
}

/** Como `drawHand`, mas com várias mãos no mesmo quadro (sem mão, só limpa). */
export function drawHands(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    hands: readonly (readonly HandLandmark[])[],
): void {
    const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const width = Math.round(video.clientWidth * ratio)
    const height = Math.round(video.clientHeight * ratio)
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)

    const area = containRect(canvas.width, canvas.height, video.videoWidth, video.videoHeight)
    const point = (landmark: HandLandmark) => ({
        x: area.x + landmark.x * area.width,
        y: area.y + landmark.y * area.height,
    })

    for (const landmarks of hands) {
        context.lineWidth = 2 * ratio
        context.strokeStyle = '#4f9cff'
        for (const [from, to] of HAND_CONNECTIONS) {
            const a = landmarks[from]
            const b = landmarks[to]
            if (!a || !b) continue
            const start = point(a)
            const end = point(b)
            context.beginPath()
            context.moveTo(start.x, start.y)
            context.lineTo(end.x, end.y)
            context.stroke()
        }

        context.fillStyle = '#2ecc71'
        for (const landmark of landmarks) {
            const { x, y } = point(landmark)
            context.beginPath()
            context.arc(x, y, 3 * ratio, 0, Math.PI * 2)
            context.fill()
        }
    }
}
