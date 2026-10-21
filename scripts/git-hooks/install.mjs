// Ativa o hook de pré-push versionado: `git config core.hooksPath .githooks` no repositório.
// Idempotente; usa só Node e Git.
//
//   node scripts/git-hooks/install.mjs [--repo <diretório>]
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const HOOKS_PATH = '.githooks'
const LAUNCHER = `${HOOKS_PATH}/pre-push`

function git(cwd, args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    return { status: result.status ?? 1, stdout: (result.stdout ?? '').trim() }
}

function parseRepo(argv) {
    const index = argv.indexOf('--repo')
    if (index === -1) return null
    const value = argv[index + 1]
    if (!value) throw new Error('Informe o diretório depois de --repo.')
    return resolve(value)
}

export function install({
    repo = null,
    log = (message) => process.stdout.write(`${message}\n`),
} = {}) {
    const root =
        repo ?? git(process.cwd(), ['rev-parse', '--show-toplevel']).stdout
    if (!root || git(root, ['rev-parse', '--git-dir']).status !== 0) {
        throw new Error(
            'Execute dentro de um repositório Git ou informe --repo <diretório>.',
        )
    }
    const launcher = join(root, LAUNCHER)
    if (!existsSync(launcher)) {
        throw new Error(
            `${LAUNCHER} não existe em ${root}; nada foi configurado.`,
        )
    }
    if (
        process.platform !== 'win32' &&
        (statSync(launcher).mode & 0o111) === 0
    ) {
        log(
            `Aviso: ${LAUNCHER} não é executável; o Git ignora o hook. Use: chmod +x ${LAUNCHER}`,
        )
    }
    const current = git(root, [
        'config',
        '--local',
        '--get',
        'core.hooksPath',
    ]).stdout
    if (current === HOOKS_PATH) {
        log(
            `core.hooksPath já aponta para ${HOOKS_PATH} em ${root}; nada a fazer.`,
        )
        return { changed: false, root }
    }
    if (
        git(root, ['config', '--local', 'core.hooksPath', HOOKS_PATH])
            .status !== 0
    ) {
        throw new Error(
            'Não foi possível gravar core.hooksPath com git config.',
        )
    }
    log(`core.hooksPath configurado para ${HOOKS_PATH} em ${root}.`)
    if (current) log(`Valor anterior: ${current}.`)
    log(
        'O pre-push agora roda as verificações dos escopos afetados; contorno: git push --no-verify.',
    )
    return { changed: true, root }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    try {
        install({ repo: parseRepo(process.argv.slice(2)) })
    } catch (error) {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
    }
}
