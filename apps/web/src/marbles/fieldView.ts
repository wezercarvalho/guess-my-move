import { type BeteConfig, type BeteSnapshot, DEFAULT_BETE } from '@guess-my-move/marbles'

type Context = CanvasRenderingContext2D

function marble(context: Context, x: number, y: number, radius: number, color: string): void {
    const shade = context.createRadialGradient(x - radius / 3, y - radius / 3, 1, x, y, radius)
    shade.addColorStop(0, '#ffffff')
    shade.addColorStop(0.35, color)
    shade.addColorStop(1, '#00000066')
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = shade
    context.fill()
}

function ring(context: Context, x: number, y: number, radius: number, dash: number[]): void {
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.setLineDash(dash)
    context.stroke()
    context.setLineDash([])
}

/** Seta tracejada da bolinha de tiro na direção da velocidade, com ponta aberta. */
function arrow(context: Context, from: BeteSnapshot['shooter'], velocity: { x: number; y: number }, power: number): void {
    const speed = Math.hypot(velocity.x, velocity.y)
    if (speed === 0) return
    const ux = velocity.x / speed
    const uy = velocity.y / speed
    const length = 60 + 140 * power
    const tipX = from.x + ux * length
    const tipY = from.y + uy * length
    context.beginPath()
    context.moveTo(from.x + ux * 24, from.y + uy * 24)
    context.lineTo(tipX, tipY)
    context.moveTo(tipX - ux * 14 - uy * 8, tipY - uy * 14 + ux * 8)
    context.lineTo(tipX, tipY)
    context.lineTo(tipX - ux * 14 + uy * 8, tipY - uy * 14 - ux * 8)
    context.setLineDash([8, 6])
    context.stroke()
    context.setLineDash([])
}

/** Cursor da mão no campo: posição da pinça e se está fechada. */
export interface HandCursor {
    point: { x: number; y: number }
    closed: boolean
}

/**
 * Desenha o campo 2D visto de cima: terreno, marca do ponto de partida, bolinha
 * de tiro, alvo, o cursor da mão (quando visível) e, durante a mira, o elástico,
 * o cursor da pinça e a seta de previsão. As coordenadas são as do campo; o CSS
 * escala o canvas.
 */
export function drawField(
    canvas: HTMLCanvasElement,
    snapshot: BeteSnapshot,
    hand: HandCursor | null = null,
    config: BeteConfig = DEFAULT_BETE,
): void {
    const context = canvas.getContext('2d')
    if (!context) return
    const { width, height } = config.physics
    const { radius, shooterStart } = config

    context.clearRect(0, 0, width, height)
    context.fillStyle = '#b98f5e'
    context.fillRect(0, 0, width, height)
    context.lineWidth = 6
    context.strokeStyle = '#7a5a34'
    context.strokeRect(3, 3, width - 6, height - 6)

    context.lineWidth = 2
    context.strokeStyle = 'rgba(60, 40, 20, 0.45)'
    ring(context, shooterStart.x, shooterStart.y, radius + 8, [4, 4])

    marble(context, snapshot.target.x, snapshot.target.y, radius, '#e5533d')
    marble(context, snapshot.shooter.x, snapshot.shooter.y, radius, '#3b82f6')

    const { aim } = snapshot
    if (hand && !aim) {
        context.lineWidth = 3
        if (hand.closed) {
            context.beginPath()
            context.arc(hand.point.x, hand.point.y, 9, 0, Math.PI * 2)
            context.fillStyle = '#2f855a'
            context.fill()
        } else {
            context.strokeStyle = '#ffffff'
            context.beginPath()
            context.arc(hand.point.x, hand.point.y, 11, 0, Math.PI * 2)
            context.stroke()
        }
    }
    if (aim) {
        context.lineCap = 'round'
        context.lineWidth = 3
        context.strokeStyle = '#2f855a'
        context.beginPath()
        context.moveTo(aim.pinch.x, aim.pinch.y)
        context.lineTo(snapshot.shooter.x, snapshot.shooter.y)
        context.stroke()

        context.beginPath()
        context.arc(aim.pinch.x, aim.pinch.y, 9, 0, Math.PI * 2)
        context.fillStyle = '#2f855a'
        context.fill()

        if (aim.shot) {
            context.lineWidth = 3
            context.strokeStyle = '#1e3a8a'
            arrow(context, snapshot.shooter, aim.shot.velocity, aim.shot.power)
        }
    }
}
