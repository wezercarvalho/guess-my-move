/* Testes estruturais do pr-gate e do hook local de pré-push: seleção por path, comandos e plano de
   verificações precisam permanecer equivalentes entre `.github/workflows/pr-gate.yml`,
   `scripts/git-hooks/` e os scripts do `package.json`. */
import assert from 'node:assert/strict'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, URL } from 'node:url'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
const readWorkflow = async (name) =>
    parse(await readFile(join(repoRoot, '.github/workflows', name), 'utf8'))
const prGate = await readWorkflow('pr-gate.yml')
const notDraft = /github\.event\.pull_request\.draft\s*==\s*false/

// Estrutura do pr-gate: não roda em rascunho, roda sozinho quando a PR é marcada como pronta e
// mantém a seleção por path.
test('pr-gate roda ao abrir, atualizar, reabrir e marcar a PR como pronta', () => {
    assert.deepEqual(prGate.on.pull_request.types, [
        'opened',
        'synchronize',
        'reopened',
        'ready_for_review',
    ])
})

test('pr-gate pula a detecção e o gate em PR rascunho, sem label nem disparo manual', () => {
    assert.match(String(prGate.jobs['detect-changes'].if), notDraft)
    assert.match(String(prGate.jobs.gate.if), notDraft)
    assert.match(String(prGate.jobs.gate.if), /always\(\)/)
    assert.ok(!('workflow_dispatch' in prGate.on), 'o gate não deve ter disparo manual')
    assert.doesNotMatch(JSON.stringify(prGate.on), /labeled/)
})

test('os demais jobs do pr-gate continuam dependendo da detecção (herdam o rascunho)', () => {
    for (const job of ['sdd', 'audit']) {
        assert.ok(
            [prGate.jobs[job].needs].flat().includes('detect-changes'),
            `${job} deve depender de detect-changes`,
        )
    }
    assert.ok([prGate.jobs.gate.needs].flat().includes('detect-changes'))
})

test('o pr-gate só tem permissão de leitura e cancela execuções antigas da mesma PR', () => {
    assert.deepEqual(prGate.permissions, { contents: 'read' })
    assert.equal(prGate.concurrency['cancel-in-progress'], true)
})

// Job de governança: SDD, formatação dos docs da raiz e testes dos gates compartilham uma
// instalação de dependências; cada verificação tem condição própria por passo.
const governanceStep = (name) => prGate.jobs.sdd.steps.find((item) => item.name === name)
const normalizeCondition = (condition) => String(condition).replace(/\s+/g, ' ').trim()
const selected = (name) => `needs.detect-changes.outputs.${name} == 'true'`

test('o job sdd é o de governança e roda quando qualquer das três seleções é verdadeira', () => {
    assert.equal(prGate.jobs.sdd.name, 'governança: SDD, docs da raiz e gates')
    assert.deepEqual([prGate.jobs.sdd.needs].flat(), ['detect-changes'])
    assert.equal(
        normalizeCondition(prGate.jobs.sdd.if),
        [selected('sdd'), selected('root-docs'), selected('tooling')].join(' || '),
    )
    const outputs = prGate.jobs['detect-changes'].outputs
    for (const name of ['sdd', 'root-docs', 'tooling', 'audit']) {
        assert.equal(outputs[name], `\${{ steps.filter.outputs.${name} }}`)
    }
})

test('cada verificação de governança tem passo e condição próprios', () => {
    const expectations = [
        ['Testar checker e consolidação', selected('sdd'), /yarn test:sdd/],
        ['Verificar catálogo e links', selected('sdd'), /yarn sdd:check/],
        ['Verificar formatação dos docs da raiz', selected('root-docs'), /yarn docs:format:check/],
        ['Testar hook, auditor e workflows', selected('tooling'), /yarn test:gates/],
    ]
    for (const [name, condition, command] of expectations) {
        const step = governanceStep(name)
        assert.ok(step, `o passo "${name}" deve existir no job sdd`)
        assert.equal(normalizeCondition(step.if), condition, `condição de "${name}"`)
        assert.match(step.run, command)
    }
    for (const name of ['Habilitar corepack', 'Instalar dependências']) {
        assert.equal(governanceStep(name).if, undefined, `"${name}" roda sempre que o job roda`)
    }
})

test('o job de governança instala as dependências uma única vez e com histórico completo', () => {
    const installs = prGate.jobs.sdd.steps.filter((item) => /yarn install/.test(item.run ?? ''))
    assert.equal(installs.length, 1, 'uma única instalação de dependências')
    assert.match(installs[0].run, /--frozen-lockfile/)
    const checkout = prGate.jobs.sdd.steps.find((item) => /actions\/checkout/.test(item.uses ?? ''))
    assert.equal(checkout.with['fetch-depth'], 0, 'o sdd:check precisa do diff contra a base')
})

