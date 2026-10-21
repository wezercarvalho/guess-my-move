import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkCatalog } from './check-catalog.mjs'

const args = process.argv.slice(2)
let root = fileURLToPath(new URL('../../', import.meta.url))
const extraFiles = []
let valid = true
for (let index = 0; index < args.length; index += 2) {
    if (!args[index + 1] || !['--root', '--file'].includes(args[index])) {
        valid = false
        break
    }
    if (args[index] === '--root') root = resolve(args[index + 1])
    else extraFiles.push(args[index + 1])
}
if (!valid) {
    console.error('Uso: node scripts/sdd/check-specs.mjs [--root <raiz>] [--file <documento> ...]')
    process.exitCode = 2
} else {
    try {
        const errors = await checkCatalog(root, { extraFiles })
        for (const { file, rule, message } of errors) console.error(`${file} [${rule}]: ${message}`)
        if (errors.length) process.exitCode = 1
        else
            console.log(
                'SDD: catálogo, estados, gates, cobertura e links válidos (verificação estrutural somente leitura).',
            )
    } catch (error) {
        console.error(`SDD [execution]: ${error.message}`)
        process.exitCode = 1
    }
}
