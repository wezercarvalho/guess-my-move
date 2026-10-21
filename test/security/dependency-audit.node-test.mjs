/* eslint-disable security/detect-non-literal-fs-filename -- Caminhos criados por mkdtemp nos próprios testes, sem entrada externa. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
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
    parseYarnAuditJson,
    readProductionRoots,
    run,
} from '../../scripts/lib/dependency-audit.mjs'
import {
    AUDIT_FAILURE_CATEGORIES,
    AuditFailure,
} from '../../scripts/lib/dependency-audit-failure.mjs'
import {
    HTTP_ERROR_STDERR,
    NETWORK_UNAVAILABLE_STDERR,
    NETWORK_UNAVAILABLE_STDOUT,
    advisoryLine,
    advisoryLines,
    assertExcludes,
    assertIncludes,
    auditLine,
    capture,
    expectFailure,
    sameGhsaInTwoPackages,
    summaryLine,
    validAdvisory,
    writeFakeYarn,
} from './dependency-audit-fixtures.mjs'

describe('categorias de falha', () => {
    it('declara as doze categorias estáveis', () => {
        assert.deepEqual(AUDIT_FAILURE_CATEGORIES, [
            'saida-invalida',
            'formato-inesperado',
            'sem-dados',
            'erros-do-yarn',
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

    for (const category of AUDIT_FAILURE_CATEGORIES) {
        it(`inicia a mensagem da categoria ${category} pelo rótulo entre colchetes`, () => {
            const failure = new AuditFailure(category, 'detalhe')

            assert.equal(failure.message, `[${category}] detalhe`)
            assert.equal(failure.category, category)
            assert.ok(failure instanceof Error)
        })
    }
})

describe('política do auditor de dependências', () => {
    it('reporta Low e Moderate sem bloquear', () => {
        const report = parseYarnAuditJson(summaryLine({ low: 2, moderate: 1 }))

        assert.equal(report.blockingTotal, 0)
        assertIncludes(formatAuditSummary(report), 'low=2 moderate=1')
    })

    it('bloqueia High e Critical', () => {
        const report = parseYarnAuditJson(summaryLine({ low: 0, high: 2, critical: 1 }))

        assert.equal(report.blockingTotal, 3)
        assert.equal(report.counts.high, 2)
        assert.equal(report.counts.critical, 1)
    })

    it('conta as severidades pelos advisories quando não há resumo', () => {
        const report = parseYarnAuditJson(
            [
                advisoryLine(validAdvisory({ id: 1, severity: 'low' })),
                advisoryLine(validAdvisory({ id: 1, severity: 'low' })),
                advisoryLine(validAdvisory({ id: 2, severity: 'high' })),
            ].join('\n'),
        )

        assert.deepEqual(report.counts, { info: 0, low: 1, moderate: 0, high: 1, critical: 0 })
        assert.equal(report.blockingTotal, 1)
    })

    it('devolve os advisories bloqueantes na ordem em que aparecem', () => {
        const report = parseYarnAuditJson(
            [
                advisoryLine(validAdvisory({ id: 1, severity: 'high' })),
                advisoryLine(
                    validAdvisory({ id: 2, severity: 'moderate', module_name: 'ignorado' }),
                ),
                advisoryLine(
                    validAdvisory({
                        id: 3,
                        severity: 'critical',
                        module_name: 'outro',
                        title: 'Execução remota',
                        url: 'https://example.test/3',
                    }),
                ),
                summaryLine({ low: 0, moderate: 1, high: 1, critical: 1 }),
            ].join('\n'),
        )

        assert.equal(report.blockingTotal, 2)
        assert.deepEqual(report.blockingAdvisories, [
            {
                module: 'modulo',
                title: 'Título do advisory',
                url: 'https://example.test/advisory',
            },
            { module: 'outro', title: 'Execução remota', url: 'https://example.test/3' },
        ])
    })
})

const productionRoots = new Set(['react', 'axios'])

function parseScoped(...lines) {
    return parseYarnAuditJson(lines.join('\n'), { productionRoots })
}

describe('alcance e deduplicação dos advisories', () => {
    it('classifica como produção quando a raiz da cadeia está em dependencies', () => {
        const report = parseScoped(
            advisoryLine(
                validAdvisory({ module_name: 'follow-redirects' }),
                'axios>follow-redirects',
            ),
        )

        assert.equal(report.advisories.length, 1)
        assert.equal(report.advisories[0].scope, 'produção')
    })

    it('classifica como tooling quando a raiz da cadeia está só em devDependencies', () => {
        const report = parseScoped(
            advisoryLine(
                validAdvisory({ module_name: 'markdown-it' }),
                'orval>typedoc>markdown-it',
            ),
        )

        assert.equal(report.advisories[0].scope, 'tooling')
    })

    it('classifica como produção quando um caminho é de produção e outro é de tooling', () => {
        const advisory = validAdvisory({ module_name: 'compartilhado' })

        const report = parseScoped(
            ...advisoryLines(advisory, [
                'vitest>compartilhado',
                'react>compartilhado',
                'orval>compartilhado',
            ]),
        )

        assert.equal(report.advisories.length, 1)
        assert.equal(report.advisories[0].scope, 'produção')
    })

    it('não confia na flag dev do Yarn para decidir o alcance', () => {
        // O Yarn 1 devolve `dev: false` até para pacotes que só chegam por tooling.
        const line = auditLine('auditAdvisory', {
            resolution: { id: 1, path: 'vitest>@vitest/mocker', dev: false },
            advisory: validAdvisory(),
        })
        const devTrue = auditLine('auditAdvisory', {
            resolution: { id: 1, path: 'react>modulo', dev: true },
            advisory: validAdvisory({ id: 2, github_advisory_id: 'GHSA-aaaa-bbbb-cccc' }),
        })

        const report = parseScoped(line, devTrue)

        assert.deepEqual(
            report.advisories.map((advisory) => advisory.scope),
            ['tooling', 'produção'],
        )
    })

    it('compara a raiz inteira de um pacote com escopo, não um prefixo', () => {
        const report = parseScoped(advisoryLine(validAdvisory(), '@vitest/mocker>modulo'))

        assert.equal(report.advisories[0].scope, 'tooling')
    })

    it('trata todo advisory como produção quando não há raízes de produção', () => {
        const report = parseYarnAuditJson(advisoryLine(validAdvisory(), 'vitest>modulo'))

        assert.equal(report.advisories[0].scope, 'produção')
    })

    it('lista o advisory uma vez por identificador e pacote e conta os caminhos distintos', () => {
        const advisory = validAdvisory({ id: 7, github_advisory_id: 'GHSA-aaaa-bbbb-cccc' })

        const report = parseScoped(
            ...advisoryLines(advisory, [
                'orval>a>modulo',
                'orval>b>modulo',
                'orval>c>modulo',
                'orval>c>modulo',
            ]),
            summaryLine({ low: 0, high: 4 }),
        )

        assert.equal(report.advisories.length, 1)
        assert.equal(report.advisories[0].id, 'GHSA-aaaa-bbbb-cccc')
        assert.equal(report.advisories[0].pathCount, 3)
        assert.equal(report.blockingAdvisories.length, 1)
        // A contagem do resumo do Yarn continua exposta como veio.
        assert.equal(report.counts.high, 4)
    })

    it('separa o mesmo GHSA em pacotes diferentes (vitest e @vitest/mocker)', () => {
        const report = parseScoped(...sameGhsaInTwoPackages())

        assert.equal(report.advisories.length, 2)
        assert.deepEqual(
            report.advisories.map(({ id, module, pathCount }) => ({ id, module, pathCount })),
            [
                { id: 'GHSA-82fw-gwwq-j7x9', module: 'vitest', pathCount: 1 },
                { id: 'GHSA-82fw-gwwq-j7x9', module: '@vitest/mocker', pathCount: 1 },
            ],
        )
        assert.equal(report.blockingAdvisories.length, 2)
    })

    it('separa o mesmo npm-<id> em pacotes diferentes', () => {
        const report = parseScoped(
            advisoryLine(validAdvisory({ id: 50, module_name: 'um' }), 'react>um'),
            advisoryLine(validAdvisory({ id: 50, module_name: 'dois' }), 'react>dois'),
        )

        assert.deepEqual(
            report.advisories.map(({ id, module }) => `${id} ${module}`),
            ['npm-50 um', 'npm-50 dois'],
        )
    })

    it('mantém separados advisories diferentes do mesmo pacote', () => {
        const report = parseScoped(
            advisoryLine(
                validAdvisory({ id: 1, github_advisory_id: 'GHSA-aaaa-aaaa-aaaa' }),
                'react>modulo',
            ),
            advisoryLine(
                validAdvisory({ id: 2, github_advisory_id: 'GHSA-bbbb-bbbb-bbbb' }),
                'react>modulo',
            ),
        )

        assert.deepEqual(
            report.advisories.map((advisory) => advisory.id),
            ['GHSA-aaaa-aaaa-aaaa', 'GHSA-bbbb-bbbb-bbbb'],
        )
    })

    it('usa npm-<id> quando o advisory não tem github_advisory_id', () => {
        const report = parseScoped(advisoryLine(validAdvisory({ id: 1234 }), 'react>modulo'))

        assert.equal(report.advisories[0].id, 'npm-1234')
    })

    it('lê versões, severidade e detalhes do advisory', () => {
        const report = parseScoped(
            advisoryLine(
                validAdvisory({
                    severity: 'moderate',
                    findings: [{ version: '6.15.3' }, { version: '6.14.2' }],
                    vulnerable_versions: '>=6.14.2 <=6.15.3',
                    patched_versions: '>=6.16.0',
                }),
                'react>modulo',
            ),
        )

        assert.deepEqual(report.advisories, [
            {
                id: 'npm-1',
                module: 'modulo',
                title: 'Título do advisory',
                url: 'https://example.test/advisory',
                severity: 'moderate',
                scope: 'produção',
                installed: '6.15.3, 6.14.2',
                vulnerable: '>=6.14.2 <=6.15.3',
                patched: '>=6.16.0',
                pathCount: 1,
            },
        ])
    })
})

describe('relatório do auditor', () => {
    let workDir
    let packageJsonPath
    let exceptionsPath

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-report-'))
        packageJsonPath = join(workDir, 'package.json')
        // Ausente de propósito: sem arquivo de exceções, nenhuma exceção vale.
        exceptionsPath = join(workDir, 'exceptions.json')
        writeFileSync(
            packageJsonPath,
            JSON.stringify({
                dependencies: { react: '^19.0.0' },
                devDependencies: { vitest: '^4.1.9' },
            }),
        )
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function runWith(stdout, exitCode = 0) {
        const { out, err, output } = capture()
        const code = run(writeFakeYarn(workDir, stdout, exitCode), output, {
            packageJsonPath,
            exceptionsPath,
        })
        return { code, out: out.join(''), err: err.join('') }
    }

    function highAdvisory(path, severity = 'high') {
        return advisoryLine(
            validAdvisory({ severity, github_advisory_id: 'GHSA-aaaa-bbbb-cccc' }),
            path,
        )
    }

    for (const [severity, label] of [
        ['high', 'HIGH'],
        ['critical', 'CRITICAL'],
    ]) {
        it(`bloqueia um advisory ${severity} de produção com pacote, título, URL, id e alcance`, () => {
            const { code, err } = runWith(highAdvisory('react>modulo', severity))

            assert.equal(code, 1)
            assertIncludes(
                err,
                `[bloqueante] modulo 1.2.3 ${label} produção GHSA-aaaa-bbbb-cccc — Título do advisory (https://example.test/advisory)`,
            )
            assertIncludes(err, 'Auditoria bloqueada por 1 vulnerabilidade(s) High/Critical.')
        })
    }

    it('bloqueia um advisory High que só alcança o tooling', () => {
        const { code, err } = runWith(highAdvisory('vitest>modulo'))

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] modulo 1.2.3 HIGH tooling GHSA-aaaa-bbbb-cccc')
    })

    it('informa produção quando o advisory bloqueante alcança os dois grupos', () => {
        const { code, err } = runWith(
            [highAdvisory('vitest>modulo'), highAdvisory('react>modulo')].join('\n'),
        )

        assert.equal(code, 1)
        assert.equal(err.match(/\[bloqueante\]/gu).length, 1)
        assertIncludes(err, ' HIGH produção ')
    })

    it('bloqueia os dois pacotes quando o mesmo GHSA High aparece em ambos', () => {
        const { code, err } = runWith(sameGhsaInTwoPackages('GHSA-82fw-gwwq-j7x9').join('\n'))

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] vitest 1.2.3 HIGH tooling GHSA-82fw-gwwq-j7x9')
        assertIncludes(err, '[bloqueante] @vitest/mocker 1.2.3 HIGH tooling GHSA-82fw-gwwq-j7x9')
        assertIncludes(err, 'Auditoria bloqueada por 2 vulnerabilidade(s) High/Critical.')
    })

    it('passa só com Info, Low e Moderate, listando cada advisory', () => {
        const stdout = [
            ...advisoryLines(
                validAdvisory({
                    id: 10,
                    severity: 'moderate',
                    module_name: 'markdown-it',
                    title: 'Negação de serviço',
                    github_advisory_id: 'GHSA-253c-mchw-3w2r',
                    findings: [{ version: '14.3.0' }],
                }),
                ['orval>typedoc>markdown-it', 'orval>@orval/core>typedoc>markdown-it'],
            ),
            advisoryLine(
                validAdvisory({
                    id: 11,
                    severity: 'low',
                    module_name: 'qs',
                    title: 'Desvio baixo',
                    github_advisory_id: 'GHSA-x5fp-wj9c-mxmx',
                    findings: [{ version: '6.15.3' }],
                }),
                'react>qs',
            ),
            advisoryLine(
                validAdvisory({
                    id: 12,
                    severity: 'info',
                    module_name: 'unico',
                    title: 'Aviso',
                    github_advisory_id: 'GHSA-info-info-info',
                }),
                'vitest>unico',
            ),
            summaryLine({ info: 1, low: 1, moderate: 2 }),
        ].join('\n')

        // O Yarn sai com código diferente de zero quando há advisories.
        const { code, out, err } = runWith(stdout, 4)

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(
            out,
            '[informativo] markdown-it 14.3.0 moderate tooling GHSA-253c-mchw-3w2r — Negação de serviço (2 caminhos)',
        )
        assertIncludes(
            out,
            '[informativo] qs 6.15.3 low produção GHSA-x5fp-wj9c-mxmx — Desvio baixo (1 caminho)',
        )
        assertIncludes(
            out,
            '[informativo] unico 1.2.3 info tooling GHSA-info-info-info — Aviso (1 caminho)',
        )
        assertIncludes(out, 'Auditoria de dependências: info=1 low=1 moderate=2 high=0 critical=0')
        assertIncludes(out, 'Vulnerabilidades Low/Moderate foram reportadas sem bloquear o gate.')
        assertExcludes(out, '[bloqueante]')
    })

    it('lista um registro por pacote no caso real do vitest e do @vitest/mocker', () => {
        const markdownIt = validAdvisory({
            id: 1195000,
            severity: 'moderate',
            module_name: 'markdown-it',
            github_advisory_id: 'GHSA-253c-mchw-3w2r',
            findings: [{ version: '14.3.0' }],
        })
        const stdout = [
            ...sameGhsaInTwoPackages('GHSA-82fw-gwwq-j7x9', { severity: 'moderate' }),
            ...advisoryLines(markdownIt, [
                'orval>typedoc>markdown-it',
                'orval>@orval/core>typedoc>markdown-it',
                'orval>@orval/angular>@orval/core>typedoc>markdown-it',
                'orval>@orval/mcp>@orval/fetch>@orval/core>typedoc>markdown-it',
            ]),
            summaryLine({ low: 0, moderate: 6 }),
        ].join('\n')

        const { code, out, err } = runWith(stdout, 4)

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(out, '[informativo] vitest 1.2.3 moderate tooling GHSA-82fw-gwwq-j7x9')
        assertIncludes(
            out,
            '[informativo] @vitest/mocker 1.2.3 moderate tooling GHSA-82fw-gwwq-j7x9',
        )
        assertIncludes(out, '[informativo] markdown-it 14.3.0 moderate tooling')
        assertIncludes(out, '(4 caminhos)')
        assert.equal(out.match(/\[informativo\]/gu).length, 3)
        assertIncludes(out, 'Auditoria de dependências: info=0 low=0 moderate=6 high=0 critical=0')
        assertExcludes(out, 'Dependências auditadas')
    })

    it('separa os advisories bloqueantes dos informativos', () => {
        const stdout = [
            highAdvisory('react>modulo'),
            advisoryLine(
                validAdvisory({
                    id: 2,
                    severity: 'moderate',
                    module_name: 'leve',
                    github_advisory_id: 'GHSA-leve-leve-leve',
                }),
                'vitest>leve',
            ),
        ].join('\n')

        const { code, out, err } = runWith(stdout)

        assert.equal(code, 1)
        assertIncludes(err, '[bloqueante] modulo')
        assertExcludes(err, '[informativo]')
        assertIncludes(out, '[informativo] leve')
        assertExcludes(out, '[bloqueante]')
    })

    it('falha fechado quando o resumo conta High mas nenhum advisory o explica', () => {
        const { code, err } = runWith(summaryLine({ low: 0, high: 2 }))

        assert.equal(code, 1)
        assertIncludes(err, 'Auditoria bloqueada')
    })
})

describe('leitura da saída do Yarn', () => {
    it('rejeita uma linha que não é JSON, mesmo com um resumo válido', () => {
        const output = [summaryLine(), 'isto não é JSON'].join('\n')

        const failure = expectFailure(() => parseYarnAuditJson(output), 'saida-invalida')

        assertIncludes(failure.message, 'linha 2')
    })

    it('numera só as linhas não vazias', () => {
        const output = ['', summaryLine(), '', '', 'quebrada'].join('\n')

        const failure = expectFailure(() => parseYarnAuditJson(output), 'saida-invalida')

        assertIncludes(failure.message, 'linha 2')
    })

    const unexpectedShapes = [
        ['null', 'null'],
        ['um número', '42'],
        ['um texto', '"texto"'],
        ['uma lista', '[]'],
        ['um advisory sem data', JSON.stringify({ type: 'auditAdvisory' })],
        ['um advisory sem advisory', auditLine('auditAdvisory', {})],
        ['um advisory sem id', advisoryLine(validAdvisory({ id: undefined }))],
        [
            'um advisory com severidade desconhecida',
            advisoryLine(validAdvisory({ severity: 'severe' })),
        ],
        ['um advisory sem módulo', advisoryLine(validAdvisory({ module_name: undefined }))],
        ['um advisory sem título', advisoryLine(validAdvisory({ title: undefined }))],
        ['um advisory sem URL', advisoryLine(validAdvisory({ url: undefined }))],
        [
            'um advisory sem resolution.path',
            auditLine('auditAdvisory', { advisory: validAdvisory() }),
        ],
        ['um resumo sem data', JSON.stringify({ type: 'auditSummary' })],
        ['um resumo sem vulnerabilities', auditLine('auditSummary', {})],
        [
            'um resumo com contagem que não é número',
            auditLine('auditSummary', { vulnerabilities: { high: 'muitas' } }),
        ],
    ]

    for (const [description, line] of unexpectedShapes) {
        it(`rejeita JSON com formato inesperado, citando a linha: ${description}`, () => {
            const output = [summaryLine(), line].join('\n')

            const failure = expectFailure(() => parseYarnAuditJson(output), 'formato-inesperado')

            assertIncludes(failure.message, 'linha 2')
        })
    }

    it('ignora linhas em branco, finais CRLF e registros sem relação com a auditoria', () => {
        const output = [
            auditLine('warning', 'aviso do Yarn'),
            '',
            auditLine('info', 'Visit https://yarnpkg.com'),
            summaryLine(),
            '',
        ].join('\r\n')

        const report = parseYarnAuditJson(output)

        assert.equal(report.counts.low, 1)
        assert.deepEqual(report.errors, [])
        assert.deepEqual(report.blockingAdvisories, [])
    })

    const withoutData = [
        ['vazia', ''],
        ['só com linhas em branco', '\n\r\n\n'],
        [
            'só com registros que não são de auditoria',
            [auditLine('warning', 'aviso'), auditLine('info', 'info')].join('\n'),
        ],
    ]

    for (const [description, output] of withoutData) {
        it(`informa relatório sem dados quando a saída é ${description}`, () => {
            expectFailure(() => parseYarnAuditJson(output), 'sem-dados')
        })
    }

    it('mantém os erros do Yarn junto com um resumo válido', () => {
        const report = parseYarnAuditJson(
            [auditLine('error', 'falha qualquer'), summaryLine()].join('\n'),
        )

        assert.deepEqual(report.errors, ['falha qualquer'])
        assert.equal(report.counts.low, 1)
    })
})

// Processo Node real no lugar do Yarn: nada de rede e nada de Yarn simulado.
function nodeProcess(code) {
    return { command: process.execPath, args: ['-e', code] }
}

function printing(output, extraCode = '') {
    return nodeProcess(`process.stdout.write(${JSON.stringify(output)}); ${extraCode}`)
}

describe('executeYarnAudit', () => {
    it('usa por padrão os limites documentados', () => {
        assert.equal(AUDIT_MAX_BUFFER_BYTES, 64 * BYTES_PER_MIB)
        assert.equal(AUDIT_TIMEOUT_MS, 5 * 60 * 1000)
        assert.equal(STDERR_EXCERPT_MAX_CHARS, 500)
    })

    it('devolve o relatório de um processo que termina com um resumo válido', () => {
        const report = executeYarnAudit(printing(summaryLine()))

        assert.equal(report.counts.low, 1)
        assert.equal(report.blockingTotal, 0)
    })

    it('confia em um relatório válido mesmo quando o Yarn sai com código 4', () => {
        const report = executeYarnAudit(printing(summaryLine(), 'process.exitCode = 4'))

        assert.equal(report.blockingTotal, 0)
        assert.equal(report.counts.low, 1)
    })

    it('processa uma saída acima do limite padrão de 1 MiB do spawnSync', () => {
        const lineCount = 1536
        const filler = 'x'.repeat(1024)
        const code = `
            const line = JSON.stringify({ type: 'warning', data: '${filler}' }) + '\\n'
            for (let i = 0; i < ${lineCount}; i += 1) process.stdout.write(line)
            process.stdout.write(${JSON.stringify(summaryLine())})
        `

        const report = executeYarnAudit(nodeProcess(code))

        assert.ok(lineCount * filler.length > BYTES_PER_MIB)
        assert.equal(report.counts.low, 1)
    })

    it('informa linha inválida mesmo quando o processo termina com sucesso', () => {
        const failure = expectFailure(
            () => executeYarnAudit(printing(`${summaryLine()}\nquebrada`)),
            'saida-invalida',
        )

        assertIncludes(failure.message, 'linha 2')
    })

    it('informa relatório sem dados quando o processo sai com código 0', () => {
        expectFailure(() => executeYarnAudit(printing('')), 'sem-dados')
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
            () => executeYarnAudit(printing(summaryLine(), "process.kill(process.pid, 'SIGKILL')")),
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

    it('informa o limite, e não uma linha inválida, quando a saída é cortada no meio da linha', () => {
        expectFailure(
            () =>
                executeYarnAudit({
                    ...printing(`${summaryLine()}\n{"type":"warn`.repeat(200)),
                    maxBufferBytes: 1024,
                }),
            'limite-de-saida',
        )
    })

    it('interrompe um processo que não termina e cita o timeout', () => {
        const timeoutMs = 500
        const hang = `process.stdout.write(${JSON.stringify(summaryLine())}); setInterval(() => {}, 1000)`

        const failure = expectFailure(
            () => executeYarnAudit({ ...nodeProcess(hang), timeoutMs }),
            'timeout',
        )

        assertIncludes(failure.message, `${timeoutMs} ms`)
    })
})

describe('execução completa do auditor', () => {
    let workDir

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-'))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function fakeYarn(stdout, exitCode = 0, stderr = '') {
        return writeFakeYarn(workDir, stdout, exitCode, stderr)
    }

    it('aprova um relatório válido e informa Low/Moderate sem bloquear', () => {
        const { out, err, output } = capture()

        const code = run(fakeYarn(summaryLine(), 4), output)

        assert.equal(code, 0)
        assert.deepEqual(err, [])
        assertIncludes(
            out.join(''),
            'Auditoria de dependências: info=0 low=1 moderate=0 high=0 critical=0',
        )
        assertIncludes(
            out.join(''),
            'Vulnerabilidades Low/Moderate foram reportadas sem bloquear o gate.',
        )
    })

    it('falha listando os erros reportados pelo Yarn, mesmo com um resumo válido', () => {
        const { err, output } = capture()
        const stdout = [auditLine('error', 'falha qualquer'), summaryLine()].join('\n')

        const code = run(fakeYarn(stdout, 1), output)

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[erros-do-yarn\] /u)
        assertIncludes(err.join(''), 'falha qualquer')
    })

    it('falha com a categoria de uma falha de execução', () => {
        const { err, output } = capture()

        const code = run(fakeYarn('', 2), output)

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[yarn-falhou\] /u)
    })

    it('falha com a categoria de saída inválida mesmo com resumo válido', () => {
        const { err, output } = capture()

        const code = run(fakeYarn(`${summaryLine()}\nquebrada`), output)

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[saida-invalida\] .*linha 2/u)
    })

    for (const execPath of [undefined, '/usr/bin/npm-cli.js']) {
        it(`exige a execução por Yarn (npm_execpath=${execPath})`, () => {
            const { err, output } = capture()

            const code = run(execPath, output)

            assert.equal(code, 1)
            assert.equal(err.join(''), 'Execute security:dependencies por meio do Yarn.\n')
        })
    }

    it('informa um erro inesperado como defeito interno do auditor', () => {
        const { err, output } = capture()
        output.stdout.write = () => {
            throw new Error('falha inesperada ao escrever')
        }

        const code = run(fakeYarn(summaryLine()), output)

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[erro-interno\] /u)
        assertIncludes(err.join(''), 'falha inesperada ao escrever')
    })

    it('informa defeito interno, sem veredito, quando o package.json não pode ser lido', () => {
        const { out, err, output } = capture()

        const code = run(fakeYarn(summaryLine()), output, {
            packageJsonPath: join(workDir, 'inexistente', 'package.json'),
            exceptionsPath: join(workDir, 'exceptions.json'),
        })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[erro-interno\] /u)
        assertIncludes(err.join(''), 'package.json')
        assertExcludes(out.join(''), 'Auditoria de dependências')
    })

    it('informa defeito interno quando o package.json não tem dependencies', () => {
        const { err, output } = capture()
        const packageJsonPath = join(workDir, 'sem-dependencies.json')
        writeFileSync(packageJsonPath, JSON.stringify({ devDependencies: {} }))

        const code = run(fakeYarn(summaryLine()), output, {
            packageJsonPath,
            exceptionsPath: join(workDir, 'exceptions.json'),
        })

        assert.equal(code, 1)
        assert.match(err.join(''), /^\[erro-interno\] /u)
        assertIncludes(err.join(''), 'dependencies')
    })

    it('roda o Yarn com o diretório do package.json como cwd', () => {
        const { out, output } = capture()
        const directory = mkdtempSync(join(workDir, 'cwd-'))
        const packageJsonPath = join(directory, 'package.json')
        writeFileSync(packageJsonPath, JSON.stringify({ dependencies: {} }))
        // O Yarn falso devolve o próprio cwd como título de um advisory informativo.
        const yarn = join(directory, 'yarn.js')
        const advisory = validAdvisory({ severity: 'low' })
        writeFileSync(
            yarn,
            `const advisory = ${JSON.stringify(advisory)}; advisory.title = process.cwd(); process.stdout.write(JSON.stringify({ type: 'auditAdvisory', data: { resolution: { id: 1, path: 'raiz>modulo' }, advisory } }))`,
        )

        const code = run(yarn, output, {
            packageJsonPath,
            exceptionsPath: join(workDir, 'exceptions.json'),
        })

        assert.equal(code, 0)
        assertIncludes(out.join(''), `— ${realpathSync(directory)} (1 caminho)`)
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

    it('termina com 0 e resume o relatório quando o Yarn devolve só Moderate', () => {
        const { code, out, err } = runEntry(
            writeFakeYarn(workDir, summaryLine({ low: 0, moderate: 6 }), 4),
        )

        assert.equal(code, 0)
        assert.equal(err, '')
        assertIncludes(out, 'Auditoria de dependências: info=0 low=0 moderate=6 high=0 critical=0')
        assertExcludes(out, 'Dependências auditadas')
    })

    it('termina com 1 e a categoria quando o Yarn falha sem relatório', () => {
        const { code, err } = runEntry(writeFakeYarn(workDir, '', 2))

        assert.equal(code, 1)
        assert.match(err, /^\[yarn-falhou\] /u)
    })
})

function yarnWithStreams(stdout, stderr, exitCode = 1) {
    return nodeProcess(
        `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = ${exitCode}`,
    )
}

describe('registry indisponível', () => {
    it('classifica a falha de rede real, só no stderr, como registry indisponível', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    yarnWithStreams(NETWORK_UNAVAILABLE_STDOUT, NETWORK_UNAVAILABLE_STDERR),
                ),
            'registry-indisponivel',
        )

        assertIncludes(failure.message, 'veredito não foi emitido')
        assertIncludes(failure.message, 'não é uma vulnerabilidade')
        assertIncludes(failure.message, 'repetida')
        assertIncludes(failure.message, '/-/npm/v1/security/audits')
        assertIncludes(failure.message, 'ECONNREFUSED')
        assertExcludes(failure.message, 'cli.js')
    })

    it('classifica um erro HTTP do registry no mesmo formato', () => {
        const failure = expectFailure(
            () => executeYarnAudit(yarnWithStreams(NETWORK_UNAVAILABLE_STDOUT, HTTP_ERROR_STDERR)),
            'registry-indisponivel',
        )

        assertIncludes(failure.message, '503 Service Unavailable')
    })

    it('classifica o registro error no stdout, com prioridade sobre erros-do-yarn', () => {
        const stdout = [
            auditLine(
                'error',
                'Error: https://registry.yarnpkg.com/-/npm/v1/security/audits: socket hang up',
            ),
            summaryLine(),
        ].join('\n')

        const failure = expectFailure(
            () => executeYarnAudit(yarnWithStreams(stdout, '', 0)),
            'registry-indisponivel',
        )

        assertIncludes(failure.message, 'socket hang up')
    })

    it('reconhece o texto puro no stderr que cita o endpoint de auditoria', () => {
        expectFailure(
            () =>
                executeYarnAudit(
                    yarnWithStreams(
                        NETWORK_UNAVAILABLE_STDOUT,
                        'error Error: https://registry.npmjs.org/-/npm/v1/security/audits: timeout\n',
                    ),
                ),
            'registry-indisponivel',
        )
    })

    it('trunca o trecho do erro do Yarn na mensagem', () => {
        const stderr = `${auditLine('error', `https://registry.yarnpkg.com/-/npm/v1/security/audits: ${'x'.repeat(STDERR_EXCERPT_MAX_CHARS * 2)}`)}\n`

        const failure = expectFailure(
            () => executeYarnAudit(yarnWithStreams('', stderr)),
            'registry-indisponivel',
        )

        assertExcludes(failure.message, 'x'.repeat(STDERR_EXCERPT_MAX_CHARS))
    })

    it('não trata um warning que cita o endpoint como falha de registry', () => {
        const stderr = `${auditLine('warning', 'Consulta a /-/npm/v1/security/audits demorou')}\n`

        const report = executeYarnAudit(yarnWithStreams(summaryLine(), stderr, 0))

        assert.equal(report.counts.low, 1)
    })

    it('mantém yarn-falhou quando o stderr não cita o endpoint de auditoria', () => {
        const failure = expectFailure(
            () =>
                executeYarnAudit(
                    yarnWithStreams(
                        NETWORK_UNAVAILABLE_STDOUT,
                        `${auditLine('error', 'getaddrinfo ENOTFOUND registry.yarnpkg.com')}\n`,
                    ),
                ),
            'yarn-falhou',
        )

        assertIncludes(failure.message, 'ENOTFOUND')
    })

    it('mantém erros-do-yarn quando o erro do stdout não cita o endpoint', () => {
        const { err, output } = capture()
        const workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-registry-'))
        try {
            const stdout = [auditLine('error', 'falha qualquer'), summaryLine()].join('\n')

            const code = run(writeFakeYarn(workDir, stdout, 1), output)

            assert.equal(code, 1)
            assert.match(err.join(''), /^\[erros-do-yarn\] /u)
        } finally {
            rmSync(workDir, { recursive: true, force: true })
        }
    })

    it('não altera as falhas de timeout, limite de saída, sinal e início do processo', () => {
        // O stderr cita o endpoint, mas a falha do processo tem prioridade.
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
        expectFailure(
            () =>
                executeYarnAudit({
                    command: join(tmpdir(), 'yarn-que-nao-existe'),
                    args: [],
                }),
            'yarn-nao-iniciou',
        )
    })

    describe('pelo run', () => {
        let workDir

        before(() => {
            workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-registry-run-'))
        })

        after(() => {
            rmSync(workDir, { recursive: true, force: true })
        })

        it('falha sem emitir veredito quando o registry está indisponível', () => {
            const { out, err, output } = capture()
            const yarn = writeFakeYarn(
                workDir,
                NETWORK_UNAVAILABLE_STDOUT,
                1,
                NETWORK_UNAVAILABLE_STDERR,
            )

            const code = run(yarn, output)

            assert.equal(code, 1)
            assert.match(err.join(''), /^\[registry-indisponivel\] /u)
            assertIncludes(err.join(''), 'repetida')
            assertExcludes(out.join(''), 'Auditoria de dependências')
        })

        it('falha mesmo que o Yarn saia com código 0 depois de citar o erro do endpoint', () => {
            const { err, output } = capture()
            const yarn = writeFakeYarn(workDir, summaryLine(), 0, HTTP_ERROR_STDERR)

            assert.equal(run(yarn, output), 1)
            assert.match(err.join(''), /^\[registry-indisponivel\] /u)
        })
    })
})

describe('readProductionRoots: união das dependencies dos workspaces', () => {
    let workDir

    before(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependency-audit-roots-'))
    })

    after(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function writePackage(relDir, manifest) {
        const dir = relDir === '.' ? workDir : join(workDir, relDir)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
    }

    it('une as dependencies da raiz e de cada workspace; devDependencies ficam de fora', () => {
        writePackage('.', {
            private: true,
            workspaces: ['apps/web', 'apps/server', 'packages/core'],
            dependencies: {},
            devDependencies: { eslint: '10.13.0', typescript: '6.0.3' },
        })
        writePackage('apps/web', {
            dependencies: { react: '19.3.1', 'react-dom': '19.3.1' },
            devDependencies: { vite: '8.3.4' },
        })
        writePackage('apps/server', {
            dependencies: { '@nestjs/core': '12.2.0', rxjs: '7.8.2' },
            devDependencies: { '@nestjs/cli': '12.0.10' },
        })
        writePackage('packages/core', {
            devDependencies: { vitest: '5.0.5' },
        })

        const roots = readProductionRoots(join(workDir, 'package.json'))
        assert.deepEqual(
            [...roots].sort(),
            ['@nestjs/core', 'react', 'react-dom', 'rxjs'].sort(),
        )
        // devDependencies (raiz e workspaces) NÃO entram como produção.
        for (const dev of ['eslint', 'typescript', 'vite', '@nestjs/cli', 'vitest'])
            assert.equal(roots.has(dev), false, dev)
    })

    it('resolve um glob de workspaces de um nível (apps/*)', () => {
        const root = mkdtempSync(join(tmpdir(), 'dependency-audit-glob-'))
        try {
            writeFileSync(
                join(root, 'package.json'),
                JSON.stringify({ workspaces: ['apps/*'], dependencies: {} }),
            )
            mkdirSync(join(root, 'apps/web'), { recursive: true })
            writeFileSync(
                join(root, 'apps/web/package.json'),
                JSON.stringify({ dependencies: { axios: '1.0.0' } }),
            )
            mkdirSync(join(root, 'apps/server'), { recursive: true })
            writeFileSync(
                join(root, 'apps/server/package.json'),
                JSON.stringify({ dependencies: { express: '5.0.0' } }),
            )
            const roots = readProductionRoots(join(root, 'package.json'))
            assert.deepEqual([...roots].sort(), ['axios', 'express'])
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })

    it('exige que a raiz declare o objeto dependencies (mesmo vazio)', () => {
        const root = mkdtempSync(join(tmpdir(), 'dependency-audit-nodeps-'))
        try {
            writeFileSync(
                join(root, 'package.json'),
                JSON.stringify({ workspaces: ['apps/web'] }),
            )
            assert.throws(
                () => readProductionRoots(join(root, 'package.json')),
                /não tem o objeto "dependencies"/u,
            )
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })

    it('ignora um padrão de workspace sem package.json, sem inventar raízes', () => {
        const root = mkdtempSync(join(tmpdir(), 'dependency-audit-missing-'))
        try {
            writeFileSync(
                join(root, 'package.json'),
                JSON.stringify({
                    workspaces: ['apps/web', 'apps/inexistente'],
                    dependencies: { lodash: '4.17.21' },
                }),
            )
            mkdirSync(join(root, 'apps/web'), { recursive: true })
            writeFileSync(
                join(root, 'apps/web/package.json'),
                JSON.stringify({ dependencies: { react: '19.3.1' } }),
            )
            const roots = readProductionRoots(join(root, 'package.json'))
            assert.deepEqual([...roots].sort(), ['lodash', 'react'])
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
})
