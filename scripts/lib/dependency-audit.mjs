import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

// O `yarn audit --json` excede o limite padrão de 1 MiB do spawnSync.
// Unidade: bytes de stdout; acima dele o spawnSync encerra o processo (ENOBUFS).
export const AUDIT_MAX_BUFFER_BYTES = 64 * BYTES_PER_MIB

// Orçamento local para o `yarn audit` terminar, sem medição de cauda.
// Unidade: milissegundos; ao excedê-lo o spawnSync encerra o processo.
export const AUDIT_TIMEOUT_MS = 5 * MS_PER_MINUTE

// Orçamento local para o início do stderr exibido nas falhas do Yarn.
// Unidade: caracteres.
export const STDERR_EXCERPT_MAX_CHARS = 500

// Endpoint de auditoria que o Yarn 1 consulta; é fixo no código do Yarn, e o erro
// de rede ou de HTTP o cita na mensagem.
export const AUDIT_ENDPOINT_PATH = '/-/npm/v1/security/audits'

const DEFAULT_PACKAGE_JSON_PATH = fileURLToPath(new URL('../../package.json', import.meta.url))
const DEFAULT_EXCEPTIONS_PATH = fileURLToPath(
    new URL('../dependency-audit-exceptions.json', import.meta.url),
)

// Texto das versões que o Yarn não informa.
const UNKNOWN_VERSION = 'desconhecida'

// Separador dos itens da cadeia de dependência em `resolution.path`.
const CHAIN_SEPARATOR = '>'

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

function isCount(value) {
    return Number.isInteger(value) && value >= 0
}

function normalizeCounts(counts) {
    return Object.fromEntries(severities.map((severity) => [severity, counts?.[severity] ?? 0]))
}

// Percorre a saída uma vez: numera as linhas não vazias, valida cada registro e agrupa os
// advisories. `productionRoots` são as chaves de `dependencies` do package.json; sem elas o
// alcance não pode ser decidido e todo advisory vale como produção, a classificação mais
// estrita.
export function parseYarnAuditJson(output, { productionRoots } = {}) {
    const groups = new Map()
    const errors = []
    let summary
    let lineNumber = 0

    for (const line of output.split(/\r?\n/u)) {
        if (!line.trim()) continue
        lineNumber += 1
        const entry = parseAuditLine(line, lineNumber)

        if (entry.type === 'error') errors.push(String(entry.data))
        else if (entry.type === 'auditAdvisory')
            addToGroup(groups, readAdvisory(entry.data, lineNumber), productionRoots)
        else if (entry.type === 'auditSummary') summary = readSummary(entry.data, lineNumber)
    }

    const advisories = [...groups.values()].map(toAuditAdvisory)
    const counts = summary ?? countsFromAdvisories(advisories)

    if (summary === undefined && advisories.length === 0 && errors.length === 0) {
        throw new AuditFailure(
            'sem-dados',
            'A saída do Yarn não tem resumo, advisory nem erro de auditoria.',
        )
    }

    return {
        counts,
        errors,
        blockingTotal: counts.high + counts.critical,
        blockingAdvisories: advisories
            .filter((advisory) => isBlocking(advisory.severity))
            .map(({ module, title, url }) => ({ module, title, url })),
        advisories,
    }
}

// O mesmo advisory chega uma vez por caminho da cadeia. Agrupa por identificador e pacote:
// o mesmo GHSA pode valer para pacotes diferentes (como `vitest` e `@vitest/mocker`, com ids
// numéricos distintos), e cada pacote precisa de um registro próprio. Marca como produção se
// qualquer caminho nasce em `dependencies`, pois a flag `dev` do Yarn 1 não separa os dois
// alcances.
function addToGroup(groups, advisory, productionRoots) {
    const root = advisory.path.split(CHAIN_SEPARATOR)[0]
    const production = productionRoots === undefined || productionRoots.has(root)
    const key = `${advisory.id}\u0000${advisory.details.module}`

    const group = groups.get(key) ?? {
        advisory,
        versions: new Set(),
        paths: new Set(),
        production: false,
    }
    for (const version of advisory.versions) group.versions.add(version)
    group.paths.add(advisory.path)
    group.production ||= production
    groups.set(key, group)
}

