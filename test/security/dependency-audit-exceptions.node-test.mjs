/* eslint-disable security/detect-non-literal-fs-filename -- Caminhos criados por mkdtemp nos próprios testes, sem entrada externa. */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { URL, fileURLToPath } from 'node:url'

import { run } from '../../scripts/lib/dependency-audit.mjs'
import {
    MAX_EXCEPTION_VALIDITY_DAYS,
    coversAdvisory,
    evaluateExceptions,
    loadExceptions,
    parseExceptions,
} from '../../scripts/lib/dependency-audit-exceptions.mjs'
import {
    advisoryLine,
    assertExcludes,
    assertIncludes,
    capture,
    expectFailure,
    ndjson,
    sameGhsaInTwoPackages,
    writeFakeYarn,
} from './dependency-audit-fixtures.mjs'

const ADVISORY = 'GHSA-253c-mchw-3w2r'

function validEntry(overrides = {}) {
    return {
        advisory: ADVISORY,
        package: 'markdown-it',
        owner: 'Wezer Carvalho',
        justification: 'Sem versão corrigida; alcança só o tooling.',
        approval: 'https://github.com/wezercarvalho/guess-my-move/issues/26',
        approvedAt: '2026-10-14',
        expiresAt: '2026-12-31',
        ...overrides,
    }
}

function fileText(...entries) {
    return JSON.stringify({ exceptions: entries })
}

function invalidFailure(text) {
    return expectFailure(() => parseExceptions(text), 'excecoes-invalidas')
}

