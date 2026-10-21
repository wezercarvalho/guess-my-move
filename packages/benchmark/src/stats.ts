/** Intervalo de confiança de Wilson (95% por padrão) para uma proporção. */
export interface WilsonInterval {
    point: number
    low: number
    high: number
    n: number
}

/**
 * Intervalo de Wilson para `successes` em `n` tentativas. `z` padrão 1.96
 * (~95%). Para `n === 0` devolve [0, 0] com ponto 0, sinalizando ausência de
 * amostra em vez de dividir por zero.
 */
export function wilson(successes: number, n: number, z = 1.96): WilsonInterval {
    if (n === 0) {
        return { point: 0, low: 0, high: 0, n: 0 }
    }
    const p = successes / n
    const z2 = z * z
    const denom = 1 + z2 / n
    const center = (p + z2 / (2 * n)) / denom
    const margin =
        (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
    return {
        point: p,
        low: Math.max(0, center - margin),
        high: Math.min(1, center + margin),
        n,
    }
}

/** Percentil (interpolação linear) de uma lista de números. */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) {
        return Number.NaN
    }
    const sorted = [...values].sort((a, b) => a - b)
    if (sorted.length === 1) {
        return sorted[0]
    }
    const rank = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(rank)
    const upper = Math.ceil(rank)
    if (lower === upper) {
        return sorted[lower]
    }
    const weight = rank - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function median(values: number[]): number {
    return percentile(values, 50)
}

/** Resultado por clipe depois de executado contra o provedor. */
export interface ClipOutcome {
    id: string
    scenario: string
    expected: 'positive' | 'negative'
    /** Palpite devolvido (vazio em evidência insuficiente). */
    guess: string
    insufficientEvidence: boolean
    /** O palpite casou com "acenar" pela regra determinística? */
    matchedWaving: boolean
    /** Latência ponta a ponta medida no harness (ms). */
    latencyMs: number
    /** Custo por tentativa, quando informado pelo provedor/config. */
    costUsd?: number
    /** Falha técnica (timeout, erro de provedor) em vez de um palpite. */
    technicalFailure: boolean
    variant?: string
}

/** Métricas agregadas de um conjunto de resultados (um provedor/variante). */
export interface AggregateMetrics {
    total: number
    positives: number
    negatives: number
    truePositives: number
    falseNegatives: number
    trueNegatives: number
    falsePositives: number
    insufficientOnPositives: number
    technicalFailures: number
    accuracy: WilsonInterval
    precision: WilsonInterval
    recall: WilsonInterval
    falsePositiveRate: WilsonInterval
    latencyMedianMs: number
    latencyP95Ms: number
    costPerAttemptUsd?: number
}

/**
 * Agrega resultados em métricas. Falhas técnicas são contadas à parte e NÃO
 * entram como acerto/erro de visão (um timeout não é um falso negativo). O
 * julgamento é por `matchedWaving` (determinístico), separando visão de
 * semântica.
 */
export function aggregate(outcomes: ClipOutcome[]): AggregateMetrics {
    const usable = outcomes.filter((o) => !o.technicalFailure)
    const positives = usable.filter((o) => o.expected === 'positive')
    const negatives = usable.filter((o) => o.expected === 'negative')

    const truePositives = positives.filter((o) => o.matchedWaving).length
    const falseNegatives = positives.length - truePositives
    const falsePositives = negatives.filter((o) => o.matchedWaving).length
    const trueNegatives = negatives.length - falsePositives
    const insufficientOnPositives = positives.filter(
        (o) => o.insufficientEvidence,
    ).length

    const correct = truePositives + trueNegatives
    const predictedPositive = truePositives + falsePositives

    const latencies = usable.map((o) => o.latencyMs)
    const costs = usable
        .map((o) => o.costUsd)
        .filter((c): c is number => typeof c === 'number')

    const metrics: AggregateMetrics = {
        total: outcomes.length,
        positives: positives.length,
        negatives: negatives.length,
        truePositives,
        falseNegatives,
        trueNegatives,
        falsePositives,
        insufficientOnPositives,
        technicalFailures: outcomes.length - usable.length,
        accuracy: wilson(correct, usable.length),
        precision: wilson(truePositives, predictedPositive),
        recall: wilson(truePositives, positives.length),
        falsePositiveRate: wilson(falsePositives, negatives.length),
        latencyMedianMs: median(latencies),
        latencyP95Ms: percentile(latencies, 95),
    }
    if (costs.length > 0) {
        metrics.costPerAttemptUsd =
            costs.reduce((a, b) => a + b, 0) / costs.length
    }
    return metrics
}
