import { readFileSync } from 'node:fs'

import { AuditFailure } from './dependency-audit-failure.mjs'

// Prazo máximo entre a aprovação e a validade de uma exceção, para obrigar a
// reavaliação. Unidade: dias corridos.
export const MAX_EXCEPTION_VALIDITY_DAYS = 90

// Unidade: milissegundos por dia. Todas as datas são comparadas em UTC, sem horário de
// verão, então o dia tem sempre esta duração.
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Unidade: caracteres de uma data ISO `AAAA-MM-DD`.
const ISO_DATE_LENGTH = 10

const fields = [
    'advisory',
    'package',
    'owner',
    'justification',
    'approval',
    'approvedAt',
    'expiresAt',
]

const WILDCARD = /[*?]/u
const ADVISORY_ID = /^(?:GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|npm-\d+)$/u
const PACKAGE_NAME_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u
const BYTE_ORDER_MARK = /^\uFEFF/u

// Arquivo ausente equivale a nenhuma exceção; qualquer outro defeito do arquivo derruba o
// auditor, para que nenhuma exceção valha por engano.
export function loadExceptions(path) {
    let text
    try {
        text = readFileSync(path, 'utf8')
    } catch (error) {
        if (error.code === 'ENOENT') return []
        throw invalidExceptions([`não foi possível ler ${path}: ${error.message}`])
    }
    return parseExceptions(text)
}

export function parseExceptions(text) {
    const source = text.replace(BYTE_ORDER_MARK, '')
    if (!source.trim()) return []

    let root
    try {
        root = JSON.parse(source)
    } catch (error) {
        throw invalidExceptions([`o arquivo não é JSON válido: ${error.message}`])
    }

    const list = isRecord(root) ? root.exceptions : undefined
    if (!Array.isArray(list)) {
        throw invalidExceptions([
            'exceptions: a raiz do arquivo deve ser um objeto com a lista "exceptions"',
        ])
    }

    const problems = []
    const seen = new Map()
    list.forEach((entry, index) => {
        const prefix = `exceptions[${index}]`
        if (!isRecord(entry)) {
            problems.push(`${prefix}: a entrada deve ser um objeto`)
            return
        }

        const entryProblems = validateEntry(entry, prefix)
        problems.push(...entryProblems)
        if (entryProblems.length) return

        const key = `${entry.advisory}\u0000${entry.package}`
        const first = seen.get(key)
        if (first === undefined) seen.set(key, index)
        else {
            problems.push(
                `${prefix}: entrada duplicada de exceptions[${first}] (mesmo advisory e pacote)`,
            )
        }
    })

    if (problems.length) throw invalidExceptions(problems)
    return list
}

// `expired` lista toda exceção vencida, haja ou não advisory correspondente; `unused` lista
// a exceção válida que não cobre nenhum bloqueante atual. O relógio entra por `now`.
export function evaluateExceptions(entries, blocking, now) {
    const today = dayOf(now)
    const problems = entries.flatMap((entry, index) => {
        const approvedAt = parseDay(entry.approvedAt)
        // As entradas vêm de `parseExceptions`; a checagem mantém o veredito fechado se
        // alguém montar uma entrada à mão.
        if (approvedAt === undefined || parseDay(entry.expiresAt) === undefined)
            return [`exceptions[${index}]: datas inválidas`]
        return approvedAt > today
            ? [
                  `exceptions[${index}].approvedAt: a aprovação não pode estar no futuro (${entry.approvedAt})`,
              ]
            : []
    })
    if (problems.length) throw invalidExceptions(problems)

    const result = { applied: [], expired: [], unused: [] }
    for (const entry of entries) {
        if (parseDay(entry.expiresAt) < today) result.expired.push(entry)
        else if (blocking.some((target) => coversAdvisory(entry, target)))
            result.applied.push(entry)
        else result.unused.push(entry)
    }
    return result
}

// A exceção vale só para o par advisory e pacote que ela informa.
export function coversAdvisory(exception, target) {
    return exception.advisory === target.id && exception.package === target.module
}

function validateEntry(entry, prefix) {
    const problems = Object.keys(entry)
        .filter((key) => !fields.includes(key))
        .map((key) => `${prefix}.${key}: campo desconhecido`)

    for (const field of fields) {
        const value = entry[field]
        if (typeof value !== 'string' || !value.trim())
            problems.push(`${prefix}.${field}: obrigatório, texto não vazio`)
    }
    if (problems.length) return problems

    problems.push(
        ...checkIdentifier(
            entry.advisory,
            (value) => ADVISORY_ID.test(value),
            `${prefix}.advisory`,
            'use o identificador GHSA-xxxx-xxxx-xxxx ou npm-<id>',
        ),
        ...checkIdentifier(
            entry.package,
            isPackageName,
            `${prefix}.package`,
            'use o nome exato do pacote npm',
        ),
        ...checkDates(entry, prefix),
    )
    return problems
}

// Nome exato de pacote npm: `nome` ou `@escopo/nome`.
function isPackageName(value) {
    const scoped = value.startsWith('@')
    const parts = scoped ? value.slice(1).split('/') : [value]
    return parts.length === (scoped ? 2 : 1) && parts.every((part) => PACKAGE_NAME_PART.test(part))
}

function checkIdentifier(value, isValid, field, hint) {
    if (WILDCARD.test(value)) return [`${field}: curinga não é permitido (${value})`]
    return isValid(value) ? [] : [`${field}: formato inválido, ${hint}`]
}

function checkDates(entry, prefix) {
    const problems = []
    const approvedAt = parseDay(entry.approvedAt)
    const expiresAt = parseDay(entry.expiresAt)

    if (approvedAt === undefined)
        problems.push(`${prefix}.approvedAt: data inválida, use AAAA-MM-DD (${entry.approvedAt})`)
    if (expiresAt === undefined)
        problems.push(`${prefix}.expiresAt: data inválida, use AAAA-MM-DD (${entry.expiresAt})`)
    if (approvedAt === undefined || expiresAt === undefined) return problems

    if (expiresAt < approvedAt) {
        problems.push(
            `${prefix}.expiresAt: a validade é anterior a approvedAt (${entry.expiresAt} < ${entry.approvedAt})`,
        )
    } else if ((expiresAt - approvedAt) / MS_PER_DAY > MAX_EXCEPTION_VALIDITY_DAYS) {
        problems.push(
            `${prefix}.expiresAt: a validade excede ${MAX_EXCEPTION_VALIDITY_DAYS} dias após approvedAt (${entry.expiresAt})`,
        )
    }
    return problems
}

// Meia-noite UTC do dia informado, ou `undefined` se não for uma data real.
function parseDay(value) {
    const match = ISO_DATE.exec(value)
    if (!match) return undefined

    const [year, month, day] = [match[1], match[2], match[3]].map(Number)
    const time = Date.UTC(year, month - 1, day)
    const date = new Date(time)
    const isReal =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    return isReal ? time : undefined
}

function dayOf(now) {
    return parseDay(now.toISOString().slice(0, ISO_DATE_LENGTH))
}

function invalidExceptions(problems) {
    return new AuditFailure(
        'excecoes-invalidas',
        `O arquivo de exceções é inválido e nenhuma exceção foi aplicada: ${problems.join('; ')}.`,
    )
}

function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
