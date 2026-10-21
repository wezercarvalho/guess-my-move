// Hook local de pré-push: roda, para os escopos afetados pelo que está sendo enviado, as mesmas
// verificações leves do pr-gate (checker do SDD, formatação dos docs da raiz e testes dos gates)
// e a auditoria de dependências quando o push toca o que o gate audita. Só Node e Git;
// `.githooks/pre-push` é o launcher.
// Contorno: `git push --no-verify` (o pr-gate remoto continua valendo).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_SCOPES, installCommand, planChecks } from './scopes.mjs'

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

const isZeroSha = (sha) => /^0+$/.test(sha)
const lines = (text) =>
    text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

// Cada linha do stdin do pre-push: `<local ref> <local sha> <remote ref> <remote sha>`.
export function parsePushLines(text) {
    return lines(text)
        .map((line) => line.split(/\s+/))
        .filter((fields) => fields.length === 4)
        .map(([localRef, localSha, remoteRef, remoteSha]) => ({
            localRef,
            localSha,
            remoteRef,
            remoteSha,
        }))
}

// `git(args)` devolve `{ status, stdout }`; é injetável para os testes.
export function createGit(cwd = repoRoot) {
    return (args) => {
        const result = spawnSync(
            'git',
            ['-c', 'core.quotepath=false', ...args],
            {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            },
        )
        return { status: result.status ?? 1, stdout: result.stdout ?? '' }
    }
}

// Base de comparação de uma branch sem referência remota: o ancestral comum com `origin/main`.
export function mergeBaseWithMain({ git, ref }) {
    if (git(['rev-parse', '--verify', '--quiet', 'origin/main']).status !== 0) {
        return {
            base: null,
            note: 'origin/main não encontrado: verificando todos os escopos.',
        }
    }
    const result = git(['merge-base', ref, 'origin/main'])
    const base = result.stdout.trim()
    if (result.status !== 0 || base === '') {
        return {
            base: null,
            note: `Sem ancestral comum entre ${ref} e origin/main: verificando todos os escopos.`,
        }
    }
    return { base, note: null }
}

export function resolveChangedFiles({ lines: pushLines, git }) {
    const files = new Set()
    const notes = new Set()
    let allScopes = false
    const unknownRange = (note) => {
        allScopes = true
        notes.add(note)
    }
    for (const { localSha, remoteSha } of pushLines) {
        if (isZeroSha(localSha)) continue
        let base = null
        if (
            !isZeroSha(remoteSha) &&
            git(['cat-file', '-e', `${remoteSha}^{commit}`]).status === 0
        ) {
            base = remoteSha
        } else {
            const merge = mergeBaseWithMain({ git, ref: localSha })
            base = merge.base
            if (merge.note) unknownRange(merge.note)
        }
        if (base === null) continue
        const diff = git(['diff', '--name-only', `${base}..${localSha}`])
        if (diff.status !== 0) {
            unknownRange(
                `Não foi possível calcular o diff de ${base}..${localSha}: verificando todos os escopos.`,
            )
            continue
        }
        for (const file of lines(diff.stdout)) files.add(file)
    }
    return { files: [...files].sort(), allScopes, notes: [...notes] }
}

