import { type RefObject } from 'react'

/**
 * Canvas transparente sobre o vídeo, onde o esqueleto da mão é desenhado para
 * depuração. Decorativo para leitores de tela; não captura cliques.
 */
export function HandOverlay({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
    return (
        <canvas
            ref={canvasRef}
            className="hand-overlay"
            aria-hidden="true"
            data-testid="hand-overlay"
        />
    )
}
