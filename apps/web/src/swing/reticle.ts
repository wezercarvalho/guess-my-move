/** Ponto do alvo na tela: `x` e `y` em fração do quadro (0,0 é o canto de cima à esquerda). */
export interface ScreenPoint {
    x: number
    y: number
    /** O alvo está atrás da câmera. */
    behind: boolean
}

export interface ReticlePlacement {
    /** Posição em pixels. */
    x: number
    y: number
    /** O alvo está à vista; senão a mira fica na borda, apontando para ele. */
    inside: boolean
    /** Direção do centro até o alvo, em radianos (só importa fora do quadro). */
    angle: number
}

/**
 * Onde desenhar a mira de um alvo. À vista, no próprio ponto; fora do quadro ou atrás da
 * câmera, na borda (com `margin` de folga), na direção do alvo.
 */
export function reticlePlacement(
    point: ScreenPoint,
    width: number,
    height: number,
    margin = 28,
): ReticlePlacement {
    let dx = point.x - 0.5
    let dy = point.y - 0.5
    if (point.behind) {
        dx = -dx
        dy = -dy
        // Exatamente atrás de nós não tem direção: aponta para cima.
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = -0.5
    }
    const inside = !point.behind && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    const angle = Math.atan2(dy, dx)
    const halfW = width / 2 - margin
    const halfH = height / 2 - margin
    if (inside) {
        return {
            x: Math.min(width - margin, Math.max(margin, point.x * width)),
            y: Math.min(height - margin, Math.max(margin, point.y * height)),
            inside,
            angle,
        }
    }
    const px = dx * width
    const py = dy * height
    const scale = Math.min(
        px === 0 ? Infinity : halfW / Math.abs(px),
        py === 0 ? Infinity : halfH / Math.abs(py),
    )
    return { x: width / 2 + px * scale, y: height / 2 + py * scale, inside, angle }
}

/** Desenha a mira: anel dourado à vista, ou seta na borda quando o alvo está fora do quadro. */
export function drawReticle(
    context: CanvasRenderingContext2D,
    place: ReticlePlacement,
    label: string,
): void {
    context.save()
    context.translate(place.x, place.y)
    context.strokeStyle = '#e0aa08'
    context.fillStyle = '#e0aa08'
    context.lineWidth = 3
    if (place.inside) {
        context.beginPath()
        context.arc(0, 0, 14, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.arc(0, 0, 3, 0, Math.PI * 2)
        context.fill()
    } else {
        context.rotate(place.angle)
        context.beginPath()
        context.moveTo(14, 0)
        context.lineTo(-8, -10)
        context.lineTo(-8, 10)
        context.closePath()
        context.fill()
        context.rotate(-place.angle)
    }
    context.font = '700 13px "DM Sans", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, 0, place.y < 44 ? 26 : -24)
    context.restore()
}
