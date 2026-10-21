/* eslint-disable security/detect-non-literal-fs-filename -- Caminhos criados por mkdtemp nos próprios testes, sem entrada externa. */
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Helpers e fixtures sintéticas dos testes do auditor de dependências: nada aqui
// acessa o registry nem a rede, e nenhum dado vem de um projeto real além dos
// textos de erro do Yarn citados abaixo.

// Uma linha do `yarn npm audit --json`: `{"value": "<pacote>", "children": { ... }}`.
export function advisoryLine(overrides = {}) {
    const { value = 'modulo', ...children } = overrides
    return JSON.stringify({
        value,
        children: {
            ID: 1,
            Issue: 'Título do advisory',
            URL: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
            Severity: 'high',
            'Vulnerable Versions': '<4.17.21',
            'Tree Versions': ['1.2.3'],
            Dependents: ['lab@workspace:.'],
            ...children,
        },
    })
}

// Junta várias linhas NDJSON (o auditor ignora linhas em branco).
export function ndjson(...lines) {
    return lines.join('\n')
}

// Duas linhas como o Yarn 4 as emite para o mesmo GHSA em pacotes diferentes: ids
// numéricos distintos, mesma URL (logo o mesmo GHSA extraído dela).
export function sameGhsaInTwoPackages(ghsa = 'GHSA-82fw-gwwq-j7x9', overrides = {}) {
    const url = `https://github.com/advisories/${ghsa}`
    const shared = { URL: url, Issue: 'Leitura de arquivo fora da raiz', ...overrides }
    return [
        advisoryLine({ value: 'vitest', ID: 1193683, ...shared }),
        advisoryLine({ value: '@vitest/mocker', ID: 1193684, ...shared }),
    ]
}

// Stderr observado com a rede indisponível (proxy morto): o Yarn 4 escreve o stack do Node com
// RequestError e o código ECONNREFUSED; não cita o endpoint de auditoria.
export const NETWORK_UNAVAILABLE_STDERR = [
    'node:internal/process/promises:394',
    '    triggerUncaughtException(err, true /* fromPromise */);',
    '    ^',
    '',
    'Ls [RequestError]: connect ECONNREFUSED 127.0.0.1:9',
    '    at ClientRequest.<anonymous> (/home/user/.cache/node/corepack/v1/yarn/4.18.1/yarn.js:148:14258)',
    '    at ClientRequest.emit (node:events:526:24)',
    "  code: 'ECONNREFUSED',",
    '',
    'Node.js v24.21.0',
].join('\n')

// Erro HTTP no mesmo formato de stack: o Yarn 4 traz HTTPError e o status pela mensagem
// `Response code`.
export const HTTP_ERROR_STDERR = [
    'Uncaught HTTPError: Response code 503 (Service Unavailable)',
    '    at ClientRequest.<anonymous> (/home/user/.cache/node/corepack/v1/yarn/4.18.1/yarn.js:148:14258)',
].join('\n')

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

// Um `yarn.js` falso que imprime NDJSON conforme o `--environment` recebido: o `run` o executa
// com o Node, como faz com o Yarn. `byEnvironment` mapeia 'production'/'development' para o
// stdout de cada execução; `fallback` cobre o caso sem `--environment`.
export function writeFakeYarn(workDir, config, exitCode = 1, stderr = '') {
    const spec =
        typeof config === 'string'
            ? { production: config, development: '', fallback: config, exitCode, stderr }
            : {
                  production: config.production ?? '',
                  development: config.development ?? '',
                  fallback: config.fallback ?? config.production ?? '',
                  exitCode: config.exitCode ?? exitCode,
                  stderr: config.stderr ?? stderr,
              }
    const directory = mkdtempSync(join(workDir, 'case-'))
    const file = join(directory, 'yarn.js')
    writeFileSync(
        file,
        [
            `const spec = ${JSON.stringify(spec)}`,
            "const index = process.argv.indexOf('--environment')",
            "const environment = index >= 0 ? process.argv[index + 1] : 'fallback'",
            'const stdout = spec[environment] ?? spec.fallback',
            'process.stdout.write(stdout)',
            'process.stderr.write(spec.stderr)',
            // Sem advisories no stdout, sai 0; com advisories, o Yarn sairia != 0.
            'process.exitCode = stdout.trim() ? spec.exitCode : 0',
        ].join('\n'),
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
