import { type Body, type FieldDecor, DEFAULT_PHYSICS, type Vec } from '@guess-my-move/marbles'

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
function arrow(context: Context, from: Vec, velocity: Vec, power: number): void {
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
    point: Vec
    closed: boolean
}

/** Mira em andamento a desenhar: elástico da pinça e/ou seta do estalo. */
export interface AimDraw {
    pinch: Vec
    shot: { velocity: Vec; power: number } | null
    direction: Vec | null
}

/** O que a tela entrega ao desenho do campo de um modo qualquer. */
export interface FieldDraw {
    field: readonly Body[]
    decor: FieldDecor | null
    aim: AimDraw | null
    hand: HandCursor | null
}

/** Desenha o círculo do triângulo ou as covas (com a ativa destacada). */
function drawDecor(context: Context, decor: FieldDecor): void {
    if (decor.circle) {
        context.lineWidth = 2
        context.strokeStyle = 'rgba(60, 40, 20, 0.55)'
        ring(context, decor.circle.x, decor.circle.y, decor.circle.radius, [6, 6])
    }
    if (decor.holes) {
        const { positions, radius, active } = decor.holes
        positions.forEach((pos, index) => {
            context.beginPath()
            context.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
            context.fillStyle = '#3a2a16'
            context.fill()
            context.lineWidth = index === active ? 4 : 2
            context.strokeStyle = index === active ? '#f2c14e' : 'rgba(60, 40, 20, 0.6)'
            context.stroke()
        })
    }
}

/**
 * Desenha o campo 2D visto de cima para QUALQUER modo: terreno, a geometria do
 * modo (círculo do triângulo, covas com a ativa destacada), os corpos (a bolinha
 * de tiro em azul e as demais em vermelho), o cursor da mão e, durante a mira, o
 * elástico/seta de previsão. As coordenadas são as do campo; o CSS escala o
 * canvas. O desenho não conhece regras de modo: consome só corpos e geometria.
 */
export function drawField(canvas: HTMLCanvasElement, draw: FieldDraw): void {
    const context = canvas.getContext('2d')
    if (!context) return
    const { width, height } = DEFAULT_PHYSICS
    const { field, decor, aim, hand } = draw

    context.clearRect(0, 0, width, height)
    context.fillStyle = '#b98f5e'
    context.fillRect(0, 0, width, height)
    context.lineWidth = 6
    context.strokeStyle = '#7a5a34'
    context.strokeRect(3, 3, width - 6, height - 6)

    if (decor) drawDecor(context, decor)

    // A bolinha de tiro (índice 0) é azul; as demais são vermelhas.
    field.forEach((body, index) => {
        marble(context, body.pos.x, body.pos.y, body.radius, index === 0 ? '#3b82f6' : '#e5533d')
    })

    const shooter = field.length > 0 ? field[0].pos : { x: 0, y: 0 }

    if (aim?.direction) {
        context.lineCap = 'round'
        context.lineWidth = 3
        context.strokeStyle = '#1e3a8a'
        arrow(context, shooter, aim.direction, 0.3)
    }

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

    if (aim && !aim.direction) {
        context.lineCap = 'round'
        context.lineWidth = 3
        context.strokeStyle = '#2f855a'
        context.beginPath()
        context.moveTo(aim.pinch.x, aim.pinch.y)
        context.lineTo(shooter.x, shooter.y)
        context.stroke()

        context.beginPath()
        context.arc(aim.pinch.x, aim.pinch.y, 9, 0, Math.PI * 2)
        context.fillStyle = '#2f855a'
        context.fill()

        if (aim.shot) {
            context.lineWidth = 3
            context.strokeStyle = '#1e3a8a'
            arrow(context, shooter, aim.shot.velocity, aim.shot.power)
        }
    }
}