describe('leitura do arquivo de exceções', () => {
    it('mantém o limite de validade documentado', () => {
        assert.equal(MAX_EXCEPTION_VALIDITY_DAYS, 90)
    })

    it('lê uma entrada válida com todos os campos', () => {
        assert.deepEqual(parseExceptions(fileText(validEntry())), [validEntry()])
    })

    for (const [description, text] of [
        ['uma lista vazia', '{ "exceptions": [] }'],
        ['um arquivo vazio', ''],
        ['um arquivo só com espaços', ' \n\t\n'],
    ]) {
        it(`trata ${description} como nenhuma exceção`, () => {
            assert.deepEqual(parseExceptions(text), [])
        })
    }

    it('ignora a marca de ordem de bytes (BOM) no início do arquivo', () => {
        assert.deepEqual(parseExceptions(`\uFEFF${fileText(validEntry())}`), [validEntry()])
    })

    it('aceita um advisory npm-<id> e um pacote com escopo', () => {
        const entry = validEntry({ advisory: 'npm-1234', package: '@vitest/mocker' })

        assert.deepEqual(parseExceptions(fileText(entry)), [entry])
    })

    it('aceita uma validade exatamente 90 dias após a aprovação', () => {
        const entry = validEntry({ approvedAt: '2026-10-14', expiresAt: '2027-01-12' })

        assert.deepEqual(parseExceptions(fileText(entry)), [entry])
    })

    it('aceita uma validade igual à data da aprovação', () => {
        const entry = validEntry({ expiresAt: '2026-10-14' })

        assert.deepEqual(parseExceptions(fileText(entry)), [entry])
    })

    it('rejeita JSON quebrado', () => {
        assertIncludes(invalidFailure('{ "exceptions": [').message, 'JSON válido')
    })

    for (const [description, text] of [
        ['a raiz é uma lista', '[]'],
        ['a raiz não tem exceptions', '{}'],
        ['exceptions não é lista', '{ "exceptions": {} }'],
    ]) {
        it(`rejeita o arquivo quando ${description}`, () => {
            assertIncludes(invalidFailure(text).message, 'exceptions')
        })
    }

    it('rejeita uma entrada que não é objeto, citando o índice', () => {
        const failure = invalidFailure(fileText(validEntry(), 'texto'))

        assertIncludes(failure.message, 'exceptions[1]')
    })

    for (const field of [
        'advisory',
        'package',
        'owner',
        'justification',
        'approval',
        'approvedAt',
        'expiresAt',
    ]) {
        it(`rejeita uma entrada sem ${field}, citando índice e campo`, () => {
            const failure = invalidFailure(
                fileText(validEntry(), validEntry({ [field]: undefined })),
            )

            assertIncludes(failure.message, `exceptions[1].${field}`)
            assertExcludes(failure.message, 'exceptions[0]')
        })
    }

    for (const [description, value] of [
        ['vazio', ''],
        ['só com espaços', '   '],
        ['que não é texto', 42],
    ]) {
        it(`rejeita um campo obrigatório ${description}`, () => {
            const failure = invalidFailure(fileText(validEntry({ owner: value })))

            assertIncludes(failure.message, 'exceptions[0].owner')
        })
    }

    for (const field of ['severity', '*', 'wildcard']) {
        it(`rejeita o campo desconhecido ${field}, então um curinga de severidade é impossível`, () => {
            const failure = invalidFailure(fileText(validEntry({ [field]: 'high' })))

            assertIncludes(failure.message, `exceptions[0].${field}`)
            assertIncludes(failure.message, 'campo desconhecido')
        })
    }

    for (const advisory of ['*', 'GHSA-*', 'GHSA-253c-*-3w2r', 'npm-*']) {
        it(`rejeita o curinga de advisory ${advisory}`, () => {
            const failure = invalidFailure(fileText(validEntry({ advisory })))

            assertIncludes(failure.message, 'exceptions[0].advisory')
            assertIncludes(failure.message, 'curinga')
        })
    }

    for (const name of ['*', 'markdown-*', '@vitest/*', 'markdown-it?']) {
        it(`rejeita o curinga de pacote ${name}`, () => {
            const failure = invalidFailure(fileText(validEntry({ package: name })))

            assertIncludes(failure.message, 'exceptions[0].package')
            assertIncludes(failure.message, 'curinga')
        })
    }

    for (const advisory of ['CVE-2026-97058', 'GHSA-253c', '123', 'npm-abc']) {
        it(`rejeita o advisory com formato desconhecido ${advisory}`, () => {
            const failure = invalidFailure(fileText(validEntry({ advisory })))

            assertIncludes(failure.message, 'exceptions[0].advisory')
        })
    }

    for (const name of ['Markdown It', '../escape', 'a b']) {
        it(`rejeita o pacote com nome inválido ${name}`, () => {
            const failure = invalidFailure(fileText(validEntry({ package: name })))

            assertIncludes(failure.message, 'exceptions[0].package')
        })
    }

    for (const [description, value] of [
        ['formato diferente', '14/10/2026'],
        ['com horário', '2026-10-14T00:00:00Z'],
        ['mês inexistente', '2026-13-01'],
        ['dia inexistente', '2026-02-30'],
        ['29 de fevereiro fora de ano bissexto', '2027-02-29'],
    ]) {
        it(`rejeita uma data inválida: ${description}`, () => {
            const approvedAt = invalidFailure(fileText(validEntry({ approvedAt: value })))
            const expiresAt = invalidFailure(fileText(validEntry({ expiresAt: value })))

            assertIncludes(approvedAt.message, 'exceptions[0].approvedAt')
            assertIncludes(expiresAt.message, 'exceptions[0].expiresAt')
        })
    }

    it('aceita 29 de fevereiro de um ano bissexto', () => {
        const entry = validEntry({ approvedAt: '2028-02-29', expiresAt: '2028-03-29' })

        assert.equal(parseExceptions(fileText(entry)).length, 1)
    })

    it('rejeita uma validade acima de 90 dias após a aprovação', () => {
        const failure = invalidFailure(
            fileText(validEntry({ approvedAt: '2026-10-14', expiresAt: '2027-01-13' })),
        )

        assertIncludes(failure.message, 'exceptions[0].expiresAt')
        assertIncludes(failure.message, '90')
    })

    it('rejeita uma validade anterior à aprovação', () => {
        const failure = invalidFailure(
            fileText(validEntry({ approvedAt: '2026-10-14', expiresAt: '2026-10-13' })),
        )

        assertIncludes(failure.message, 'exceptions[0].expiresAt')
        assertIncludes(failure.message, 'anterior')
    })

    it('rejeita uma duplicata do mesmo advisory e pacote, citando a entrada posterior', () => {
        const failure = invalidFailure(
            fileText(validEntry(), validEntry({ owner: 'Outra pessoa' })),
        )

        assertIncludes(failure.message, 'exceptions[1]')
        assertIncludes(failure.message, 'duplicada')
        assertIncludes(failure.message, 'exceptions[0]')
    })

    it('aceita o mesmo advisory em pacotes diferentes', () => {
        const entries = [validEntry(), validEntry({ package: 'outro' })]

        assert.equal(parseExceptions(fileText(...entries)).length, 2)
    })

    it('informa todos os defeitos encontrados, não só o primeiro', () => {
        const failure = invalidFailure(
            fileText(validEntry({ owner: '' }), validEntry({ package: '*', advisory: 'npm-9' })),
        )

        assertIncludes(failure.message, 'exceptions[0].owner')
        assertIncludes(failure.message, 'exceptions[1].package')
    })
})

