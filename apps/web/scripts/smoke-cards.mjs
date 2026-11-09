// Optional integration demonstration: built UI + compiled server + synthetic camera, no media persistence.
import assert from 'node:assert/strict'
import { createServer, request as proxyRequest } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

if (!process.env.GMM_PLAYWRIGHT_PATH) throw new Error('Defina GMM_PLAYWRIGHT_PATH para a instalação externa de Playwright 1.64.1.')
const { chromium } = createRequire(import.meta.url)(process.env.GMM_PLAYWRIGHT_PATH)
const root = resolve(import.meta.dirname, '../../..')
const publicRoot = resolve(root, 'apps/web/dist')
let apiOrigin
const frontend = createServer(async (request, response) => {
    if ((request.url ?? '').startsWith('/api/')) {
        const upstream = proxyRequest(new URL(request.url, apiOrigin), { method: request.method, headers: { ...request.headers, host: new URL(apiOrigin).host } }, (incoming) => {
            response.writeHead(incoming.statusCode, incoming.headers)
            incoming.pipe(response)
        })
        upstream.on('error', () => { response.writeHead(502).end() })
        request.pipe(upstream)
        return
    }
    try {
        const file = resolve(publicRoot, decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html')
        if (!file.startsWith(publicRoot + sep)) { response.writeHead(404).end(); return }
        const body = await readFile(file)
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' }
        response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
        response.end(body)
    } catch { response.writeHead(404).end() }
})
let app
let browser
const originalOrigins = process.env.ALLOWED_ORIGINS
const originalObserve = process.env.OBSERVE_ENABLED
process.env.OBSERVE_ENABLED = 'false'
try {
    await new Promise((resolve) => frontend.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${frontend.address().port}`
    process.env.ALLOWED_ORIGINS = origin
    const { createServerApp } = await import(pathToFileURL(resolve(root, 'apps/server/dist/app.setup.js')).href)
    app = await createServerApp({ logger: false })
    await app.listen(0, '127.0.0.1')
    apiOrigin = `http://127.0.0.1:${app.getHttpServer().address().port}`
    browser = await chromium.launch({ headless: true,
        ...(process.env.GMM_CHROMIUM_PATH ? { executablePath: process.env.GMM_CHROMIUM_PATH } : {}),
        args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const errors = []
    const bodyKeys = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/cards/rounds') && request.method() === 'POST') bodyKeys.push(Object.keys(JSON.parse(request.postData() ?? '{}')).sort())
    })
    await page.goto(`${origin}/cards.html?delegate=CPU`)
    await page.locator('.card-word').waitFor()
    await page.getByLabel('Categoria', { exact: true }).selectOption('arts')
    assert.equal(await page.locator('.card-word').textContent(), 'Regente de orquestra')
    await page.getByLabel('Idioma', { exact: true }).selectOption('en-US')
    assert.equal(await page.locator('.card-word').textContent(), 'Orchestra conductor')
    await page.reload()
    await page.getByRole('button', { name: 'Enable camera', exact: true }).waitFor()
    await page.getByLabel('Mode', { exact: true }).selectOption('competitive')
    await page.getByRole('button', { name: 'Enable camera', exact: true }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Start' && !button.disabled), null, { timeout: 45000 })
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.getByTestId('competitive-score').waitFor({ timeout: 20000 })
    assert.equal(await page.getByTestId('competitive-score').textContent(), '0')
    await page.getByText('The server calculated the result and points.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Stop camera', exact: true }).click()
    assert.deepEqual(errors, [])
    assert.ok(bodyKeys.some((keys) => JSON.stringify(keys) === '["cardId","locale"]'))
    assert.ok(bodyKeys.some((keys) => JSON.stringify(keys) === '["angleDeg","seq"]'))
    assert.ok(bodyKeys.every((keys) => keys.every((key) => ['cardId', 'locale', 'angleDeg', 'seq'].includes(key))))
    const result = { result: 'PASS', browser: browser.version(), camera: 'Chromium synthetic test pattern, no hand',
        scenarios: ['Portuguese category/card selection', 'English card/controls', 'locale preference after reload', 'real MediaPipe loading', 'built frontend and compiled Nest API', 'server timeout without hand awards zero', 'scalar-only command bodies', 'camera stopped'],
        requests: bodyKeys.length, limitations: ['no physical camera or gesture accuracy measurement', 'loopback only', 'no media, tokens or signal samples persisted'] }
    if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
    await context.close()
} finally {
    await browser?.close()
    await app?.close()
    frontend.closeAllConnections()
    await new Promise((resolve) => frontend.close(resolve))
    if (originalObserve === undefined) delete process.env.OBSERVE_ENABLED
    else process.env.OBSERVE_ENABLED = originalObserve
    if (originalOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = originalOrigins
}
