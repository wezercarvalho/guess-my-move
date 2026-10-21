import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AuditFailure } from './dependency-audit-failure.mjs'
import {
    coversAdvisory,
    evaluateExceptions,
    loadExceptions,
} from './dependency-audit-exceptions.mjs'

export { AuditFailure } from './dependency-audit-failure.mjs'

// Unidade: bytes por MiB (1 MiB = 1024 * 1024 bytes).
export const BYTES_PER_MIB = 1024 * 1024

// Unidade: milissegundos por minuto.
const MS_PER_MINUTE = 60 * 1000

// A saída do `yarn npm audit --json` pode passar do limite padrão de 1 MiB do spawnSync.
// Unidade: bytes de stdout; acima dele o spawnSync encerra o processo (ENOBUFS).
export const AUDIT_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB

// Orçamento local para o `yarn npm audit` terminar, sem medição de cauda.
// Unidade: milissegundos; ao excedê-lo o spawnSync encerra o processo.
export const AUDIT_TIMEOUT_MS = 5 * MS_PER_MINUTE

// Orçamento local para o início do stderr exibido nas falhas do Yarn.
// Unidade: caracteres.
export const STDERR_EXCERPT_MAX_CHARS = 500

// Endpoint de auditoria em lote que o Yarn 4 consulta; a mensagem de registry o cita para o
// leitor, mas a classificação de falha de rede usa as assinaturas abaixo, não este caminho (o
// stderr do Yarn 4 traz o stack do Node, sem o endpoint).
export const AUDIT_ENDPOINT_PATH = '/-/npm/v1/security/advisories/bulk'

// Assinaturas de falha de rede/registry no stderr do Yarn 4: o erro chega como stack do Node
// (RequestError, HTTPError) ou como código de socket/DNS. Qualquer uma classifica a execução
// como `registry-indisponivel` (retentável), distinta de `yarn-falhou`.
const REGISTRY_ERROR_SIGNATURES = [
    'RequestError',
    'HTTPError',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EAI_AGAIN',
    'socket hang up',
    'Response code',
]

const DEFAULT_PACKAGE_JSON_PATH = fileURLToPath(new URL('../../package.json', import.meta.url))
const DEFAULT_EXCEPTIONS_PATH = fileURLToPath(
    new URL('../dependency-audit-exceptions.json', import.meta.url),
)

// Texto das versões que o Yarn não informa.
const UNKNOWN_VERSION = 'desconhecida'

// GHSA no caminho da URL do advisory: `/advisories/GHSA-xxxx-xxxx-xxxx`.
const GHSA_FROM_URL = /\/advisories\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/iu

const severities = ['info', 'low', 'moderate', 'high', 'critical']

function isBlocking(severity) {
    return severity === 'high' || severity === 'critical'
}

function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSeverity(value) {
    return severities.includes(value)
}

function normalizeCounts(counts) {
    return Object.fromEntries(severities.map((severity) => [severity, counts?.[severity] ?? 0]))
}

// Percorre a saída NDJSON uma vez: numera as linhas não vazias, valida cada advisory e agrupa
// por (id, pacote). `scope` ('produção' ou 'tooling') marca de qual execução por ambiente o
// advisory veio; na deduplicação entre execuções, produção vence (ver `mergeReports`).
export function parseYarnAuditJson(output, { scope = 'produção' } = {}) {
    const groups = new Map()
    let lineNumber = 0

    for (const line of output.split(/\r?\n/u)) {
        if (!line.trim()) continue
        lineNumber += 1
        addToGroup(groups, readAdvisory(parseAuditLine(line, lineNumber), lineNumber), scope)
    }

    const advisories = [...groups.values()].map(toAuditAdvisory)
    const counts = countsFromAdvisories(advisories)

    // Saída vazia é um relatório limpo, não uma falha: o Yarn 4 sai 0 e não imprime nada quando
    // não há advisory.
    return buildReport(advisories, counts)
}

function buildReport(advisories, counts) {
    return {
        counts,
        blockingTotal: counts.high + counts.critical,
        blockingAdvisories: advisories
            .filter((advisory) => isBlocking(advisory.severity))
            .map(({ module, title, url }) => ({ module, title, url })),
        advisories,
    }
}

