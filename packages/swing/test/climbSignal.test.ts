import { describe, expect, it } from 'vitest'

import { DEFAULT_GRIP, climbSignal, pullBackSignal } from '../src/climb.js'

/**
 * Dados SINTÉTICOS (números de deslocamento de landmarks, não mão real). O y do MediaPipe
 * cresce para baixo, então uma mão que "desce na imagem" tem dy positivo e puxa o corpo
 * para cima. Nada aqui afirma precisão do rastreio.
 */
describe('climbSignal (movimento alternado das mãos)', () => {
    it('é zero quando as duas mãos estão paradas (dentro da zona morta)', () => {
        expect(climbSignal(0, 0)).toBe(0)
        expect(climbSignal(0.01, -0.01)).toBe(0)
    })

    it('sobe quando uma mão desce e a outra sobe (alternado)', () => {
        // esquerda desce (dy>0), direita sobe (dy<0): puxão para cima.
        const s = climbSignal(0.2, -0.2)
        expect(s).toBeGreaterThan(0)
    })

    it('desce quando o alternado é no sentido oposto', () => {
        // esquerda sobe (dy<0), direita desce (dy>0): empurra para baixo.
        const s = climbSignal(-0.2, 0.2)
        expect(s).toBeLessThan(0)
    })

    it('satura em 1 e -1 para movimentos grandes', () => {
        expect(climbSignal(5, -5)).toBe(1)
        expect(climbSignal(-5, 5)).toBe(-1)
    })

    it('o movimento conjunto (as duas no mesmo sentido) não vira escalada forte', () => {
        // as duas descem juntas: não é "alternar"; o sinal fica perto de zero.
        const s = climbSignal(0.2, 0.2)
        expect(Math.abs(s)).toBeLessThan(climbSignal(0.2, -0.2))
    })

    it('respeita a zona morta configurável', () => {
        const big = { ...DEFAULT_GRIP, climbDeadzone: 0.5 }
        expect(climbSignal(0.1, -0.1, big)).toBe(0)
    })
})

describe('pullBackSignal (puxar a mão para trás, profundidade z)', () => {
    it('é falso quando a profundidade quase não muda', () => {
        expect(pullBackSignal(0, 0)).toBe(false)
        expect(pullBackSignal(0.01, 0.01)).toBe(false)
    })

    it('é verdadeiro quando uma mão se afasta da câmera além do limite', () => {
        // z cresce para longe da câmera: a mão foi puxada para trás.
        expect(pullBackSignal(0.2, 0)).toBe(true)
        expect(pullBackSignal(0, 0.2)).toBe(true)
    })

    it('aproximar a mão (z diminui) não conta como soltar', () => {
        expect(pullBackSignal(-0.2, -0.2)).toBe(false)
    })

    it('respeita o limite configurável', () => {
        const strict = { ...DEFAULT_GRIP, pullBackThreshold: 0.5 }
        expect(pullBackSignal(0.2, 0, strict)).toBe(false)
    })
})
