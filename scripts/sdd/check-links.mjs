import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

import { isWithin, withoutFences } from './check-markdown.mjs'

function headings(text) {
    const counts = new Map()
    return text.split('\n').flatMap((line) => {
        const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/)?.[1]
        if (!heading) return []
        const slug = heading
            .toLowerCase()
            .replace(/<[^>]*>|[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '')
            .replace(/\s/g, '-')
        const count = counts.get(slug) ?? 0
        counts.set(slug, count + 1)
        return [count ? `${slug}-${count}` : slug]
    })
}
function destinations(text) {
    // Fences and inline code are examples, not declarations of live links.
    const source = withoutFences(text).replace(/(`+)[^\n]*?\1/g, '')
    const references = new Map()
    const links = []
    const normalize = (key) => key.trim().replace(/\s+/g, ' ').toLowerCase()
    const target = (value) =>
        value.trim().startsWith('<')
            ? value.trim().slice(1, value.indexOf('>'))
            : value.trim().split(/\s+["']/)[0]
    for (const match of source.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(.+)$/gm)) {
        references.set(normalize(match[1]), target(match[2]))
        links.push({ target: target(match[2]) })
    }
    const prose = source.replace(/^\s{0,3}\[[^\]]+\]:.*$/gm, '')
    // Balance parentheses in destinations; names may include nested brackets.
    for (let index = 0; index < prose.length; index++) {
        if (prose[index] !== '[' || prose[index - 1] === '\\') continue
        let end = index + 1
        let brackets = 1
        while (end < prose.length && brackets) {
            if (prose[end] === '[') brackets++
            if (prose[end] === ']') brackets--
            if (brackets) end++
        }
        if (brackets) continue
        const label = prose.slice(index + 1, end)
        if (prose[end + 1] === '(') {
            let cursor = end + 2
            let balance = 1
            while (cursor < prose.length && balance) {
                if (prose[cursor - 1] !== '\\') {
                    if (prose[cursor] === '(') balance++
                    if (prose[cursor] === ')') balance--
                }
                if (balance) cursor++
            }
            if (!balance) {
                links.push({ target: target(prose.slice(end + 2, cursor)) })
                index = cursor
            }
        } else if (prose[end + 1] === '[') {
            const close = prose.indexOf(']', end + 2)
            if (close >= 0) {
                const key = normalize(prose.slice(end + 2, close) || label)
                links.push({ target: references.get(key), reference: key })
                index = close
            }
        } else if (references.has(normalize(label))) {
            links.push({ target: references.get(normalize(label)) })
            index = end
        }
    }
    return links
}
export async function markdownFiles(directory) {
    const files = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name)
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory()) files.push(...(await markdownFiles(file)))
        else if (entry.isFile() && extname(entry.name) === '.md') files.push(file)
    }
    return files
}
export async function checkLinks(file, root, report) {
    if (!isWithin(root, await realpath(file))) {
        report(file, 'artifact', 'Documento governado escapa da raiz.')
        return
    }
    const text = await readFile(file, 'utf8')
    for (const link of destinations(text)) {
        const fail = (message) => report(file, 'link', message)
        if (!link.target) {
            fail(`Referência Markdown não definida: ${link.reference}.`)
            continue
        }
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link.target)) continue
        const [location, rawFragment] = link.target.split('#', 2)
        let local, fragment
        try {
            local = decodeURIComponent(location.split('?')[0]).replace(/\\([()])/g, '$1')
            fragment = rawFragment === undefined ? undefined : decodeURIComponent(rawFragment)
        } catch {
            fail(`URL local inválida: ${link.target}.`)
            continue
        }
        const candidate = local
            ? local.startsWith('/')
                ? resolve(root, '.' + local)
                : resolve(dirname(file), local)
            : file
        let actual
        try {
            actual = await realpath(candidate)
        } catch {
            fail(`Destino local inexistente: ${link.target}.`)
            continue
        }
        if (
            relative(root, actual).startsWith('..' + sep) ||
            (actual !== root && relative(root, actual) === '..')
        ) {
            fail(`Link escapa da raiz: ${link.target}.`)
            continue
        }
        if (fragment && extname(actual) === '.md' && (await stat(actual)).isFile()) {
            const target = withoutFences(await readFile(actual, 'utf8'))
            const anchor = new RegExp(
                `(?:id|name)=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            )
            if (!headings(target).includes(fragment) && !anchor.test(target))
                fail(`Fragmento inexistente: ${link.target}.`)
        }
    }
}
