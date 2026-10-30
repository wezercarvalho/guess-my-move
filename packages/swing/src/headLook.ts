/**
 * Olhar da câmera a partir da orientação da cabeça, por funções puras e testáveis sem
 * navegador nem câmera. Converte a pose da cabeça (guinada e inclinação) num desvio que
 * soma ao olhar automático do jogo: corrige o espelhamento da imagem, calibra o neutro,
 * ignora uma zona morta, aplica ganho e limites, suaviza e, sem rosto, volta a zero.
 *
 * O jogo lê o olhar de `state.yaw`/`state.pitch` (a mira da teia sai dali), então aplicar
 * este desvio ao olhar faz a câmera E a mira seguirem a cabeça, por construção.
 */

/** Orientação da cabeça, em radianos: guinada (lados) e inclinação (cima/baixo). */
export interface HeadOrientation {
    /** Giro em torno do eixo vertical. Na imagem espelhada, virar para a direita do jogador dá valor positivo. */
    yaw: number
    /** Inclinação: cabeça para cima dá valor positivo. */
    pitch: number
}

/**
 * Um ponto do rosto, normalizado (0..1) na imagem da câmera, como o MediaPipe devolve.
 * `z` é opcional (profundidade relativa) e não é usado no desenho 2D.
 */
export interface FaceLandmark {
    x: number
    y: number
    z?: number
}

/**
 * Leitura do rosto num quadro: a orientação da cabeça (para o olhar) e os pontos do rosto
 * (para o desenho transitório no overlay). Os pontos NUNCA são gravados, persistidos nem
 * logados — são desenhados e descartados. `orientation` é `null` quando não há matriz válida.
 */
export interface FaceReading {
    orientation: HeadOrientation | null
    landmarks: readonly FaceLandmark[]
}

export interface HeadLookConfig {
    /** Quadros estáveis para a calibração automática do neutro no começo. */
    calibrationFrames: number
    /** Ângulo da cabeça ignorado em volta do neutro, em radianos (não treme parado). */
    deadzone: number
    /** Multiplicador do desvio da cabeça para o olhar (acima de 1, gira mais que a cabeça). */
    gain: number
    /** Limite do desvio de guinada, em radianos. */
    maxYaw: number
    /** Limite do desvio de inclinação, em radianos. */
    maxPitch: number
    /** Suavização exponencial por segundo (maior = mais rápido para o alvo). 0 desliga. */
    smoothing: number
}

export const DEFAULT_HEAD_LOOK: HeadLookConfig = {
    calibrationFrames: 12,
    deadzone: (5 * Math.PI) / 180,
    gain: 1.8,
    maxYaw: (70 * Math.PI) / 180,
    maxPitch: (45 * Math.PI) / 180,
    smoothing: 8,
}

/** Estado do olhar da cabeça num quadro. */
export interface HeadLookState {
    /** Desvio de guinada a somar ao olhar do jogo, em radianos. */
    yawOffset: number
    /** Desvio de inclinação a somar ao olhar do jogo, em radianos. */
    pitchOffset: number
    /** O neutro já foi calibrado. */
    calibrated: boolean
    /** Havia rosto no último quadro. */
    faceVisible: boolean
}

export interface HeadLook {
    /**
     * Um quadro: a orientação da cabeça (`null` sem rosto) e o tempo `dt` em segundos.
     * Devolve o desvio suavizado a somar ao olhar.
     */
    update(orientation: HeadOrientation | null, dt: number): HeadLookState
    /** Trata a orientação atual como o novo neutro (botão "Centralizar"). */
    recenter(): void
    /** Volta ao estado inicial, sem calibração. */
    reset(): void
}

/**
 * Lê a guinada e a inclinação de uma matriz de transformação facial 4x4 do MediaPipe
 * (16 números em ordem de coluna). A guinada é o giro em torno do eixo vertical e a
 * inclinação, em torno do eixo horizontal, extraídas da parte de rotação. `null` quando a
 * matriz não tem 16 números.
 */