test('a auditoria de dependências é um job condicional e o gate depende de todos', () => {
    assert.equal(normalizeCondition(prGate.jobs.audit.if), selected('audit'))
    assert.match(
        prGate.jobs.audit.steps.map((item) => item.run ?? '').join('\n'),
        /yarn security:dependencies/,
    )
    const needs = [prGate.jobs.gate.needs].flat()
    assert.deepEqual([...needs].sort(), ['audit', 'detect-changes', 'sdd'])
    assert.match(JSON.stringify(prGate.jobs.gate.steps), /check-job-results\.mjs/)
})

// Hook local de pré-push: os escopos, os comandos e a seleção por path vêm de
// `scripts/git-hooks/scopes.mjs` e precisam permanecer equivalentes ao `pr-gate.yml` e ao
// `package.json`.
const hooksDir = join(repoRoot, 'scripts/git-hooks')
const hooksUrl = (name) => new URL(`../../scripts/git-hooks/${name}`, import.meta.url).href
const scopes = await import(hooksUrl('scopes.mjs'))
const prePush = await import(hooksUrl('pre-push.mjs'))
const localChecks = await import(hooksUrl('local-checks.mjs'))
const { planChecks, yarnExecutable } = scopes

const prGateText = await readFile(join(repoRoot, '.github/workflows/pr-gate.yml'), 'utf8')
const gatePattern = (name) => {
    const match = new RegExp(`${name}='([^']+)'`).exec(prGateText)
    assert.ok(match, `${name} deve existir no pr-gate.yml`)
    return match[1]
}
const ids = (plan) => plan.map((step) => step.id)
const allExist = () => true

test('planChecks devolve lista vazia quando nenhum escopo é afetado', () => {
    assert.deepEqual(planChecks([], { exists: allExist }), [])
    assert.deepEqual(planChecks(['LICENSE', 'logo.png'], { exists: allExist }), [])
})

test('planChecks do escopo sdd roda test:sdd e sdd:check na raiz', () => {
    const [first, check] = planChecks(['specs/x/spec.md'], { exists: allExist }).filter((step) =>
        step.id.startsWith('sdd'),
    )
    assert.deepEqual([first.cwd, first.command, first.args], ['.', yarnExecutable(), ['test:sdd']])
    assert.equal(check.cwd, '.')
    assert.deepEqual(check.args, ['sdd:check', '--file', 'specs/x/spec.md'])
})

test('planChecks passa --file só para .md existentes e fora dos templates do SDD', () => {
    const plan = planChecks(
        [
            'specs/x/spec.md',
            'specs/removida/spec.md',
            'docs/development-strategies/sdd/templates/spec.md',
            'docs/development-strategies/sdd/README.md',
            'scripts/sdd/check-specs.mjs',
        ],
        { exists: (file) => file !== 'specs/removida/spec.md' },
    )
    const check = plan.find((step) => step.id === 'sdd-check')
    assert.deepEqual(check.args, [
        'sdd:check',
        '--file',
        'specs/x/spec.md',
        '--file',
        'docs/development-strategies/sdd/README.md',
    ])
})

test('planChecks do escopo root-docs repete a verificação de formatação do gate', () => {
    const step = planChecks(['README.md'], { exists: allExist }).find(
        (item) => item.id === 'root-docs',
    )
    assert.deepEqual([step.cwd, step.args], ['.', ['docs:format:check']])
    assert.ok(packageJson.scripts['docs:format:check'].startsWith('prettier --check'))
    assert.match(
        prGate.jobs.sdd.steps.map((item) => item.run ?? '').join('\n'),
        /yarn docs:format:check/,
    )
})

test('planChecks do escopo tooling roda test:gates', () => {
    const plan = planChecks(['scripts/git-hooks/scopes.mjs'], { exists: allExist })
    assert.deepEqual(ids(plan), ['tooling'])
    assert.deepEqual(plan[0].args, ['test:gates'])
    assert.equal(typeof packageJson.scripts['test:gates'], 'string')
})

test('planChecks ordena sdd, root-docs, tooling e auditoria (leves primeiro)', () => {
    const plan = planChecks(['yarn.lock', 'README.md', 'specs/x/spec.md'], { exists: allExist })
    assert.deepEqual(ids(plan), ['sdd-test', 'sdd-check', 'root-docs', 'tooling', 'audit'])
})

test('os passos de auditoria só aparecem com kind audit; os demais não têm kind', () => {
    const plan = planChecks(['yarn.lock'], { exists: allExist })
    for (const step of plan) {
        if (step.id === 'audit') assert.equal(step.kind, 'audit')
        else assert.equal(step.kind, undefined, step.id)
    }
    assert.deepEqual(plan.find((step) => step.id === 'audit').args, ['security:dependencies'])
    assert.equal(typeof packageJson.scripts['security:dependencies'], 'string')
})

test('planChecks não roda auditor quando nada casa o padrão de auditoria', () => {
    const plan = planChecks(['README.md', 'specs/x/spec.md'], { exists: allExist })
    assert.ok(!ids(plan).includes('audit'))
})

