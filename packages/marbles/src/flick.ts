/**
 * Estalo do polegar (modo alpha do bete). A mão fica fechada com o polegar
 * preso contra o indicador ("armada") e o estalo é o polegar se esticando de
 * uma vez: a razão polegar-indicador (distância entre as pontas dividida pela
 * escala da mão) sobe de uma faixa baixa para uma faixa alta e FICA alta por
 * alguns quadros. A mira (a direção) é relativa, como na pinça, e vive na
 * rodada; aqui só se mede o estalo e a posição da mão antes dele. Funções
 * puras, sem DOM, sem relógio próprio e sem MediaPipe: o tempo entra pelos
 * argumentos. Os números padrão são palpites calibrados
 * em duas gravações de uma única pessoa e uma webcam de cerca de 15 quadros
 * novos por segundo (issue #72); não são medição de desempenho.
 */
import { type Point, pinchRatio } from './pinch.js'

const THUMB_TIP = 4
const INDEX_TIP = 8
/** Base do dedo médio: parada enquanto o polegar se mexe, serve de posição da mão. */
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
    /** Gesto pronto que, visto durante a confirmação, indica a mão se abrindo (e não o polegar esticando) e cancela o estalo. */
    openHandGesture: string
    /** Pontuação mínima (0 a 1) do gesto pronto para ele valer. */
    gestureMinScore: number
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
    openHandGesture: 'Open_Palm',
    gestureMinScore: 0.8,
    powerLowSpeed: 3,
    powerHighSpeed: 20,
    minShotSpeed: 300,
    maxShotSpeed: 1100,
}

/** Gesto pronto reconhecido pelo MediaPipe no quadro (por exemplo `Closed_Fist`, `Open_Palm`, `Thumb_Up`). */
export interface HandGesture {
    name: string
    score: number
}

/** Etapa do detector: sem armar, armado (polegar preso) ou confirmando o polegar esticado. */
export type FlickPhase = 'idle' | 'armed' | 'pending'

/** Como terminou um estalo candidato. */
export type FlickVerdict = 'confirmed' | 'weak' | 'unsustained' | 'open_hand'

/** Medição de um estalo candidato (o polegar cruzou `extendRatio`). */
export interface FlickRelease {
    /**
     * `confirmed`: subiu e ficou esticado; `weak`: subida pequena; `unsustained`: voltou a fechar
     * antes de confirmar; `open_hand`: subiu e ficou esticado, mas o gesto pronto foi palma aberta.
     */
    verdict: FlickVerdict
    /** Pico da inclinação da razão entre amostras consecutivas da subida (razão/s). */
    openSpeed: number
    /** Tempo do mínimo recente até o cruzamento (ms). */
    riseMs: number
    /** Posição da mão (normalizada e espelhada) na última amostra armada, antes do cruzamento: a mira trava aqui. */
    point: Point
}

/** Leitura da pinça e da direção da mão; `closed` significa armado (ou candidato em confirmação). */
export interface FlickReading {
    handVisible: boolean
    closed: boolean
    /** Etapa do detector, para guiar o jogador na tela. */
    phase: FlickPhase
    /** Distância entre as pontas dividida pela escala da mão; `null` sem mão. */
    ratio: number | null
    /** Posição da mão (base do dedo médio), normalizada (0 a 1) e espelhada em x; `null` sem mão. */
    point: Point | null
    /** Gesto pronto reconhecido no quadro, se houver. */
    gesture: HandGesture | null
    release: FlickRelease | null
}

export interface FlickDetector {
    /** `aspect` é largura/altura da imagem; `nowMs` é um relógio monotônico; `gesture` é o gesto pronto do quadro, se houver. */
    update(
        landmarks: readonly Point[] | null,
        aspect: number,
        nowMs: number,
        gesture?: HandGesture | null,
    ): FlickReading
    reset(): void
}

interface Sample {
    t: number
    ratio: number
    point: Point
    openHand: boolean
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
 * movimento) sobe e volta no quadro seguinte e não confirma. Se o gesto pronto
 * reconhecido nessas amostras for palma aberta, é a mão se abrindo e o estalo
 * também é cancelado. Perder a mão zera
 * tudo, então reaparecer esticada nunca dispara.
 */
export function createFlickDetector(config: Partial<FlickConfig> = {}): FlickDetector {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    let phase: FlickPhase = 'idle'
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
        // A mira trava na última posição armada, antes do cruzamento.
        const point = history[history.length - 1].point
        clear()
        return { verdict, openSpeed, riseMs, point }
    }

    return {
        update(landmarks, aspect, nowMs, gesture = null) {
            const ratio = landmarks ? pinchRatio(landmarks, aspect) : null
            const thumb = landmarks?.[THUMB_TIP]
            const index = landmarks?.[INDEX_TIP]
            if (!landmarks || ratio === null || !thumb || !index) {
                clear()
                return {
                    handVisible: false,
                    closed: false,
                    phase: 'idle',
                    ratio: null,
                    point: null,
                    gesture: null,
                    release: null,
                }
            }

            // A posição da mão é a base do dedo médio, que não se move com o polegar.
            const knuckle = landmarks[MIDDLE_FINGER_MCP] ?? thumb
            const point = { x: 1 - knuckle.x, y: knuckle.y }
            const openHand =
                gesture !== null &&
                gesture.name === cfg.openHandGesture &&
                gesture.score >= cfg.gestureMinScore
            const sample: Sample = { t: nowMs, ratio, point, openHand }
            const confirmedVerdict = (): FlickVerdict =>
                run.some((item) => item.openHand) ? 'open_hand' : 'confirmed'
            let release: FlickRelease | null = null

            if (phase === 'pending') {
                run.push(sample)
                const first = run[0]
                const riseMs = first.t - (base?.t ?? first.t)
                if (ratio < cfg.extendRatio) {
                    release = finish('unsustained', riseMs)
                } else if (run.length >= cfg.confirmSamples) {
                    release = finish(confirmedVerdict(), riseMs)
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
                    release = finish(confirmedVerdict(), nowMs - low.t)
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
                phase,
                ratio,
                point,
                gesture,
                release,
            }
        },
        reset() {
            clear()
        },
    }
}

/** Força de um estalo confirmado. */
export interface FlickPower {
    /** Força relativa, de 0 a 1. */
    power: number
    /** Velocidade do tiro (unid/s), de `minShotSpeed` a `maxShotSpeed`. */
    speed: number
}

/**
 * Converte um estalo em força: a velocidade com que o polegar se estica (a
 * subida da razão) numa escala logarítmica de `powerLowSpeed` a
 * `powerHighSpeed` dá a força, e a velocidade do tiro vai linearmente de
 * `minShotSpeed` a `maxShotSpeed`. A direção NÃO vem daqui: é da mira da
 * rodada. Devolve `null` (tiro cancelado) para estalo fraco, não sustentado ou
 * mão aberta.
 */
export function flickPower(
    release: FlickRelease,
    config: Partial<FlickConfig> = {},
): FlickPower | null {
    const cfg: FlickConfig = { ...DEFAULT_FLICK, ...config }
    if (release.verdict !== 'confirmed') return null

    const span = Math.log(cfg.powerHighSpeed / cfg.powerLowSpeed)
    const raw = span > 0 ? Math.log(release.openSpeed / cfg.powerLowSpeed) / span : 1
    const power = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), 1)
    return { power, speed: cfg.minShotSpeed + power * (cfg.maxShotSpeed - cfg.minShotSpeed) }
}
