/**
 * Escalar olhando: agarrado à parede, segurar o olhar para cima (ou para baixo) por um
 * tempo de espera começa a subir (ou descer); olhar para o lado ou voltar ao centro para.
 * Para voltar a escalar, repete-se o processo. Lógica pura, sem navegador nem câmera.
 *
 * A entrada é o desvio da cabeça já aplicado ao olhar (zona morta e ganho do `headLook`),
 * em radianos: `pitch > 0` olha para cima, `yaw` é o giro para os lados.
 */

export interface HeadClimbConfig {
    /** Tempo, em ms, segurando o olhar antes de começar a escalar. */
    dwellMs: number
    /** Desvio de inclinação, em radianos, a partir do qual o olhar conta como "cima/baixo". */
    pitchStart: number
    /** Desvio mínimo para continuar contando/escalando depois de começar (histerese, menor que `pitchStart`). */
    pitchHold: number
    /** Desvio de guinada, em radianos, acima do qual o olhar conta como "para o lado". */
    yawLimit: number
    /** Fração da velocidade de escalada (0 a 1) usada ao escalar olhando. */
    speed: number
}

export const DEFAULT_HEAD_CLIMB: HeadClimbConfig = {
    dwellMs: 2000,
    pitchStart: (12 * Math.PI) / 180,
    pitchHold: (7 * Math.PI) / 180,
    yawLimit: (20 * Math.PI) / 180,
    speed: 0.8,
}

export interface HeadClimbInput {
    /** Desvio de inclinação da cabeça aplicado ao olhar (positivo = para cima). */
    pitch: number
    /** Desvio de guinada da cabeça aplicado ao olhar. */
    yaw: number
    /** Só conta agarrado, no modo Rosto, com rosto à vista e neutro calibrado. */
    active: boolean
}

export interface HeadClimbState {
    /** Sinal de escalada (-1 a 1): positivo sobe, negativo desce, 0 parado. */
    climb: number
    /** Para onde o olhar está pedindo escalar (esperando ou já escalando); `null` sem pedido. */
    intent: 'up' | 'down' | null
    /** Quanto da espera já passou (0 a 1); 1 quando escalando. */
    progress: number
    /** Passou a espera e está escalando. */
    climbing: boolean
}

export interface HeadClimb {
    /** Avança `dtMs` milissegundos com a entrada do quadro. */
    update(input: HeadClimbInput, dtMs: number): HeadClimbState
    reset(): void
}

const IDLE: HeadClimbState = { climb: 0, intent: null, progress: 0, climbing: false }

export function createHeadClimb(config: HeadClimbConfig = DEFAULT_HEAD_CLIMB): HeadClimb {
    let intent: 'up' | 'down' | null = null
    let dwellMs = 0

    function stop(): HeadClimbState {
        intent = null
        dwellMs = 0
        return { ...IDLE }
    }

    return {
        update({ pitch, yaw, active }, dtMs) {
            if (!active) return stop()
            // Olhar para o lado interrompe e zera a espera.
            if (Math.abs(yaw) > config.yawLimit) return stop()

            // Histerese: já pedindo uma direção, basta o limite menor para manter; para começar, o maior.
            let direction: 'up' | 'down' | null = null
            if (intent === 'up' && pitch > config.pitchHold) direction = 'up'
            else if (intent === 'down' && pitch < -config.pitchHold) direction = 'down'
            else if (pitch > config.pitchStart) direction = 'up'
            else if (pitch < -config.pitchStart) direction = 'down'

            if (direction === null) return stop()
            if (direction !== intent) {
                intent = direction
                dwellMs = 0
            } else {
                dwellMs += dtMs
            }

            const climbing = dwellMs >= config.dwellMs
            const sign = direction === 'up' ? 1 : -1
            return {
                climb: climbing ? sign * config.speed : 0,
                intent: direction,
                progress: climbing ? 1 : Math.min(1, dwellMs / config.dwellMs),
                climbing,
            }
        },
        reset() {
            stop()
        },
    }
}
