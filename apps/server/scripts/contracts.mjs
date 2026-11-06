import { readFile, writeFile, mkdir } from 'node:fs/promises'
import {
    buildOpenApiDocument,
    buildMultiplayerContract,
} from '../dist/contracts/documents.js'

const check = process.argv.includes('--check')
if (process.argv.slice(2).some((argument) => argument !== '--check'))
    throw new Error('Uso: contracts.mjs [--check]')
const directory = new URL('../../../contracts/', import.meta.url)
if (!check) await mkdir(directory, { recursive: true })
for (const [name, document] of [
    ['http.openapi.json', buildOpenApiDocument()],
    ['multiplayer.socketio.json', buildMultiplayerContract()],
]) {
    const file = new URL(name, directory)
    const text = JSON.stringify(document, null, 2) + '\n'
    if (check) {
        const current = await readFile(file, 'utf8').catch(() => '')
        if (current !== text)
            throw new Error(
                `Contrato divergente: ${name}. Execute yarn contracts:export e revise o diff.`,
            )
    } else await writeFile(file, text)
    console.log(`${check ? 'Conferido' : 'Exportado'}: ${name}`)
}
