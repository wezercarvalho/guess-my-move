/**
 * Harness OFFLINE do benchmark do gesto "Acenar". Lê um manifesto de clipes de
 * um diretório LOCAL fora do Git, executa contra o provedor configurado
 * (`mock` ou `codex`) e gera um relatório Markdown com métricas por
 * provedor/variante, intervalos de confiança (Wilson) e limitações — sem
 * declarar taxa de acerto geral. Testes usam dados sintéticos e o `mock`.
 */
export {
    type BenchmarkManifest,
    type ClipEntry,
    SCENARIOS,
    type ScenarioDef,
    type ScenarioLabel,
    scenarioById,
} from './scenarios.js'
export {
    matchesWaving,
    normalize,
    REJECTED_GENERIC,
    WAVING_ALIASES,
} from './semantics.js'
export {
    aggregate,
    type AggregateMetrics,
    type ClipOutcome,
    median,
    percentile,
    wilson,
    type WilsonInterval,
} from './stats.js'
export {
    buildInput,
    loadManifest,
    ManifestError,
    parseManifest,
    type RunOptions,
    runBenchmark,
    runClip,
} from './runner.js'
export { renderReport, type ReportInput } from './report.js'