describe('carga do arquivo de exceções', () => {
    let workDir
    let counter = 0

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-exceptions-'))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function writeText(text) {
        counter += 1
        const path = join(workDir, `${counter}.json`)
        writeFileSync(path, text)
        return path
    }

    it('trata um arquivo ausente como nenhuma exceção', () => {
        assert.deepEqual(loadExceptions(join(workDir, 'inexistente.json')), [])
    })

    it('trata um arquivo existente e vazio como lista vazia', () => {
        assert.deepEqual(loadExceptions(writeText('')), [])
    })

    it('carrega um arquivo válido', () => {
        assert.deepEqual(loadExceptions(writeText(fileText(validEntry()))), [validEntry()])
    })

    it('falha com a categoria de exceções inválidas quando o arquivo é inválido', () => {
        assert.throws(
            () => loadExceptions(writeText('{ quebrado')),
            /^AuditFailure: \[excecoes-invalidas\] /u,
        )
    })

    it('falha com a categoria de exceções inválidas quando o caminho não pode ser lido como arquivo', () => {
        expectFailure(() => loadExceptions(workDir), 'excecoes-invalidas')
    })

    it('entrega no repositório um arquivo de exceções válido e vazio', () => {
        const path = fileURLToPath(
            new URL('../../scripts/dependency-audit-exceptions.json', import.meta.url),
        )

        assert.deepEqual(loadExceptions(path), [])
    })
})

describe('avaliação das exceções', () => {
    const blocking = [{ id: ADVISORY, module: 'markdown-it' }]
    const lastDay = new Date('2026-12-31T23:59:59.999Z')
    const dayAfter = new Date('2027-01-01T00:00:00.000Z')

    it('aplica uma exceção válida ao advisory e ao pacote que ela cita', () => {
        const entries = parseExceptions(fileText(validEntry()))

        const result = evaluateExceptions(entries, blocking, lastDay)

        assert.deepEqual(result.applied, entries)
        assert.deepEqual(result.expired, [])
        assert.deepEqual(result.unused, [])
    })

    it('mantém a exceção válida no último dia, até o fim do dia UTC', () => {
        const entries = parseExceptions(fileText(validEntry()))

        for (const now of [new Date('2026-12-31T00:00:00.000Z'), lastDay]) {
            assert.equal(evaluateExceptions(entries, blocking, now).applied.length, 1)
        }
    })

    it('vence a exceção no dia UTC seguinte', () => {
        const entries = parseExceptions(fileText(validEntry()))

        const result = evaluateExceptions(entries, blocking, dayAfter)

        assert.deepEqual(result.applied, [])
        assert.deepEqual(result.expired, entries)
        assert.deepEqual(result.unused, [])
    })

    it('lista uma exceção vencida mesmo sem advisory correspondente', () => {
        const entries = parseExceptions(fileText(validEntry()))

        const result = evaluateExceptions(entries, [], dayAfter)

        assert.deepEqual(result.expired, entries)
        assert.deepEqual(result.unused, [])
    })

    it('informa uma exceção válida sem advisory correspondente como sem efeito', () => {
        const entries = parseExceptions(fileText(validEntry()))

        const result = evaluateExceptions(entries, [], lastDay)

        assert.deepEqual(result.unused, entries)
        assert.deepEqual(result.applied, [])
        assert.deepEqual(result.expired, [])
    })

    it('não cobre outro advisory do mesmo pacote', () => {
        const entries = parseExceptions(fileText(validEntry()))
        const other = { id: 'GHSA-zzzz-zzzz-zzzz', module: 'markdown-it' }

        const result = evaluateExceptions(entries, [other], lastDay)

        assert.equal(coversAdvisory(entries[0], other), false)
        assert.deepEqual(result.applied, [])
        assert.deepEqual(result.unused, entries)
    })

    it('não cobre o mesmo advisory em outro pacote', () => {
        const entries = parseExceptions(fileText(validEntry()))
        const other = { id: ADVISORY, module: 'outro-pacote' }

        assert.equal(coversAdvisory(entries[0], other), false)
        assert.deepEqual(evaluateExceptions(entries, [other], lastDay).applied, [])
    })

    it('cobre exatamente o par de advisory e pacote', () => {
        const entries = parseExceptions(fileText(validEntry()))

        assert.equal(coversAdvisory(entries[0], blocking[0]), true)
    })

    it('rejeita uma aprovação datada no futuro', () => {
        const entries = parseExceptions(fileText(validEntry({ approvedAt: '2026-11-01' })))

        assert.throws(
            () => evaluateExceptions(entries, blocking, new Date('2026-10-14')),
            /^AuditFailure: \[excecoes-invalidas\] .*exceptions\[0\]\.approvedAt/u,
        )
    })

    it('aceita uma aprovação datada no dia UTC atual', () => {
        const entries = parseExceptions(fileText(validEntry({ approvedAt: '2026-10-14' })))

        const result = evaluateExceptions(entries, blocking, new Date('2026-10-14T00:00:00.000Z'))

        assert.equal(result.applied.length, 1)
    })
})

