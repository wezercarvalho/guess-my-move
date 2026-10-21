import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, relative, resolve, sep } from 'node:path'

import { checkLinks, markdownFiles } from './check-links.mjs'
import { checkState, field, section } from './check-state.mjs'
import { isDate, isWithin, withoutFences } from './check-markdown.mjs'

const requireRoot = createRequire(new URL('../../package.json', import.meta.url))
const { parseDocument } = requireRoot('yaml')
const states = [
    'draft',
    'specified',
    'clarified',
    'planned',
    'implementing',
    'validating',
    'validated',
    'superseded',
    'abandoned',
]
const isText = (value) =>
    typeof value === 'string' &&
    value.trim() !== '' &&
    !/\b(?:TODO|TBD)\b|<[^>]+>|AAAA-MM-DD|YYYY-MM-DD/i.test(value)
export async function checkCatalog(inputRoot, { extraFiles = [] } = {}) {
    const root = await realpath(resolve(inputRoot))
    const errors = []
    const error = (file, rule, message) =>
        errors.push({
            file: relative(root, file).split(sep).join('/'),
            rule,
            message,
        })
    const constitutionFile = join(root, 'docs/development-strategies/sdd/constitution.md')
    let version
    try {
        if (!isWithin(root, await realpath(constitutionFile)))
            throw new Error('Constituição fora da raiz.')
        version = (await readFile(constitutionFile, 'utf8')).match(
            /(?:\*\*)?Versão:(?:\*\*)?\s*(\d+\.\d+\.\d+)/,
        )?.[1]
    } catch {
        error(constitutionFile, 'constitution', 'Constituição vigente não encontrada.')
    }
    if (!version) error(constitutionFile, 'constitution', 'Versão constitucional não identificada.')
    let entries
    try {
        if ((await lstat(join(root, 'specs'))).isSymbolicLink()) {
            error(join(root, 'specs'), 'catalog', 'O catálogo não pode ser symlink.')
            return errors
        }
        entries = await readdir(join(root, 'specs'), { withFileTypes: true })
    } catch {
        error(join(root, 'specs'), 'catalog', 'Catálogo de specs não encontrado.')
        return errors
    }
    const catalog = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) {
            error(
                join(root, 'specs', entry.name),
                'catalog',
                'Diretórios de spec não podem ser symlinks.',
            )
            continue
        }
        if (!entry.isDirectory()) continue
        const directory = join(root, 'specs', entry.name)
        const file = join(directory, 'spec.md')
        let source
        try {
            if ((await lstat(file)).isSymbolicLink()) {
                error(file, 'artifact', 'spec.md não pode ser symlink.')
                continue
            }
            source = await readFile(file, 'utf8')
        } catch {
            error(file, 'artifact', 'spec.md obrigatório não encontrado.')
            continue
        }
        const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
        if (!match) {
            error(file, 'frontmatter', 'Frontmatter YAML obrigatório ausente.')
            continue
        }
        const document = parseDocument(match[1], { uniqueKeys: true })
        if (document.errors.length) {
            error(file, 'frontmatter', 'Frontmatter YAML inválido: ' + document.errors[0].message)
            continue
        }
        const data = document.toJS()
        if (!data || Array.isArray(data) || typeof data !== 'object') {
            error(file, 'frontmatter', 'Frontmatter deve ser um mapa YAML.')
            continue
        }
        const body = withoutFences(source.slice(match[0].length))
        if (
            !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+){2,}$/.test(entry.name) ||
            data.id !== entry.name ||
            data.id !== `${data.created_at}-${data.slug}` ||
            !isDate(data.created_at)
        )
            error(
                file,
                'identity',
                'Pasta, id, data real de criação e slug devem definir a mesma identidade completa.',
            )
        for (const key of [
            'id',
            'title',
            'slug',
            'strategy',
            'domain',
            'capability',
            'objective',
            'summary',
            'constitution_version',
        ])
            if (!isText(data[key]))
                error(file, 'metadata', `Campo ${key} obrigatório, textual e sem placeholder.`)
        for (const key of [
            'owners',
            'reviewers',
            'aliases',
            'code_paths',
            'related_specs',
            'supersedes',
        ])
            if (
                !Array.isArray(data[key]) ||
                !data[key].every(isText) ||
                (key === 'owners' && data[key].length === 0)
            )
                error(
                    file,
                    'metadata',
                    `Campo ${key} deve ser lista de textos${key === 'owners' ? ' não vazia' : ''}.`,
                )
        if (data.branch !== null && !isText(data.branch))
            error(file, 'metadata', 'branch deve ser texto ou null.')
        if (data.strategy !== 'sdd' || !states.includes(data.status))
            error(file, 'metadata', 'Estratégia ou estado inválido.')
        if (!isDate(data.updated_at) || data.updated_at < data.created_at)
            error(file, 'metadata', 'updated_at deve ser data real igual ou posterior à criação.')
        if (data.constitution_version !== version) {
            const adoption = section(body, /Adoção constitucional/)
            const preserved = field(adoption, 'Versão preservada')
            const approved =
                field(adoption, 'Status') === 'aprovado' &&
                ['Aprovador', 'Referência', 'Justificativa'].every((key) =>
                    isText(field(adoption, key)),
                ) &&
                isDate(field(adoption, 'Data'))
            if (
                !/^\d+\.\d+\.\d+$/.test(data.constitution_version) ||
                preserved !== data.constitution_version ||
                !approved
            )
                error(
                    file,
                    'metadata',
                    'Versão diferente da vigente exige registro aprovado de adoção constitucional e justificativa.',
                )
        }
        catalog.push({ directory, file, name: entry.name, data, body })
    }
    const ids = new Set()
    for (const spec of catalog) {
        if (ids.has(spec.data.id))
            error(spec.file, 'duplicate-id', 'Identidade completa duplicada.')
        ids.add(spec.data.id)
    }
    for (const spec of catalog)
        for (const key of ['related_specs', 'supersedes'])
            if (Array.isArray(spec.data[key]))
                for (const id of spec.data[key])
                    if (!ids.has(id))
                        error(spec.file, 'relation', `Destino de ${key} inexistente: ${id}.`)
    for (const spec of catalog) {
        await checkState(spec, error)
        for (const file of await markdownFiles(spec.directory)) await checkLinks(file, root, error)
    }
    const guides = await markdownFiles(join(root, 'docs/development-strategies/sdd'))
    for (const file of guides.filter(
        (file) => !relative(root, file).split(sep).includes('templates'),
    ))
        await checkLinks(file, root, error)
    const catalogReadme = join(root, 'specs/README.md')
    try {
        await lstat(catalogReadme)
        await checkLinks(catalogReadme, root, error)
    } catch (cause) {
        if (cause.code !== 'ENOENT') throw cause
    }
    for (const name of extraFiles) {
        const file = resolve(root, name)
        if (relative(root, file) === '..' || relative(root, file).startsWith('..' + sep)) {
            error(file, 'artifact', 'Documento extra escapa da raiz.')
            continue
        }
        try {
            if ((await lstat(file)).isSymbolicLink()) {
                error(file, 'artifact', 'Documento governado não pode ser symlink.')
                continue
            }
            if (!isWithin(root, await realpath(file))) {
                error(file, 'artifact', 'Documento extra escapa da raiz por symlink.')
                continue
            }
            await checkLinks(file, root, error)
        } catch (cause) {
            if (cause.code === 'ENOENT') error(file, 'artifact', 'Documento extra não encontrado.')
            else throw cause
        }
    }
    return errors.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule))
}
