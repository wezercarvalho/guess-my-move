# Desenvolvimento local

## Requisitos

- Node.js 24.18 ou superior (`.node-version`) e Yarn 1.22 via Corepack (`corepack enable`).
- Instalação das dependências na raiz: `yarn install --frozen-lockfile` instala a raiz e todos os workspaces (`apps/web`, `apps/server`, `packages/core`) de uma vez.

## Verificações locais antes do push

O repositório não tem workflow de CI por `push` em branches de trabalho; quem faz a verificação rápida é o hook de Git `.githooks/pre-push`, um launcher `sh` que chama `node scripts/git-hooks/pre-push.mjs`. Ele usa só Node e Git e não adiciona dependência. O `AGENTS.md` manda instalá-lo antes do primeiro push.

**Instalação.** Na raiz, uma vez por clone: `node scripts/git-hooks/install.mjs`. O comando configura `core.hooksPath` para `.githooks` e é idempotente.

**O que o hook roda.** Ele calcula os arquivos do intervalo enviado (em branch nova, contra o merge-base com `origin/main`) e roda, por escopo afetado, os mesmos comandos do `pr-gate`, na ordem:

1. `sdd`: `yarn test:sdd` e `yarn sdd:check` (como os passos do job de governança `sdd`);
2. `root-docs`: `yarn docs:format:check`, Prettier com o estilo de `/.prettierrc` em `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` e `specs/`;
3. `tooling`: `yarn test:gates`, testes do hook, do auditor e dos workflows;
4. `code`: `yarn check:static` (typecheck + lint) por padrão, ou `yarn check:all` (typecheck + lint + test + build) no `--mode full`, quando o PR toca `apps/`, `packages/`, manifesto/lockfile, `tsconfig*.json`, `eslint.config.*` ou `.env.example`;
5. `audit`: `yarn security:dependencies`, se os arquivos casarem o padrão de auditoria do `pr-gate`.

Um push sem arquivos nesses escopos termina em segundos, sem rodar nada. Falha em qualquer passo barra o push, com a mensagem do passo. O gate remoto roda sempre o `yarn check:all` do escopo de código; o hook roda `check:static` por padrão para falhar rápido.

**Auditoria de dependências.** Ela roda na sua máquina, não consome minutos de Actions e usa rede (consulta o registry). Vulnerabilidade High ou Critical barra o push e a saída do auditor aparece. Se o registry ou a rede falhar, o auditor imprime `registry-indisponivel` e diz que o problema não é vulnerabilidade: o hook só avisa, não barra, e informa que o `pr-gate` fará a verificação. A política está em [auditoria de dependências](../security/dependency-audit.md).

**Requisito.** As dependências precisam estar instaladas. Sem `node_modules`, o hook barra o push e informa o comando (`yarn install --frozen-lockfile`).

**Sob demanda.** `node scripts/git-hooks/local-checks.mjs` roda o mesmo núcleo do hook para o que mudou em relação ao merge-base com `origin/main` mais o working tree. Aceita `--mode static|full` (o escopo de código roda `yarn check:static` em `static` e `yarn check:all` em `full`) e `--files <arquivos>`.

**Contorno.** `git push --no-verify` ignora o hook. Ele é opcional por natureza: o `pr-gate` remoto continua valendo e barra o merge se falhar.

**O que só o CI cobre.** O `pr-gate / gate` como decisão de merge e a rotina quinzenal de auditoria na `main`. Para o desenho completo, ver [Pipeline de CI](../delivery/ci-pipeline.md#o-que-roda-onde).

## Scripts de governança

| Script                       | O que faz                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `yarn sdd:check`             | Verificação estrutural do catálogo de specs, estados, gates e links.           |
| `yarn test:sdd`              | Testes do checker do SDD e da consolidação de resultados do gate.              |
| `yarn docs:format:check`     | Prettier `--check` nos documentos da raiz.                                     |
| `yarn docs:format:fix`       | Prettier `--write` nos mesmos documentos (escreve arquivos; nunca roda no CI). |
| `yarn test:gates`            | Testes do hook, do auditor de dependências e da estrutura dos workflows.       |
| `yarn security:dependencies` | Auditoria de dependências (usa rede).                                          |