test('planChecks aceita escopos explícitos e valida o modo', () => {
    const plan = planChecks([], { scopes: scopes.ALL_SCOPES, exists: allExist })
    assert.deepEqual(ids(plan), ['sdd-test', 'sdd-check', 'root-docs', 'tooling', 'audit'])
    assert.deepEqual(ids(planChecks([], { scopes: ['tooling'], exists: allExist })), ['tooling'])
    assert.deepEqual(
        ids(planChecks(['yarn.lock'], { mode: 'full', exists: allExist })),
        ids(planChecks(['yarn.lock'], { mode: 'static', exists: allExist })),
    )
    assert.throws(() => planChecks(['README.md'], { mode: 'x' }), /mode inválido/)
})

test('yarnExecutable usa yarn.cmd só no Windows', () => {
    assert.equal(yarnExecutable('win32'), 'yarn.cmd')
    assert.equal(yarnExecutable('linux'), 'yarn')
    assert.equal(yarnExecutable('darwin'), 'yarn')
})

test('os padrões de path do hook são os mesmos do pr-gate.yml', () => {
    assert.equal(scopes.PATH_PATTERNS.sdd, gatePattern('SDD_PATTERN'))
    assert.equal(scopes.PATH_PATTERNS['root-docs'], gatePattern('ROOT_DOCS_PATTERN'))
    assert.equal(scopes.PATH_PATTERNS.tooling, gatePattern('TOOLING_PATTERN'))
    assert.equal(scopes.PATH_PATTERNS.audit, gatePattern('AUDIT_PATTERN'))
})

test('amostras de paths têm o mesmo escopo no hook e no padrão extraído do pr-gate.yml', () => {
    const gate = Object.fromEntries(
        [
            ['sdd', 'SDD_PATTERN'],
            ['root-docs', 'ROOT_DOCS_PATTERN'],
            ['tooling', 'TOOLING_PATTERN'],
            ['audit', 'AUDIT_PATTERN'],
        ].map(([scope, name]) => [scope, new RegExp(gatePattern(name))]),
    )
    const samples = {
        'specs/2026-10-20-x/spec.md': ['sdd', 'root-docs'],
        'scripts/sdd/check-specs.mjs': ['sdd'],
        'test/sdd/check-specs.node-test.mjs': ['sdd'],
        'docs/development-strategies/sdd/README.md': ['sdd', 'root-docs'],
        'docs/development-context/delivery/ci-pipeline.md': ['root-docs'],
        'AGENTS.md': ['sdd', 'root-docs'],
        'CLAUDE.md': ['root-docs'],
        'README.md': ['root-docs'],
        '.prettierrc': ['root-docs', 'tooling'],
        '.node-version': ['tooling'],
        'package.json': ['sdd', 'tooling', 'audit'],
        'yarn.lock': ['sdd', 'tooling', 'audit'],
        '.github/workflows/pr-gate.yml': ['sdd', 'root-docs', 'tooling', 'audit'],
        '.github/workflows/dependency-audit.yml': ['tooling', 'audit'],
        '.githooks/pre-push': ['tooling'],
        'scripts/git-hooks/scopes.mjs': ['tooling'],
        'scripts/audit-dependencies.mjs': ['tooling', 'audit'],
        'scripts/dependency-audit-exceptions.json': ['tooling', 'audit'],
        'scripts/lib/dependency-audit.mjs': ['tooling', 'audit'],
        'scripts/lib/dependency-audit-failure.mjs': ['tooling', 'audit'],
        'scripts/lib/outro.mjs': ['tooling'],
        'test/gates/hook-and-gate.node-test.mjs': ['tooling'],
        'test/security/dependency-audit.node-test.mjs': ['tooling'],
        LICENSE: [],
        'logo.png': [],
    }
    for (const [path, expected] of Object.entries(samples)) {
        assert.deepEqual(scopes.affectedScopes([path]), expected, path)
        for (const [scope, pattern] of Object.entries(gate)) {
            assert.equal(pattern.test(path), expected.includes(scope), `${path} (${scope} no gate)`)
        }
    }
})

test('o job sdd do pr-gate roda os mesmos comandos do hook', () => {
    const runs = prGate.jobs.sdd.steps.map((item) => item.run ?? '')
    assert.ok(runs.includes('yarn test:sdd'))
    assert.ok(runs.some((run) => run.includes('yarn sdd:check')))
    assert.ok(runs.some((run) => run.includes('docs/development-strategies/sdd/templates/')))
})

test('os scripts oficiais usados pelo gate e pelo hook existem no package.json', () => {
    for (const name of [
        'test:sdd',
        'sdd:check',
        'docs:format:check',
        'test:gates',
        'security:dependencies',
    ]) {
        assert.equal(typeof packageJson.scripts[name], 'string', name)
    }
})

