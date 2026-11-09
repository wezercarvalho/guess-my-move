// Run after build: exercises TypeScript-emitted decorator metadata and workspace exports.
import assert from 'node:assert/strict'
const originalObserve = process.env.OBSERVE_ENABLED
const originalOrigins = process.env.ALLOWED_ORIGINS
process.env.OBSERVE_ENABLED = 'false'
process.env.ALLOWED_ORIGINS = 'http://localhost:5173'
const { createServerApp } = await import('../dist/app.setup.js')

const app = await createServerApp({ logger: false })
try {
    await app.listen(0, '127.0.0.1')
    const { port } = app.getHttpServer().address()
    const url = `http://127.0.0.1:${port}`
    const health = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) })
    assert.equal(health.status, 200)
    const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }
    const created = await fetch(`${url}/api/cards/rounds`, {
        method: 'POST', headers, body: JSON.stringify({ cardId: 'wave-001', locale: 'pt-BR' }), signal: AbortSignal.timeout(5000),
    })
    assert.equal(created.status, 201)
    const access = await created.json()
    assert.equal(access.round.state, 'detecting')
    assert.equal(access.round.score, 0)
    assert.equal('evaluation' in access.round.card, false)
    const invalid = await fetch(`${url}/api/cards/rounds`, {
        method: 'POST', headers, body: JSON.stringify({ cardId: 'wave-001', locale: 'pt-BR', score: 99999 }), signal: AbortSignal.timeout(5000),
    })
    assert.equal(invalid.status, 400)
    const cancelled = await fetch(`${url}/api/cards/rounds/${access.roundId}/cancel`, {
        method: 'POST', headers: { ...headers, Authorization: `Bearer ${access.token}` }, body: '{}', signal: AbortSignal.timeout(5000),
    })
    assert.equal(cancelled.status, 200)
    const final = await cancelled.json()
    assert.equal(final.state, 'user_cancelled')
    assert.equal(final.score, 0)
    console.log('Servidor compilado: DI/metadados, health 200, início 201, validação 400 e cancelamento 200 aprovados; sem logs de credenciais.')
} finally {
    await app.close()
    if (originalObserve === undefined) delete process.env.OBSERVE_ENABLED
    else process.env.OBSERVE_ENABLED = originalObserve
    if (originalOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = originalOrigins
}
