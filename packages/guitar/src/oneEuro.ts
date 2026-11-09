export interface OneEuroConfig {
    /** Frequência de corte mínima (Hz): menos tremor com valores menores. */
    readonly minCutoff: number
    /** Quanto o corte sobe com a velocidade: menos atraso em movimento rápido com valores maiores. */
    readonly beta: number
    /** Corte do filtro da derivada (Hz). */
    readonly dCutoff: number
}

/** Fator do filtro passa-baixa de primeira ordem para o intervalo `te` (s) e o corte (Hz). */
function smoothingFactor(te: number, cutoff: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / te)
}

/**
 * Filtro One Euro (Casiez, Roussel e Vogel, CHI 2012) para um valor escalar. O tempo é
 * injetado em milissegundos; um tempo que não avança devolve a última saída.
 */
export class OneEuroFilter {
    private lastValue: number | null = null
    private lastOutput = 0
    private lastDerivative = 0
    private lastTime = 0

    constructor(private readonly config: OneEuroConfig) {}

    filter(value: number, tMs: number): number {
        if (this.lastValue === null) {
            this.lastValue = value
            this.lastOutput = value
            this.lastTime = tMs
            return value
        }
        const te = (tMs - this.lastTime) / 1000
        if (te <= 0) return this.lastOutput
        const derivative = (value - this.lastValue) / te
        const derivativeAlpha = smoothingFactor(te, this.config.dCutoff)
        this.lastDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * this.lastDerivative
        const cutoff = this.config.minCutoff + this.config.beta * Math.abs(this.lastDerivative)
        const alpha = smoothingFactor(te, cutoff)
        this.lastOutput = alpha * value + (1 - alpha) * this.lastOutput
        this.lastValue = value
        this.lastTime = tMs
        return this.lastOutput
    }

    reset(): void {
        this.lastValue = null
        this.lastOutput = 0
        this.lastDerivative = 0
        this.lastTime = 0
    }
}