const fakeGit = (table) => {
    const calls = []
    const git = (args) => {
        calls.push(args.join(' '))
        const key = args.join(' ')
        return key in table ? { status: 0, stdout: table[key] } : { status: 1, stdout: '' }
    }
    git.calls = calls
    return git
}
const ZERO = '0'.repeat(40)

test('parsePushLines lê as linhas do Git e ignora linhas em branco', () => {
    const lines = prePush.parsePushLines(
        `refs/heads/a aaa refs/heads/a bbb\n\n  \nrefs/heads/c ccc refs/heads/c ${ZERO}\n`,
    )
    assert.deepEqual(lines, [
        { localRef: 'refs/heads/a', localSha: 'aaa', remoteRef: 'refs/heads/a', remoteSha: 'bbb' },
        {
            localRef: 'refs/heads/c',
            localSha: 'ccc',
            remoteRef: 'refs/heads/c',
            remoteSha: ZERO,
        },
    ])
    assert.deepEqual(prePush.parsePushLines(''), [])
})

test('resolveChangedFiles usa o intervalo remote..local de uma branch existente', () => {
    const git = fakeGit({
        'cat-file -e R1^{commit}': '',
        'diff --name-only R1..L1': 'scripts/a.mjs\ndocs/b.md\n',
    })
    const lines = prePush.parsePushLines('refs/heads/x L1 refs/heads/x R1\n')
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.deepEqual(result.files, ['docs/b.md', 'scripts/a.mjs'])
    assert.equal(result.allScopes, false)
    assert.ok(!git.calls.some((call) => call.startsWith('merge-base')))
})

test('resolveChangedFiles usa o merge-base com origin/main em branch nova', () => {
    const git = fakeGit({
        'rev-parse --verify --quiet origin/main': 'MAIN\n',
        'merge-base L1 origin/main': 'MB\n',
        'diff --name-only MB..L1': 'specs/x/spec.md\n',
    })
    const lines = prePush.parsePushLines(`refs/heads/novo L1 refs/heads/novo ${ZERO}\n`)
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.deepEqual(result.files, ['specs/x/spec.md'])
    assert.equal(result.allScopes, false)
    assert.ok(git.calls.includes('merge-base L1 origin/main'))
})

test('resolveChangedFiles cai no merge-base quando o remote sha não existe localmente', () => {
    const git = fakeGit({
        'rev-parse --verify --quiet origin/main': 'MAIN\n',
        'merge-base L1 origin/main': 'MB\n',
        'diff --name-only MB..L1': 'scripts/a.mjs\n',
    })
    const lines = prePush.parsePushLines('refs/heads/x L1 refs/heads/x DESCONHECIDO\n')
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.deepEqual(result.files, ['scripts/a.mjs'])
    assert.ok(git.calls.includes('cat-file -e DESCONHECIDO^{commit}'))
})

test('resolveChangedFiles ignora referência apagada sem consultar o Git', () => {
    const git = fakeGit({})
    const lines = prePush.parsePushLines(`(delete) ${ZERO} refs/heads/velho R1\n`)
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.deepEqual(result.files, [])
    assert.equal(result.allScopes, false)
    assert.deepEqual(git.calls, [])
})

test('resolveChangedFiles trata todos os escopos e avisa quando não há origin/main', () => {
    const git = fakeGit({})
    const lines = prePush.parsePushLines(`refs/heads/novo L1 refs/heads/novo ${ZERO}\n`)
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.equal(result.allScopes, true)
    assert.equal(result.notes.length, 1)
    assert.match(result.notes[0], /origin\/main/)
})

test('resolveChangedFiles une os intervalos de várias referências sem duplicar', () => {
    const git = fakeGit({
        'cat-file -e R1^{commit}': '',
        'cat-file -e R2^{commit}': '',
        'diff --name-only R1..L1': 'docs/b.md\nscripts/a.mjs\n',
        'diff --name-only R2..L2': 'scripts/a.mjs\nAGENTS.md\n',
    })
    const lines = prePush.parsePushLines(
        'refs/heads/x L1 refs/heads/x R1\nrefs/heads/y L2 refs/heads/y R2\n',
    )
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.deepEqual(result.files, ['AGENTS.md', 'docs/b.md', 'scripts/a.mjs'])
})

test('resolveChangedFiles trata todos os escopos quando o diff falha', () => {
    const git = fakeGit({ 'cat-file -e R1^{commit}': '' })
    const lines = prePush.parsePushLines('refs/heads/x L1 refs/heads/x R1\n')
    const result = prePush.resolveChangedFiles({ lines, git })
    assert.equal(result.allScopes, true)
    assert.equal(result.notes.length, 1)
})

const makeRunner = (statuses = {}) => {
    const executed = []
    const run = (step) => {
        executed.push(step.id)
        const outcome = statuses[step.id] ?? 0
        return typeof outcome === 'object' ? outcome : { status: outcome }
    }
    run.executed = executed
    return run
}
const makeLog = () => {
    const lines = []
    const log = (message) => lines.push(message)
    log.text = () => lines.join('\n')
    return log
}
const fullPlan = planChecks(['scripts/git-hooks/a.mjs', 'specs/x/spec.md', 'AGENTS.md'], {
    exists: allExist,
})

