/**
 * Estalo do polegar (modo alpha do bete). A mão fica fechada com o polegar
 * preso contra o indicador ("armada") e o estalo é o polegar se esticando de
 * uma vez: a razão polegar-indicador (distância entre as pontas dividida pela
 * escala da mão) sobe de uma faixa baixa para uma faixa alta e FICA alta por
 * alguns quadros. Funções puras, sem DOM, sem relógio próprio e sem MediaPipe:
 * o tempo entra pelos argumentos. Os números padrão são palpites calibrados
 * em duas gravações de uma única pessoa e uma webcam de cerca de 15 quadros
 * novos por segundo (issue #72); não são medição de desempenho.
 */
import { type Vec } from './physics.js'
import { type Point, pinchRatio } from './pinch.js'

const LANDMARK_COUNT = 21
const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_FINGER_MCP = 9

/** Parâmetros do estalo. */
export interface FlickConfig {
    /** A mão arma com a razão menor ou igual a este valor. */
    armRatio: number
    /** Razão a partir da qual o polegar conta como esticado; a subida até aqui é um estalo candidato. */
    extendRatio: number
    /** Amostras seguidas (a primeira é a que cruzou `extendRatio`) que devem ficar esticadas para confirmar o estalo. */
    confirmSamples: number
    /** Subida mínima da razão, do mínimo recente até o cruzamento; abaixo disso a mão só derivou e o estalo é fraco. */
    minRise: number
    /** Janela (ms) antes do cruzamento em que se procura o mínimo da razão (a base da subida). */
    baseWindowMs: number
    /** Quanto histórico (ms) o detector guarda enquanto armado. */
    historyMs: number
    /**
     * Escala da força (razão/s), logarítmica: a velocidade de abertura `powerLowSpeed`
     * dá força 0 e `powerHighSpeed` dá força 1.
     */
    powerLowSpeed: number
    powerHighSpeed: number
    /** Velocidade do tiro (unid/s) na força mínima e na máxima. */
    minShotSpeed: number
    maxShotSpeed: number
}

export const DEFAULT_FLICK: FlickConfig = {
    armRatio: 1.05,
    extendRatio: 1.2,
    confirmSamples: 3,
    minRise: 0.4,
    baseWindowMs: 250,
    historyMs: 400,
    powerLowSpeed: 3,
    powerHighSpeed: 20,
    minShotSpeed: 300,
    maxShotSpeed: 1100,
}

/** Como terminou um estalo candidato. */
export type FlickVerdict = 'confirmed' | 'weak' | 'unsustained'

/** Medição de um estalo candidato (o polegar cruzou `extendRatio`). */
export interface FlickRelease {
    /** `confirmed`: subiu e ficou esticado; `weak`: subida pequena; `unsustained`: voltou a fechar antes de confirmar. */
    verdict: FlickVerdict
    /** Pico da inclinação da razão entre amostras consecutivas da subida (razão/s). */
    openSpeed: number
    /** Tempo do mínimo recente até o cruzamento (ms). */
    riseMs: number
    /** Direção da mão no mínimo recente, antes de o estalo perturbá-la. */
    direction: Vec | null
}

/** Leitura da pinça e da direção da mão; `closed` significa armado (ou candidato em confirmação). */
export interface FlickReading {
    handVisible: boolean
    closed: boolean
    /** Distância entre as pontas dividida pela escala da mão; `null` sem mão. */
    ratio: number | null
    /** Ponto médio das pontas, normalizado (0 a 1) e espelhado em x; `null` sem mão. */
    point: Point | null
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

/** Maior inclinação da razão (razão/s) entre amostras consecutivas. */
function peakSlope(samples: readonly Sample[]): number {
    let peak = 0
    for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i]
        const b = samples[i + 1]
        const seconds = (b.t - a.t) / 1000
        if (seconds > 0) peak = Math.max(peak, (b.ratio - a.ratio) / seconds)
    }
    return peak
}

/**
 * Detector de estalo: arma com a razão baixa e, quando a razão cruza
 * `extendRatio` subindo pelo menos `minRise` acima do mínimo recente, abre um
 * candidato. O candidato só vira estalo se as `confirmSamples` primeiras
 * amostras seguirem esticadas: uma oscilação de rastreamento (a mão fechada em
 * movimento) sobe e volta no quadro seguinte e não confirma. Perder a mão zera
 * tudo, então reaparecer esticada nunca dispara.
 */
