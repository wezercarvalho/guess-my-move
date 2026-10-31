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

    it('sem rosto, mantém o olhar por faceLostHoldMs e depois volta suave a zero (CQ-012)', () => {
        const look = createHeadLook()
        for (let i = 0; i < DEFAULT_HEAD_LOOK.calibrationFrames + 1; i++) {
            look.update({ yaw: 0, pitch: 0 }, 1 / 60)
        }
        const turned = settle(look, { yaw: ANGLE, pitch: 0 })
        expect(turned.yawOffset).toBeGreaterThan(0)
        // Rosto some: marca ausente, mas o olhar não se mexe dentro do prazo de espera.
        const first = look.update(null, 1 / 60)
        expect(first.faceVisible).toBe(false)
        expect(first.yawOffset).toBeCloseTo(turned.yawOffset, 6)
        const holdFrames = Math.floor((DEFAULT_HEAD_LOOK.faceLostHoldMs / 1000) * 60) - 5
        let held = first
        for (let i = 0; i < holdFrames; i++) held = look.update(null, 1 / 60)
        expect(held.yawOffset).toBeCloseTo(turned.yawOffset, 6)
        // Passado o prazo, volta suave: um passo ainda não zera.
        let after = held
        for (let i = 0; i < 12; i++) after = look.update(null, 1 / 60)
        expect(after.yawOffset).toBeLessThan(turned.yawOffset)
        expect(after.yawOffset).toBeGreaterThan(0)
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


/** Roda `seconds` de quadros a 60 Hz com a cabeça em `orientation` e o pedido de trava `lock`. */
function run(
    look: ReturnType<typeof createHeadLook>,
    orientation: HeadOrientation | null,
    seconds: number,
    lock = false,
) {
    let state = look.update(orientation, 1 / 60, lock)
    const frames = Math.round(seconds * 60) - 1
    for (let i = 0; i < frames; i++) state = look.update(orientation, 1 / 60, lock)
    return state
}

function calibrated() {
    const look = createHeadLook()
    run(look, { yaw: 0, pitch: 0 }, 0.5)
    return look
}

const CENTER: HeadOrientation = { yaw: 0, pitch: 0 }
const RIGHT: HeadOrientation = { yaw: ANGLE, pitch: 0 }

describe('trava da direção (CQ-012)', () => {
    it('sem o pedido de trava, nada trava e o modo é "seguindo"', () => {
        const look = calibrated()
        const state = run(look, RIGHT, 2)
        expect(state.mode).toBe('following')
        expect(state.yawOffset).toBeGreaterThan(0)
        expect(state.liveYaw).toBeCloseTo(state.yawOffset, 6)
        expect(state.recenterProgress).toBe(0)
    })

    it('com o pedido, trava e a cabeça deixa de girar a câmera', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        const locked = run(look, RIGHT, 0.1, true)
        expect(locked.mode).toBe('locked')
        expect(locked.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        // Volta o rosto para a tela com o gesto ainda valendo: o olhar fica onde estava.
        const still = run(look, CENTER, 2, true)
        expect(still.mode).toBe('locked')
        expect(still.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        expect(still.liveYaw).toBe(0)
    })

    it('trava a direção de pouco antes do gesto, não a do instante em que ele é reconhecido', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        // Levar a mão ao gesto mexe a cabeça: ela já voltou ao centro quando o gesto vale.
        run(look, CENTER, 0.25)
        const locked = run(look, CENTER, 2, true)
        expect(locked.yawOffset).toBeGreaterThan(turned.yawOffset * 0.9)
    })

    it('ao tirar a mão, mantém a direção e espera o rosto centralizar', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 1, true)
        // Gesto desfeito com o rosto já no centro: aguarda por recenterMs.
        const early = run(look, CENTER, 0.1)
        expect(early.mode).toBe('waiting')
        expect(early.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        expect(early.recenterProgress).toBeGreaterThan(0)
        expect(early.recenterProgress).toBeLessThan(1)
        const done = run(look, CENTER, 0.5)
        expect(done.mode).toBe('following')
        expect(done.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        expect(done.liveYaw).toBeCloseTo(0, 3)
    })

    it('olhando de lado ao tirar a mão, continua aguardando e não gira a câmera', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        // Tira a mão com a cabeça ainda virada: aguarda indefinidamente.
        const waiting = run(look, RIGHT, 5)
        expect(waiting.mode).toBe('waiting')
        expect(waiting.recenterProgress).toBe(0)
        expect(waiting.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        // Vira mais ainda: a câmera não acompanha.
        const more = run(look, { yaw: ANGLE * 2, pitch: 0 }, 2)
        expect(more.yawOffset).toBeCloseTo(turned.yawOffset, 2)
    })

    it('a centralização recomeça se a cabeça sair do centro antes de recenterMs', () => {
        const look = calibrated()
        run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 0.2)
        const broke = run(look, RIGHT, 0.1)
        expect(broke.mode).toBe('waiting')
        expect(broke.recenterProgress).toBe(0)
        const back = run(look, CENTER, 0.15)
        expect(back.mode).toBe('waiting')
    })

    it('depois de centralizar, a cabeça soma a partir da direção travada, sem salto', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 1, true)
        run(look, CENTER, 1)
        // Primeiro quadro virando de novo: continua perto da direção travada (sem salto).
        const first = look.update(RIGHT, 1 / 60)
        expect(Math.abs(first.yawOffset - turned.yawOffset)).toBeLessThan(0.08)
        const more = run(look, RIGHT, 2)
        expect(more.mode).toBe('following')
        expect(more.yawOffset).toBeGreaterThan(turned.yawOffset + 0.2)
        // Para a esquerda, volta ao redor da direção travada.
        const left = run(look, { yaw: -ANGLE, pitch: 0 }, 2)
        expect(left.yawOffset).toBeLessThan(turned.yawOffset - 0.2)
    })

    it('trava a inclinação junto com a guinada', () => {
        const look = calibrated()
        const up: HeadOrientation = { yaw: 0, pitch: ANGLE }
        const turned = run(look, up, 1.5)
        expect(turned.pitchOffset).toBeGreaterThan(0.1)
        run(look, up, 0.1, true)
        const locked = run(look, CENTER, 2, true)
        expect(locked.pitchOffset).toBeCloseTo(turned.pitchOffset, 2)
    })

    it('travar de novo com a direção anterior: a nova trava vale pelo total aplicado', () => {
        const look = calibrated()
        const first = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 1, true)
        run(look, CENTER, 1)
        const turnedAgain = run(look, RIGHT, 1.5)
        expect(turnedAgain.yawOffset).toBeGreaterThan(first.yawOffset + 0.2)
        run(look, RIGHT, 0.1, true)
        const second = run(look, CENTER, 2, true)
        expect(second.yawOffset).toBeCloseTo(turnedAgain.yawOffset, 2)
    })

    it('travada ou aguardando o centro, perder o rosto não muda o olhar', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        const lockedNoFace = run(look, null, 4, true)
        expect(lockedNoFace.mode).toBe('locked')
        expect(lockedNoFace.faceVisible).toBe(false)
        expect(lockedNoFace.yawOffset).toBeCloseTo(turned.yawOffset, 2)
        const waitingNoFace = run(look, null, 4)
        expect(waitingNoFace.mode).toBe('waiting')
        expect(waitingNoFace.yawOffset).toBeCloseTo(turned.yawOffset, 2)
    })

    it('fora da trava, sem rosto volta suave à direção travada, não a zero', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 1, true)
        run(look, CENTER, 1)
        run(look, RIGHT, 1.5)
        const gone = run(look, null, 8)
        expect(gone.mode).toBe('following')
        expect(gone.yawOffset).toBeCloseTo(turned.yawOffset, 2)
    })

    it('"Centralizar" encerra a trava e zera a direção travada', () => {
        const look = calibrated()
        run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        run(look, CENTER, 1, true)
        look.recenter()
        const state = run(look, CENTER, 3)
        expect(state.mode).toBe('following')
        expect(Math.abs(state.yawOffset)).toBeLessThan(1e-3)
    })

    it('expõe a direção travada (viés do acompanhamento): zero sem trava, o total travado depois', () => {
        const look = calibrated()
        const turned = run(look, RIGHT, 1.5)
        expect(turned.lockedYaw).toBe(0)
        expect(turned.lockedPitch).toBe(0)
        const locked = run(look, RIGHT, 0.1, true)
        expect(locked.lockedYaw).toBeCloseTo(turned.yawOffset, 2)
        // Segue valendo aguardando o centro e seguindo de novo; "Centralizar" zera.
        expect(run(look, CENTER, 0.1).lockedYaw).toBeCloseTo(turned.yawOffset, 2)
        expect(run(look, CENTER, 1).lockedYaw).toBeCloseTo(turned.yawOffset, 2)
        look.recenter()
        expect(run(look, CENTER, 0.1).lockedYaw).toBe(0)
    })

    it('não trava antes de calibrar', () => {
        const look = createHeadLook()
        const state = look.update(CENTER, 1 / 60, true)
        expect(state.mode).toBe('following')
        expect(state.calibrated).toBe(false)
    })

    it('reset volta ao modo seguindo e sem direção travada', () => {
        const look = calibrated()
        run(look, RIGHT, 1.5)
        run(look, RIGHT, 0.1, true)
        look.reset()
        const state = look.update(null, 1 / 60)
        expect(state.mode).toBe('following')
        expect(state.yawOffset).toBe(0)
        expect(state.recenterProgress).toBe(0)
    })
})
