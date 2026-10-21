/* eslint-disable security/detect-non-literal-fs-filename -- Caminhos criados por mkdtemp nos próprios testes, sem entrada externa. */
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Helpers e fixtures sintéticas dos testes do auditor de dependências: nada aqui
// acessa o registry nem a rede, e nenhum dado vem de um projeto real além dos
// textos de erro do Yarn citados abaixo.

export function auditLine(type, data) {
    return JSON.stringify({ type, data })
}

export function summaryLine(vulnerabilities = {}) {
    return auditLine('auditSummary', {
        vulnerabilities: { info: 0, low: 1, moderate: 0, high: 0, critical: 0, ...vulnerabilities },
    })
}

export function validAdvisory(overrides = {}) {
    return {
        id: 1,
        severity: 'high',
        module_name: 'modulo',
        title: 'Título do advisory',
        url: 'https://example.test/advisory',
        findings: [{ version: '1.2.3' }],
        ...overrides,
    }
}

// Uma linha `auditAdvisory` do Yarn 1 representa um caminho da cadeia de
// dependência; o mesmo advisory se repete uma vez por caminho.
export function advisoryLine(advisory, path = 'raiz>modulo') {
    return auditLine('auditAdvisory', {
        resolution: { id: advisory.id, path, dev: false },
        advisory,
    })
}

// Saída sintética de um advisory alcançado por vários caminhos.
export function advisoryLines(advisory, paths) {
    return paths.map((path) => advisoryLine(advisory, path))
}

export const NETWORK_UNAVAILABLE_STDOUT = [
    auditLine(
        'warning',
        'Resolution field "modulo-sintetico@1.0.0" is incompatible with requested version "modulo-sintetico@^2.0.0"',
    ),
    auditLine(
        'info',
        'Visit https://yarnpkg.com/en/docs/cli/audit for documentation about this command.',
    ),
].join('\n')

// Saída do Yarn 1.22.22 observada com a rede indisponível (proxy morto): o
// stdout traz só o `info` (mais warnings de resolutions, aqui sintético) e o
// erro vai para o stderr, com o código de saída 1.
export const NETWORK_UNAVAILABLE_STDERR = `${auditLine(
    'error',
    'Error: https://registry.yarnpkg.com/-/npm/v1/security/audits: tunneling socket could not be established, cause=connect ECONNREFUSED 127.0.0.1:9\n' +
        '    at ClientRequest.onError (/opt/yarn-v1.22.22/lib/cli.js:152896:17)\n' +
        '    at Object.onceWrapper (node:events:633:26)\n' +
        '    at ClientRequest.emit (node:events:518:28)',
)}\n`

// Erro HTTP no mesmo formato. Não foi observado: a mensagem foi reconstruída a
// partir do código do Yarn 1.22.22 (`lib/cli.js`), que cita o endpoint de
// auditoria seguido do status devolvido pelo registry.
export const HTTP_ERROR_STDERR = `${auditLine(
    'error',
    'Error: https://registry.yarnpkg.com/-/npm/v1/security/audits: Request failed "503 Service Unavailable"\n' +
        '    at ResponseError.ExtendableBuiltin (/opt/yarn-v1.22.22/lib/cli.js:696:66)',
)}\n`

// Duas linhas como o Yarn 1 as emite para o mesmo GHSA em pacotes diferentes: ids
// numéricos distintos (1193683 e 1193684), mesmo `github_advisory_id`.
export function sameGhsaInTwoPackages(ghsa = 'GHSA-82fw-gwwq-j7x9', overrides = {}) {
    const shared = {
        github_advisory_id: ghsa,
        title: 'Leitura de arquivo fora da raiz',
        ...overrides,
    }
    return [
        advisoryLine(validAdvisory({ ...shared, id: 1193683, module_name: 'vitest' }), 'vitest'),
        advisoryLine(
            validAdvisory({ ...shared, id: 1193684, module_name: '@vitest/mocker' }),
            'vitest>@vitest/mocker',
        ),
    ]
}

export function capture() {
    const out = []
    const err = []
    return {
        out,
        err,
        output: {
            stdout: { write: (text) => out.push(text) },
            stderr: { write: (text) => err.push(text) },
        },
    }
}

// Um `yarn.js` falso: o `run` o executa com o Node, como faz com o Yarn.
export function writeFakeYarn(workDir, stdout, exitCode = 0, stderr = '') {
    const directory = mkdtempSync(join(workDir, 'case-'))
    const file = join(directory, 'yarn.js')
    writeFileSync(
        file,
        `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = ${exitCode}`,
    )
    return file
}

// Executa a ação e exige que ela falhe com `AuditFailure`; devolve a falha.
export function failureOf(action) {
    try {
        action()
    } catch (error) {
        // Pelo nome, para os helpers não dependerem do módulo sob teste.
        assert.equal(error?.name, 'AuditFailure', `Esperava AuditFailure, veio: ${error}`)
        return error
    }
    throw new assert.AssertionError({ message: 'A ação deveria ter falhado com AuditFailure.' })
}

export function expectFailure(action, category) {
    const failure = failureOf(action)
    assert.equal(failure.category, category)
    assert.ok(
        failure.message.startsWith(`[${category}] `),
        `A mensagem deve começar com [${category}]: ${failure.message}`,
    )
    return failure
}

// Asserções de trecho com a saída completa na mensagem, para depurar o relatório.
export function assertIncludes(text, part) {
    assert.ok(text.includes(part), `Faltou "${part}" em:\n${text}`)
}

export function assertExcludes(text, part) {
    assert.ok(!text.includes(part), `Não deveria haver "${part}" em:\n${text}`)
}
