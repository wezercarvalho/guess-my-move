/**
 * Gatilho do estalo do polegar (modo alpha do bete): para a câmera, uma pinça
 * que ABRE RÁPIDO. O detector só classifica a abertura; direção e força vêm do
 * arrasto relativo da mão, como no modo pinça. Funções puras, sem DOM, sem
 * relógio próprio e sem MediaPipe: o tempo entra pelos argumentos. Os números
 * padrão são palpites apoiados em uma única sessão de teste (issue #72).
 */
import {
    DEFAULT_PINCH,
    type PinchConfig,
    type PinchReading,
    type Point,
    createPinchDetector,
} from './pinch.js'

/** Parâmetros do gatilho, além da histerese da pinça. */
export interface FlickConfig extends PinchConfig {
    /** A subida da razão começa na última amostra com razão menor ou igual a este valor. */
    riseStartRatio: number
    /** Uma subida mais longa que isto (ms) é abertura lenta e cancela o tiro. */
    slowMs: number
    /** Velocidade de abertura (razão/s) mínima para valer como estalo. */
    minOpenSpeed: number
    /** Quanto histórico (ms) o detector guarda enquanto armado. */
    historyMs: number
}

export const DEFAULT_FLICK: FlickConfig = {
    ...DEFAULT_PINCH,
    riseStartRatio: 0.4,
    slowMs: 80,
    minOpenSpeed: 2,
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
}

/** Leitura da pinça mais a soltura medida; `closed` significa armado. */
export type FlickReading = PinchReading & {
    release: FlickRelease | null
}

export interface FlickDetector {
    /** `aspect` é largura/altura da imagem; `nowMs` é um relógio monotônico. */
    update(landmarks: readonly Point[] | null, aspect: number, nowMs: number): FlickReading
    reset(): void
}

interface Sample {
    t: number
    ratio: number
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
                return { ...reading, release: null }
            }

            const sample: Sample = { t: nowMs, ratio: reading.ratio }
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
            return { ...reading, release }
        },
        reset() {
            pinch.reset()
            armed = false
            history = []
        },
    }
}
