/**
 * Janelas deslizantes em memória para rate limit (por minuto) e teto de custo
 * (tentativas por hora). Suficiente para a PoC de instância única; nenhuma
 * mídia nem dado de carta é guardado, só marcas de tempo.
 */
export class SlidingWindowCounter {
    private readonly hits: number[] = []

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    /** Remove marcas fora da janela atual. */
    private prune(current: number): void {
        const threshold = current - this.windowMs
        while (this.hits.length > 0 && this.hits[0] <= threshold) {
            this.hits.shift()
        }
    }

    /** True se ainda há orçamento na janela, sem registrar a tentativa. */
    canProceed(): boolean {
        const current = this.now()
        this.prune(current)
        return this.hits.length < this.limit
    }

    /** Registra uma tentativa agora. */
    record(): void {
        this.hits.push(this.now())
    }
}
