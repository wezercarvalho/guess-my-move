/** Quantidade de linhas radiais e velocidade (0 a 1) abaixo da qual nada é desenhado. */
export const LINE_COUNT = 28
export const MIN_INTENSITY = 0.15

/** Ângulo áureo: espalha as linhas sem formar padrão regular. */
const GOLDEN_ANGLE = 2.399963

/**
 * Linhas de velocidade na borda da tela, saindo do centro: crescem e ficam mais opacas
 * com a velocidade. É um efeito de desenho 2D sobre a cena, não desfoque de movimento
 * real. `intensity` vai de 0 (parado) a 1 (velocidade máxima).
 */
export function drawSpeedLines(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    seconds: number,
): void {
    context.clearRect(0, 0, width, height)
    if (intensity < MIN_INTENSITY) return
    const cx = width / 2
    const cy = height / 2
    const reach = Math.hypot(cx, cy)
    context.strokeStyle = `rgba(255, 236, 200, ${(0.12 + 0.3 * intensity).toFixed(3)})`
    context.lineWidth = 1 + 2 * intensity
    for (let i = 0; i < LINE_COUNT; i++) {
        const angle = i * GOLDEN_ANGLE
        // Cada linha corre para fora num ciclo próprio, o que dá a sensação de avanço.
        const phase = (seconds * (1.2 + 0.5 * intensity) + i * 0.37) % 1
        const start = reach * (0.3 + 0.45 * phase)
        const end = start + reach * (0.1 + 0.3 * intensity)
        context.beginPath()
        context.moveTo(cx + Math.cos(angle) * start, cy + Math.sin(angle) * start)
        context.lineTo(cx + Math.cos(angle) * end, cy + Math.sin(angle) * end)
        context.stroke()
    }
}
