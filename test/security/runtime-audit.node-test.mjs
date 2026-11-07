import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { assessRuntime, fetchOfficialJson, SOURCES } from '../../scripts/lib/runtime-audit.mjs'
import { affectedScopes, planChecks } from '../../scripts/git-hooks/scopes.mjs'

const now = new Date('2026-11-06T12:00:00Z')
const schedule = { v26: { start: '2026-04-22', end: '2029-04-30' } }
const release = (version, security = false) => ({ version, security, date: '2026-10-21' })
const index = [release('v26.13.0'), release('v26.12.1', true), release('v26.12.0')]
const assess = (pin = '26.12.1', releases = index, calendar = schedule) => assessRuntime(pin, releases, calendar, now)

test('release comum posterior informa atualização sem alegar correção de segurança', () => {
    assert.deepEqual(assess(), { pin: '26.12.1', latest: '26.13.0', latestSecurity: '26.12.1', updateRequired: false })
})
test('detecta correção publicada independentemente da ordem; compara numericamente', () => {
    const releases = [...index, release('v26.9.0', true), release('v26.13.1', true)]
    assert.equal(assess('26.12.1', releases.reverse()).updateRequired, true)
    assert.equal(assess('26.13.1', releases).updateRequired, false)
})
test('ignora prerelease e outra major; não cruza major automaticamente', () => {
    assert.equal(assess('26.12.1', [...index, release('v27.1.0', true), release('v26.14.0-rc.1', true)]).updateRequired, false)
})
test('sem releases de segurança ainda, major suportada não inventa patch', () => {
    assert.equal(assess('26.13.0', [release('v26.13.0')]).latestSecurity, null)
})
test('pin ausente, intervalo, feed vazio ou formato desconhecido não geram aprovação', () => {
    for (const [pin, feed] of [['26.99.0', index], ['>=26.0.0', index], ['26.12.1', []], ['26.12.1', {}], ['26.12.1', [{ version: 'v26.12.1', security: 'false', date: '2026-10-21' }]], ['26.12.1', [{ ...index[1], date: '2026-02-30' }]]]) {
        assert.throws(() => assess(pin, feed))
    }
})
test('calendário ausente, data inválida e major fora da janela de suporte falham', () => {
    for (const calendar of [{}, { v26: {} }, { v26: { start: '2026-04-22', end: '2026-11-06' } }, { v26: { start: '2027-01-01', end: '2029-04-30' } }]) assert.throws(() => assess('26.12.1', index, calendar))
})
test('JSON oficial tem fontes fixas, timeout, redirect recusado e limite de bytes', async () => {
    let options
    const body = await fetchOfficialJson(SOURCES.releases, async (url, init) => {
        assert.equal(url, 'https://nodejs.org/dist/index.json')
        options = init
        return new Response(JSON.stringify(index))
    })
    assert.deepEqual(body, index)
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    await assert.rejects(fetchOfficialJson('https://example.com', async () => new Response('{}')))
    for (const response of [new Response('{}', { status: 503 }), new Response('not json'), new Response('x'.repeat(2 * 1024 * 1024 + 1))]) {
        await assert.rejects(fetchOfficialJson(SOURCES.releases, async () => response))
    }
    await assert.rejects(fetchOfficialJson(SOURCES.releases, async () => { throw new DOMException('timeout', 'TimeoutError') }))
})
test('stream é cancelado ao exceder limite sem depender de content-length', async () => {
    let cancelled = false
    const response = new Response(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)) },
        cancel() { cancelled = true },
    }))
    await assert.rejects(fetchOfficialJson(SOURCES.schedule, async () => response))
    assert.equal(cancelled, true)
})
test('runtime é selecionado no hook e em PR; rotina não tem permissões de escrita', () => {
    for (const path of ['.node-version', 'scripts/audit-runtime.mjs', 'scripts/lib/runtime-audit.mjs', '.github/workflows/runtime-audit.yml']) {
        assert.ok(affectedScopes([path]).includes('audit'), path)
        const plan = planChecks([path])
        assert.deepEqual(plan.find(step => step.id === 'runtime').args, ['security:runtime'])
    }
    const workflow = parse(readFileSync('.github/workflows/runtime-audit.yml', 'utf8'))
    assert.deepEqual(workflow.permissions, { contents: 'read' })
    assert.equal(workflow.on.schedule[0].cron, '37 8 * * *')
    assert.ok('workflow_dispatch' in workflow.on)
    assert.ok(!('pull_request' in workflow.on))
    const pr = parse(readFileSync('.github/workflows/pr-gate.yml', 'utf8'))
    assert.match(JSON.stringify(pr.jobs.audit.steps), /yarn security:runtime/)
})

test('atualização do pin seleciona regressões de código além da auditoria', () => {
    assert.ok(affectedScopes(['.node-version']).includes('code'))
})
