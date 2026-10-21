// Fonte única dos escopos do hook local de pré-push: padrões de path, comandos e plano de
// verificações. Sem I/O: quem executa (pre-push.mjs, local-checks.mjs) injeta o que toca o disco.
// Os padrões são cópias literais dos de `.github/workflows/pr-gate.yml` (passo "Detectar paths
// alterados"); um teste em `test/gates/` compara os dois.
//
// O escopo de código (`code`) cobre a aplicação (apps/, packages/) e roda `yarn check:static` no
// modo `static` (hook por padrão) e `yarn check:all` no modo `full`, o mesmo conjunto que o gate
// remoto executa. Seu padrão é cópia literal de `CODE_PATTERN` no `pr-gate.yml`, e o job `code`
// entra também em `SELECTED_JOBS` de `scripts/sdd/check-job-results.mjs`.

export const PATH_PATTERNS = {
    sdd: '^specs/|^scripts/sdd/|^test/sdd/|^docs/development-strategies/sdd/|^AGENTS\\.md$|^(package\\.json|yarn\\.lock)$|^\\.github/workflows/pr-gate\\.yml$',
    'root-docs':
        '^(AGENTS\\.md|CLAUDE\\.md|README\\.md|\\.prettierrc|docs/|specs/|\\.github/workflows/pr-gate\\.yml$)',
    // Testes dos próprios gates: hook local, auditor de dependências e workflows.
    tooling:
        '^scripts/(git-hooks|lib)/|^scripts/(audit-dependencies\\.mjs|dependency-audit-exceptions\\.json)$|^test/(gates|security)/|^\\.githooks/|^\\.github/workflows/|^(package\\.json|yarn\\.lock|\\.prettierrc|\\.node-version)$',
    // Código da aplicação (apps/, packages/), manifesto/lockfile, tsconfig*, config do ESLint e
    // o .env.example; `CODE_PATTERN` do gate (espelhado EXATAMENTE).
    code: '^apps/|^packages/|^(package\\.json|yarn\\.lock)$|^tsconfig[^/]*\\.json$|^eslint\\.config\\.[a-z]+$|^\\.env\\.example$',
    // Auditoria de dependências: só o que muda o veredito (manifesto, lockfile, auditor, exceções
    // e os workflows que a executam); `AUDIT_PATTERN` do gate.
    audit: '^(package\\.json|yarn\\.lock|scripts/audit-dependencies\\.mjs|scripts/dependency-audit-exceptions\\.json|scripts/lib/dependency-audit[a-z-]*\\.mjs)$|^\\.github/workflows/(pr-gate|dependency-audit)\\.yml$',
}

// Ordem de execução: leves primeiro, para falhar rápido; o escopo de código roda os gates da
// aplicação e a auditoria consulta o registry, por isso vêm por último.
export const ALL_SCOPES = ['sdd', 'root-docs', 'tooling', 'code', 'audit']

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

function stepsFor(scope, { changedFiles, exists, mode }) {
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
        case 'code': {
            // `static` roda a verificação rápida (typecheck + lint); `full` roda o conjunto
            // completo que o gate remoto executa (typecheck + lint + test + build).
            const script = mode === 'full' ? 'check:all' : 'check:static'
            return [
                {
                    id: 'code',
                    label: `Código: ${script === 'check:all' ? 'typecheck, lint, test e build' : 'typecheck e lint'} (yarn ${script})`,
                    cwd: '.',
                    command: yarn,
                    args: [script],
                },
            ]
        }
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
// `scopes` força os escopos quando o intervalo é desconhecido. `mode` escolhe a profundidade do
// escopo de código: `static` roda `yarn check:static` (typecheck + lint) e `full` roda
// `yarn check:all` (typecheck + lint + test + build); os demais escopos ignoram o modo.
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
        (scope) => stepsFor(scope, { changedFiles, exists, mode }),
    )
}
