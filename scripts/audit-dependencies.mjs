import { run } from './lib/dependency-audit.mjs'

// Ponto de entrada de `yarn security:dependencies`: a execução e o veredito ficam em
// `lib/dependency-audit.mjs`, que exige a execução por Yarn (`npm_execpath`).
process.exitCode = run(process.env.npm_execpath)
