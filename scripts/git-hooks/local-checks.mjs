// Verificações locais sob demanda, com o mesmo núcleo do hook de pré-push.
//
//   node scripts/git-hooks/local-checks.mjs [--mode static|full] [--files a b c]
//
// Sem --files, usa os arquivos alterados em relação ao merge-base com origin/main, mais o working
// tree (alterações não commitadas e arquivos novos). `--mode full` troca a verificação rápida pela
// completa nos escopos de pacote; enquanto não há código, equivale a `static`.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { ALL_SCOPES, MODES, planChecks } from './scopes.mjs'
import { createGit, mergeBaseWithMain, repoRoot, runPlan } from './pre-push.mjs'

export function parseArgs(argv) {
    const options = { mode: 'static', files: null }
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]
        if (arg === '--mode') {
            const mode = argv[index + 1]
            if (!MODES.includes(mode)) {
                throw new Error(
                    `--mode inválido: ${mode}. Use ${MODES.join(' ou ')}.`,
                )
            }
            options.mode = mode
            index += 1
        } else if (arg === '--files') {
            options.files = []
            while (
                index + 1 < argv.length &&
                !argv[index + 1].startsWith('--')
            ) {
                options.files.push(argv[index + 1])
                index += 1
            }
        } else {
            throw new Error(
                `Opção desconhecida: ${arg}. Use --mode static|full e --files <arquivos>.`,
            )
        }
    }
    return options
}

export function resolveLocalFiles({ git }) {
    const { base, note } = mergeBaseWithMain({ git, ref: 'HEAD' })
    if (base === null) return { files: [], allScopes: true, notes: [note] }
    const names = (text) => text.split(/\r?\n/).filter(Boolean)
    const diff = git(['diff', '--name-only', base])
    const untracked = git(['ls-files', '--others', '--exclude-standard'])
    if (diff.status !== 0 || untracked.status !== 0) {
        return {
            files: [],
            allScopes: true,
            notes: [
                'Não foi possível listar os arquivos alterados: verificando todos os escopos.',
            ],
        }
    }
    const files = [
        ...new Set([...names(diff.stdout), ...names(untracked.stdout)]),
    ].sort()
    return { files, allScopes: false, notes: [] }
}

export function main(argv = process.argv.slice(2)) {
    let options
    try {
        options = parseArgs(argv)
    } catch (error) {
        process.stderr.write(`${error.message}\n`)
        return 2
    }
    const resolved = options.files
        ? { files: options.files, allScopes: false, notes: [] }
        : resolveLocalFiles({ git: createGit() })
    for (const note of resolved.notes)
        process.stderr.write(`local-checks: aviso: ${note}\n`)
    const plan = planChecks(resolved.files, {
        mode: options.mode,
        scopes: resolved.allScopes ? ALL_SCOPES : undefined,
        exists: (file) => existsSync(join(repoRoot, file)),
    })
    return runPlan(plan).code
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    process.exitCode = main()
}
