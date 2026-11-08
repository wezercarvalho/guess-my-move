// Pure assessment and bounded reads of official metadata. Never installs or executes a release.
export const SOURCES = Object.freeze({
    releases: 'https://nodejs.org/dist/index.json',
    schedule: 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json',
})
const MAX_BYTES = 2 * 1024 * 1024
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
function versionParts(version) {
    if (typeof version !== 'string' || !VERSION.test(version)) throw new Error('Versão estável inválida.')
    const parts = version.split('.').map(Number)
    if (!parts.every(Number.isSafeInteger)) throw new Error('Versão fora do limite.')
    return parts
}
function compare(a, b) {
    const left = versionParts(a), right = versionParts(b)
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i]
    return 0
}
function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data oficial inválida.')
    const result = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(result.valueOf()) || result.toISOString().slice(0, 10) !== value) throw new Error('Data oficial inválida.')
    return result.valueOf()
}
export function assessRuntime(pin, releases, schedule, now = new Date()) {
    const [major] = versionParts(pin)
    if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) throw new Error('Relógio inválido.')
    const window = schedule?.[`v${major}`]
    if (!window || typeof window !== 'object' || Array.isArray(window)) throw new Error('Major sem calendário oficial.')
    const start = date(window.start), end = date(window.end)
    if (start >= end || now.valueOf() < start || now.valueOf() >= end) throw new Error('Runtime fora da janela de suporte oficial.')
    if (!Array.isArray(releases) || releases.length === 0) throw new Error('Índice de releases inválido.')
    const stable = new Map()
    for (const item of releases) {
        if (!item || typeof item !== 'object' || typeof item.version !== 'string' || typeof item.security !== 'boolean') throw new Error('Formato de release desconhecido.')
        if (!item.version.startsWith('v')) throw new Error('Versão oficial inválida.')
        date(item.date)
        const value = item.version.slice(1)
        if (!VERSION.test(value)) {
            // The official index also contains prereleases; only valid semver prereleases are ignored.
            if (/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-[0-9A-Za-z.-]+$/.test(value)) continue
            throw new Error('Versão oficial desconhecida.')
        }
        if (versionParts(value)[0] !== major) continue
        if (stable.has(value)) throw new Error('Release duplicado no índice.')
        stable.set(value, item)
    }
    if (!stable.has(pin)) throw new Error('Pin não encontrado no índice oficial.')
    const versions = [...stable.keys()].sort(compare)
    const security = versions.filter(value => stable.get(value).security)
    const latestSecurity = security.at(-1) ?? null
    return { pin, latest: versions.at(-1), latestSecurity, updateRequired: latestSecurity !== null && compare(latestSecurity, pin) > 0 }
}
export async function fetchOfficialJson(url, fetcher = globalThis.fetch) {
    if (!Object.values(SOURCES).includes(url)) throw new Error('Fonte não permitida.')
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } })
    if (!response.ok || response.redirected || !response.body) throw new Error('Fonte oficial indisponível.')
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_BYTES) throw new Error('Resposta oficial excedeu 2 MiB.')
            chunks.push(value)
        }
        return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
    } catch (error) {
        await reader.cancel().catch(() => {})
        throw error
    } finally {
        reader.releaseLock()
    }
}
