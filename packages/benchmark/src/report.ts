import type { BenchmarkManifest } from './scenarios.js'
import {
    type AggregateMetrics,
    aggregate,
    type ClipOutcome,
    type WilsonInterval,
} from './stats.js'

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`
}

function ci(interval: WilsonInterval): string {
    if (interval.n === 0) {
        return 'sem amostra'
    }
    return `${pct(interval.point)} (IC95% ${pct(interval.low)}–${pct(interval.high)}, n=${String(interval.n)})`
}

function ms(v: number): string {
    return Number.isNaN(v) ? 'sem amostra' : `${v.toFixed(0)} ms`
}

/** Agrupa resultados por variante (ou "default" quando não houver). */
function groupByVariant(
    outcomes: ClipOutcome[],
): Map<string, ClipOutcome[]> {
    const groups = new Map<string, ClipOutcome[]>()
    for (const outcome of outcomes) {
        const key = outcome.variant ?? 'default'
        const list = groups.get(key) ?? []
        list.push(outcome)
        groups.set(key, list)
    }
    return groups
}

function metricsBlock(label: string, m: AggregateMetrics): string {
    return [
        `### Provedor/variante: ${label}`,
        '',
        '| Métrica | Valor |',
        '| --- | --- |',
        `| Clipes (total / usáveis) | ${String(m.total)} / ${String(m.total - m.technicalFailures)} |`,
        `| Positivos / negativos | ${String(m.positives)} / ${String(m.negatives)} |`,
        `| Recall (visão nos positivos) | ${ci(m.recall)} |`,
        `| Precisão | ${ci(m.precision)} |`,
        `| Acurácia | ${ci(m.accuracy)} |`,
        `| Taxa de falso positivo | ${ci(m.falsePositiveRate)} |`,
        `| Falsos positivos / negativos | ${String(m.falsePositives)} / ${String(m.falseNegatives)} |`,
        `| "Evidência insuficiente" em positivos | ${String(m.insufficientOnPositives)} |`,
        `| Falhas técnicas | ${String(m.technicalFailures)} |`,
        `| Latência mediana / p95 | ${ms(m.latencyMedianMs)} / ${ms(m.latencyP95Ms)} |`,
        `| Custo por tentativa | ${
            m.costPerAttemptUsd === undefined
                ? 'não informado'
                : `US$ ${m.costPerAttemptUsd.toFixed(5)}`
        } |`,
        '',
    ].join('\n')
}

export interface ReportInput {
    providerId: string
    manifest: BenchmarkManifest
    outcomes: ClipOutcome[]
    /** Latência medida via Codex CLI (não representativa de produção). */
    viaCodexCli: boolean
    generatedAt?: string
}

/**
 * Gera o relatório em Markdown a partir do modelo. NÃO declara taxa de acerto
 * geral do produto: todas as proporções vêm com intervalo de confiança de
 * Wilson e amostra declarada, e há uma seção de limitações obrigatória.
 */
export function renderReport(input: ReportInput): string {
    const { providerId, manifest, outcomes, viaCodexCli } = input
    const generatedAt = input.generatedAt ?? new Date().toISOString()
    const groups = groupByVariant(outcomes)
    const sample = manifest.sample ?? {}

    const sections: string[] = []
    sections.push('# Relatório do benchmark — gesto "Acenar"')
    sections.push('')
    sections.push(`- Gerado em: ${generatedAt}`)
    sections.push(`- Provedor: \`${providerId}\``)
    sections.push(
        `- Amostra declarada: ${String(sample.people ?? '?')} pessoa(s), ` +
            `${String(sample.environments ?? '?')} ambiente(s), ` +
            `${String(sample.lightingConditions ?? '?')} condição(ões) de iluminação`,
    )
    if (sample.notes) {
        sections.push(`- Notas da amostra: ${sample.notes}`)
    }
    sections.push('')
    sections.push(
        'Este relatório mede o provedor configurado contra os cenários ' +
            'positivos (P1–P6) e negativos (N1–N5) do protocolo. O julgamento ' +
            'de "acerto" é **determinístico** (normalização + aliases), ' +
            'separando VISÃO de SEMÂNTICA; o árbitro oficial do jogo vive em ' +
            '`@guess-my-move/core` e não é usado aqui.',
    )
    sections.push('')
    sections.push('## Métricas por provedor/variante')
    sections.push('')
    for (const [variant, list] of groups) {
        const label = variant === 'default' ? providerId : `${providerId} · ${variant}`
        sections.push(metricsBlock(label, aggregate(list)))
    }

    sections.push('## Limitações')
    sections.push('')
    sections.push(
        [
            '- **Sem taxa de acerto geral.** As proporções acima trazem ' +
                'intervalo de confiança de Wilson (95%) e tamanho de amostra; ' +
                'diferenças pequenas entre configurações podem não ser ' +
                'estatisticamente distinguíveis.',
            '- Uma única ação ("acenar", um dos gestos mais fáceis) e uma ' +
                'amostra pequena: bom desempenho aqui não prova desempenho em ' +
                'outras cartas, ângulos, tons de pele, câmeras ou iluminação.',
            viaCodexCli
                ? '- **Latência via Codex CLI NÃO é representativa de ' +
                  'produção** (inclui a inicialização do processo e a camada ' +
                  'de agente). A latência de produção é medida de novo no ' +
                  'provedor definitivo (SC-004).'
                : '- A latência depende da rede, da região e da carga do ' +
                  'momento; repita em horários diferentes.',
            '- O custo por tentativa só aparece quando informado por ' +
                'configuração (API paga); o `mock` e o modo local não têm custo.',
        ].join('\n'),
    )
    sections.push('')
    sections.push('## Decisão')
    sections.push('')
    sections.push(
        '> Preencher após a execução com clipes reais: manter, ajustar ou ' +
            'trocar o provedor, com base nos números acima e nas metas ' +
            'exploratórias da spec (SC-005/SC-006).',
    )
    sections.push('')
    return sections.join('\n')
}