describe('execução do auditor com exceções', () => {
    let workDir
    let packageJsonPath
    let counter = 0

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-run-exc-'))
        packageJsonPath = join(workDir, 'package.json')
        writeFileSync(packageJsonPath, JSON.stringify({ private: true }))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    // markdown-it High que só aparece na execução de desenvolvimento (tooling).
    const highDevelopment = advisoryLine({
        value: 'markdown-it',
        ID: 10,
        Severity: 'high',
        URL: `https://github.com/advisories/${ADVISORY}`,
        'Tree Versions': ['14.3.0'],
    })

    function exceptionsFile(text) {
        counter += 1
        const path = join(workDir, `excecoes-${counter}.json`)
        if (text !== undefined) writeFileSync(path, text)
        return path
    }

    // `config` descreve a saída de cada ambiente para o Yarn falso (production/development).
    function runWith(config, exceptionsPath, now = new Date('2026-10-20T12:00:00.000Z')) {
        const { out, err, output } = capture()
        const code = run(writeFakeYarn(workDir, config), output, {
            packageJsonPath,
            exceptionsPath,
            now,
        })
        return { code, out: out.join(''), err: err.join('') }
    }

    const highConfig = { production: '', development: highDevelopment }
    const cleanConfig = { production: '', development: '' }

    it('passa um High coberto por exceção válida e imprime quem a aprovou', () => {
        const path = exceptionsFile(fileText(validEntry()))

        const { code, out, err } = runWith(highConfig, path)

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(
            out,
            `[exceção aplicada] ${ADVISORY} markdown-it — responsável Wezer Carvalho, válida até 2026-12-31, aprovação https://github.com/wezercarvalho/guess-my-move/issues/26`,
        )
        assertExcludes(out, '[bloqueante]')
        assertIncludes(out, 'Auditoria de dependências:')
    })

    it('aplica a exceção a um advisory que só alcança o tooling', () => {
        const path = exceptionsFile(fileText(validEntry()))

        assert.equal(runWith(highConfig, path).code, 0)
    })

    it('volta a bloquear quando a exceção venceu e informa o vencimento', () => {
        const path = exceptionsFile(fileText(validEntry()))

        const { code, out, err } = runWith(highConfig, path, new Date('2027-01-01T00:00:00.000Z'))

        assert.equal(code, 1)
        assertIncludes(err, `[bloqueante] markdown-it 14.3.0 HIGH tooling ${ADVISORY}`)
        assertIncludes(out, `[exceção vencida] ${ADVISORY} markdown-it — venceu em 2026-12-31`)
        assertExcludes(out, '[exceção aplicada]')
    })

    it('ainda passa no último dia e bloqueia no dia seguinte', () => {
        const path = exceptionsFile(fileText(validEntry()))

        assert.equal(runWith(highConfig, path, new Date('2026-12-31T23:59:59.999Z')).code, 0)
        assert.equal(runWith(highConfig, path, new Date('2027-01-01T00:00:00.000Z')).code, 1)
    })

    it('não cobre outro advisory do mesmo pacote', () => {
        const development = ndjson(
            highDevelopment,
            advisoryLine({
                value: 'markdown-it',
                ID: 11,
                Severity: 'high',
                Issue: 'Outro defeito',
                URL: 'https://github.com/advisories/GHSA-zzzz-zzzz-zzzz',
                'Tree Versions': ['14.3.0'],
            }),
        )
        const path = exceptionsFile(fileText(validEntry()))

        const { code, out, err } = runWith({ production: '', development }, path)

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] markdown-it 14.3.0 HIGH tooling GHSA-zzzz-zzzz-zzzz')
        assertExcludes(err, `HIGH tooling ${ADVISORY}`)
        assertIncludes(err, 'Auditoria bloqueada por 1 vulnerabilidade(s)')
        assertIncludes(out, '[exceção aplicada]')
    })

    it('cobre só o pacote citado quando o mesmo GHSA High aparece em dois pacotes', () => {
        const development = ndjson(...sameGhsaInTwoPackages('GHSA-82fw-gwwq-j7x9'))
        const config = { production: '', development }
        const vitestOnly = exceptionsFile(
            fileText(validEntry({ advisory: 'GHSA-82fw-gwwq-j7x9', package: 'vitest' })),
        )
        const both = exceptionsFile(
            fileText(
                validEntry({ advisory: 'GHSA-82fw-gwwq-j7x9', package: 'vitest' }),
                validEntry({ advisory: 'GHSA-82fw-gwwq-j7x9', package: '@vitest/mocker' }),
            ),
        )

        const partial = runWith(config, vitestOnly)
        const complete = runWith(config, both)

        assert.equal(partial.code, 1)
        assertIncludes(
            partial.err,
            '[bloqueante] @vitest/mocker 1.2.3 HIGH tooling GHSA-82fw-gwwq-j7x9',
        )
        assertExcludes(partial.err, '[bloqueante] vitest ')
        assertIncludes(partial.err, 'Auditoria bloqueada por 1 vulnerabilidade(s)')
        assertIncludes(partial.out, '[exceção aplicada] GHSA-82fw-gwwq-j7x9 vitest')
        assert.equal(complete.code, 0)
        assertExcludes(complete.err, '[bloqueante]')
    })

    it('informa uma exceção sem efeito e não bloqueia', () => {
        const path = exceptionsFile(fileText(validEntry()))

        const { code, out } = runWith(cleanConfig, path)

        assert.equal(code, 0)
        assertIncludes(
            out,
            `[exceção sem efeito] ${ADVISORY} markdown-it — nenhum advisory correspondente`,
        )
    })

    it('informa uma exceção vencida sem advisory correspondente e não bloqueia', () => {
        const path = exceptionsFile(fileText(validEntry()))

        const { code, out } = runWith(cleanConfig, path, new Date('2027-02-01T00:00:00.000Z'))

        assert.equal(code, 0)
        assertIncludes(out, '[exceção vencida]')
        assertExcludes(out, '[exceção sem efeito]')
    })

    it('trata um arquivo de exceções ausente como nenhuma exceção', () => {
        const { code, err } = runWith(highConfig, exceptionsFile())

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante]')
    })

    it('trata uma lista vazia como nenhuma exceção', () => {
        const { code } = runWith(highConfig, exceptionsFile('{ "exceptions": [] }'))

        assert.equal(code, 1)
    })

    it('falha com a categoria de exceções inválidas e não aplica nenhuma quando o arquivo é inválido', () => {
        const path = exceptionsFile(
            fileText(validEntry(), validEntry({ package: '*', advisory: 'npm-9' })),
        )

        const { code, out, err } = runWith(highConfig, path)

        assert.equal(code, 1)
        assert.match(err, /^\[excecoes-invalidas\] /u)
        assertIncludes(err, 'exceptions[1].package')
        assertExcludes(out, '[exceção aplicada]')
        assertExcludes(out, 'Auditoria de dependências')
    })

    it('não aceita um High com arquivo inválido mesmo que a primeira entrada o cubra', () => {
        const path = exceptionsFile(fileText(validEntry(), validEntry({ expiresAt: 'amanhã' })))

        const { code, err } = runWith(highConfig, path)

        assert.equal(code, 1)
        assert.match(err, /^\[excecoes-invalidas\] /u)
    })

    it('valida o arquivo de exceções antes de consultar o Yarn', () => {
        const { err, output } = capture()
        const path = exceptionsFile('{ quebrado')

        const code = run(join(workDir, 'yarn-que-nao-existe', 'yarn.js'), output, {
            packageJsonPath,
            exceptionsPath: path,
        })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[excecoes-invalidas\] /u)
    })
})