// Agrupa por (id, pacote): o mesmo advisory pode chegar por mais de um Dependent e o mesmo id
// numérico do Yarn pode valer para pacotes diferentes, cada um com registro próprio.
function addToGroup(groups, advisory, scope) {
    const key = `${advisory.id}\u0000${advisory.module}`
    const group = groups.get(key) ?? {
        advisory,
        versions: new Set(),
        dependents: new Set(),
        scope,
    }
    for (const version of advisory.versions) group.versions.add(version)
    for (const dependent of advisory.dependents) group.dependents.add(dependent)
    // Produção vence tooling quando o mesmo par aparece nas duas execuções.
    if (scope === 'produção') group.scope = 'produção'
    groups.set(key, group)
}

function toAuditAdvisory({ advisory, versions, dependents, scope }) {
    return {
        id: advisory.id,
        module: advisory.module,
        title: advisory.title,
        url: advisory.url,
        severity: advisory.severity,
        scope,
        installed: versions.size ? [...versions].join(', ') : UNKNOWN_VERSION,
        vulnerable: advisory.vulnerable,
        patched: UNKNOWN_VERSION,
        pathCount: dependents.size,
    }
}

function parseAuditLine(line, lineNumber) {
    let entry
    try {
        entry = JSON.parse(line)
    } catch (error) {
        throw new AuditFailure(
            'saida-invalida',
            `A linha ${lineNumber} da saída do Yarn não é JSON válido: ${error.message}`,
        )
    }

    if (!isRecord(entry)) throw unexpectedFormat(lineNumber, 'o registro não é um objeto JSON')
    return entry
}

// Lê uma linha `{"value": "<pacote>", "children": { ... }}` do `yarn npm audit --json`.
function readAdvisory(entry, lineNumber) {
    const module = entry.value
    if (typeof module !== 'string' || !module)
        throw unexpectedFormat(lineNumber, 'advisory sem value (nome do pacote)')

    const children = entry.children
    if (!isRecord(children)) throw unexpectedFormat(lineNumber, 'advisory sem children')

    const id = children.ID
    if (typeof id !== 'number') throw unexpectedFormat(lineNumber, 'advisory sem ID numérico')

    const severity = children.Severity
    if (!isSeverity(severity))
        throw unexpectedFormat(lineNumber, 'advisory com severidade desconhecida')

    const url = readText(children, 'URL', lineNumber)

    return {
        // O GHSA é estável entre execuções; o id numérico muda com a base do registry.
        id: readGhsaFromUrl(url) ?? `npm-${id}`,
        module,
        title: readText(children, 'Issue', lineNumber),
        url,
        severity,
        versions: readTreeVersions(children),
        vulnerable: readOptionalText(children, 'Vulnerable Versions'),
        dependents: readDependents(children),
    }
}

function readGhsaFromUrl(url) {
    const match = GHSA_FROM_URL.exec(url)
    return match ? match[1] : undefined
}

function readTreeVersions(children) {
    const value = children['Tree Versions']
    if (!Array.isArray(value)) return []
    return value.filter((version) => typeof version === 'string' && version)
}

function readDependents(children) {
    const value = children.Dependents
    if (!Array.isArray(value)) return []
    return value.filter((dependent) => typeof dependent === 'string' && dependent)
}

function readOptionalText(record, field) {
    const value = record[field]
    return typeof value === 'string' && value ? value : UNKNOWN_VERSION
}

function readText(record, field, lineNumber) {
    const value = record[field]
    if (typeof value !== 'string') throw unexpectedFormat(lineNumber, `advisory sem ${field}`)
    return value
}

function unexpectedFormat(lineNumber, reason) {
    return new AuditFailure(
        'formato-inesperado',
        `A linha ${lineNumber} da saída do Yarn tem formato inesperado: ${reason}.`,
    )
}

function countsFromAdvisories(advisories) {
    const counts = normalizeCounts()
    for (const { severity } of advisories) counts[severity] += 1
    return counts
}

export function formatAuditSummary(report) {
    const { counts } = report
    return severities.map((severity) => `${severity}=${counts[severity]}`).join(' ')
}

// Funde os relatórios das duas execuções por ambiente em um só: deduplica por (id, pacote), com
// o advisory de produção vencendo o de tooling, e recalcula as contagens dos advisories únicos.
export function mergeReports(production, tooling) {
    const groups = new Map()
    for (const advisory of [...production.advisories, ...tooling.advisories]) {
        const key = `${advisory.id}\u0000${advisory.module}`
        const current = groups.get(key)
        if (current === undefined || (current.scope !== 'produção' && advisory.scope === 'produção'))
            groups.set(key, advisory)
    }
    const advisories = [...groups.values()]
    return buildReport(advisories, countsFromAdvisories(advisories))
}

