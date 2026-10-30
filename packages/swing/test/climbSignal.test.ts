import { describe, expect, it } from 'vitest'

import { DEFAULT_GRIP, climbSignal } from '../src/climb.js'

/**
 * Dados SINTÉTICOS (números de deslocamento de landmarks, não mão real). O y do MediaPipe
 * cresce para baixo, então uma mão que "desce na imagem" tem dy positivo e puxa o corpo
 * para cima. Subir = cada mão que desce puxa (soma); descer = as duas mãos sobem juntas.
 * Nada aqui afirma precisão do rastreio.
 */
describe('climbSignal (desça uma mão por vez para subir)', () => {
    it('é zero quando as duas mãos estão paradas (dentro da zona morta)', () => {
        expect(climbSignal(0, 0)).toBe(0)
        expect(climbSignal(0.01, -0.01)).toBe(0)
    })

    it('sobe quando uma mão desce na imagem, mesmo com a outra parada', () => {
        expect(climbSignal(0.2, 0)).toBeGreaterThan(0)
        expect(climbSignal(0, 0.2)).toBeGreaterThan(0)
    })

    it('sobe quando as duas mãos descem (as duas puxam para cima)', () => {
        expect(climbSignal(0.2, 0.2)).toBeGreaterThan(0)
    })

    it('alternar as mãos dá subida líquida: uma desce enquanto a outra sobe', () => {
        // Esquerda desce (dy>0), direita sobe (dy<0): o componente de subida da esquerda
        // domina, sem nenhuma descida (que só conta quando AS DUAS sobem).
        expect(climbSignal(0.2, -0.2)).toBeGreaterThan(0)
        expect(climbSignal(-0.2, 0.2)).toBeGreaterThan(0)
    })

    it('desce só quando as DUAS mãos sobem ao mesmo tempo', () => {
        expect(climbSignal(-0.2, -0.2)).toBeLessThan(0)
    })

    it('uma mão só subindo não desce (a outra ausente conta dy = 0)', () => {
        // Direita ausente (dy = 0): não há descida das duas; a esquerda subindo não puxa.
        expect(climbSignal(-0.2, 0)).toBe(0)
    })

    it('satura em 1 e -1 para movimentos grandes', () => {
        expect(climbSignal(5, 5)).toBe(1)
        expect(climbSignal(-5, -5)).toBe(-1)
    })

    it('respeita a zona morta configurável', () => {
        const big = { ...DEFAULT_GRIP, climbDeadzone: 0.5 }
        expect(climbSignal(0.1, 0.1, big)).toBe(0)
    })
})
