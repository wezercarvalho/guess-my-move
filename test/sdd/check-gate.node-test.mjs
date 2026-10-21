import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { checkJobResults, SELECTED_JOBS } from '../../scripts/sdd/check-job-results.mjs'

const requireRoot = createRequire(new URL('../../package.json', import.meta.url))
const { parse } = requireRoot('yaml')

// Seleções de governança do `detect-changes`: sdd, root-docs e tooling (job `sdd` do pr-gate).
const needs = ({
    sdd = 'false',
    rootDocs = 'false',
    tooling = 'false',
    code = 'false',
    audit = 'false',
    result = 'skipped',
} = {}) => ({
    'detect-changes': {
        result: 'success',
        outputs: { sdd, 'root-docs': rootDocs, tooling, code, audit },
    },
    sdd: { result },
    code: { result: 'skipped' },
    audit: { result: 'skipped' },
})

test('os jobs condicionais do gate são code e audit', () =>
    assert.deepEqual(SELECTED_JOBS, ['code', 'audit']))
test('required gate aceita governança aprovada', () =>
    assert.deepEqual(checkJobResults(needs({ sdd: 'true', result: 'success' })), []))
for (const result of ['failure', 'cancelled', 'skipped'])
    test(`required gate bloqueia governança selecionada ${result}`, () => {
        const errors = checkJobResults(needs({ sdd: 'true', result }))
        assert.ok(errors.some((message) => message.includes('sdd')))
    })
test('falha/cancelamento de detecção ou seleção ausente não permite ignorar a governança', () => {
    for (const result of ['failure', 'cancelled', 'skipped']) {
        const jobs = needs()
        jobs['detect-changes'].result = result
        assert.ok(checkJobResults(jobs).length > 0)
    }
    const jobs = needs()
    delete jobs['detect-changes'].outputs.sdd
    assert.ok(checkJobResults(jobs).length > 0)
})
// O job `sdd` é obrigatório quando qualquer das três seleções é verdadeira.
for (const sdd of ['true', 'false'])
    for (const rootDocs of ['true', 'false'])
        for (const tooling of ['true', 'false'])
            for (const result of ['success', 'skipped', 'failure', 'cancelled']) {
                const required = [sdd, rootDocs, tooling].includes('true')
                const accepted = required ? ['success'] : ['success', 'skipped']
                const blocks = !accepted.includes(result)
                test(`governança sdd=${sdd} root-docs=${rootDocs} tooling=${tooling} job=${result} ${blocks ? 'bloqueia' : 'passa'}`, () => {
                    const errors = checkJobResults(needs({ sdd, rootDocs, tooling, result }))
                    if (!blocks) return assert.deepEqual(errors, [])
                    assert.equal(errors.length, 1)
                    assert.match(errors[0], /governança \(SDD, docs da raiz e gates\)/)
                    assert.match(errors[0], new RegExp(result))
                })
            }
