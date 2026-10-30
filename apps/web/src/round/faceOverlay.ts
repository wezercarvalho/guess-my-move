import { type FaceLandmark, type HeadOrientation } from '@guess-my-move/swing'

import { containRect } from './handOverlay.js'

/**
 * Subconjunto leve e esparso de pontos do FaceMesh do MediaPipe (468 pontos) que, juntos,
 * esboçam o rosto sem desenhar a malha inteira: contorno, olhos, sobrancelhas, nariz e boca.
 * Os índices são da topologia fixa do FaceMesh; usar um subconjunto evita depender das
 * tabelas de conexão grandes do `@mediapipe/tasks-vision` e mantém o desenho testável.
 * Os pontos são desenhados de forma TRANSITÓRIA e nunca gravados, persistidos ou logados.
 */
export const FACE_POINT_INDICES: readonly number[] = [
    // Contorno do rosto (oval), esparso.
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    // Olho direito (do jogador) e sobrancelha.
    33, 133, 159, 145, 70, 105, 107,
    // Olho esquerdo (do jogador) e sobrancelha.
    263, 362, 386, 374, 300, 334, 336,
    // Nariz.
    1, 2, 98, 327, 168,
    // Boca (externa).
    61, 291, 0, 17, 13, 14,
]

/** Ponta do nariz no FaceMesh; âncora do eixo do olhar. */
const NOSE_TIP = 1

/**
 * Desenha um esboço esparso do rosto e um eixo curto saindo do nariz na direção do olhar,
 * SOBRE o mesmo overlay das mãos (não limpa o canvas — o chamador limpa ao desenhar as mãos
 * primeiro). As coordenadas normalizadas são mapeadas para a área do vídeo; o espelhamento
 * fica por conta do CSS do canvas, o mesmo do `<video>` e do esqueleto da mão. Cor discreta,
 * para não competir com o dourado da mira. Sem pontos, não desenha nada. Nada é gravado.
 */
export function drawFace(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    landmarks: readonly FaceLandmark[] | null,
    orientation: HeadOrientation | null,
): void {
    if (!landmarks || landmarks.length === 0) return
    const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const width = Math.round(video.clientWidth * ratio)
    const height = Math.round(video.clientHeight * ratio)
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return

    const area = containRect(canvas.width, canvas.height, video.videoWidth, video.videoHeight)
    const point = (landmark: FaceLandmark) => ({
        x: area.x + landmark.x * area.width,
        y: area.y + landmark.y * area.height,
    })

    // Pontos esparsos do rosto, cor discreta (verde-água translúcido do design).
    context.fillStyle = 'rgba(42, 157, 143, 0.85)'
    for (const index of FACE_POINT_INDICES) {
        const landmark = landmarks[index]
        if (!landmark) continue
        const { x, y } = point(landmark)
        context.beginPath()
        context.arc(x, y, 1.6 * ratio, 0, Math.PI * 2)
        context.fill()
    }

    // Eixo curto saindo do nariz na direção do olhar (yaw para os lados, pitch para cima).
    // O canvas é espelhado por CSS (como o vídeo): `yaw > 0` (olha para a sua direita) é
    // desenhado para -x do canvas, que aparece à direita na tela espelhada.
    const nose = landmarks[NOSE_TIP]
    if (orientation && nose) {
        const origin = point(nose)
        const axis = Math.min(area.width, area.height) * 0.22
        const end = {
            x: origin.x - Math.sin(orientation.yaw) * axis,
            y: origin.y - Math.sin(orientation.pitch) * axis,
        }
        context.strokeStyle = 'rgba(224, 170, 8, 0.9)'
        context.lineWidth = 2 * ratio
        context.beginPath()
        context.moveTo(origin.x, origin.y)
        context.lineTo(end.x, end.y)
        context.stroke()
    }
}