// Executa uma vez o `yarn npm audit`, classifica as falhas de execução e devolve o relatório de
// um ambiente. A ordem das checagens importa: erro de spawn e sinal antes da saída, falha de
// rede antes do veredito, e só então o parse. A saída vazia com exit != 0 e sem assinatura de
// rede é falha do próprio Yarn; a saída vazia com exit 0 é um relatório limpo.
export function executeYarnAudit({
    command,
    args,
    cwd = process.cwd(),
    env = process.env,
    maxBufferBytes = AUDIT_MAX_BUFFER_BYTES,
    timeoutMs = AUDIT_TIMEOUT_MS,
    scope = 'produção',
}) {
    const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: maxBufferBytes,
        timeout: timeoutMs,
        shell: false,
    })

    // ENOBUFS e ETIMEDOUT também trazem `signal` SIGTERM; por isso o `error.code` é
    // classificado antes do sinal.
    if (result.error) throw classifySpawnError(result.error, maxBufferBytes, timeoutMs)
    if (result.signal) {
        throw new AuditFailure(
            'yarn-sinal',
            `O Yarn foi encerrado pelo sinal ${result.signal}. ${describeStderr(result.stderr)}`,
        )
    }

    // Falha de registry vem antes de classificar a saída: o erro chega só pelo stderr (stack do
    // Node) e no stdout não deixa relatório utilizável.
    const registryError = findRegistryError(result.stderr)
    if (registryError !== undefined) {
        throw new AuditFailure(
            'registry-indisponivel',
            `O Yarn não conseguiu consultar o endpoint de auditoria do registry (${AUDIT_ENDPOINT_PATH}), então o veredito não foi emitido. Isso é uma falha de registry ou de rede, não é uma vulnerabilidade: a execução pode ser repetida. Erro do Yarn: ${registryError.slice(0, STDERR_EXCERPT_MAX_CHARS)}`,
        )
    }

    // Saída vazia com exit != 0 e sem assinatura de rede: o Yarn falhou sem emitir relatório. O
    // Yarn sai com código diferente de zero quando há advisories, então uma saída vazia só é
    // esperada no relatório limpo (exit 0).
    if (!result.stdout.trim() && result.status !== 0) {
        throw new AuditFailure(
            'yarn-falhou',
            `O Yarn terminou com código de saída ${result.status} sem relatório de auditoria. ${describeStderr(result.stderr)}`,
        )
    }

    return parseYarnAuditJson(result.stdout, { scope })
}

// Procura, no stderr do Yarn 4, uma das assinaturas de falha de rede/registry. Devolve o trecho
// da primeira linha que casa, ou `undefined` quando nenhuma assinatura aparece.
function findRegistryError(stderr) {
    for (const line of stderr.split(/\r?\n/u)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (REGISTRY_ERROR_SIGNATURES.some((signature) => trimmed.includes(signature)))
            return trimmed
    }
    return undefined
}

function classifySpawnError(error, maxBufferBytes, timeoutMs) {
    if (error.code === 'ENOBUFS') {
        return new AuditFailure(
            'limite-de-saida',
            `A saída do yarn npm audit excedeu o limite de ${describeBytes(maxBufferBytes)}.`,
        )
    }
    if (error.code === 'ETIMEDOUT') {
        return new AuditFailure(
            'timeout',
            `O yarn npm audit excedeu o timeout de ${timeoutMs} ms e foi interrompido.`,
        )
    }
    return new AuditFailure('yarn-nao-iniciou', `Não foi possível iniciar o Yarn: ${error.message}`)
}

function describeBytes(bytes) {
    return bytes % BYTES_PER_MIB === 0 ? `${bytes / BYTES_PER_MIB} MiB` : `${bytes} bytes`
}

function describeStderr(stderr) {
    const text = stderr.trim()
    if (!text) return 'O stderr estava vazio.'
    const excerpt = text.slice(0, STDERR_EXCERPT_MAX_CHARS)
    const ellipsis = text.length > STDERR_EXCERPT_MAX_CHARS ? '…' : ''
    return `Início do stderr: ${excerpt}${ellipsis}`
}

// Devolve o código de saída: 0 só para relatório aprovado, 1 para todo o resto.
export function run(yarnCli, output = process, options = {}) {
    try {
        return runAudit(yarnCli, output, options)
    } catch (error) {
        output.stderr.write(`${describeFailure(error)}\n`)
        return 1
    }
}

