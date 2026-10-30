import { describe, expect, it } from 'vitest'

import {
    DEFAULT_HEAD_LOOK,
    createHeadLook,
    headOrientationFromMatrix,
    type HeadOrientation,
} from '../src/headLook.js'

/**
 * Matriz 4x4 em ordem de coluna (como o MediaPipe devolve) de uma rotação pura em torno do
 * eixo vertical Y por `theta` radianos, no espaço da câmera (modelo olha para +Z, X para a
 * direita da imagem, Y para cima). Ry(theta) leva +Z a (sin theta, 0, cos theta). As colunas
 * são as imagens de X, Y, Z e a translação.
 */
function rotationYMatrix(theta: number): number[] {
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // prettier-ignore
    return [
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
    ]
}

/** Rotação pura em torno do eixo horizontal X por `phi`; Rx(phi) leva +Z a (0, -sin phi, cos phi). */
function rotationXMatrix(phi: number): number[] {
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    // prettier-ignore
    return [
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1,
    ]
}

const ANGLE = Math.PI / 9 // 20 graus

/**
 * Convenção fixada pelos testes (derivada da matriz + relato do dono, não medida com
 * instrumento — ver research.md): a imagem da câmera NÃO é espelhada pelo MediaPipe, então,
 * quando o jogador vira a cabeça para a SUA direita, o rosto aponta para a esquerda da
 * imagem e a rotação geométrica em torno de Y é NEGATIVA. `headOrientationFromMatrix` deve
 * devolver `yaw > 0` nesse caso (jogador olha para a direita), e `pitch > 0` ao olhar para
 * cima. O olhar do jogo (`state.yaw`) cresce para a direita, então o sinal casa direto.
 */
describe('headOrientationFromMatrix', () => {
    it('lê a guinada e a inclinação zero numa matriz identidade', () => {
        const orientation = headOrientationFromMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        expect(orientation).not.toBeNull()
        expect(orientation?.yaw).toBeCloseTo(0, 5)
        expect(orientation?.pitch).toBeCloseTo(0, 5)
    })

    it('jogador que vira para a SUA direita (Ry negativa) dá guinada positiva', () => {
        // Virar para a direita do jogador = rotação geométrica negativa em torno de Y.
        const orientation = headOrientationFromMatrix(rotationYMatrix(-ANGLE))
        expect(orientation?.yaw).toBeCloseTo(ANGLE, 4)
        expect(orientation?.pitch).toBeCloseTo(0, 4)
    })

    it('jogador que vira para a SUA esquerda (Ry positiva) dá guinada negativa', () => {
        const orientation = headOrientationFromMatrix(rotationYMatrix(ANGLE))
        expect(orientation?.yaw).toBeCloseTo(-ANGLE, 4)
        expect(orientation?.pitch).toBeCloseTo(0, 4)
    })

    it('jogador que olha para CIMA (Rx negativa) dá inclinação positiva', () => {
        // Olhar para cima = rotação geométrica negativa em torno de X.
        const orientation = headOrientationFromMatrix(rotationXMatrix(-ANGLE))
        expect(orientation?.pitch).toBeCloseTo(ANGLE, 4)
        expect(orientation?.yaw).toBeCloseTo(0, 4)
    })

    it('jogador que olha para BAIXO (Rx positiva) dá inclinação negativa', () => {
        const orientation = headOrientationFromMatrix(rotationXMatrix(ANGLE))
        expect(orientation?.pitch).toBeCloseTo(-ANGLE, 4)
        expect(orientation?.yaw).toBeCloseTo(0, 4)
    })

    it('devolve null com uma matriz de tamanho errado', () => {
        expect(headOrientationFromMatrix([1, 0, 0])).toBeNull()
        expect(headOrientationFromMatrix([])).toBeNull()
    })
})

/** Repete `update` até o olhar estabilizar (a suavização é exponencial). */
function settle(
    look: ReturnType<typeof createHeadLook>,
    orientation: HeadOrientation | null,
    steps = 240,
) {
    let last = look.update(orientation, 1 / 60)
    for (let i = 0; i < steps; i++) last = look.update(orientation, 1 / 60)
    return last
}

