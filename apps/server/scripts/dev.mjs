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
