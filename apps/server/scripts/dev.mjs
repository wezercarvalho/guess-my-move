import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const root = fileURLToPath(new URL('../../..', import.meta.url))
const tsc = ['tsc', '-p', 'tsconfig.build.json']
// O servidor executa os exports compilados do workspace, também em clone novo.
for (const [args, directory] of [
    [['workspace', '@guess-my-move/core', 'build'], root],
    [['workspace', '@guess-my-move/marbles', 'build'], root],
    [['workspace', '@guess-my-move/swing', 'build'], root],
    [tsc, cwd],
]) {
    const result = spawnSync('yarn', args, { cwd: directory, stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
}

const children = [
    spawn('yarn', ['workspace', '@guess-my-move/core', 'exec', 'tsc', '--build', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { cwd: root, stdio: 'inherit' }),
    spawn(
        'yarn',
        [
            'workspace',
            '@guess-my-move/swing',
            'exec',
            'tsc',
            '--build',
            'tsconfig.build.json',
            '--watch',
            '--preserveWatchOutput',
        ],
        { cwd: root, stdio: 'inherit' },
    ),
    spawn(
        'yarn',
        [
            'workspace',
            '@guess-my-move/marbles',
            'exec',
            'tsc',
            '--build',
            'tsconfig.build.json',
            '--watch',
            '--preserveWatchOutput',
        ],
        { cwd: root, stdio: 'inherit' },
    ),
    spawn('yarn', [...tsc, '--watch', '--preserveWatchOutput'], {
        cwd,
        stdio: 'inherit',
    }),
    spawn('node', ['--watch', 'dist/main.js'], { cwd, stdio: 'inherit' }),
]
let stopping = false
function stop(code = 0) {
    if (stopping) return
    stopping = true
    process.exitCode = code
    for (const child of children) child.kill('SIGTERM')
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
for (const child of children) {
    child.on('error', () => stop(1))
    child.on('exit', (code) => stop(code ?? 1))
}
