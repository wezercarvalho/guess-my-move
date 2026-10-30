import {
    type BoardPlacement,
    type FingerDebug,
    FRET_EDGES,
    STRING_NUMBERS,
    type ScreenPoint,
    stringV,
    strumZone,
    toScreenPoint,
} from '@guess-my-move/guitar'

import { containRect } from '../round/handOverlay.js'

/** O que o desenho do braço precisa saber de cada quadro. */
export interface BoardView {
    placement: BoardPlacement
    /** Posição suavizada e célula de cada ponta de dedo. */
    fingers: readonly FingerDebug[]
}

const COLORS = {
    paper: 'rgba(246, 244, 239, 0.75)',
    pressed: 'rgba(46, 204, 113, 0.8)',
    shade: 'rgba(9, 9, 9, 0.32)',
    zone: 'rgba(224, 170, 8, 0.45)',
} as const

/**
 * Desenha o braço de violão imaginário e os dedos detectados sobre o canvas que cobre o
 * vídeo. O overlay não antecipa um acorde: a forma é reconhecida pelas posições confirmadas.
 * As coordenadas são espelhadas como o vídeo, então o x é invertido ao desenhar.
 * Chame depois de `drawHands`, que dimensiona e limpa o canvas. Nada é gravado.
 */
export function drawBoardOverlay(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    view: BoardView,
): void {
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return
    const area = containRect(canvas.width, canvas.height, video.videoWidth, video.videoHeight)
    const unit = Math.max(1, area.height / 360)
    const { placement } = view

    /** Ponto da tela espelhada em pixels do canvas (que o CSS espelha de volta). */
    const px = (point: ScreenPoint) => ({
        x: area.x + (1 - point.x) * area.width,
        y: area.y + point.y * area.height,
    })
    const onBoard = (u: number, v: number) => px(toScreenPoint({ u, v }, placement))
    const stringGap = (placement.height * area.height) / 5

    // sombra leve atrás do braço, para as linhas aparecerem sobre qualquer fundo
    const corners = [onBoard(-0.08, -0.12), onBoard(1.02, -0.12), onBoard(1.02, 1.12), onBoard(-0.08, 1.12)]
    context.fillStyle = COLORS.shade
    context.beginPath()
    corners.forEach((corner, index) => {
        if (index === 0) context.moveTo(corner.x, corner.y)
        else context.lineTo(corner.x, corner.y)
    })
    context.closePath()
    context.fill()

    // pestana e casas
    FRET_EDGES.forEach((edge, index) => {
        const from = onBoard(edge, -0.1)
        const to = onBoard(edge, 1.1)
        context.lineWidth = (index === 0 ? 4 : 1.5) * unit
        context.strokeStyle = COLORS.paper
        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
    })

    // seis cordas neutras: o acorde nasce das posições observadas, não de um alvo desenhado
    for (const string of STRING_NUMBERS) {
        const from = onBoard(0, stringV(string))
        const to = onBoard(1, stringV(string))
        context.lineWidth = (0.8 + (string - 1) * 0.22) * unit
        context.strokeStyle = COLORS.paper
        context.beginPath()
        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        context.stroke()
    }

    const radius = Math.max(3 * unit, stringGap * 0.28)

    // zona ampla da batida
    const zone = strumZone(view.placement)
    const a = px({ x: zone.x0, y: zone.y0 })
    const b = px({ x: zone.x1, y: zone.y1 })
    context.setLineDash([6 * unit, 6 * unit])
    context.lineWidth = 1.5 * unit
    context.strokeStyle = COLORS.zone
    context.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y))
    context.setLineDash([])

    // pontas dos dedos: cheio quando já aperta, anel fino enquanto só passa por cima
    for (const finger of view.fingers) {
        if (!finger.board) continue
        const point = onBoard(finger.board.u, finger.board.v)
        context.beginPath()
        context.arc(point.x, point.y, radius * 0.5, 0, Math.PI * 2)
        if (finger.pressed) {
            context.fillStyle = COLORS.pressed
            context.fill()
        } else {
            context.lineWidth = 1.5 * unit
            context.strokeStyle = COLORS.paper
            context.stroke()
        }
    }
}