test('só os testes dos gates falham: tooling=true, job sdd=failure → erro', () => {
    const errors = checkJobResults(needs({ tooling: 'true', result: 'failure' }))
    assert.equal(errors.length, 1)
    assert.match(errors[0], /governança/)
})
test('seleção ausente ou inválida de sdd, root-docs ou tooling é erro', () => {
    for (const name of ['sdd', 'root-docs', 'tooling']) {
        for (const value of [undefined, '', 'maybe', true]) {
            const jobs = needs()
            if (value === undefined) delete jobs['detect-changes'].outputs[name]
            else jobs['detect-changes'].outputs[name] = value
            const errors = checkJobResults(jobs)
            assert.ok(
                errors.some((message) => message.includes(`${name}: seleção ausente ou inválida`)),
                `${name}=${String(value)}`,
            )
        }
    }
})
test('job condicional: selecionado exige success; não selecionado aceita skipped', () => {
    const jobs = needs()
    jobs['detect-changes'].outputs.audit = 'true'
    jobs.audit.result = 'failure'
    assert.ok(checkJobResults(jobs).some((message) => message.startsWith('audit:')))
    jobs.audit.result = 'skipped'
    assert.ok(checkJobResults(jobs).length > 0)
    jobs.audit.result = 'success'
    assert.deepEqual(checkJobResults(jobs), [])
    jobs['detect-changes'].outputs.audit = 'false'
    jobs.audit.result = 'skipped'
    assert.deepEqual(checkJobResults(jobs), [])
    jobs.audit.result = 'failure'
    assert.ok(checkJobResults(jobs).length > 0)
    delete jobs['detect-changes'].outputs.audit
    assert.ok(checkJobResults(jobs).some((message) => message.includes('audit: seleção')))
})
test('um PR só de código: code selecionado exige success, e o gate falha se code falhar', () => {
    // code=true + job pulado ou falho bloqueia; só success passa.
    for (const result of ['failure', 'cancelled', 'skipped']) {
        const jobs = needs({ code: 'true' })
        jobs.code.result = result
        assert.ok(
            checkJobResults(jobs).some((message) => message.startsWith('code:')),
            `code=true job=${result} deve bloquear`,
        )
    }
    const ok = needs({ code: 'true' })
    ok.code.result = 'success'
    assert.deepEqual(checkJobResults(ok), [])
})
test('um PR só de código não exige governança: sdd pode ser pulado', () => {
    // code=true, governança toda falsa → job sdd pulado é aceitável, code success passa.
    const jobs = needs({ code: 'true' })
    jobs.code.result = 'success'
    jobs.sdd.result = 'skipped'
    assert.deepEqual(checkJobResults(jobs), [])
})
test('code não selecionado aceita skipped; selecionado inválido é erro de seleção', () => {
    const jobs = needs()
    jobs.code.result = 'skipped'
    assert.deepEqual(checkJobResults(jobs), [])
    delete jobs['detect-changes'].outputs.code
    assert.ok(checkJobResults(jobs).some((message) => message.includes('code: seleção')))
})
test('job de pacote futuro entra pela lista de jobs condicionais', () => {
    const jobs = { ...needs(), app: { result: 'failure' } }
    jobs['detect-changes'].outputs.app = 'true'
    assert.ok(checkJobResults(jobs, ['audit', 'app']).some((message) => message.startsWith('app:')))
})
test('workflow liga seleção, comandos oficiais e resultado da governança ao required gate', async () => {
    const source = await readFile(
        new URL('../../.github/workflows/pr-gate.yml', import.meta.url),
        'utf8',
    )
    const workflow = parse(source)
    assert.ok(workflow.jobs.gate.needs.includes('sdd'))
    assert.ok(workflow.jobs.gate.needs.includes('code'))
    assert.ok(workflow.jobs.gate.needs.includes('audit'))
    // Sempre decide em PR pronta; em rascunho nada roda (inclusive o gate).
    assert.equal(workflow.jobs.gate.if, 'always() && github.event.pull_request.draft == false')
    assert.match(
        workflow.jobs.gate.steps.map((step) => step.run ?? '').join('\n'),
        /check-job-results\.mjs/,
    )
    assert.equal(
        workflow.jobs.gate.steps.find((step) => step.env?.GATE_NEEDS).env.GATE_NEEDS,
        '${{ toJSON(needs) }}',
    )
    for (const name of ['sdd', 'root-docs', 'tooling']) {
        assert.equal(
            workflow.jobs['detect-changes'].outputs[name],
            `\${{ steps.filter.outputs.${name} }}`,
        )
        assert.match(workflow.jobs.sdd.if, new RegExp(`outputs\\.${name} == 'true'`))
    }
    const commands = workflow.jobs.sdd.steps.map((step) => step.run ?? '').join('\n')
    assert.match(commands, /yarn test:sdd/)
    assert.match(commands, /yarn sdd:check/)
    assert.match(source, /scripts\/sdd/)
    assert.match(source, /specs/)
})
test('o job code roda yarn check:all, condicionado à seleção code, como os demais jobs', async () => {
    const source = await readFile(
        new URL('../../.github/workflows/pr-gate.yml', import.meta.url),
        'utf8',
    )
    const workflow = parse(source)
    assert.equal(
        workflow.jobs['detect-changes'].outputs.code,
        '${{ steps.filter.outputs.code }}',
    )
    const code = workflow.jobs.code
    assert.ok(code, 'o job code deve existir')
    assert.deepEqual([code.needs].flat(), ['detect-changes'])
    assert.match(String(code.if), /needs\.detect-changes\.outputs\.code == 'true'/)
    const runs = code.steps.map((step) => step.run ?? '')
    assert.ok(runs.includes('corepack enable'), 'o job code habilita corepack como os demais')
    assert.ok(runs.some((run) => /yarn install --frozen-lockfile/.test(run)))
    assert.ok(runs.some((run) => /yarn check:all/.test(run)))
})
