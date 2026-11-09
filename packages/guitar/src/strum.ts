import { type Rect, insideRect } from './board.js'
import { OneEuroFilter, type OneEuroConfig } from './oneEuro.js'

/** Centro da palma da mão que bate, na tela espelhada (0 a 1), com o tamanho da mão. */
export interface StrumSample {
    readonly tMs: number
    readonly x: number
    /** Em fração da altura da tela; cresce para baixo. */
    readonly y: number
    /** Distância pulso a base do dedo médio, em fração da altura da tela. */
    readonly handSize: number
}

export interface StrumEvent {
    readonly direction: 'down' | 'up'
    /** De `minForce` a 1, pelo pico de velocidade. */
    readonly force: number
    readonly tMs: number
    /** Pico de velocidade vertical, em tamanhos de mão por segundo. */
    readonly speed: number
}

export interface StrumConfig {
    /** Velocidade que arma o golpe (tamanhos de mão por segundo). */
    readonly onSpeed: number
    /** Velocidade abaixo da qual o golpe termina. */
    readonly offSpeed: number
    /** Deslocamento mínimo do golpe, em tamanhos de mão. */
    readonly minTravel: number
    /** Velocidade que dá a força máxima. */
    readonly fullSpeed: number
    /** Força mínima de um golpe que passou do limiar. */
    readonly minForce: number
    /** Intervalo mínimo entre dois eventos (ms). */
    readonly refractoryMs: number
    /** Lacuna entre amostras que reinicia o detector (ms): a mão sumiu e voltou. */
    readonly maxGapMs: number
    /** Amostras de velocidade ignoradas depois de um reinício. */
    readonly warmupSamples: number
    readonly filter: OneEuroConfig
}

/** Valores iniciais: hipóteses a calibrar ao vivo (ver plan.md). */
export const DEFAULT_STRUM_CONFIG: StrumConfig = {
    onSpeed: 3,
    offSpeed: 1.5,
    minTravel: 0.55,
    fullSpeed: 12,
    minForce: 0.15,
    refractoryMs: 150,
    maxGapMs: 150,
    warmupSamples: 1,
    filter: { minCutoff: 2, beta: 0.5, dCutoff: 2 },
}

type Phase = 'idle' | 'tracking' | 'spent'

/**
 * Detecta a batida pela velocidade vertical do centro da palma, em tamanhos de mão por
 * segundo (não depende da distância à câmera). Depois de armar pelo limiar de velocidade,
 * exige deslocamento suficiente na mesma direção e dispara ao completar essa trajetória. Só
 * conta dentro da zona de batida e respeita o período refratário. O tempo é injetado.
 */
export class StrumDetector {
    private readonly filter: OneEuroFilter
    private scale: number | null = null
    private previous: { py: number; tMs: number } | null = null
    private velocitySamples = 0
    private phase: Phase = 'idle'
    private direction: 1 | -1 = 1
    private startPy = 0
    private peak = 0
    private lastEventAt: number | null = null
    private speed = 0

    constructor(private readonly config: StrumConfig = DEFAULT_STRUM_CONFIG) {
        this.filter = new OneEuroFilter(config.filter)
    }

    update(sample: StrumSample, zone: Rect): StrumEvent | null {
        if (this.previous && sample.tMs - this.previous.tMs > this.config.maxGapMs) this.reset()
        if (sample.handSize <= 0) return null
        // normaliza pelo tamanho da mão ANTES de filtrar: o resultado independe da escala
        this.scale = this.scale === null ? sample.handSize : this.scale + 0.2 * (sample.handSize - this.scale)
        const py = this.filter.filter(sample.y / this.scale, sample.tMs)
        const previous = this.previous
        this.previous = { py, tMs: sample.tMs }
        if (!previous) return null
        const dt = (sample.tMs - previous.tMs) / 1000
        if (dt <= 0) return null
        const velocity = (py - previous.py) / dt
        this.speed = velocity
        if (this.velocitySamples++ < this.config.warmupSamples) return null
        return this.advance(velocity, py, sample, zone)
    }

    private advance(velocity: number, py: number, sample: StrumSample, zone: Rect): StrumEvent | null {
        const magnitude = Math.abs(velocity)
        const sign: 1 | -1 = velocity >= 0 ? 1 : -1
        const { onSpeed, offSpeed } = this.config

        if (this.phase === 'tracking') {
            if (sign !== this.direction) {
                this.phase = 'idle'
                if (magnitude >= onSpeed) this.begin(sign, magnitude, py)
                return null
            }
            this.peak = Math.max(this.peak, magnitude)
            if (Math.abs(py - this.startPy) >= this.config.minTravel) {
                const event = this.fire(sample, zone)
                this.phase = 'spent'
                return event
            }
            if (magnitude < offSpeed) this.phase = 'idle'
            return null
        }
        if (this.phase === 'spent') {
            if (magnitude < offSpeed) this.phase = 'idle'
            else if (sign !== this.direction && magnitude >= onSpeed) this.begin(sign, magnitude, py)
            return null
        }
        if (magnitude >= onSpeed) this.begin(sign, magnitude, py)
        return null
    }

    private begin(sign: 1 | -1, magnitude: number, py: number): void {
        this.phase = 'tracking'
        this.direction = sign
        this.startPy = py
        this.peak = magnitude
    }

    private fire(sample: StrumSample, zone: Rect): StrumEvent | null {
        const { tMs } = sample
        if (this.lastEventAt !== null && tMs - this.lastEventAt < this.config.refractoryMs) return null
        if (!insideRect({ x: sample.x, y: sample.y }, zone)) return null
        this.lastEventAt = tMs
        const { onSpeed, fullSpeed, minForce } = this.config
        const ratio = Math.min(1, Math.max(0, (this.peak - onSpeed) / (fullSpeed - onSpeed)))
        return {
            direction: this.direction === 1 ? 'down' : 'up',
            force: minForce + (1 - minForce) * ratio,
            tMs,
            speed: this.peak,
        }
    }

    /** A mão saiu do quadro: reinicia para não gerar batida com o salto de posição. */
    lost(): void {
        this.reset()
    }

    reset(): void {
        this.filter.reset()
        this.scale = null
        this.previous = null
        this.velocitySamples = 0
        this.phase = 'idle'
        this.startPy = 0
        this.peak = 0
        this.speed = 0
    }

    /** Velocidade vertical atual (com sinal, tamanhos de mão por segundo) para a depuração. */
    debug(): { speed: number; phase: Phase } {
        return { speed: this.speed, phase: this.phase }
    }
}
