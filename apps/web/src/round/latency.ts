/** Estatísticas de latência de inferência, em milissegundos. */
export interface LatencySummary {
    medianMs: number | null
    p95Ms: number | null
}

/** Mediana e p95 (posto mais próximo) de uma lista de medições; nulos se vazia. */
export function summarizeLatency(values: readonly number[]): LatencySummary {
    if (values.length === 0) return { medianMs: null, p95Ms: null }
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const medianMs =
        sorted.length % 2 === 1
            ? (sorted[middle] ?? 0)
            : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    const rank = Math.max(1, Math.ceil(sorted.length * 0.95))
    return { medianMs, p95Ms: sorted[rank - 1] ?? null }
}
