import { lstat, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'

import { isDate, isWithin, withoutFences } from './check-markdown.mjs'

const clean = (value) => value.replaceAll('**', '').replaceAll('`', '').trim()
export function section(text, heading) {
    const lines = withoutFences(text).split('\n')
    const start = lines.findIndex((line) => /^##\s+/.test(line) && heading.test(line))
    if (start < 0) return ''
    const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line))
    return lines
        .slice(start + 1, end < 0 ? undefined : end)
        .join('\n')
        .trim()
}
export function field(text, name) {
    const lines = clean(text).split('\n')
    const pattern = new RegExp(`^\\s*(?:-\\s*)?(?:${name}):\\s*(.*)$`, 'i')
    const start = lines.findIndex((line) => pattern.test(line))
    if (start < 0) return ''
    const parts = [lines[start].match(pattern)[1]]
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\s*-\s*[^:]+:|^##/.test(lines[i])) break
        parts.push(lines[i])
    }
    return parts.join('\n').trim()
}
const substantive = (value) =>
    value && !/\b(?:TODO|TBD)\b|<[^>]+>|AAAA-MM-DD|YYYY-MM-DD/i.test(value)
const dateField = (text) => isDate(field(text, 'Data').match(/\d{4}-\d{2}-\d{2}/)?.[0])
function approvedGate(text, number) {
    const gate = section(text, new RegExp(`Gate ${number}\\b`))
    const artifacts = field(gate, 'Artefatos(?: aprovados)?')
    return (
        /^aprovado\b/i.test(field(gate, 'Status')) &&
        dateField(gate) &&
        ['Aprovador', 'Referência', number === 1 ? 'Observações' : 'Exceções'].every((key) =>
            substantive(field(gate, key)),
        ) &&
        (number === 1 ? ['spec.md', 'clarification.md'] : ['plan.md', 'tasks.md']).every((file) =>
            artifacts.includes(file),
        )
    )
}
export async function checkState(spec, report) {
    const { data, directory, file, body } = spec
    const error = (rule, message, target = file) => report(target, rule, message)
    const states = [
        'draft',
        'specified',
        'clarified',
        'planned',
        'implementing',
        'validating',
        'validated',
    ]
    const level = states.indexOf(data.status)
    if (data.status === 'superseded' || data.status === 'abandoned') {
        const justification = section(
            body,
            data.status === 'superseded' ? /Substituição/ : /Abandono/,
        )
        if (
            !substantive(justification) ||
            justification.trim().length < 20 ||
            (data.status === 'superseded' && !data.related_specs?.length)
        )
            error(
                'justification',
                'Justificativa substantiva e relações aplicáveis são obrigatórias fora de fences.',
            )
        return
    }
    const load = async (name, aliases = []) => {
        for (const candidate of [name, ...aliases]) {
            try {
                if ((await lstat(join(directory, candidate))).isSymbolicLink()) {
                    error(
                        'artifact',
                        'Artefato governado não pode ser symlink.',
                        join(directory, candidate),
                    )
                    return { text: '', file: join(directory, candidate) }
                }
                if (!isWithin(directory, await realpath(join(directory, candidate)))) {
                    error(
                        'artifact',
                        'Artefato obrigatório escapa do diretório da spec.',
                        join(directory, candidate),
                    )
                    return { text: '', file: join(directory, candidate) }
                }
                return {
                    text: withoutFences(await readFile(join(directory, candidate), 'utf8')),
                    file: join(directory, candidate),
                }
            } catch (cause) {
                if (cause.code !== 'ENOENT') throw cause
            }
        }
        error('artifact', `Artefato obrigatório ausente: ${name}.`, join(directory, name))
        return { text: '', file: join(directory, name) }
    }
    if (level >= 1) {
        const checklist = await load('checklists/specification.md', ['specification-checklist.md'])
        const text = clean(checklist.text)
        const legacyReview = /Revisor:\s*[^\n.]+\.\s*Data:\s*(\d{4}-\d{2}-\d{2})/.exec(text)
        const reviewed =
            (substantive(field(text, 'Revisor')) && dateField(text)) ||
            (legacyReview && isDate(legacyReview[1]))
        if (
            !/^-\s*\[x\]/im.test(text) ||
            /^\s*-\s*\[ \]/m.test(text) ||
            !/^aprovad[ao]\b/i.test(
                field(text, 'Resultado') || field(section(text, /Resultado/), 'Status'),
            ) ||
            !reviewed
        )
            error(
                'checklist',
                'Checklist deve estar concluída, aprovada, com revisor e data.',
                checklist.file,
            )
    }
    if (level >= 2) {
        const clarification = await load('clarification.md')
        if (!approvedGate(clarification.text, 1))
            error('gate-1', 'Gate 1 exige aprovação, data e campos completos.', clarification.file)
    }
    let tasks
    if (level >= 3) {
        const plan = await load('plan.md')
        if (
            !section(plan.text, /Constitution Check.*pr[eé]/i) ||
            !section(plan.text, /Constitution Check.*p[oó]s/i)
        )
            error(
                'constitution-check',
                'Plano exige Constitution Check antes e depois do design.',
                plan.file,
            )
        tasks = await load('tasks.md')
        if (!approvedGate(tasks.text, 2))
            error(
                'gate-2',
                'Gate 2 exige plano e tarefas aprovados com exceções registradas.',
                tasks.file,
            )
        const consistency = section(tasks.text, /Análise de consistência/)
        const legacy = /^Aprovada por .+ em (\d{4}-\d{2}-\d{2}):\s*nenhuma/i.exec(consistency)
        const formal =
            /^aprovada\b/i.test(field(consistency, 'Status')) &&
            ['Revisor', 'Lacunas'].every((key) => substantive(field(consistency, key))) &&
            dateField(consistency)
        if (!(formal || (legacy && isDate(legacy[1]))))
            error(
                'consistency',
                'Análise de consistência aprovada, com revisor, data e lacunas, é obrigatória.',
                tasks.file,
            )
        const functional = [...body.matchAll(/^\s*-\s+\*?\*?(FR-\d+)\*?\*?:/gm)].map(
            (match) => match[1],
        )
        const lines = tasks.text
            .split('\n')
            .filter((line) => /^\s*-\s+\[[ xX]\]\s+T\d+\b/.test(line))
        for (const requirement of functional)
            if (
                !lines.some((line) =>
                    [...line.matchAll(/\[([^\]]+)\]/g)].some((tag) =>
                        tag[1].split(/\s*,\s*/).includes(requirement),
                    ),
                )
            )
                error('task-coverage', `${requirement} sem tarefa formal.`, tasks.file)
        if (level >= 5 && lines.some((line) => /^\s*-\s+\[ \]/.test(line)))
            error(
                'task-completion',
                'Validating/validated exigem todas as tarefas concluídas.',
                tasks.file,
            )
        if (level >= 5) {
            const validation = await load('validation.md')
            if (level >= 6) {
                const evidence = section(validation.text, /Evidências por requisito/)
                for (const requirement of functional) {
                    const rows = evidence
                        .split('\n')
                        .filter((line) => new RegExp(`^\\|\\s*${requirement}\\s*\\|`).test(line))
                    const cells =
                        rows[0]
                            ?.split(/(?<!\\)\|/)
                            .slice(1, -1)
                            .map(clean) ?? []
                    if (
                        rows.length !== 1 ||
                        cells.length !== 4 ||
                        cells[3] !== 'PASS' ||
                        ![cells[1], cells[2]].every(substantive)
                    )
                        error(
                            'evidence-coverage',
                            `${requirement} exige exatamente uma linha própria PASS com tarefa e evidência preenchidas sem placeholders.`,
                            validation.file,
                        )
                }
                const state = section(validation.text, /^##\s+Estado\b/)
                if (
                    !['Spec', 'Status', 'Constituição', 'Executor/revisor', 'Commit'].every((key) =>
                        substantive(field(state, key)),
                    ) ||
                    !dateField(state) ||
                    field(state, 'Constituição') !== data.constitution_version ||
                    !/^aprovado\b/.test(field(state, 'Status'))
                )
                    error(
                        'validation-state',
                        'Estado de validação deve estar completo.',
                        validation.file,
                    )
                const gate = section(validation.text, /Gate 3\b/)
                if (
                    !['aprovado', 'aprovado com risco aceito'].includes(field(gate, 'Veredito')) ||
                    !dateField(gate) ||
                    !['Aprovador', 'Escopo aprovado', 'Riscos aceitos', 'Observações'].every(
                        (key) => substantive(field(gate, key)),
                    )
                )
                    error(
                        'gate-3',
                        'Gate 3 exige veredito aprovado e campos completos.',
                        validation.file,
                    )
            }
        }
    }
}