test('runPlan sai com zero e não executa nada quando não há o que verificar', () => {
    const run = makeRunner()
    const log = makeLog()
    const result = prePush.runPlan([], { run, exists: () => false, log })
    assert.equal(result.code, 0)
    assert.deepEqual(run.executed, [])
    assert.match(log.text(), /nada a verificar/i)
})

test('runPlan executa os passos em ordem e sai com zero quando todos passam', () => {
    const run = makeRunner()
    const log = makeLog()
    const result = prePush.runPlan(fullPlan, { run, exists: () => true, log })
    assert.equal(result.code, 0)
    assert.deepEqual(run.executed, ids(fullPlan))
    assert.match(log.text(), /conclu/i)
})

test('runPlan barra no primeiro erro, não executa os seguintes e explica o contorno', () => {
    const run = makeRunner({ tooling: 2 })
    const log = makeLog()
    const result = prePush.runPlan(fullPlan, { run, exists: () => true, log })
    assert.notEqual(result.code, 0)
    const failedIndex = ids(fullPlan).indexOf('tooling')
    assert.deepEqual(run.executed, ids(fullPlan).slice(0, failedIndex + 1))
    assert.equal(result.failed.id, 'tooling')
    const text = log.text()
    assert.match(text, new RegExp(fullPlan[failedIndex].label.replace(/[()]/g, '\\$&')))
    assert.match(text, /git push --no-verify/)
    assert.match(text, /pr-gate/)
})

test('runPlan trata erro ao iniciar o comando como falha', () => {
    const run = makeRunner({ 'root-docs': { status: null, error: new Error('spawn ENOENT') } })
    const log = makeLog()
    const result = prePush.runPlan(fullPlan, { run, exists: () => true, log })
    assert.notEqual(result.code, 0)
    assert.equal(result.failed.id, 'root-docs')
    assert.match(log.text(), /spawn ENOENT/)
})

test('runPlan barra com o comando de instalação quando falta node_modules, sem executar nada', () => {
    const run = makeRunner()
    const log = makeLog()
    const checked = []
    const exists = (path) => {
        checked.push(path)
        return false
    }
    const result = prePush.runPlan(fullPlan, { run, exists, log })
    assert.notEqual(result.code, 0)
    assert.deepEqual(run.executed, [])
    assert.deepEqual(result.missing, ['.'])
    assert.deepEqual(checked, ['./node_modules'], 'a raiz é o único pacote consultado')
    assert.match(log.text(), /Instale com: yarn install --frozen-lockfile/)
    assert.doesNotMatch(log.text(), /cd \. &&/)
    assert.match(log.text(), /git push --no-verify/)
})

test('runPlan executa quando node_modules da raiz existe', () => {
    const run = makeRunner()
    const result = prePush.runPlan(fullPlan, {
        run,
        exists: (path) => path === './node_modules',
        log: makeLog(),
    })
    assert.equal(result.code, 0)
    assert.deepEqual(run.executed, ids(fullPlan))
})

// Passos de auditoria rodam com a saída capturada e repetida na tela (`echo`); só a falha de
// registry (marcador emitido pelo próprio auditor) vira aviso, qualquer outra reprovação barra.
const makeEcho = () => {
    const chunks = []
    const echo = (text, stream) => chunks.push({ stream, text })
    echo.text = (stream) =>
        chunks
            .filter((chunk) => stream === undefined || chunk.stream === stream)
            .map((chunk) => chunk.text)
            .join('')
    return echo
}
const auditPlan = planChecks(['yarn.lock'], { exists: allExist })
const vulnerabilityOutput = 'Auditoria de dependências: 1 High em lodash (GHSA-xxxx).\n'
const registryOutput =
    '[registry-indisponivel] O Yarn não conseguiu consultar o endpoint de auditoria do registry.\n'

test('o marcador de registry do hook é o que o auditor emite', async () => {
    assert.equal(prePush.REGISTRY_UNAVAILABLE_MARKER, 'registry-indisponivel')
    for (const file of [
        'scripts/lib/dependency-audit.mjs',
        'scripts/lib/dependency-audit-failure.mjs',
    ]) {
        const source = await readFile(join(repoRoot, file), 'utf8')
        assert.ok(
            source.includes(`'${prePush.REGISTRY_UNAVAILABLE_MARKER}'`),
            `${file} deve emitir o marcador ${prePush.REGISTRY_UNAVAILABLE_MARKER}`,
        )
    }
})

