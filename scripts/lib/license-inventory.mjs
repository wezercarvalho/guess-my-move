// Inventário de licenças: lockfile + metadados e avisos da instalação local.
// Não executa dependências, não consulta serviços, não presume licença por nome.
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('../../', import.meta.url))
const packageName = /^(@[^/@]+\/[^/@]+|[^/@]+)@(?:npm:|workspace:|patch:)/
const noticeName = /^(?:licen[cs]e|copying|notice|copyright)(?:$|[._-])/i
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const sorted = (values) => [...values].sort()
const workspacePath = (locator) => locator.split('@workspace:')[1]

export function lockRows(source, workspaces) {
    const rows = new Map()
    const descriptors = new Map()
    const names = new Map()
    for (const [key, entry] of Object.entries(parse(source))) {
        if (key === '__metadata') continue
        if (!entry?.resolution || !entry.version) throw new Error('Entrada inválida no lock: ' + key)
        const locator = entry.resolution
        const name = packageName.exec(locator)?.[1]
        if (!name) throw new Error('Resolução não suportada: ' + locator)
        const row = rows.get(locator) ?? {
            locator,
            name,
            version: entry.version,
            dependencies: entry.dependencies ?? {},
            peers: entry.peerDependencies ?? {},
            scope: new Set(),
            direct: new Set(),
        }
        rows.set(locator, row)
        if (!names.has(name)) names.set(name, new Set())
        names.get(name).add(locator)
        for (const descriptor of key.split(', ')) descriptors.set(descriptor, locator)
    }
    function findDependency(name, range) {
        const exact = descriptors.get(name + '@' + range)
        const npm = descriptors.get(name + '@npm:' + range)
        if (exact || npm) return exact ?? npm
        throw new Error('Descriptor não encontrado: ' + name + '@' + range)
    }
    for (const [path, manifest] of Object.entries(workspaces)) {
        for (const [kind, deps] of Object.entries({
            runtime: { ...manifest.dependencies, ...manifest.optionalDependencies },
            dev: manifest.devDependencies ?? {},
        })) {
            for (const [name, range] of Object.entries(deps)) {
                rows.get(findDependency(name, range)).direct.add(path + ':' + kind)
            }
        }
    }
    for (const [path, label] of [['apps/web', 'web-candidate'], ['apps/server', 'server-candidate']]) {
        const queue = [...rows.values()].filter((row) => workspacePath(row.locator) === path)
        if (queue.length !== 1) throw new Error('Workspace ausente no lock: ' + path)
        while (queue.length) {
            const row = queue.pop()
            if (row.scope.has(label)) continue
            row.scope.add(label)
            const workspace = workspaces[workspacePath(row.locator)]
            const deps = workspace
                ? { ...workspace.dependencies, ...workspace.optionalDependencies }
                : row.dependencies
            for (const [name, range] of Object.entries(deps)) {
                queue.push(rows.get(findDependency(name, range)))
            }
            // Peers podem ter múltiplas versões/virtualizações. Marca todos os candidatos,
            // não uma garantia de inclusão no bundle.
            for (const name of Object.keys(row.peers)) {
                for (const locator of names.get(name) ?? []) queue.push(rows.get(locator))
            }
        }
    }
    return [...rows.values()]
        .map(({ dependencies, peers, scope, direct, ...row }) => ({
            ...row,
            scope: scope.size ? sorted(scope) : ['dev-or-other'],
            direct: sorted(direct),
        }))
        .sort((a, b) => a.locator.localeCompare(b.locator, 'en'))
}

export function scanInstalled(repoRoot, workspacePaths) {
    const records = new Map()
    const seen = new Set()
    function scanModules(dir) {
        if (!existsSync(dir) || seen.has(dir) || !lstatSync(dir).isDirectory()) return
        seen.add(dir)
        function scanPackage(packageDir) {
            const manifestPath = join(packageDir, 'package.json')
            if (!existsSync(manifestPath)) return
            const manifest = json(manifestPath)
            if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
                throw new Error('Manifesto sem identidade: ' + relative(repoRoot, manifestPath))
            }
            // Apenas arquivos regulares no topo do pacote; não segue symlinks.
            const notices = readdirSync(packageDir, { withFileTypes: true })
                .filter((entry) => entry.isFile() && noticeName.test(entry.name))
                .map((entry) => {
                    const path = join(packageDir, entry.name)
                    return { file: entry.name, path, sha256: sha(readFileSync(path)) }
                })
                .sort((a, b) => a.file.localeCompare(b.file, 'en'))
            const key = manifest.name + '@' + manifest.version
            const record = {
                location: relative(repoRoot, packageDir).split('\\').join('/'),
                declaredLicense: typeof manifest.license === 'string' ? manifest.license : null,
                notices,
            }
            if (!records.has(key)) records.set(key, [])
            records.get(key).push(record)
            scanModules(join(packageDir, 'node_modules'))
        }
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue
            const path = join(dir, entry.name)
            if (entry.name.startsWith('@')) {
                for (const child of readdirSync(path, { withFileTypes: true })) {
                    if (child.isDirectory()) scanPackage(join(path, child.name))
                }
            } else scanPackage(path)
        }
    }
    for (const workspace of workspacePaths) scanModules(join(repoRoot, workspace, 'node_modules'))
    return records
}