// Variáveis que o Git define para o hook e que confundiriam comandos que usam outros repositórios
// (testes que fazem `git init` em diretórios temporários, por exemplo).
const GIT_ENV_TO_DROP = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_PREFIX',
    'GIT_COMMON_DIR',
]
const UNSAFE_WINDOWS_ARG = /["&|<>^%!`();\r\n]/

// Sem shell, exceto `yarn.cmd` no Windows: desde o Node 20.12 o `spawn` recusa `.cmd` sem shell
// (EINVAL). Nesse caso os argumentos são recusados se tiverem metacaracteres do `cmd.exe` e os
// que têm espaço vão entre aspas.
export function spawnSpec(step, platform = process.platform) {
    const needsShell =
        platform === 'win32' && /\.(cmd|bat)$/i.test(step.command)
    if (!needsShell)
        return { command: step.command, args: step.args, shell: false }
    const args = step.args.map((arg) => {
        if (UNSAFE_WINDOWS_ARG.test(arg)) {
            throw new Error(
                `Argumento não permitido para ${step.command}: ${arg}`,
            )
        }
        return /\s/.test(arg) ? `"${arg}"` : arg
    })
    return { command: step.command, args, shell: true }
}

// Marcador estável que o auditor de dependências emite quando o registry não
// responde. Se o texto mudar, o hook deixa de reconhecer o caso e passa a barrar (lado seguro).
export const REGISTRY_UNAVAILABLE_MARKER = 'registry-indisponivel'

const AUDIT_OUTPUT_MAX_BYTES = 16 * 1024 * 1024

// Devolve `{ status, signal, error, stdout, stderr }`. Passos `kind: 'audit'` têm a saída
// capturada (o `runPlan` a repete na tela e a classifica); os demais herdam o terminal.
export function spawnStep(step) {
    const { command, args, shell } = spawnSpec(step)
    const env = { ...process.env }
    for (const name of GIT_ENV_TO_DROP) delete env[name]
    const captured = step.kind === 'audit'
    return spawnSync(command, args, {
        cwd: join(repoRoot, step.cwd),
        env,
        shell,
        ...(captured
            ? {
                  encoding: 'utf8',
                  maxBuffer: AUDIT_OUTPUT_MAX_BYTES,
                  stdio: ['inherit', 'pipe', 'pipe'],
              }
            : { stdio: 'inherit' }),
    })
}

const defaultRunDeps = {
    run: spawnStep,
    exists: (path) => existsSync(join(repoRoot, path)),
    log: (message) => process.stderr.write(`${message}\n`),
    // Repete na tela a saída capturada de um passo (`stream`: 'stdout' ou 'stderr').
    echo: (text, stream) => process[stream].write(text),
    now: () => Date.now(),
}

const REGISTRY_WARNING =
    'pre-push: AVISO: Auditoria de dependências não pôde consultar o registry; não bloqueia o push — o pr-gate remoto fará a verificação.'

// Falha de registry (rede), e não vulnerabilidade: só passos de auditoria, só com código de saída
// diferente de zero e só pelo marcador que o próprio auditor emite.
const isRegistryFailure = (step, result) =>
    step.kind === 'audit' &&
    !result.error &&
    result.status !== 0 &&
    `${result.stdout ?? ''}\n${result.stderr ?? ''}`.includes(
        REGISTRY_UNAVAILABLE_MARKER,
    )

const BYPASS_HINT =
    'Para enviar mesmo assim: git push --no-verify (o pr-gate remoto continua valendo e vai barrar o merge se falhar).'

// Executa o plano em ordem e para no primeiro erro. `run(step)` devolve `{ status, signal?,
// error?, stdout?, stderr? }`; `stdout` e `stderr` só vêm nos passos `kind: 'audit'` e são
// repetidos na tela por `echo`. Devolve `{ code, ran, failed, missing, warnings }`; `warnings`
// lista as auditorias que não alcançaram o registry (avisam e não barram).
export function runPlan(plan, deps = {}) {
    const { run, exists, log, echo, now } = { ...defaultRunDeps, ...deps }
    if (plan.length === 0) {
        log('pre-push: nada a verificar neste envio (nenhum escopo afetado).')
        return { code: 0, ran: [], failed: null, missing: [], warnings: [] }
    }
    const packages = [...new Set(plan.map((step) => step.cwd))]
    const missing = packages.filter((pkg) => !exists(`${pkg}/node_modules`))
    if (missing.length > 0) {
        log(
            'pre-push: dependências não instaladas; nenhuma verificação foi executada.',
        )
        for (const pkg of missing) log(`  Instale com: ${installCommand(pkg)}`)
        log(BYPASS_HINT)
        return { code: 1, ran: [], failed: null, missing, warnings: [] }
    }
    const started = now()
    const ran = []
    const warnings = []
    for (const [index, step] of plan.entries()) {
        log(`pre-push [${index + 1}/${plan.length}] ${step.label}`)
        const stepStarted = now()
        let result
        try {
            result = run(step)
        } catch (error) {
            result = { status: null, error }
        }
        const seconds = ((now() - stepStarted) / 1000).toFixed(1)
        if (step.kind === 'audit') {
            if (result.stdout) echo(result.stdout, 'stdout')
            if (result.stderr) echo(result.stderr, 'stderr')
        }
        if (isRegistryFailure(step, result)) {
            log(REGISTRY_WARNING)
            warnings.push(step.id)
            ran.push(step.id)
            log(`pre-push: ok com aviso (${seconds}s).`)
            continue
        }
        if (result.error || result.status !== 0) {
            const reason = result.error
                ? result.error.message
                : `código de saída ${result.status ?? result.signal ?? 'desconhecido'}`
            log(`pre-push: FALHOU em "${step.label}" (${reason}, ${seconds}s).`)
            log(
                `  Comando: ${[step.command, ...step.args].join(' ')} (em ${step.cwd}/)`,
            )
            log('  Os passos seguintes não foram executados.')
            log(BYPASS_HINT)
            return { code: 1, ran, failed: step, missing: [], warnings }
        }
        ran.push(step.id)
        log(`pre-push: ok (${seconds}s).`)
    }
    const total = ((now() - started) / 1000).toFixed(1)
    const warned =
        warnings.length > 0
            ? ` Avisos: ${warnings.join(', ')} (registry indisponível; o pr-gate remoto fará a verificação).`
            : ''
    log(
        `pre-push: verificações concluídas (${ran.length} passos em ${total}s): ${ran.join(', ')}.${warned}`,
    )
    return { code: 0, ran, failed: null, missing: [], warnings }
}

// Plano do envio: lista de passos mais as notas de intervalo desconhecido.
export function planForPush({ lines: pushLines, git, exists, mode }) {
    const { files, allScopes, notes } = resolveChangedFiles({
        lines: pushLines,
        git,
    })
    const plan = planChecks(files, {
        mode,
        exists,
        scopes: allScopes ? ALL_SCOPES : undefined,
    })
    return { plan, notes }
}

function readStdin() {
    try {
        return readFileSync(0, 'utf8')
    } catch {
        return ''
    }
}

export function main({
    stdin = readStdin(),
    git = createGit(),
    deps = {},
} = {}) {
    const log = deps.log ?? defaultRunDeps.log
    const exists = deps.exists ?? defaultRunDeps.exists
    const { plan, notes } = planForPush({
        lines: parsePushLines(stdin),
        git,
        exists: (file) => exists(file),
    })
    for (const note of notes) log(`pre-push: aviso: ${note}`)
    return runPlan(plan, { ...deps, log, exists }).code
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    process.exitCode = main()
}
