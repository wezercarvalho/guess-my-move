// Servidor em modo de desenvolvimento: compila uma vez, depois mantém o `tsc` em
// modo watch e reinicia o `node` quando `dist` muda. Substitui `nest start --watch`,
// que depende da API do compilador (ausente no TypeScript 7).
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const tsc = ['tsc', '-p', 'tsconfig.build.json']

const first = spawnSync('yarn', tsc, { cwd, stdio: 'inherit' })
if (first.status !== 0) process.exit(first.status ?? 1)

const children = [
    spawn('yarn', [...tsc, '--watch', '--preserveWatchOutput'], { cwd, stdio: 'inherit' }),
    spawn('node', ['--watch', 'dist/main.js'], { cwd, stdio: 'inherit' }),
]

function stop() {
    for (const child of children) child.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const child of children) child.on('exit', stop)