test('runPlan aprova a auditoria, repete a saída capturada e segue sem aviso', () => {
    const run = makeRunner({
        audit: { status: 0, stdout: 'auditoria ok\n', stderr: 'nota\n' },
    })
    const log = makeLog()
    const echo = makeEcho()
    const result = prePush.runPlan(auditPlan, { run, exists: () => true, log, echo })
    assert.equal(result.code, 0)
    assert.deepEqual(run.executed, ids(auditPlan))
    assert.deepEqual(result.warnings, [])
    assert.equal(echo.text('stdout'), 'auditoria ok\n')
    assert.equal(echo.text('stderr'), 'nota\n')
    assert.doesNotMatch(log.text(), /AVISO/)
})

test('runPlan barra quando o auditor reprova por vulnerabilidade e mostra a saída dele', () => {
    const run = makeRunner({
        'audit': { status: 1, stdout: vulnerabilityOutput, stderr: 'High encontrado\n' },
    })
    const log = makeLog()
    const echo = makeEcho()
    const result = prePush.runPlan(auditPlan, { run, exists: () => true, log, echo })
    assert.notEqual(result.code, 0)
    assert.equal(result.failed.id, 'audit')
    const index = ids(auditPlan).indexOf('audit')
    assert.deepEqual(run.executed, ids(auditPlan).slice(0, index + 1))
    assert.ok(echo.text().includes(vulnerabilityOutput), 'a saída do auditor aparece na tela')
    assert.ok(echo.text('stderr').includes('High encontrado'))
    const text = log.text()
    assert.match(text, new RegExp(auditPlan[index].label.replace(/[()]/g, '\\$&')))
    assert.match(text, /git push --no-verify/)
    assert.doesNotMatch(text, /AVISO/)
    assert.deepEqual(result.warnings, [])
})

test('runPlan só avisa, sem barrar, quando o auditor não alcança o registry', () => {
    const run = makeRunner({
        'audit': { status: 1, stdout: '', stderr: registryOutput },
    })
    const log = makeLog()
    const echo = makeEcho()
    const result = prePush.runPlan(auditPlan, { run, exists: () => true, log, echo })
    assert.equal(result.code, 0)
    assert.equal(result.failed, null)
    assert.deepEqual(run.executed, ids(auditPlan), 'os passos seguintes continuam')
    assert.deepEqual(result.warnings, ['audit'])
    assert.ok(echo.text('stderr').includes(registryOutput), 'a saída do auditor aparece na tela')
    const text = log.text()
    assert.match(text, /AVISO: Auditoria de dependências não pôde consultar o registry/)
    assert.match(text, /não bloqueia o push/)
    assert.match(text, /pr-gate remoto fará a verificação/)
    assert.match(text, /conclu/i)
    assert.match(text, /Avisos: audit/, 'o aviso aparece no resumo final')
})

test('o marcador de registry no stdout também vira aviso; com código zero não há aviso', () => {
    const inStdout = prePush.runPlan(auditPlan, {
        run: makeRunner({ 'audit': { status: 2, stdout: registryOutput, stderr: '' } }),
        exists: () => true,
        log: makeLog(),
        echo: makeEcho(),
    })
    assert.equal(inStdout.code, 0)
    assert.deepEqual(inStdout.warnings, ['audit'])
    const passing = prePush.runPlan(auditPlan, {
        run: makeRunner({ 'audit': { status: 0, stdout: registryOutput, stderr: '' } }),
        exists: () => true,
        log: makeLog(),
        echo: makeEcho(),
    })
    assert.equal(passing.code, 0)
    assert.deepEqual(passing.warnings, [])
})

test('runPlan barra quando o auditor não inicia e não trata outros passos com o marcador como aviso', () => {
    const notStarted = prePush.runPlan(auditPlan, {
        run: makeRunner({ 'audit': { status: null, error: new Error('spawn ENOENT') } }),
        exists: () => true,
        log: makeLog(),
        echo: makeEcho(),
    })
    assert.notEqual(notStarted.code, 0)
    assert.equal(notStarted.failed.id, 'audit')
    const other = prePush.runPlan(auditPlan, {
        run: makeRunner({ tooling: { status: 1, stdout: '', stderr: registryOutput } }),
        exists: () => true,
        log: makeLog(),
        echo: makeEcho(),
    })
    assert.notEqual(other.code, 0, 'só passos kind audit têm a exceção de registry')
    assert.equal(other.failed.id, 'tooling')
})

test('runPlan tolera auditor sem saída capturada e exige node_modules da raiz', () => {
    const quiet = prePush.runPlan(auditPlan, {
        run: makeRunner(),
        exists: () => true,
        log: makeLog(),
        echo: makeEcho(),
    })
    assert.equal(quiet.code, 0)
    const run = makeRunner()
    const blocked = prePush.runPlan(auditPlan, { run, exists: () => false, log: makeLog() })
    assert.notEqual(blocked.code, 0)
    assert.deepEqual(blocked.missing, ['.'])
    assert.deepEqual(run.executed, [])
})

