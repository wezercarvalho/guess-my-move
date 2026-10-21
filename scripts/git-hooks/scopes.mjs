// Fonte única dos escopos do hook local de pré-push: padrões de path, comandos e plano de
// verificações. Sem I/O: quem executa (pre-push.mjs, local-checks.mjs) injeta o que toca o disco.
// Os padrões são cópias literais dos de `.github/workflows/pr-gate.yml` (passo "Detectar paths
// alterados"); um teste em `test/gates/` compara os dois.
//
// Ainda não há escopo de pacote (o repositório não tem código). Quando o scaffold da aplicação
// chegar, o escopo do pacote entra aqui, no `detect-changes` do pr-gate e em `SELECTED_JOBS` de
// `scripts/sdd/check-job-results.mjs`, com o mesmo comando que o gate remoto roda.

export const PATH_PATTERNS = {
    sdd: '^specs/|^scripts/sdd/|^test/sdd/|^docs/development-strategies/sdd/|^AGENTS\\.md$|^(package\\.json|yarn\\.lock)$|^\\.github/workflows/pr-gate\\.yml$',
    'root-docs':
        '^(AGENTS\\.md|CLAUDE\\.md|README\\.md|\\.prettierrc|docs/|specs/|\\.github/workflows/pr-gate\\.yml$)',
    // Testes dos próprios gates: hook local, auditor de dependências e workflows.
    tooling:
        '^scripts/(git-hooks|lib)/|^scripts/(audit-dependencies\\.mjs|dependency-audit-exceptions\\.json)$|^test/(gates|security)/|^\\.githooks/|^\\.github/workflows/|^(package\\.json|yarn\\.lock|\\.prettierrc|\\.node-version)$',
    // Auditoria de dependências: só o que muda o veredito (manifesto, lockfile, auditor, exceções
    // e os workflows que a executam); `AUDIT_PATTERN` do gate.
    audit: '^(package\\.json|yarn\\.lock|scripts/audit-dependencies\\.mjs|scripts/dependency-audit-exceptions\\.json|scripts/lib/dependency-audit[a-z-]*\\.mjs)$|^\\.github/workflows/(pr-gate|dependency-audit)\\.yml$',
}

// Ordem de execução: leves primeiro, para falhar rápido; a auditoria consulta o registry e vem
// por último entre as de governança.
export const ALL_SCOPES = ['sdd', 'root-docs', 'tooling', 'audit']

export const MODES = ['static', 'full']

// Modelos do SDD ficam fora do `--file`, como no job `sdd` do gate.
const SDD_TEMPLATES_PREFIX = 'docs/development-strategies/sdd/templates/'

export function yarnExecutable(platform = process.platform) {
    return platform === 'win32' ? 'yarn.cmd' : 'yarn'
}

export function installCommand(packageDir) {
    return packageDir === '.'
        ? 'yarn install --frozen-lockfile'
        : `cd ${packageDir} && yarn install --frozen-lockfile`
}

export function affectedScopes(changedFiles) {
    return ALL_SCOPES.filter((scope) => {
        const pattern = new RegExp(PATH_PATTERNS[scope])
        return changedFiles.some((file) => pattern.test(file))
    })
}

function stepsFor(scope, { changedFiles, exists }) {
    const yarn = yarnExecutable()
    switch (scope) {
        case 'sdd': {
            const files = changedFiles.filter(
                (file) =>
                    file.endsWith('.md') &&
                    !file.startsWith(SDD_TEMPLATES_PREFIX) &&
                    exists(file),
            )
            return [
                {
                    id: 'sdd-test',
                    label: 'SDD: testes do checker (yarn test:sdd)',
                    cwd: '.',
                    command: yarn,
                    args: ['test:sdd'],
                },
                {
                    id: 'sdd-check',
                    label: 'SDD: catálogo e links (yarn sdd:check)',
                    cwd: '.',
                    command: yarn,
                    args: [
                        'sdd:check',
                        ...files.flatMap((file) => ['--file', file]),
                    ],
                },
            ]
        }
        case 'root-docs':
            return [
                {
                    id: 'root-docs',
                    label: 'Docs da raiz: formatação (yarn docs:format:check)',
                    cwd: '.',
                    command: yarn,
                    args: ['docs:format:check'],
                },
            ]
        case 'tooling':
            return [
                {
                    id: 'tooling',
                    label: 'Gates: testes do hook, do auditor e dos workflows (yarn test:gates)',
                    cwd: '.',
                    command: yarn,
                    args: ['test:gates'],
                },
            ]
        default:
            return [
                {
                    id: scope,
                    label: 'Auditoria de dependências (yarn security:dependencies)',
                    cwd: '.',
                    command: yarn,
                    args: ['security:dependencies'],
                    kind: 'audit',
                },
            ]
    }
}

// `exists(caminhoRelativoAaRaiz)` filtra os `.md` removidos (como `[ -f $FILE ]` no gate);
// `scopes` força os escopos quando o intervalo é desconhecido. `mode` é validado e reservado: os
// escopos de pacote, quando existirem, rodam a verificação rápida em `static` e a completa em
// `full`; hoje os dois modos produzem o mesmo plano.
export function planChecks(
    changedFiles,
    {
        mode = 'static',
        exists = () => true,
        scopes = affectedScopes(changedFiles),
    } = {},
) {
    if (!MODES.includes(mode)) {
        throw new Error(`mode inválido: ${mode}. Use ${MODES.join(' ou ')}.`)
    }
    return ALL_SCOPES.filter((scope) => scopes.includes(scope)).flatMap(
        (scope) => stepsFor(scope, { changedFiles, exists }),
    )
}