describe('createHeadLook', () => {
    it('começa sem calibrar, sem olhar e sem rosto', () => {
        const look = createHeadLook()
        const state = look.update(null, 1 / 60)
        expect(state.calibrated).toBe(false)
        expect(state.faceVisible).toBe(false)
        expect(state.yawOffset).toBe(0)
        expect(state.pitchOffset).toBe(0)
    })

    it('calibra sozinho depois de alguns quadros estáveis e trata o neutro como zero', () => {
        const look = createHeadLook()
        const neutral: HeadOrientation = { yaw: 0.05, pitch: -0.03 }
        let state = look.update(neutral, 1 / 60)
        expect(state.faceVisible).toBe(true)
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames; i++) {
            state = look.update(neutral, 1 / 60)
        }
        expect(state.calibrated).toBe(true)
        // Parado no neutro, o olhar não sai de perto de zero (zona morta + neutro).
        const held = settle(look, neutral)
        expect(Math.abs(held.yawOffset)).toBeLessThan(1e-3)
        expect(Math.abs(held.pitchOffset)).toBeLessThan(1e-3)
    })

    it('vira a câmera para a direita quando a cabeça vira para a direita (corrige o espelhamento)', () => {
        const look = createHeadLook()
        // Calibra no neutro.
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        // A imagem é espelhada: virar a cabeça para a DIREITA do jogador aparece como yaw
        // POSITIVO na matriz; a câmera do jogo deve girar para a direita (yaw do jogo cresce).
        const right = settle(look, { yaw: ANGLE, pitch: 0 })
        expect(right.yawOffset).toBeGreaterThan(0)
        // E para a esquerda, o oposto.
        const left = settle(look, { yaw: -ANGLE, pitch: 0 })
        expect(left.yawOffset).toBeLessThan(0)
    })

    it('inclina para cima e para baixo conforme a cabeça', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const up = settle(look, { yaw: 0, pitch: ANGLE })
        expect(up.pitchOffset).toBeGreaterThan(0)
        const down = settle(look, { yaw: 0, pitch: -ANGLE })
        expect(down.pitchOffset).toBeLessThan(0)
    })

    it('não reage dentro da zona morta', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const small = DEFAULT_HEAD_LOOK.deadzone * 0.5
        const state = settle(look, { yaw: small, pitch: small })
        expect(state.yawOffset).toBeCloseTo(0, 4)
        expect(state.pitchOffset).toBeCloseTo(0, 4)
    })

    it('respeita o limite de guinada mesmo com a cabeça muito virada', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const state = settle(look, { yaw: Math.PI / 2, pitch: 0 })
        expect(state.yawOffset).toBeLessThanOrEqual(DEFAULT_HEAD_LOOK.maxYaw + 1e-6)
        expect(state.yawOffset).toBeGreaterThan(DEFAULT_HEAD_LOOK.maxYaw * 0.9)
    })

    it('aplica ganho: um giro de cabeça vira a câmera mais que 1:1', () => {
        const look = createHeadLook({ ...DEFAULT_HEAD_LOOK, gain: 2, deadzone: 0, smoothing: 0, maxYaw: Math.PI })
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const state = settle(look, { yaw: 0.2, pitch: 0 }, 2)
        expect(state.yawOffset).toBeCloseTo(0.4, 2)
    })

    it('suaviza: não salta de uma vez para o alvo', () => {
        const look = createHeadLook({ ...DEFAULT_HEAD_LOOK, deadzone: 0 })
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const first = look.update({ yaw: ANGLE, pitch: 0 }, 1 / 60)
        const target = settle(look, { yaw: ANGLE, pitch: 0 })
        expect(Math.abs(first.yawOffset)).toBeLessThan(Math.abs(target.yawOffset))
    })

    it('sem rosto, o olhar volta suave a zero e marca o rosto como ausente', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const turned = settle(look, { yaw: ANGLE, pitch: 0 })
        expect(turned.yawOffset).toBeGreaterThan(0)
        // Rosto some: um passo ainda não zera (volta suave), mas marca ausente.
        const first = look.update(null, 1 / 60)
        expect(first.faceVisible).toBe(false)
        expect(first.yawOffset).toBeGreaterThan(0)
        expect(first.yawOffset).toBeLessThan(turned.yawOffset)
        // Depois de muitos quadros sem rosto, o olhar chega a zero.
        const gone = settle(look, null)
        expect(Math.abs(gone.yawOffset)).toBeLessThan(1e-3)
        expect(Math.abs(gone.pitchOffset)).toBeLessThan(1e-3)
    })

    it('recalibra o neutro sob demanda (centralizar)', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        // A cabeça agora descansa virada 20 graus; um quadro nessa pose e então centralizar
        // deve tratar essa pose como o novo zero.
        look.update({ yaw: ANGLE, pitch: 0 }, 1 / 60)
        look.recenter()
        const held = settle(look, { yaw: ANGLE, pitch: 0 })
        expect(Math.abs(held.yawOffset)).toBeLessThan(5e-3)
    })

    it('reset volta ao estado inicial sem calibração', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0.1, pitch: 0 }, 1 / 60)
        }
        look.reset()
        const state = look.update(null, 1 / 60)
        expect(state.calibrated).toBe(false)
        expect(state.yawOffset).toBe(0)
    })
})