test('spawnStep captura stdout e stderr só nos passos de auditoria', () => {
    const script = "console.log('saida'); console.error('erro'); process.exit(3)"
    const base = { id: 'x', label: 'x', cwd: '.', command: process.execPath, args: ['-e', script] }
    const audited = prePush.spawnStep({ ...base, kind: 'audit' })
    assert.equal(audited.status, 3)
    assert.equal(audited.stdout, 'saida\n')
    assert.equal(audited.stderr, 'erro\n')
})

test('local-checks usa o mesmo runPlan do hook (comportamento único de auditoria)', async () => {
    const source = await readFile(join(hooksDir, 'local-checks.mjs'), 'utf8')
    assert.match(source, /import \{[^}]*\brunPlan\b[^}]*\} from '\.\/pre-push\.mjs'/)
    assert.match(source, /runPlan\(plan/)
})

test('spawnSpec roda sem shell, exceto yarn.cmd no Windows, e recusa argumentos perigosos', () => {
    const step = { id: 'x', label: 'x', cwd: '.', command: 'yarn', args: ['test:sdd'] }
    assert.deepEqual(prePush.spawnSpec(step, 'linux'), {
        command: 'yarn',
        args: ['test:sdd'],
        shell: false,
    })
    const win = prePush.spawnSpec({ ...step, command: 'yarn.cmd' }, 'win32')
    assert.equal(win.shell, true, 'Node >= 20.12 recusa .cmd sem shell no Windows')
    assert.throws(
        () => prePush.spawnSpec({ ...step, command: 'yarn.cmd', args: ['a&calc'] }, 'win32'),
        /argumento/i,
    )
    assert.equal(
        prePush.spawnSpec({ ...step, command: process.execPath, args: ['a b'] }, 'win32').shell,
        false,
    )
})

test('local-checks lê --mode e --files e recusa opções inválidas', () => {
    assert.deepEqual(localChecks.parseArgs([]), { mode: 'static', files: null })
    assert.deepEqual(localChecks.parseArgs(['--mode', 'full', '--files', 'a.md', 'b/c.md']), {
        mode: 'full',
        files: ['a.md', 'b/c.md'],
    })
    assert.throws(() => localChecks.parseArgs(['--mode', 'x']), /mode/)
    assert.throws(() => localChecks.parseArgs(['--desconhecida']), /desconhecida/)
})

test('local-checks usa o merge-base com origin/main e o working tree sem --files', () => {
    const git = fakeGit({
        'rev-parse --verify --quiet origin/main': 'MAIN\n',
        'merge-base HEAD origin/main': 'MB\n',
        'diff --name-only MB': 'scripts/a.mjs\n',
        'ls-files --others --exclude-standard': 'docs/novo.md\n',
    })
    const result = localChecks.resolveLocalFiles({ git })
    assert.deepEqual(result.files, ['docs/novo.md', 'scripts/a.mjs'])
    assert.equal(result.allScopes, false)
    const withoutMain = localChecks.resolveLocalFiles({ git: fakeGit({}) })
    assert.equal(withoutMain.allScopes, true)
    assert.match(withoutMain.notes[0], /origin\/main/)
})

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' })
const runInstall = (...args) =>
    spawnSync(process.execPath, [join(hooksDir, 'install.mjs'), ...args], { encoding: 'utf8' })

test('install.mjs configura core.hooksPath de forma idempotente', async (t) => {
    const repo = await mkdtemp(join(tmpdir(), 'gmm-install-hook-'))
    t.after(() => rm(repo, { recursive: true, force: true }))
    assert.equal(git(repo, 'init', '--quiet').status, 0)
    await mkdir(join(repo, '.githooks'))
    const launcher = join(repo, '.githooks/pre-push')
    await writeFile(launcher, await readFile(join(repoRoot, '.githooks/pre-push'), 'utf8'))
    chmodSync(launcher, 0o755)

    const first = runInstall('--repo', repo)
    assert.equal(first.status, 0, first.stderr)
    assert.match(first.stdout, /core\.hooksPath/)
    const configured = () => git(repo, 'config', '--local', '--get', 'core.hooksPath').stdout.trim()
    assert.equal(configured(), '.githooks')
    const configFile = join(repo, '.git/config')
    const before = await readFile(configFile, 'utf8')

    const second = runInstall('--repo', repo)
    assert.equal(second.status, 0, second.stderr)
    assert.match(second.stdout, /já/i)
    assert.equal(configured(), '.githooks')
    assert.equal(await readFile(configFile, 'utf8'), before, 'rodar de novo não muda nada')
})

test('install.mjs falha sem o launcher .githooks/pre-push e não configura nada', async (t) => {
    const repo = await mkdtemp(join(tmpdir(), 'gmm-install-hook-'))
    t.after(() => rm(repo, { recursive: true, force: true }))
    assert.equal(git(repo, 'init', '--quiet').status, 0)
    const result = runInstall('--repo', repo)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /pre-push/)
    assert.equal(git(repo, 'config', '--local', '--get', 'core.hooksPath').stdout.trim(), '')
})

