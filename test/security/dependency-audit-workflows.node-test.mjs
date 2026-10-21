/* Estrutura dos workflows que executam a auditoria de dependências: job condicional no pr-gate e
   rotina quinzenal na main. Lê só arquivos versionados da raiz do repositório. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, URL } from 'node:url'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const readText = (path) => readFile(join(repoRoot, path), 'utf8')
const readYaml = async (path) => parse(await readText(path))

const prGateText = await readText('.github/workflows/pr-gate.yml')
const prGate = parse(prGateText)
const audit = await readYaml('.github/workflows/dependency-audit.yml')
const packageJson = JSON.parse(await readText('package.json'))

const AUDIT_COMMAND = 'yarn security:dependencies'

const auditPattern = () => {
    const match = /AUDIT_PATTERN='([^']+)'/.exec(prGateText)
    assert.ok(match, 'pr-gate.yml deve definir AUDIT_PATTERN')
    return new RegExp(match[1])
}

const runSteps = (job) => (job.steps ?? []).map((step) => step.run)

test('pr-gate expõe a seleção audit e tem o job audit condicionado a ela', () => {
    assert.ok(prGate.jobs['detect-changes'].outputs.audit)
    const job = prGate.jobs.audit
    assert.ok(job, 'job audit ausente')
    assert.equal(job.if, "needs.detect-changes.outputs.audit == 'true'")
    assert.equal(typeof job['timeout-minutes'], 'number')
    assert.ok(runSteps(job).includes(AUDIT_COMMAND))
})

test('AUDIT_PATTERN dispara só para o que muda o veredito', () => {
    const pattern = auditPattern()
    for (const path of [
        'package.json',
        'yarn.lock',
        'scripts/audit-dependencies.mjs',
        'scripts/dependency-audit-exceptions.json',
        'scripts/lib/dependency-audit.mjs',
        'scripts/lib/dependency-audit-failure.mjs',
        'scripts/lib/dependency-audit-exceptions.mjs',
        '.github/workflows/pr-gate.yml',
        '.github/workflows/dependency-audit.yml',
    ]) {
        assert.ok(pattern.test(path), `deveria disparar: ${path}`)
    }
    for (const path of [
        'README.md',
        'specs/x/spec.md',
        'scripts/sdd/check-specs.mjs',
        'scripts/git-hooks/scopes.mjs',
        'apps/web/package.json',
    ]) {
        assert.ok(!pattern.test(path), `não deveria disparar: ${path}`)
    }
})

test('dependency-audit é rotina quinzenal (dias 1 e 15) sem credenciais', async () => {
    assert.equal(audit.on.schedule.length, 1)
    // Quinzenal: dias 1 e 15 do mês, às 08:23 UTC.
    assert.equal(audit.on.schedule[0].cron, '23 8 1,15 * *')
    assert.ok('workflow_dispatch' in audit.on)
    assert.deepEqual(audit.permissions, { contents: 'read' })
    assert.ok(!(await readText('.github/workflows/dependency-audit.yml')).includes('secrets.'))
    const job = audit.jobs.audit
    assert.match(job.name, /quinzenal/)
    assert.doesNotMatch(job.name, /semanal/)
    assert.equal(typeof job['timeout-minutes'], 'number')
    assert.ok(runSteps(job).includes(AUDIT_COMMAND))
})

test('a auditoria fica fora de test:gates e não depende do estado do registry nos testes', () => {
    assert.ok(!packageJson.scripts['test:gates'].includes('audit-dependencies'))
    assert.ok(!packageJson.scripts['test:sdd'].includes('security'))
})

test('test:gates inclui os testes do auditor, do hook e dos workflows', () => {
    for (const file of [
        'test/security/dependency-audit.node-test.mjs',
        'test/security/dependency-audit-exceptions.node-test.mjs',
        'test/security/dependency-audit-workflows.node-test.mjs',
        'test/gates/hook-and-gate.node-test.mjs',
    ]) {
        assert.ok(packageJson.scripts['test:gates'].includes(file), file)
    }
})