export function createFlickDetector(config: Partial<FlickConfig> = {}): FlickDetector {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    let phase: 'idle' | 'armed' | 'pending' = 'idle'
    /** Amostras armadas, da mais antiga à mais nova (inclui o mínimo recente). */
    let history: Sample[] = []
    /** Candidato: o mínimo recente e as amostras esticadas desde o cruzamento. */
    let base: Sample | null = null
    let run: Sample[] = []
    let rise: Sample[] = []

    const clear = (): void => {
        phase = 'idle'
        history = []
        base = null
        run = []
        rise = []
    }

    function finish(verdict: FlickVerdict, riseMs: number): FlickRelease {
        const openSpeed = peakSlope([...rise, ...run])
        const direction = base?.direction ?? null
        clear()
        return { verdict, openSpeed, riseMs, direction }
    }

    return {
        update(landmarks, aspect, nowMs) {
            const ratio = landmarks ? pinchRatio(landmarks, aspect) : null
            const thumb = landmarks?.[THUMB_TIP]
            const index = landmarks?.[INDEX_TIP]
            if (!landmarks || ratio === null || !thumb || !index) {
                clear()
                return { handVisible: false, closed: false, ratio: null, point: null, direction: null, release: null }
            }

            const direction = handDirection(landmarks, aspect)
            const sample: Sample = { t: nowMs, ratio, direction }
            let release: FlickRelease | null = null

            if (phase === 'pending') {
                run.push(sample)
                const first = run[0]
                const riseMs = first.t - (base?.t ?? first.t)
                if (ratio < cfg.extendRatio) {
                    release = finish('unsustained', riseMs)
                } else if (run.length >= cfg.confirmSamples) {
                    release = finish('confirmed', riseMs)
                }
            } else if (phase === 'armed' && ratio >= cfg.extendRatio) {
                const recent = history.filter((item) => item.t >= nowMs - cfg.baseWindowMs)
                const pool = recent.length > 0 ? recent : history.slice(-1)
                let low = pool[0]
                for (const item of pool) if (item.ratio <= low.ratio) low = item
                base = low
                rise = history.filter((item) => item.t >= low.t)
                run = [sample]
                if (ratio - low.ratio < cfg.minRise) {
                    release = finish('weak', nowMs - low.t)
                } else if (run.length >= cfg.confirmSamples) {
                    release = finish('confirmed', nowMs - low.t)
                } else {
                    phase = 'pending'
                }
            } else if (phase === 'armed') {
                history.push(sample)
                const oldest = nowMs - cfg.historyMs
                history = history.filter((item) => item.t >= oldest)
            }

            if (phase === 'idle' && ratio <= cfg.armRatio) {
                phase = 'armed'
                history = [sample]
            }

            return {
                handVisible: true,
                closed: phase !== 'idle',
                ratio,
                point: { x: 1 - (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
                direction,
                release,
            }
        },
        reset() {
            clear()
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
 * Converte um estalo em tiro: a força vem da velocidade com que o polegar se
 * estica (a subida da razão), numa escala logarítmica de `powerLowSpeed` a
 * `powerHighSpeed`, e a velocidade do tiro vai linearmente de `minShotSpeed` a
 * `maxShotSpeed`. A direção é a da mão. Devolve `null` (tiro cancelado) para
 * estalo fraco, não sustentado ou sem direção.
 */
export function flickShot(
    release: FlickRelease,
    config: Partial<FlickConfig> = {},
): FlickShot | null {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    const { direction } = release
    if (release.verdict !== 'confirmed' || !direction) return null

    const span = Math.log(cfg.powerHighSpeed / cfg.powerLowSpeed)
    const raw = span > 0 ? Math.log(release.openSpeed / cfg.powerLowSpeed) / span : 1
    const power = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), 1)
    const speed = cfg.minShotSpeed + power * (cfg.maxShotSpeed - cfg.minShotSpeed)
    return { velocity: { x: direction.x * speed, y: direction.y * speed }, power }
}