function toAuditAdvisory({ advisory, versions, paths, production }) {
    return {
        id: advisory.id,
        ...advisory.details,
        severity: advisory.severity,
        scope: production ? 'produção' : 'tooling',
        installed: versions.size ? [...versions].join(', ') : UNKNOWN_VERSION,
        vulnerable: advisory.vulnerable,
        patched: advisory.patched,
        pathCount: paths.size,
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

function readAdvisory(data, lineNumber) {
    const advisory = isRecord(data) ? data.advisory : undefined
    if (!isRecord(advisory)) throw unexpectedFormat(lineNumber, 'auditAdvisory sem data.advisory')

    const { id, severity } = advisory
    if (typeof id !== 'number') throw unexpectedFormat(lineNumber, 'advisory sem id numérico')
    if (!isSeverity(severity))
        throw unexpectedFormat(lineNumber, 'advisory com severidade desconhecida')

    const details = {
        module: readText(advisory, 'module_name', lineNumber),
        title: readText(advisory, 'title', lineNumber),
        url: readText(advisory, 'url', lineNumber),
    }
    const path = isRecord(data.resolution) ? data.resolution.path : undefined
    if (typeof path !== 'string' || !path)
        throw unexpectedFormat(lineNumber, 'advisory sem resolution.path')

    return {
        // O GHSA é estável entre execuções; o id numérico muda com a base.
        id: readGithubId(advisory) ?? `npm-${id}`,
        severity,
        details,
        path,
        versions: readInstalledVersions(advisory),
        vulnerable: readOptionalText(advisory, 'vulnerable_versions'),
        patched: readOptionalText(advisory, 'patched_versions'),
    }
}

function readGithubId(advisory) {
    const value = advisory.github_advisory_id
    return typeof value === 'string' && value ? value : undefined
}

function readInstalledVersions(advisory) {
    const findings = Array.isArray(advisory.findings) ? advisory.findings : []
    return findings.flatMap((finding) =>
        isRecord(finding) && typeof finding.version === 'string' ? [finding.version] : [],
    )
}

function readOptionalText(record, field) {
    const value = record[field]
    return typeof value === 'string' && value ? value : UNKNOWN_VERSION
}

function readSummary(data, lineNumber) {
    const vulnerabilities = isRecord(data) ? data.vulnerabilities : undefined
    if (!isRecord(vulnerabilities))
        throw unexpectedFormat(lineNumber, 'auditSummary sem vulnerabilities')

    for (const severity of severities) {
        const count = vulnerabilities[severity]
        if (count !== undefined && !isCount(count))
            throw unexpectedFormat(lineNumber, `auditSummary com contagem inválida em ${severity}`)
    }
    return normalizeCounts(vulnerabilities)
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

export function executeYarnAudit({
    command,
    args,
    cwd = process.cwd(),
    env = process.env,
    maxBufferBytes = AUDIT_MAX_BUFFER_BYTES,
    timeoutMs = AUDIT_TIMEOUT_MS,
    productionRoots,
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

    // Falha de registry vem antes de classificar a saída: o erro pode chegar só pelo stderr
    // e, no stdout, não deixa relatório utilizável.
    const registryError = findRegistryError(result.stdout, result.stderr)
    if (registryError !== undefined) {
        throw new AuditFailure(
            'registry-indisponivel',
            `O Yarn não conseguiu consultar o endpoint de auditoria do registry (${AUDIT_ENDPOINT_PATH}), então o veredito não foi emitido. Isso é uma falha de registry ou de rede, não é uma vulnerabilidade: a execução pode ser repetida. Erro do Yarn: ${registryError.slice(0, STDERR_EXCERPT_MAX_CHARS)}`,
        )
    }

    try {
        return parseYarnAuditJson(result.stdout, { productionRoots })
    } catch (error) {
        // O código de saída do Yarn só entra quando não há relatório: com um relatório
        // válido, o veredito vem dele, pois o Yarn sai com código diferente de zero sempre
        // que há advisories.
        const withoutReport = error instanceof AuditFailure && error.category === 'sem-dados'
        if (withoutReport && result.status !== 0) {
            throw new AuditFailure(
                'yarn-falhou',
                `O Yarn terminou com código de saída ${result.status} sem relatório de auditoria. ${describeStderr(result.stderr)}`,
            )
        }
        throw error
    }
}

// Procura o erro do Yarn que cita o endpoint de auditoria: registro `error` no stdout ou no
// stderr, ou texto puro no stderr. Um `warning` que cita o endpoint não é falha.
function findRegistryError(stdout, stderr) {
    return findEndpointError(stdout, false) ?? findEndpointError(stderr, true)
}

function findEndpointError(stream, acceptPlainText) {
    for (const line of stream.split(/\r?\n/u)) {
        if (!line.includes(AUDIT_ENDPOINT_PATH)) continue

        const entry = parseJsonRecord(line)
        if (entry === undefined) {
            if (acceptPlainText) return line.trim()
            continue
        }
        const data = entry.type === 'error' ? entry.data : undefined
        if (typeof data === 'string' && data.includes(AUDIT_ENDPOINT_PATH))
            return data.split(/\r?\n/u)[0]
    }
    return undefined
}

function parseJsonRecord(line) {
    try {
        const entry = JSON.parse(line)
        return isRecord(entry) ? entry : undefined
    } catch {
        return undefined
    }
}

function classifySpawnError(error, maxBufferBytes, timeoutMs) {
    if (error.code === 'ENOBUFS') {
        return new AuditFailure(
            'limite-de-saida',
            `A saída do yarn audit excedeu o limite de ${describeBytes(maxBufferBytes)}.`,
        )
    }
    if (error.code === 'ETIMEDOUT') {
        return new AuditFailure(
            'timeout',
            `O yarn audit excedeu o timeout de ${timeoutMs} ms e foi interrompido.`,
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
    if (!yarnCli || !/yarn(?:\.js)?$/iu.test(yarnCli)) {
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
    const report = executeYarnAudit({
        command: process.execPath,
        args: [yarnCli, 'audit', '--json'],
        cwd: dirname(packageJsonPath),
        productionRoots: readProductionRoots(packageJsonPath),
    })

    const blocking = report.advisories.filter(({ severity }) => isBlocking(severity))
    const evaluation = evaluateExceptions(exceptions, blocking, now)
    const effective = blocking.filter(
        (advisory) => !evaluation.applied.some((exception) => coversAdvisory(exception, advisory)),
    )

    writeAdvisories(output, report, effective)
    writeExceptions(output, evaluation)
    output.stdout.write(`Auditoria de dependências: ${formatAuditSummary(report)}\n`)

    if (report.errors.length) {
        throw new AuditFailure(
            'erros-do-yarn',
            `O Yarn reportou erro(s): ${report.errors.join('; ')}`,
        )
    }

    // Um resumo com High/Critical sem advisory que o explique não pode ser coberto por
    // exceção: segue bloqueando.
    const blockingTotal = blocking.length ? effective.length : report.blockingTotal
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

// Raízes de cadeia que contam como produção: as chaves de `dependencies`.
function readProductionRoots(packageJsonPath) {
    let dependencies
    try {
        const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
        dependencies = isRecord(manifest) ? manifest.dependencies : undefined
    } catch (error) {
        throw new Error(
            `Não foi possível ler o package.json em ${packageJsonPath}: ${error.message}`,
        )
    }
    if (!isRecord(dependencies))
        throw new Error(`O package.json em ${packageJsonPath} não tem o objeto "dependencies".`)
    return new Set(Object.keys(dependencies))
}

function writeAdvisories(output, report, effective) {
    for (const advisory of effective) {
        output.stderr.write(
            `[bloqueante] ${advisory.module} ${advisory.installed} ${advisory.severity.toUpperCase()} ${advisory.scope} ${advisory.id} — ${advisory.title} (${advisory.url})\n`,
        )
    }
    for (const advisory of report.advisories) {
        if (isBlocking(advisory.severity)) continue
        const paths = `${advisory.pathCount} ${advisory.pathCount === 1 ? 'caminho' : 'caminhos'}`
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