export function headOrientationFromMatrix(matrix: readonly number[]): HeadOrientation | null {
    if (matrix.length !== 16) return null
    // Ordem de coluna: índice = coluna*4 + linha. r[linha][coluna].
    const r = (row: number, col: number) => matrix[col * 4 + row] ?? 0
    // A matriz do MediaPipe leva o modelo canônico (olha para +Z, X à direita da imagem, Y
    // para cima) ao espaço da câmera, SEM espelhar. Em Ry(theta), +Z vai a (sin theta, 0,
    // cos theta): r(0,2)=sin, r(2,2)=cos, r(2,0)=-sin. Como a imagem não é espelhada, virar
    // a cabeça para a direita do jogador é theta NEGATIVO; invertemos o sinal para que
    // `yaw > 0` signifique "olha para a sua direita". O mesmo para a inclinação: em Rx(phi),
    // +Z vai a (0, -sin phi, cos phi), e olhar para cima é phi negativo, então `pitch > 0`
    // ao olhar para cima. Assim o olhar do jogo (yaw cresce à direita, pitch positivo para
    // cima) casa com o desvio sem inversão extra.
    const yaw = Math.atan2(r(2, 0), r(2, 2))
    const pitch = Math.atan2(r(1, 2), r(1, 1))
    return { yaw, pitch }
}

/** Aplica zona morta e ganho a um ângulo relativo ao neutro, depois limita. */
function shape(relative: number, config: HeadLookConfig, limit: number): number {
    const sign = Math.sign(relative)
    const past = Math.abs(relative) - config.deadzone
    if (past <= 0) return 0
    const value = sign * past * config.gain
    return Math.max(-limit, Math.min(limit, value))
}

export function createHeadLook(config: HeadLookConfig = DEFAULT_HEAD_LOOK): HeadLook {
    let calibrated = false
    let neutral: HeadOrientation = { yaw: 0, pitch: 0 }
    let stableFrames = 0
    let last: HeadOrientation | null = null
    let yawOffset = 0
    let pitchOffset = 0

    function approach(current: number, target: number, dt: number): number {
        if (config.smoothing <= 0) return target
        const k = 1 - Math.exp(-config.smoothing * dt)
        return current + (target - current) * k
    }

    return {
        update(orientation, dt) {
            if (orientation === null) {
                // Sem rosto: o desvio volta suave a zero; o jogo segue como hoje.
                yawOffset = approach(yawOffset, 0, dt)
                pitchOffset = approach(pitchOffset, 0, dt)
                stableFrames = 0
                return { yawOffset, pitchOffset, calibrated, faceVisible: false }
            }

            // Calibração automática: os primeiros quadros estáveis definem o neutro.
            if (!calibrated) {
                stableFrames++
                neutral = orientation
                if (stableFrames >= config.calibrationFrames) calibrated = true
                last = orientation
                // Durante a calibração o olhar não se mexe.
                yawOffset = approach(yawOffset, 0, dt)
                pitchOffset = approach(pitchOffset, 0, dt)
                return { yawOffset, pitchOffset, calibrated, faceVisible: true }
            }
            last = orientation

            // Espelhamento: a imagem da câmera é invertida. A matriz já dá yaw positivo
            // quando a cabeça vira para a direita do jogador, e o olhar do jogo cresce
            // para a direita, então o sinal já casa (sem inversão extra aqui).
            const targetYaw = shape(orientation.yaw - neutral.yaw, config, config.maxYaw)
            const targetPitch = shape(orientation.pitch - neutral.pitch, config, config.maxPitch)
            yawOffset = approach(yawOffset, targetYaw, dt)
            pitchOffset = approach(pitchOffset, targetPitch, dt)
            return { yawOffset, pitchOffset, calibrated: true, faceVisible: true }
        },
        recenter() {
            if (last) neutral = last
            calibrated = true
            stableFrames = config.calibrationFrames
        },
        reset() {
            calibrated = false
            neutral = { yaw: 0, pitch: 0 }
            stableFrames = 0
            last = null
            yawOffset = 0
            pitchOffset = 0
        },
    }
}
