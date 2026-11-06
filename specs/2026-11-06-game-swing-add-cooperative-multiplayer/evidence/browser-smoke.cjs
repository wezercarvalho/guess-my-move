// Demonstração exploratória opcional: requer Playwright/Chromium no ambiente, não é gate do CI.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const base = process.env.GMM_BROWSER_BASE_URL || 'http://127.0.0.1:5173'
const evidence = __dirname
const wait = async (fn, ms = 20000) => {
    const start = Date.now()
    while (!fn()) {
        if (Date.now() - start > ms)
            throw Error('Timed out waiting for browser state')
        await new Promise((r) => setTimeout(r, 50))
    }
}
;(async () => {
    await fs.mkdir(evidence, { recursive: true })
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
        ],
    })
    try {
        const contexts = await Promise.all([
            browser.newContext({ viewport: { width: 1440, height: 1000 } }),
            browser.newContext({ viewport: { width: 1440, height: 1000 } }),
        ])
        const pages = await Promise.all(contexts.map((c) => c.newPage()))
        const states = [null, null],
            errors = [],
            thirdParties = [],
            sentEvents = {}
        for (const [i, p] of pages.entries()) {
            p.on('pageerror', (e) => errors.push(e.message))
            p.on('request', (r) => {
                if (!r.url().startsWith(base) && !r.url().startsWith('data:'))
                    thirdParties.push(r.url())
            })
            p.on('websocket', (ws) => {
                ws.on('framereceived', (f) => {
                    try {
                        const text = String(f.payload),
                            at = text.indexOf('[')
                        if (at < 0) return
                        const packet = JSON.parse(text.slice(at))
                        if (packet[0] === 'swing:state') states[i] = packet[1]
                    } catch {}
                })
                ws.on('framesent', (f) => {
                    const text = String(f.payload)
                    assert(!/landmarks|data:image|"frame"/.test(text))
                    try {
                        const packet = JSON.parse(text.slice(text.indexOf('[')))
                        if (typeof packet[0] === 'string')
                            sentEvents[packet[0]] =
                                (sentEvents[packet[0]] || 0) + 1
                    } catch {}
                })
            })
            await p.goto(base + '/swing.html')
            await p
                .getByRole('button', {
                    name: 'Cooperativo online',
                    exact: true,
                })
                .click()
            await p.getByLabel('Seu apelido').fill(i === 0 ? 'Ana' : 'Bia')
        }
        await pages[0]
            .getByRole('button', { name: 'Criar sala', exact: true })
            .click()
        await wait(() => states[0])
        const code = states[0].roomCode
        await pages[1].getByLabel('Código da sala').fill(code)
        await pages[1]
            .getByRole('button', { name: 'Entrar na sala', exact: true })
            .click()
        await wait(() => states.every((s) => s?.players.length === 2))
        await pages[0].screenshot({ path: evidence + '/cooperative-lobby.png' })
        for (const p of pages)
            await p
                .getByRole('button', { name: 'Estou pronto', exact: true })
                .click()
        await wait(() => states.every((s) => s?.status === 'playing'))
        for (const p of pages) await p.getByTestId('swing-stage').waitFor()
        await pages[0].waitForTimeout(1000)
        assert.equal(errors.length, 0, errors.join('\n'))
        const before = structuredClone(states[0].players[0].state.position)
        await pages[0].bringToFront()
        await pages[0].keyboard.down(' ')
        await wait(() => states[0]?.players[0]?.state.started, 15000)
        await pages[0].keyboard.up(' ')
        await wait(
            () => states[0].players[0].state.position.y !== before.y,
            10000,
        )
        assert.notDeepEqual(states[0].players[0].state.position, before)
        const layout = await pages[0].evaluate(() => ({
            stageHeight: document
                .querySelector('.swing-stage')
                .getBoundingClientRect().height,
            barHeight: document
                .querySelector('[aria-label="Sala cooperativa"]')
                .getBoundingClientRect().height,
            viewportHeight: innerHeight,
        }))
        assert(layout.barHeight < 220, 'Sala deve ser compacta')
        assert(
            layout.stageHeight > layout.viewportHeight / 2,
            'Mapa deve ocupar a maior parte da janela',
        )
        await pages[0].screenshot({ path: evidence + '/cooperative-city.png' })
        await pages[0].setViewportSize({ width: 390, height: 844 })
        await pages[0].waitForTimeout(200)
        assert(
            await pages[0].evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
            'Sem rolagem horizontal no celular',
        )
        await pages[0].screenshot({
            path: evidence + '/cooperative-mobile.png',
            fullPage: true,
        })
        await pages[0].setViewportSize({ width: 1440, height: 1000 })
        await contexts[1].setOffline(true)
        await wait(() => states[0]?.status === 'paused')
        await pages[0]
            .getByText(
                'Partida pausada. Aguardando a outra pessoa reconectar.',
                { exact: true },
            )
            .waitFor()
        await contexts[1].setOffline(false)
        await wait(() => states.every((s) => s?.status === 'playing'), 25000)
        assert.equal(states[0].players[1].nickname, 'Bia')
        assert.equal(states[1].roomCode, code)
        await pages[1]
            .getByRole('button', { name: 'Sair do cooperativo', exact: true })
            .click()
        await wait(
            () =>
                states[0]?.players.length === 1 &&
                states[0]?.status === 'waiting',
        )
        assert.equal(errors.length, 0, errors.join('\n'))
        assert.equal(thirdParties.length, 0, thirdParties.join('\n'))
        const results = {
            layout,
            twoIndependentContexts: true,
            webglLoaded: true,
            nicknames: ['Ana', 'Bia'],
            sameCity: states[0].cityId,
            objectives: states[0].objectives.length,
            keyboardChangesAuthoritativePosition: true,
            disconnectPauses: true,
            reconnectResumesSameRoom: true,
            leavingReleasesSlot: true,
            noPageErrors: true,
            noThirdPartyRequests: true,
            noMediaOrLandmarksInCommands: true,
            sentEvents,
        }
        await fs.writeFile(
            evidence + '/browser-smoke.json',
            JSON.stringify(results, null, 2) + '\n',
        )
        console.log(JSON.stringify(results, null, 2))
    } finally {
        await browser.close()
    }
})().catch((e) => {
    console.error(e)
    process.exitCode = 1
})
