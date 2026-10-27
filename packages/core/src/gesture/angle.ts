/**
 * Ângulo da mão a partir dos 21 landmarks do MediaPipe Hand Landmarker.
 * Função pura, sem DOM e sem dependência do MediaPipe.
 */

/** Índice do pulso nos 21 landmarks da mão. */
const WRIST = 0
/** Índice do início do dedo médio (MCP) nos 21 landmarks da mão. */
const MIDDLE_FINGER_MCP = 9

/** Ponto normalizado (0 a 1) de um landmark. */
export interface HandLandmark {
    x: number
    y: number
}

/**
 * Ângulo, em graus, do vetor do pulso ao início do dedo médio: 0 com a mão
 * apontando para cima, positivo quando inclina para a direita da imagem,
 * negativo para a esquerda, ±180 apontando para baixo.
 *
 * Os landmarks são normalizados por largura e altura da imagem; `aspect`
 * (largura/altura) devolve o deslocamento horizontal a uma escala comparável à
 * vertical, para o ângulo não depender da proporção da câmera. Devolve `null`
 * quando faltam pontos, `aspect` é inválido ou o vetor é degenerado.
 */
export function handAngleDeg(
    landmarks: readonly HandLandmark[],
    aspect: number,
): number | null {
    const wrist = landmarks[WRIST]
    const middle = landmarks[MIDDLE_FINGER_MCP]
    if (wrist === undefined || middle === undefined) return null
    if (!Number.isFinite(aspect) || aspect <= 0) return null

    const dx = (middle.x - wrist.x) * aspect
    const up = wrist.y - middle.y
    if (!Number.isFinite(dx) || !Number.isFinite(up)) return null
    if (Math.hypot(dx, up) < 1e-6) return null

    return (Math.atan2(dx, up) * 180) / Math.PI
}