export function buildInventory(repoRoot) {
    const manifest = json(join(repoRoot, 'package.json'))
    const paths = ['.', ...manifest.workspaces]
    const workspaces = Object.fromEntries(
        paths.map((path) => [path, json(join(repoRoot, path, 'package.json'))]),
    )
    const rows = lockRows(readFileSync(join(repoRoot, 'yarn.lock'), 'utf8'), workspaces)
    const installed = scanInstalled(repoRoot, paths)
    return rows.map((row) => {
        const workspace = workspaces[workspacePath(row.locator)]
        const copies = installed.get(row.name + '@' + row.version) ?? []
        const declared = workspace
            ? [workspace.license ?? null]
            : [...new Set(copies.map((copy) => copy.declaredLicense))]
        const status = workspace
            ? 'workspace'
            : copies.length === 0
              ? 'not-installed'
              : row.locator.includes('@patch:')
                ? 'patch-review'
                : declared.length !== 1 || !declared[0]
                  ? 'license-review'
                  : copies.some((copy) => copy.notices.length === 0)
                    ? 'notice-review'
                    : 'declared-and-notice-present'
        return { ...row, declared, status, copies }
    })
}

const publicRecord = ({ copies, ...row }) => ({
    ...row,
    copies: copies.map(({ location, declaredLicense, notices }) => ({
        location,
        declaredLicense,
        notices: notices.map(({ file, sha256 }) => ({ file, sha256 })),
    })),
})

export function writeWebNotices(repoRoot, rows) {
    const out = join(repoRoot, 'apps/web/dist/licenses')
    mkdirSync(out, { recursive: true })
    const index = []
    const writeVerified = (path, bytes) => {
        writeFileSync(path, bytes)
        if (!readFileSync(path).equals(bytes)) throw new Error('Aviso não preservado: ' + path)
    }
    for (const [source, file] of [
        ['LICENSE', 'PROJECT-MIT.txt'],
        ['apps/web/src/design/fonts/OFL-DM-Sans.txt', 'OFL-DM-Sans.txt'],
        ['apps/web/src/design/fonts/OFL-Space-Grotesk.txt', 'OFL-Space-Grotesk.txt'],
    ]) writeVerified(join(out, file), readFileSync(join(repoRoot, source)))
    const sourceMapNotice = readFileSync(join(repoRoot, 'apps/web/public/swing/LICENSE.txt'))
    const builtMapNotice = readFileSync(join(repoRoot, 'apps/web/dist/swing/LICENSE.txt'))
    if (!sourceMapNotice.equals(builtMapNotice)) throw new Error('Aviso ODbL ausente no build')
    for (const row of rows.filter((entry) => entry.scope.includes('web-candidate') && entry.status !== 'workspace')) {
        const item = publicRecord(row)
        item.files = []
        for (const copy of row.copies) {
            for (const notice of copy.notices) {
                const filename = sha(Buffer.from(row.locator + '\0' + copy.location + '\0' + notice.file)) + '.txt'
                const bytes = readFileSync(notice.path)
                if (sha(bytes) !== notice.sha256) throw new Error('Aviso alterado após inventário')
                writeVerified(join(out, filename), bytes)
                item.files.push({ filename, upstream: notice.file, sha256: notice.sha256 })
            }
        }
        index.push(item)
    }
    writeVerified(join(out, 'index.json'), Buffer.from(JSON.stringify(index, null, 2) + '\n'))
    console.log('LICENSE-BUILD: MIT + 2 OFL + ODbL + ' + index.length + ' candidatos web; textos copiados e conferidos')
}

function main() {
    const rows = buildInventory(root)
    for (const row of rows) console.log('LICENSE-ENTRY ' + JSON.stringify(publicRecord(row)))
    const counts = {}
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
    console.log('LICENSE-SUMMARY ' + JSON.stringify({ total: rows.length, counts }))
    if (process.argv.includes('--web-dist')) writeWebNotices(root, rows)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main()
}