test('o launcher .githooks/pre-push é um sh mínimo, com LF e executável no Git', () => {
    const launcherPath = join(repoRoot, '.githooks/pre-push')
    assert.ok(existsSync(launcherPath), '.githooks/pre-push deve existir')
    const content = readFileSync(launcherPath, 'utf8')
    assert.ok(content.startsWith('#!/bin/sh\n'), 'o shebang deve ser #!/bin/sh com LF')
    assert.ok(!content.includes('\r'), 'CRLF quebraria o shebang no Git for Windows')
    assert.match(content, /scripts\/git-hooks\/pre-push\.mjs/)
    assert.match(content, /git rev-parse --show-toplevel/)
    assert.match(content, /exec node /)
    assert.match(content, /"\$@"/)
    if (process.platform !== 'win32') {
        assert.notEqual(statSync(launcherPath).mode & 0o111, 0, 'o arquivo deve ser executável')
    }
    const indexed = git(repoRoot, 'ls-files', '-s', '--', '.githooks/pre-push')
    if (indexed.status === 0 && indexed.stdout.trim() !== '') {
        assert.match(indexed.stdout, /^100755 /, 'o bit executável deve estar no índice do Git')
    }
})

test('os scripts do hook existem e usam só módulos node:* e arquivos vizinhos', async () => {
    const names = readdirSync(hooksDir).filter((name) => name.endsWith('.mjs'))
    assert.deepEqual(names.sort(), [
        'install.mjs',
        'local-checks.mjs',
        'pre-push.mjs',
        'scopes.mjs',
    ])
    for (const name of names) {
        const source = await readFile(join(hooksDir, name), 'utf8')
        for (const [, specifier] of source.matchAll(/from '([^']+)'/g)) {
            assert.match(specifier, /^(node:|\.\/)/, `${name} importa ${specifier}`)
        }
    }
})

// Sem workflow de push em branches de trabalho: a verificação rápida roda no hook local e o
// pr-gate roda na PR pronta. O repositório só tem a branch main.
const workflowsDir = join(repoRoot, '.github/workflows')
const workflowFiles = readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name))
const pushRestriction = (workflow) => {
    const trigger = workflow.on
    if (typeof trigger === 'string') return trigger === 'push' ? 'push sem filtro' : null
    if (Array.isArray(trigger)) return trigger.includes('push') ? 'push sem filtro' : null
    if (!trigger || !('push' in trigger)) return null
    const push = trigger.push
    if (!push || typeof push !== 'object') return 'push sem filtro'
    if ('branches-ignore' in push) return 'branches-ignore não restringe a main'
    const branches = push.branches
    const allowed = ['main']
    if (!Array.isArray(branches) || branches.length === 0) return 'push sem branches'
    if (!branches.every((branch) => allowed.includes(branch))) return `branches: ${branches}`
    return null
}

test('não existem workflows de CI por push em branch de trabalho', () => {
    for (const name of ['ci.yml', 'backend-ci.yml', 'frontend-ci.yml']) {
        assert.ok(!existsSync(join(workflowsDir, name)), `${name} não deve existir`)
    }
    assert.ok(workflowFiles.includes('pr-gate.yml'), 'a listagem de workflows deve funcionar')
})

test('nenhum workflow roda por push fora da main', async () => {
    for (const name of workflowFiles) {
        const workflow = await readWorkflow(name)
        assert.equal(pushRestriction(workflow), null, `${name}: gatilho push inválido`)
    }
    assert.equal(pushRestriction({ on: { push: { branches: ['feature/x'] } } }) !== null, true)
    assert.equal(pushRestriction({ on: { push: { 'branches-ignore': ['main'] } } }) !== null, true)
    assert.equal(pushRestriction({ on: ['push', 'pull_request'] }) !== null, true)
})

// Divulgação do hook: o ponto de entrada manda instalar o hook, para o ganho de minutos não depender de memória.
const installHookCommand = 'node scripts/git-hooks/install.mjs'
const markdownSection = (text, heading) => {
    const start = text.indexOf(`\n## ${heading}\n`)
    assert.notEqual(start, -1, `a seção "${heading}" deve existir`)
    const rest = text.slice(start + 1)
    const next = rest.indexOf('\n## ', 1)
    return next === -1 ? rest : rest.slice(0, next)
}

test('AGENTS.md instala o hook de pré-push dentro da "Ordem obrigatória de trabalho"', async () => {
    const agents = await readFile(join(repoRoot, 'AGENTS.md'), 'utf8')
    assert.ok(agents.includes(installHookCommand), 'AGENTS.md deve citar o comando de instalação')
    assert.ok(
        markdownSection(agents, 'Ordem obrigatória de trabalho').includes(installHookCommand),
        'o passo deve ficar na seção "Ordem obrigatória de trabalho"',
    )
})

test('README.md da raiz cita o comando de instalação do hook', async () => {
    const readme = await readFile(join(repoRoot, 'README.md'), 'utf8')
    assert.ok(readme.includes(installHookCommand), 'README.md deve citar o comando de instalação')
})