function runAudit(yarnCli, output, options) {
    // O Yarn 4 define npm_execpath apontando para o yarn.js do Corepack (ou um wrapper temporário
    // que termina em `/yarn`). Aceita `yarn`, `yarn.js` e `yarn.cjs`.
    if (!yarnCli || !/yarn(?:\.c?js)?$/iu.test(yarnCli)) {
        output.stderr.write('Execute security:dependencies por meio do Yarn.\n')
        return 1
    }

    const {
        packageJsonPath = DEFAULT_PACKAGE_JSON_PATH,
        exceptionsPath = DEFAULT_EXCEPTIONS_PATH,
        now = new Date(),
    } = options

    // Arquivo de exceções inválido derruba a execução antes de qualquer consulta: nenhuma
    // exceção vale por engano.
    const exceptions = loadExceptions(exceptionsPath)

    const cwd = dirname(packageJsonPath)
    // O Corepack expõe o npm_execpath como um shim executável (um wrapper `sh` que chama o
    // yarn.js) ou, conforme a instalação, como o próprio `yarn.js`/`yarn.cjs`. Um arquivo JS
    // roda por `node`; o shim executável roda direto como comando.
    const isJsEntry = /\.c?js$/iu.test(yarnCli)
    const command = isJsEntry ? process.execPath : yarnCli
    const prefix = isJsEntry ? [yarnCli] : []
    const baseArgs = [...prefix, 'npm', 'audit', '--all', '--recursive', '--json']
    // Alcance vem do Yarn: produção = dependências de produção; tooling = dependências de
    // desenvolvimento. Deduplicação entre as duas execuções com produção vencendo.
    const production = executeYarnAudit({
        command,
        args: [...baseArgs, '--environment', 'production'],
        cwd,
        scope: 'produção',
    })
    const tooling = executeYarnAudit({
        command,
        args: [...baseArgs, '--environment', 'development'],
        cwd,
        scope: 'tooling',
    })
    const report = mergeReports(production, tooling)

    const blocking = report.advisories.filter(({ severity }) => isBlocking(severity))
    const evaluation = evaluateExceptions(exceptions, blocking, now)
    const effective = blocking.filter(
        (advisory) => !evaluation.applied.some((exception) => coversAdvisory(exception, advisory)),
    )

    writeAdvisories(output, report, effective)
    writeExceptions(output, evaluation)
    output.stdout.write(`Auditoria de dependências: ${formatAuditSummary(report)}\n`)

    const blockingTotal = effective.length
    if (blockingTotal > 0) {
        output.stderr.write(
            `Auditoria bloqueada por ${blockingTotal} vulnerabilidade(s) High/Critical.\n`,
        )
        return 1
    }

    if (report.counts.low + report.counts.moderate > 0) {
        output.stdout.write('Vulnerabilidades Low/Moderate foram reportadas sem bloquear o gate.\n')
    }
    return 0
}

function writeAdvisories(output, report, effective) {
    for (const advisory of effective) {
        output.stderr.write(
            `[bloqueante] ${advisory.module} ${advisory.installed} ${advisory.severity.toUpperCase()} ${advisory.scope} ${advisory.id} — ${advisory.title} (${advisory.url})\n`,
        )
    }
    for (const advisory of report.advisories) {
        if (isBlocking(advisory.severity)) continue
        const paths = `${advisory.pathCount} ${advisory.pathCount === 1 ? 'dependente' : 'dependentes'}`
        output.stdout.write(
            `[informativo] ${advisory.module} ${advisory.installed} ${advisory.severity} ${advisory.scope} ${advisory.id} — ${advisory.title} (${paths})\n`,
        )
    }
}

function writeExceptions(output, evaluation) {
    for (const entry of evaluation.applied) {
        output.stdout.write(
            `[exceção aplicada] ${describeException(entry)} — responsável ${entry.owner}, válida até ${entry.expiresAt}, aprovação ${entry.approval}\n`,
        )
    }
    for (const entry of evaluation.expired) {
        output.stdout.write(
            `[exceção vencida] ${describeException(entry)} — venceu em ${entry.expiresAt}\n`,
        )
    }
    for (const entry of evaluation.unused) {
        output.stdout.write(
            `[exceção sem efeito] ${describeException(entry)} — nenhum advisory correspondente\n`,
        )
    }
}

function describeException(entry) {
    return `${entry.advisory} ${entry.package}`
}

function describeFailure(error) {
    if (error instanceof AuditFailure) return error.message
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    return new AuditFailure('erro-interno', `Defeito inesperado no auditor: ${detail}`).message
}
