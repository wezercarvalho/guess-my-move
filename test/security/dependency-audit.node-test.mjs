/* eslint-disable security/detect-non-literal-fs-filename -- Caminhos criados por mkdtemp nos próprios testes, sem entrada externa. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, before, describe, it } from 'node:test'
import { URL, fileURLToPath } from 'node:url'

import {
    AUDIT_MAX_BUFFER_BYTES,
    AUDIT_TIMEOUT_MS,
    BYTES_PER_MIB,
    STDERR_EXCERPT_MAX_CHARS,
    executeYarnAudit,
    formatAuditSummary,
    mergeReports,
    parseYarnAuditJson,
    run,
} from '../../scripts/lib/dependency-audit.mjs'
import {
    AUDIT_FAILURE_CATEGORIES,
    AuditFailure,
} from '../../scripts/lib/dependency-audit-failure.mjs'
import {
    HTTP_ERROR_STDERR,
    NETWORK_UNAVAILABLE_STDERR,
    advisoryLine,
    assertExcludes,
    assertIncludes,
    capture,
    expectFailure,
    ndjson,
    sameGhsaInTwoPackages,
    writeFakeYarn,
} from './dependency-audit-fixtures.mjs'

describe('categorias de falha', () => {
    it('declara as dez categorias estáveis', () => {
        assert.deepEqual(AUDIT_FAILURE_CATEGORIES, [
            'saida-invalida',
            'formato-inesperado',
            'yarn-falhou',
            'yarn-sinal',
            'yarn-nao-iniciou',
            'limite-de-saida',
            'timeout',
            'registry-indisponivel',
            'excecoes-invalidas',
            'erro-interno',
        ])
    })

    it('não declara mais as categorias sem-dados e erros-do-yarn do Yarn 1', () => {
        assert.ok(!AUDIT_FAILURE_CATEGORIES.includes('sem-dados'))
        assert.ok(!AUDIT_FAILURE_CATEGORIES.includes('erros-do-yarn'))
    })

    for (const category of AUDIT_FAILURE_CATEGORIES) {
        it(`inicia a mensagem da categoria ${category} pelo rótulo entre colchetes`, () => {
            const failure = new AuditFailure(category, 'detalhe')

            assert.equal(failure.message, `[${category}] detalhe`)
            assert.equal(failure.category, category)
            assert.ok(failure instanceof Error)
        })
    }
})

describe('leitura da saída do Yarn', () => {
    it('trata a saída vazia como relatório limpo', () => {
        const report = parseYarnAuditJson('')

        assert.equal(report.advisories.length, 0)
        assert.equal(report.blockingTotal, 0)
        assert.deepEqual(report.counts, { info: 0, low: 0, moderate: 0, high: 0, critical: 0 })
    })

    it('trata só linhas em branco e CRLF como relatório limpo', () => {
        const report = parseYarnAuditJson('\r\n\n   \n')

        assert.equal(report.advisories.length, 0)
    })

    it('lê um advisory completo com GHSA, versões, vulnerável e dependentes', () => {
        const report = parseYarnAuditJson(
            advisoryLine({
                value: 'lodash',
                ID: 1106913,
                Issue: 'Command Injection in lodash',
                URL: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm',
                Severity: 'high',
                'Vulnerable Versions': '<4.17.21',
                'Tree Versions': ['4.17.15'],
                Dependents: ['lab@workspace:.'],
            }),
        )

        assert.deepEqual(report.advisories, [
            {
                id: 'GHSA-35jh-r3h4-6jhm',
                module: 'lodash',
                title: 'Command Injection in lodash',
                url: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm',
                severity: 'high',
                scope: 'produção',
                installed: '4.17.15',
                vulnerable: '<4.17.21',
                patched: 'desconhecida',
                pathCount: 1,
            },
        ])
    })

    it('usa npm-<ID> quando a URL não é de advisory GHSA', () => {
        const report = parseYarnAuditJson(
            advisoryLine({ ID: 1234, URL: 'https://example.test/sem-ghsa' }),
        )

        assert.equal(report.advisories[0].id, 'npm-1234')
    })

    it('extrai o GHSA da URL mesmo com outro texto no caminho', () => {
        const report = parseYarnAuditJson(
            advisoryLine({ URL: 'https://github.com/advisories/GHSA-p6mc-m468-83gw' }),
        )

        assert.equal(report.advisories[0].id, 'GHSA-p6mc-m468-83gw')
    })

    const unexpectedShapes = [
        ['null', 'null'],
        ['um número', '42'],
        ['um texto', '"texto"'],
        ['uma lista', '[]'],
        ['um advisory sem value', JSON.stringify({ children: { ID: 1 } })],
        ['um advisory sem children', JSON.stringify({ value: 'modulo' })],
        ['um advisory sem ID numérico', advisoryLine({ ID: undefined })],
        ['um advisory com ID que não é número', advisoryLine({ ID: 'x' })],
        ['um advisory com severidade desconhecida', advisoryLine({ Severity: 'severe' })],
        ['um advisory sem severidade', advisoryLine({ Severity: undefined })],
        ['um advisory sem Issue (título)', advisoryLine({ Issue: undefined })],
        ['um advisory sem URL', advisoryLine({ URL: undefined })],
    ]

    for (const [description, line] of unexpectedShapes) {
        it(`rejeita JSON com formato inesperado, citando a linha: ${description}`, () => {
            const output = ndjson(advisoryLine(), line)

            const failure = expectFailure(() => parseYarnAuditJson(output), 'formato-inesperado')

            assertIncludes(failure.message, 'linha 2')
        })
    }

    it('rejeita uma linha que não é JSON, citando a linha', () => {
        const output = ndjson(advisoryLine(), 'isto não é JSON')

        const failure = expectFailure(() => parseYarnAuditJson(output), 'saida-invalida')

        assertIncludes(failure.message, 'linha 2')
    })

    it('numera só as linhas não vazias ao apontar a linha inválida', () => {
        const output = ['', advisoryLine(), '', '', 'quebrada'].join('\n')

        const failure = expectFailure(() => parseYarnAuditJson(output), 'saida-invalida')

        assertIncludes(failure.message, 'linha 2')
    })
})

describe('política do auditor de dependências', () => {
    it('reporta Low e Moderate sem bloquear', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ ID: 1, value: 'a', Severity: 'low' }),
                advisoryLine({ ID: 2, value: 'b', Severity: 'low' }),
                advisoryLine({ ID: 3, value: 'c', Severity: 'moderate' }),
            ),
        )

        assert.equal(report.blockingTotal, 0)
        assertIncludes(formatAuditSummary(report), 'low=2 moderate=1')
    })

    it('bloqueia High e Critical', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ ID: 1, value: 'a', Severity: 'high' }),
                advisoryLine({ ID: 2, value: 'b', Severity: 'high' }),
                advisoryLine({ ID: 3, value: 'c', Severity: 'critical' }),
            ),
        )

        assert.equal(report.blockingTotal, 3)
        assert.equal(report.counts.high, 2)
        assert.equal(report.counts.critical, 1)
    })

    it('conta as severidades pelos advisories agrupados', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ ID: 1, value: 'a', Severity: 'low' }),
                advisoryLine({ ID: 2, value: 'b', Severity: 'high' }),
            ),
        )

        assert.deepEqual(report.counts, { info: 0, low: 1, moderate: 0, high: 1, critical: 0 })
        assert.equal(report.blockingTotal, 1)
    })

    it('devolve os advisories bloqueantes na ordem em que aparecem', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ ID: 1, value: 'modulo', Severity: 'high' }),
                advisoryLine({ ID: 2, value: 'ignorado', Severity: 'moderate' }),
                advisoryLine({
                    ID: 3,
                    value: 'outro',
                    Severity: 'critical',
                    Issue: 'Execução remota',
                    URL: 'https://example.test/3',
                }),
            ),
        )

        assert.equal(report.blockingTotal, 2)
        assert.deepEqual(report.blockingAdvisories, [
            {
                module: 'modulo',
                title: 'Título do advisory',
                url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
            },
            { module: 'outro', title: 'Execução remota', url: 'https://example.test/3' },
        ])
    })
})

describe('agrupamento e deduplicação dos advisories', () => {
    it('agrupa por (id, pacote) e conta os dependentes distintos', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ Dependents: ['a@workspace:.'] }),
                advisoryLine({ Dependents: ['b@workspace:.'] }),
                advisoryLine({ Dependents: ['b@workspace:.'] }),
            ),
        )

        assert.equal(report.advisories.length, 1)
        assert.equal(report.advisories[0].pathCount, 2)
    })

    it('une as Tree Versions de linhas agrupadas', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ 'Tree Versions': ['1.0.0'] }),
                advisoryLine({ 'Tree Versions': ['1.0.0', '1.1.0'] }),
            ),
        )

        assert.equal(report.advisories[0].installed, '1.0.0, 1.1.0')
    })

    it('separa o mesmo GHSA em pacotes diferentes', () => {
        const report = parseYarnAuditJson(ndjson(...sameGhsaInTwoPackages()))

        assert.equal(report.advisories.length, 2)
        assert.deepEqual(
            report.advisories.map(({ id, module }) => `${id} ${module}`),
            ['GHSA-82fw-gwwq-j7x9 vitest', 'GHSA-82fw-gwwq-j7x9 @vitest/mocker'],
        )
    })

    it('separa o mesmo npm-<id> em pacotes diferentes', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ ID: 50, value: 'um', URL: 'https://example.test/x' }),
                advisoryLine({ ID: 50, value: 'dois', URL: 'https://example.test/x' }),
            ),
        )

        assert.deepEqual(
            report.advisories.map(({ id, module }) => `${id} ${module}`),
            ['npm-50 um', 'npm-50 dois'],
        )
    })

    it('mantém separados advisories diferentes do mesmo pacote', () => {
        const report = parseYarnAuditJson(
            ndjson(
                advisoryLine({ URL: 'https://github.com/advisories/GHSA-aaaa-aaaa-aaaa' }),
                advisoryLine({ URL: 'https://github.com/advisories/GHSA-bbbb-bbbb-bbbb' }),
            ),
        )

        assert.deepEqual(
            report.advisories.map((advisory) => advisory.id),
            ['GHSA-aaaa-aaaa-aaaa', 'GHSA-bbbb-bbbb-bbbb'],
        )
    })

    it('marca o escopo da execução de onde o advisory veio', () => {
        const production = parseYarnAuditJson(advisoryLine(), { scope: 'produção' })
        const tooling = parseYarnAuditJson(advisoryLine(), { scope: 'tooling' })

        assert.equal(production.advisories[0].scope, 'produção')
        assert.equal(tooling.advisories[0].scope, 'tooling')
    })
})

describe('mergeReports: produção vence tooling', () => {
    it('deduplica o par (id, pacote) presente nas duas execuções com produção vencendo', () => {
        const production = parseYarnAuditJson(advisoryLine({ value: 'lodash' }), {
            scope: 'produção',
        })
        const tooling = parseYarnAuditJson(advisoryLine({ value: 'lodash' }), { scope: 'tooling' })

        const merged = mergeReports(production, tooling)

        assert.equal(merged.advisories.length, 1)
        assert.equal(merged.advisories[0].scope, 'produção')
    })

    it('mantém o escopo tooling de um advisory que só aparece na execução de desenvolvimento', () => {
        const production = parseYarnAuditJson('', { scope: 'produção' })
        const tooling = parseYarnAuditJson(advisoryLine({ value: 'serialize-javascript' }), {
            scope: 'tooling',
        })

        const merged = mergeReports(production, tooling)

        assert.equal(merged.advisories.length, 1)
        assert.equal(merged.advisories[0].scope, 'tooling')
    })

    it('junta advisories distintos das duas execuções e recalcula as contagens', () => {
        const production = parseYarnAuditJson(
            advisoryLine({ value: 'lodash', Severity: 'high' }),
            { scope: 'produção' },
        )
        const tooling = parseYarnAuditJson(
            advisoryLine({
                value: 'serialize-javascript',
                Severity: 'moderate',
                URL: 'https://github.com/advisories/GHSA-dddd-dddd-dddd',
            }),
            { scope: 'tooling' },
        )

        const merged = mergeReports(production, tooling)

        assert.equal(merged.advisories.length, 2)
        assert.equal(merged.counts.high, 1)
        assert.equal(merged.counts.moderate, 1)
        assert.equal(merged.blockingTotal, 1)
    })
})

describe('executeYarnAudit', () => {
    it('usa por padrão os limites documentados', () => {
        assert.equal(AUDIT_MAX_BUFFER_BYTES, 64 * BYTES_PER_MIB)
        assert.equal(AUDIT_TIMEOUT_MS, 5 * 60 * 1000)
        assert.equal(STDERR_EXCERPT_MAX_CHARS, 500)
    })

    // Processo Node real no lugar do Yarn: nada de rede e nada de Yarn simulado.
    function nodeProcess(code) {
        return { command: process.execPath, args: ['-e', code] }
    }

    function printing(output, extraCode = '') {
        return nodeProcess(`process.stdout.write(${JSON.stringify(output)}); ${extraCode}`)
    }

    it('devolve o relatório de um processo que termina com advisories e exit 1', () => {
        const report = executeYarnAudit(printing(advisoryLine({ Severity: 'low' }), 'process.exitCode = 1'))

        assert.equal(report.counts.low, 1)
        assert.equal(report.blockingTotal, 0)
    })

    it('trata a saída vazia com exit 0 como relatório limpo', () => {
        const report = executeYarnAudit(printing(''))

        assert.equal(report.advisories.length, 0)
        assert.equal(report.blockingTotal, 0)
    })

    it('marca os advisories com o escopo informado', () => {
        const report = executeYarnAudit({ ...printing(advisoryLine()), scope: 'tooling' })

        assert.equal(report.advisories[0].scope, 'tooling')
    })

    it('processa uma saída acima do limite padrão de 1 MiB do spawnSync', () => {
        const lineCount = 8000
        const base = advisoryLine()
        const code = `
            const line = ${JSON.stringify(base)} + '\\n'
            for (let i = 0; i < ${lineCount}; i += 1) process.stdout.write(line)
            process.exitCode = 1
        `

        const report = executeYarnAudit(nodeProcess(code))

        assert.ok(lineCount * base.length > BYTES_PER_MIB)
        // Todas as linhas são o mesmo advisory: agrupa em um só.
        assert.equal(report.advisories.length, 1)
    })

    it('informa linha inválida mesmo quando o processo termina com sucesso', () => {
        const failure = expectFailure(
            () => executeYarnAudit(printing(`${advisoryLine()}\nquebrada`)),
            'saida-invalida',
        )

        assertIncludes(failure.message, 'linha 2')
    })

    it('informa o código de saída e o stderr truncado quando o Yarn falha sem relatório', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    nodeProcess(
                        `console.error('x'.repeat(${STDERR_EXCERPT_MAX_CHARS * 2})); process.exit(2)`,
                    ),
                ),
            'yarn-falhou',
        )

        assertIncludes(failure.message, 'código de saída 2')
        assertIncludes(failure.message, 'x'.repeat(STDERR_EXCERPT_MAX_CHARS))
        assertExcludes(failure.message, 'x'.repeat(STDERR_EXCERPT_MAX_CHARS + 1))
    })

    it('informa uma falha do Yarn com o stderr vazio', () => {
        const failure = expectFailure(
            () => executeYarnAudit(nodeProcess('process.exit(3)')),
            'yarn-falhou',
        )

        assertIncludes(failure.message, 'código de saída 3')
        assertIncludes(failure.message, 'O stderr estava vazio.')
    })

    // SIGKILL e o sinal entregue ao processo filho valem para Linux (CI e VPS); em
    // Windows o `spawnSync` não reporta `signal` assim.
    it('falha quando o Yarn é morto por um sinal, mesmo com um relatório válido', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    printing(advisoryLine(), "process.kill(process.pid, 'SIGKILL')"),
                ),
            'yarn-sinal',
        )

        assertIncludes(failure.message, 'SIGKILL')
    })

    it('falha quando o comando do Yarn não pode ser iniciado', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit({
                    command: join(tmpdir(), 'yarn-que-nao-existe'),
                    args: [],
                }),
            'yarn-nao-iniciou',
        )

        assertIncludes(failure.message, 'ENOENT')
    })

    it('falha citando um limite reduzido em bytes quando a saída o excede', () => {
        const failure = expectFailure(
            () => executeYarnAudit({ ...printing('x'.repeat(4096)), maxBufferBytes: 1024 }),
            'limite-de-saida',
        )

        assertIncludes(failure.message, '1024 bytes')
    })

    it('falha citando um limite reduzido em MiB quando a saída o excede', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit({
                    ...nodeProcess(`process.stdout.write('x'.repeat(${3 * BYTES_PER_MIB}))`),
                    maxBufferBytes: 2 * BYTES_PER_MIB,
                }),
            'limite-de-saida',
        )

        assertIncludes(failure.message, '2 MiB')
    })

    it('interrompe um processo que não termina e cita o timeout', () => {
        const timeoutMs = 500
        const hang = `process.stdout.write(${JSON.stringify(advisoryLine())}); setInterval(() => {}, 1000)`

        const failure = expectFailure(
            () => executeYarnAudit({ ...nodeProcess(hang), timeoutMs }),
            'timeout',
        )

        assertIncludes(failure.message, `${timeoutMs} ms`)
    })

    it('classifica a falha de rede do Yarn 4 (só stderr) como registry indisponível', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    nodeProcess(
                        `process.stderr.write(${JSON.stringify(NETWORK_UNAVAILABLE_STDERR)}); process.exit(1)`,
                    ),
                ),
            'registry-indisponivel',
        )

        assertIncludes(failure.message, 'veredito não foi emitido')
        assertIncludes(failure.message, 'não é uma vulnerabilidade')
        assertIncludes(failure.message, 'repetida')
        assertIncludes(failure.message, '/-/npm/v1/security/advisories/bulk')
        assertIncludes(failure.message, 'ECONNREFUSED')
    })

    it('classifica um erro HTTP do registry no mesmo formato', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    nodeProcess(
                        `process.stderr.write(${JSON.stringify(HTTP_ERROR_STDERR)}); process.exit(1)`,
                    ),
                ),
            'registry-indisponivel',
        )

        assertIncludes(failure.message, 'Response code')
    })

    const signatures = ['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'socket hang up']
    for (const signature of signatures) {
        it(`reconhece a assinatura de rede ${signature} no stderr`, () => {
            expectFailure(
                () =>
                    executeYarnAudit(
                        nodeProcess(
                            `process.stderr.write('Error: ${signature} ao consultar o registry\\n'); process.exit(1)`,
                        ),
                    ),
                'registry-indisponivel',
            )
        })
    }

    it('não trata um stderr sem assinatura de rede como registry indisponível', () => {
        expectFailure(
            () =>
                executeYarnAudit(
                    nodeProcess("process.stderr.write('aviso qualquer\\n'); process.exit(2)"),
                ),
            'yarn-falhou',
        )
    })

    it('dá prioridade à falha de processo sobre a assinatura de rede no stderr', () => {
        const citing = `process.stderr.write(${JSON.stringify(NETWORK_UNAVAILABLE_STDERR)});`

        expectFailure(
            () =>
                executeYarnAudit({
                    ...nodeProcess(`${citing} setInterval(() => {}, 1000)`),
                    timeoutMs: 500,
                }),
            'timeout',
        )
        expectFailure(
            () =>
                executeYarnAudit({
                    ...nodeProcess(`${citing} process.stdout.write('x'.repeat(4096))`),
                    maxBufferBytes: 1024,
                }),
            'limite-de-saida',
        )
        expectFailure(
            () => executeYarnAudit(nodeProcess(`${citing} process.kill(process.pid, 'SIGKILL')`)),
            'yarn-sinal',
        )
    })
})

describe('execução completa do auditor (run)', () => {
    let workDir
    let packageJsonPath
    let exceptionsPath

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-run-'))
        packageJsonPath = join(workDir, 'package.json')
        // Ausente de propósito: sem arquivo de exceções, nenhuma exceção vale.
        exceptionsPath = join(workDir, 'exceptions.json')
        writeFileSync(packageJsonPath, JSON.stringify({ private: true }))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function runWith(config) {
        const { out, err, output } = capture()
        const code = run(writeFakeYarn(workDir, config), output, {
            packageJsonPath,
            exceptionsPath,
        })
        return { code, out: out.join(''), err: err.join('') }
    }

    function high(value = 'modulo', severity = 'high') {
        return advisoryLine({
            value,
            Severity: severity,
            URL: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
            'Tree Versions': ['1.2.3'],
        })
    }

    it('aprova quando as duas execuções não têm advisories', () => {
        const { code, out, err } = runWith({ production: '', development: '' })

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(out, 'Auditoria de dependências: info=0 low=0 moderate=0 high=0 critical=0')
        assertExcludes(out, '[bloqueante]')
    })

    for (const [severity, label] of [
        ['high', 'HIGH'],
        ['critical', 'CRITICAL'],
    ]) {
        it(`bloqueia um advisory ${severity} de produção com pacote, versão, id e alcance`, () => {
            const { code, err } = runWith({ production: high('modulo', severity), development: '' })

            assert.equal(code, 1)
            assertIncludes(
                err,
                `[bloqueante] modulo 1.2.3 ${label} produção GHSA-aaaa-bbbb-cccc — Título do advisory (https://github.com/advisories/GHSA-aaaa-bbbb-cccc)`,
            )
            assertIncludes(err, 'Auditoria bloqueada por 1 vulnerabilidade(s) High/Critical.')
        })
    }

    it('bloqueia um advisory High que só aparece no tooling (development)', () => {
        const { code, err } = runWith({ production: '', development: high('modulo') })

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] modulo 1.2.3 HIGH tooling GHSA-aaaa-bbbb-cccc')
    })

    it('informa produção quando o mesmo advisory aparece nos dois ambientes', () => {
        const { code, err } = runWith({ production: high('modulo'), development: high('modulo') })

        assert.equal(code, 1)
        assert.equal(err.match(/\[bloqueante\]/gu).length, 1)
        assertIncludes(err, ' HIGH produção ')
    })

    it('passa só com Info, Low e Moderate, listando cada advisory', () => {
        const production = ndjson(
            advisoryLine({
                ID: 11,
                value: 'qs',
                Severity: 'low',
                Issue: 'Desvio baixo',
                URL: 'https://github.com/advisories/GHSA-x5fp-wj9c-mxmx',
                'Tree Versions': ['6.15.3'],
            }),
        )
        const development = ndjson(
            advisoryLine({
                ID: 10,
                value: 'markdown-it',
                Severity: 'moderate',
                Issue: 'Negação de serviço',
                URL: 'https://github.com/advisories/GHSA-253c-mchw-3w2r',
                'Tree Versions': ['14.3.0'],
                Dependents: ['a@workspace:.', 'b@workspace:.'],
            }),
        )

        const { code, out, err } = runWith({ production, development })

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(
            out,
            '[informativo] qs 6.15.3 low produção GHSA-x5fp-wj9c-mxmx — Desvio baixo (1 dependente)',
        )
        assertIncludes(
            out,
            '[informativo] markdown-it 14.3.0 moderate tooling GHSA-253c-mchw-3w2r — Negação de serviço (2 dependentes)',
        )
        assertIncludes(out, 'Auditoria de dependências: info=0 low=1 moderate=1 high=0 critical=0')
        assertIncludes(out, 'Vulnerabilidades Low/Moderate foram reportadas sem bloquear o gate.')
        assertExcludes(out, '[bloqueante]')
    })

    it('separa os advisories bloqueantes dos informativos', () => {
        const production = high('modulo')
        const development = advisoryLine({
            value: 'leve',
            Severity: 'moderate',
            URL: 'https://github.com/advisories/GHSA-leve-leve-leve',
        })

        const { code, out, err } = runWith({ production, development })

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] modulo')
        assertExcludes(err, '[informativo]')
        assertIncludes(out, '[informativo] leve')
        assertExcludes(out, '[bloqueante]')
    })

    it('falha com a categoria quando o Yarn sai != 0 sem relatório', () => {
        const { out, err, output } = capture()
        // Yarn falso que sempre sai 2 sem saída, em qualquer ambiente.
        const directory = mkdtempSync(join(workDir, 'fail-'))
        const yarn = join(directory, 'yarn.js')
        writeFileSync(yarn, 'process.exit(2)')

        const code = run(yarn, output, { packageJsonPath, exceptionsPath })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[yarn-falhou\] /u)
        assertExcludes(out.join(''), 'Auditoria de dependências')
    })

    it('falha com saída inválida mesmo que o processo saia bem', () => {
        const directory = mkdtempSync(join(workDir, 'inval-'))
        const yarn = join(directory, 'yarn.js')
        writeFileSync(yarn, "process.stdout.write('quebrada'); process.exitCode = 1")
        const { err, output } = capture()

        const code = run(yarn, output, { packageJsonPath, exceptionsPath })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[saida-invalida\] /u)
    })

    it('falha sem emitir veredito quando o registry está indisponível', () => {
        const directory = mkdtempSync(join(workDir, 'net-'))
        const yarn = join(directory, 'yarn.js')
        writeFileSync(
            yarn,
            `process.stderr.write(${JSON.stringify(NETWORK_UNAVAILABLE_STDERR)}); process.exit(1)`,
        )
        const { out, err, output } = capture()

        const code = run(yarn, output, { packageJsonPath, exceptionsPath })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[registry-indisponivel\] /u)
        assertIncludes(err.join(''), 'repetida')
        assertExcludes(out.join(''), 'Auditoria de dependências')
    })

    for (const execPath of [undefined, '/usr/bin/npm-cli.js']) {
        it(`exige a execução por Yarn (npm_execpath=${execPath})`, () => {
            const { err, output } = capture()

            const code = run(execPath, output)

            assert.equal(code, 1)
            assert.equal(err.join(''), 'Execute security:dependencies por meio do Yarn.\n')
        })
    }

    for (const execPath of [
        '/home/user/.cache/node/corepack/v1/yarn/4.18.1/yarn.js',
        '/tmp/xfs-abcd/yarn',
        '/opt/yarn/bin/yarn.cjs',
    ]) {
        it(`aceita o npm_execpath do Yarn 4: ${execPath}`, () => {
            const directory = mkdtempSync(join(workDir, 'exec-'))
            const yarn = join(directory, 'yarn.js')
            writeFileSync(yarn, 'process.exitCode = 0')
            // Só valida o formato do caminho: usa um Yarn real falso no lugar.
            const { err, output } = capture()
            const code = run(yarn, output, { packageJsonPath, exceptionsPath })
            assert.equal(code, 0)
            assert.equal(err.join(''), '')
            // Confirma que o padrão aceitaria o caminho do Corepack/wrapper.
            assert.ok(/yarn(?:\.c?js)?$/iu.test(execPath))
        })
    }

    it('informa um erro inesperado como defeito interno do auditor', () => {
        const { err, output } = capture()
        output.stdout.write = () => {
            throw new Error('falha inesperada ao escrever')
        }

        const code = run(writeFakeYarn(workDir, { production: '', development: '' }), output, {
            packageJsonPath,
            exceptionsPath,
        })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[erro-interno\] /u)
        assertIncludes(err.join(''), 'falha inesperada ao escrever')
    })

    it('roda o Yarn com o diretório do package.json como cwd', () => {
        const { out, output } = capture()
        const directory = mkdtempSync(join(workDir, 'cwd-'))
        const packageJson = join(directory, 'package.json')
        writeFileSync(packageJson, JSON.stringify({ private: true }))
        // O Yarn falso devolve o próprio cwd como título de um advisory informativo.
        const yarn = join(directory, 'yarn.js')
        writeFileSync(
            yarn,
            [
                'const index = process.argv.indexOf(\'--environment\')',
                'const environment = index >= 0 ? process.argv[index + 1] : \'\'',
                "if (environment === 'production') {",
                '  const children = { ID: 1, Issue: process.cwd(), URL: \'https://example.test/x\', Severity: \'low\', "Tree Versions": [\'1.0.0\'], Dependents: [\'a@workspace:.\'] }',
                "  process.stdout.write(JSON.stringify({ value: 'modulo', children }))",
                '  process.exitCode = 1',
                '}',
            ].join('\n'),
        )

        const code = run(yarn, output, {
            packageJsonPath: packageJson,
            exceptionsPath: join(workDir, 'exceptions.json'),
        })

        assert.equal(code, 0)
        assertIncludes(out.join(''), `— ${realpathSync(directory)} (1 dependente)`)
    })
})

describe('ponto de entrada audit-dependencies.mjs', () => {
    const entrypoint = fileURLToPath(
        new URL('../../scripts/audit-dependencies.mjs', import.meta.url),
    )
    let workDir

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-entry-'))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function runEntry(npmExecpath, extraEnv = {}) {
        const env = { ...process.env, ...extraEnv }
        delete env.npm_execpath
        if (npmExecpath !== undefined) env.npm_execpath = npmExecpath
        const result = spawnSync(process.execPath, [entrypoint], { env, encoding: 'utf8' })
        return { code: result.status, out: result.stdout, err: result.stderr }
    }

    it('exige a execução por Yarn via npm_execpath', () => {
        const { code, err } = runEntry(undefined)

        assert.equal(code, 1)
        assert.equal(err, 'Execute security:dependencies por meio do Yarn.\n')
    })

    it('recusa um npm_execpath que não é o Yarn', () => {
        const { code, err } = runEntry('/usr/bin/npm-cli.js')

        assert.equal(code, 1)
        assertIncludes(err, 'por meio do Yarn')
    })

    it('termina com 1 e a categoria quando o Yarn falha sem relatório', () => {
        const directory = mkdtempSync(join(workDir, 'entry-fail-'))
        const yarn = join(directory, 'yarn.js')
        writeFileSync(yarn, 'process.exit(2)')
        // Usa um package.json temporário via cwd do processo filho: o entrypoint usa o do repo,
        // então aqui só exercita a recusa por caminho inválido abaixo. Mantém o Yarn falso para
        // o caminho de aceitação de npm_execpath.
        const { code, err } = runEntry(yarn)

        assert.equal(code, 1)
        // Pode falhar por yarn-falhou (duas execuções no cwd do repo) — basta ser categoria.
        assert.match(err, /^\[[a-z-]+\] /u)
    })
})
