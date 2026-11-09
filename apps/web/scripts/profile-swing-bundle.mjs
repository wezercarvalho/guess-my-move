// Reproducible browser investigation, not a CI gate. Playwright stays outside project dependencies.
import { createServer } from 'node:http'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { cpus, platform, arch } from 'node:os'

const require = createRequire(import.meta.url)
if (!process.env.GMM_PLAYWRIGHT_PATH) throw new Error('Defina GMM_PLAYWRIGHT_PATH para a instalação externa do Playwright (ver docs/research/swing-bundle-loading).')
const { chromium } = require(process.env.GMM_PLAYWRIGHT_PATH)
const root = resolve(import.meta.dirname, '../../..')
const output = resolve(process.argv[2] ?? resolve(root, 'docs/research/swing-bundle-loading/results.json'))
const variants = { baseline: resolve(root, 'apps/web/dist'), split: resolve(root, 'apps/web/dist-profile') }
const sizes = {}
for (const [name, dir] of Object.entries(variants)) {
    sizes[name] = []
    for (const file of (await readdir(resolve(dir, 'assets'))).filter((file) => file.endsWith('.js')).sort()) {
        const data = await readFile(resolve(dir, 'assets', file))
        sizes[name].push({ file, bytes: data.length, gzipBytes: gzipSync(data).length })
    }
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' }
function serve(base) { return createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost')
        const file = resolve(base, decodeURIComponent(url.pathname).slice(1) || 'swing.html')
        if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) { response.writeHead(404).end(); return }
        const body = await readFile(file)
        const compress = /gzip/.test(request.headers['accept-encoding'] ?? '') && /\.(js|css|html|json)$/.test(file)
        const encoded = compress ? gzipSync(body) : body
        response.writeHead(200, {
            'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
            'Cache-Control': /\.(js|css|woff2)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
            'Content-Length': encoded.length,
            ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
        })
        response.end(encoded)
    } catch { response.writeHead(404).end() }
}) }
const servers = {}
const origins = {}
for (const [name, base] of Object.entries(variants)) {
    const instance = serve(base)
    await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve))
    servers[name] = instance
    origins[name] = `http://127.0.0.1:${instance.address().port}`
}
let browser
const results = []
try {
    browser = await chromium.launch({
        headless: true,
        ...(process.env.GMM_CHROMIUM_PATH ? { executablePath: process.env.GMM_CHROMIUM_PATH } : {}),
        args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    for (let repetition = 0; repetition < 3; repetition++) {
        // Alternate order to reduce order/thermal bias. Each pair uses a new browser context.
        const order = repetition % 2 ? ['split', 'baseline'] : ['baseline', 'split']
        for (const scenario of ['selection', 'training', 'online-lobby']) for (const variant of order) {
            const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
            try {
                const page = await context.newPage()
                const cdp = await context.newCDPSession(page)
                await cdp.send('Network.enable')
                await cdp.send('Network.emulateNetworkConditions', {
                    offline: false, latency: 150, downloadThroughput: 200000,
                    uploadThroughput: 93750, connectionType: 'cellular4g',
                })
                await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
                await page.addInitScript(() => {
                    window.__first3d = null
                    const original = WebGL2RenderingContext.prototype.clear
                    WebGL2RenderingContext.prototype.clear = function (...args) {
                        window.__first3d ??= performance.now()
                        return original.apply(this, args)
                    }
                })
                for (const cache of ['cold', 'warm']) {
                    const errors = []
                    const failed = []
                    const onError = (error) => errors.push(error.message)
                    const onFailed = (request) => failed.push(new URL(request.url()).pathname)
                    page.on('pageerror', onError)
                    page.on('requestfailed', onFailed)
                    let transferredBytes = 0
                    let requests = 0
                    const loaded = ({ encodedDataLength }) => { transferredBytes += encodedDataLength; requests++ }
                    cdp.on('Network.loadingFinished', loaded)
                    const target = `${origins[variant]}/swing.html${scenario === 'training' ? '?mode=training' : ''}`
                    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 })
                    if (scenario === 'training') await page.waitForFunction(() => window.__first3d !== null, { timeout: 30000 })
                    else {
                        await page.getByRole('heading', { name: 'Escolha o modo', exact: true }).waitFor()
                        if (scenario === 'online-lobby') {
                            await page.getByRole('button', { name: 'Cooperativo online', exact: true }).click()
                            await page.locator('.swing-online-lobby').waitFor()
                        }
                    }
                    const metrics = await page.evaluate(() => {
                        const navigation = performance.getEntriesByType('navigation')[0]
                        const resources = performance.getEntriesByType('resource').map((entry) => ({
                            path: new URL(entry.name).pathname.replace(/^\/(baseline|split)/, ''),
                            transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize,
                            durationMs: entry.duration,
                        }))
                        return { readyMs: performance.now(), domContentLoadedMs: navigation.domContentLoadedEventEnd,
                            first3dMs: window.__first3d, resources }
                    })
                    cdp.off('Network.loadingFinished', loaded)
                    page.off('pageerror', onError)
                    page.off('requestfailed', onFailed)
                    if (errors.length || failed.length) throw new Error(JSON.stringify({ scenario, variant, errors, failed }))
                    results.push({ repetition, scenario, variant, cache, transferredBytes, requests, ...metrics })
                    console.log(`${variant}/${scenario}/${cache}: ${metrics.readyMs.toFixed(0)} ms`)
                    // Complete cache warming before the next navigation; keep this outside readyMs.
                    await page.waitForLoadState('networkidle')
                }
            } finally { await context.close() }
        }
    }
    await writeFile(output, JSON.stringify({
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        measuredAt: new Date().toISOString(), browser: browser.version(), node: process.version,
        host: { platform: platform(), arch: arch(), cpus: cpus().length, cpu: cpus()[0]?.model },
        settings: { latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750, cpuSlowdown: 4,
            repetitions: 3, viewport: '1440x900', compression: 'gzip (Node default)', renderer: 'SwiftShader headless',
            camera: 'off', cache: 'cold context, then warm navigation; JS/CSS/fonts immutable, HTML/JSON no-cache' },
        sizes, results,
    }, null, 2) + '\n')
} finally {
    await browser?.close()
    for (const instance of Object.values(servers)) {
        instance.closeAllConnections()
        await new Promise((resolve) => instance.close(resolve))
    }
}
