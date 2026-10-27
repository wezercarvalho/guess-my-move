/**
 * Estalo do polegar (modo beta do bete): para a câmera, uma pinça que ABRE
 * RÁPIDO. Funções puras, sem DOM, sem relógio próprio e sem MediaPipe: o tempo
 * entra pelos argumentos. Todos os números padrão são palpites ainda não
 * medidos (issue #68).
 */
import { type Vec } from './physics.js'
import {
    DEFAULT_PINCH,
    type PinchConfig,
    type PinchReading,
    type Point,
    createPinchDetector,
} from './pinch.js'

const LANDMARK_COUNT = 21
const WRIST = 0
const MIDDLE_FINGER_MCP = 9

/** Parâmetros do estalo, além da histerese da pinça. */
export interface FlickConfig extends PinchConfig {
    /** A subida da razão começa na última amostra com razão menor ou igual a este valor. */
    riseStartRatio: number
    /** Uma subida mais longa que isto (ms) é abertura lenta e cancela o tiro. */
    slowMs: number
    /** Velocidade de abertura (razão/s) mínima para valer como estalo, e a que dá a força máxima. */
    minOpenSpeed: number
    maxOpenSpeed: number
    /** Velocidade do tiro (unid/s) na força mínima e na máxima. */
    minShotSpeed: number
    maxShotSpeed: number
    /** Quanto histórico (ms) o detector guarda enquanto armado. */
    historyMs: number
}

export const DEFAULT_FLICK: FlickConfig = {
    ...DEFAULT_PINCH,
    riseStartRatio: 0.4,
    slowMs: 300,
    minOpenSpeed: 2,
    maxOpenSpeed: 8,
    minShotSpeed: 300,
    maxShotSpeed: 1100,
    historyMs: 400,
}

/** Medição de uma abertura da pinça. */
export interface FlickRelease {
    /** Duração da subida e velocidade dentro dos limites do estalo. */
    fast: boolean
    /** Pico da inclinação da razão entre amostras consecutivas da subida (razão/s). */
    openSpeed: number
    /** Tempo do início da subida até cruzar a abertura (ms). */
    riseMs: number
    /** Direção da mão no início da subida, antes de o estalo perturbá-la. */
    direction: Vec | null
}

/** Leitura da pinça mais a direção da mão; `closed` significa armado. */
export type FlickReading = PinchReading & {
    direction: Vec | null
    release: FlickRelease | null
}

export interface FlickDetector {
    /** `aspect` é largura/altura da imagem; `nowMs` é um relógio monotônico. */
    update(landmarks: readonly Point[] | null, aspect: number, nowMs: number): FlickReading
    reset(): void
}

/**
 * Orientação da mão no plano da imagem: do pulso à base do dedo médio, com x
 * corrigido pela proporção da imagem e espelhado (como o preview), em vetor
 * unitário do campo. Devolve `null` sem os 21 pontos, com vetor degenerado ou
 * proporção inválida.
 */
export function handDirection(landmarks: readonly Point[], aspect: number): Vec | null {
    if (landmarks.length < LANDMARK_COUNT || !Number.isFinite(aspect) || aspect <= 0) return null
    const wrist = landmarks[WRIST]
    const middle = landmarks[MIDDLE_FINGER_MCP]
    if (!wrist || !middle) return null
    const dx = (middle.x - wrist.x) * aspect
    const dy = middle.y - wrist.y
    const length = Math.hypot(dx, dy)
    if (!(length > 1e-6)) return null
    return { x: -dx / length, y: dy / length }
}

interface Sample {
    t: number
    ratio: number
    direction: Vec | null
}

/** Mede a subida da razão a partir das amostras armadas mais a que cruzou a abertura. */
function measureRelease(samples: readonly Sample[], cfg: FlickConfig): FlickRelease {
    let start = 0
    for (let i = samples.length - 1; i >= 0; i--) {
        if (samples[i].ratio <= cfg.riseStartRatio) {
            start = i
            break
        }
    }
    const first = samples[start]
    const last = samples[samples.length - 1]

    let openSpeed = 0
    for (let i = start; i < samples.length - 1; i++) {
        const a = samples[i]
        const b = samples[i + 1]
        const seconds = (b.t - a.t) / 1000
        if (seconds > 0) openSpeed = Math.max(openSpeed, (b.ratio - a.ratio) / seconds)
    }

    const riseMs = last.t - first.t
    return {
        fast: riseMs <= cfg.slowMs && openSpeed >= cfg.minOpenSpeed,
        openSpeed,
        riseMs,
        direction: first.direction,
    }
}

/**
 * Detector de estalo: arma com a pinça fechada (histerese da pinça) e, ao
 * abrir, mede a velocidade e a duração da subida da razão. Perder a mão zera o
 * armado, então reaparecer com a pinça aberta nunca dispara.
 */
export function createFlickDetector(config: Partial<FlickConfig> = {}): FlickDetector {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    const pinch = createPinchDetector({ closeRatio: cfg.closeRatio, openRatio: cfg.openRatio })
    let armed = false
    let history: Sample[] = []

    return {
        update(landmarks, aspect, nowMs) {
            const reading = pinch.update(landmarks, aspect)
            if (!reading.handVisible || reading.ratio === null || !landmarks) {
                armed = false
                history = []
                return { ...reading, direction: null, release: null }
            }

            const direction = handDirection(landmarks, aspect)
            const sample: Sample = { t: nowMs, ratio: reading.ratio, direction }
            let release: FlickRelease | null = null

            if (reading.closed) {
                if (!armed) {
                    armed = true
                    history = []
                }
                history.push(sample)
                const oldest = nowMs - cfg.historyMs
                history = history.filter((item) => item.t >= oldest)
            } else if (armed) {
                armed = false
                release = measureRelease([...history, sample], cfg)
                history = []
            }
            return { ...reading, direction, release }
        },
        reset() {
            pinch.reset()
            armed = false
            history = []
        },
    }
}

/** Tiro calculado a partir de um estalo. */
export interface FlickShot {
    velocity: Vec
    /** Força relativa, de 0 a 1. */
    power: number
}

/**
 * Converte um estalo em tiro: a velocidade vai linearmente de `minShotSpeed` a
 * `maxShotSpeed` quando a abertura vai de `minOpenSpeed` a `maxOpenSpeed`. Devolve
 * `null` (tiro cancelado) para abertura lenta, fraca ou sem direção.
 */
export function flickShot(
    release: FlickRelease,
    config: Partial<FlickConfig> = {},
): FlickShot | null {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    const { direction } = release
    if (!release.fast || !direction || release.openSpeed < cfg.minOpenSpeed) return null

    const span = cfg.maxOpenSpeed - cfg.minOpenSpeed
    const power =
        span > 0 ? Math.min(Math.max((release.openSpeed - cfg.minOpenSpeed) / span, 0), 1) : 1
    const speed = cfg.minShotSpeed + power * (cfg.maxShotSpeed - cfg.minShotSpeed)
    return { velocity: { x: direction.x * speed, y: direction.y * speed }, power }
}
