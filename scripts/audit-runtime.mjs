import { readFile } from 'node:fs/promises'
import { assessRuntime, fetchOfficialJson, SOURCES } from './lib/runtime-audit.mjs'

try {
    if (process.argv.length > 2) throw new Error('Este comando não aceita URLs ou opções.')
    const pin = (await readFile(new URL('../.node-version', import.meta.url), 'utf8')).trim()
    const releases = await fetchOfficialJson(SOURCES.releases)
    const schedule = await fetchOfficialJson(SOURCES.schedule)
    const result = assessRuntime(pin, releases, schedule)
    console.log(`Node pinado: ${result.pin}; estável publicada na major: ${result.latest}; última release marcada security: ${result.latestSecurity ?? 'nenhuma'}.`)
    if (result.updateRequired) {
        console.error('[runtime-atualizacao-obrigatoria] Há correção de segurança publicada após o pin. Ler release/advisory e atualizar em PR com testes.')
        process.exitCode = 1
    } else {
        console.log('Nenhuma release marcada security posterior ao pin encontrada. Isto não atesta ausência de vulnerabilidades; conferir advisories anunciados e a política de runtime.')
    }
} catch (error) {
    console.error(`[runtime-sem-veredito] ${error instanceof Error ? error.message : 'Falha ao conferir o runtime.'}`)
    process.exitCode = 1
}
