# Plano — 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26

## Resumo técnico

Modernizar a toolchain em PRs empilhadas: primeiro Yarn 4.18.1 via Corepack com `nodeLinker: node-modules`, scripts `foreach` e auditoria em duas execuções; depois Oxlint + `oxlint-tsgolint` sobre o TypeScript 7 removendo ESLint/`typescript-eslint`, com spike de decorators do NestJS; por fim Node 26 em `.node-version`, `engines`, CI e docs, a partir do LTS. Dependências exatas, gates oficiais verdes e comportamento da aplicação preservado.

## Contexto técnico

- **Runtime/versões:** Node 26 (de `.node-version`), Corepack, Yarn 4.18.1, TypeScript 7 com Oxlint + `oxlint-tsgolint`. Versões exatas reconfirmadas na implementação.
- **Dependências:** Yarn 4.18.1 (packageManager); Oxlint e `oxlint-tsgolint` substituem ESLint, `@eslint/js`, `typescript-eslint`; `vite` como peer explícito; TypeScript 7 no lugar do 6.0.3 se o spike aprovar.
- **Provedores externos:** nenhum.
- **Persistência:** nenhuma.
- **Testes:** gates oficiais `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`; spike do servidor valida `GET /api/health` 200.
- **Restrições:** não alterar comportamento da aplicação (NFR-002); versões exatas e auditoria verde (NFR-001); gates verdes (NFR-003).

## Constitution Check — pré-design

| Princípio/gate                     | Resultado | Evidência ou exceção                                                      |
| ---------------------------------- | --------- | ------------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | `spec.md` em `clarified` com Gate 1 aprovado antes deste plano.           |
| II. Uma fonte vigente              | PASS      | Comportamento em `spec.md`; `clarification.md` como log auditável.        |
| III. Rastreabilidade               | PASS      | FR/NFR/SC com IDs estáveis; mapeamento requisito → abordagem → evidência. |
| IV. Test-first e incremental       | PASS      | Mudanças validadas por gates e testes de auditoria/CI antes de concluir.  |
| V. Evidência honesta               | PASS      | Spike do servidor com plano B explícito; sem acerto otimista.             |
| VIII. Clareza e operação segura    | PASS      | UTF-8/português; sem operação destrutiva; PRs empilhadas revisáveis.      |

A seção contém `PASS` em todas as linhas e nenhum `FAIL`.

## Pesquisa e decisões

- `research.md` — não necessária: os requisitos vêm dos critérios das issues #43, #45 e #46; decisões registradas em `clarification.md`.

## Estrutura afetada

```text
package.json             # packageManager, engines, scripts foreach, devDependencies
.yarnrc.yml              # nodeLinker: node-modules
yarn.lock                # regenerado preservando versões resolvidas
.node-version            # Node 26
tsconfig.base.json       # TypeScript 7 e decorators do servidor
scripts/                 # auditor em duas execuções por ambiente
test/                    # testes de auditoria, workflows e gate/hook
.github/workflows/       # corepack antes de setup-node, cache: yarn
apps/, packages/         # peers de vitest e build do servidor
```

## Design

### Componentes e responsabilidades

- **Yarn 4 / Corepack:** `packageManager` fixo, `.yarnrc.yml` com node-modules, `yarn install --immutable` reproduzível, scripts raiz via `foreach --all --topological`.
- **Auditor:** `yarn npm audit` em produção e desenvolvimento, política High/Critical, exceções com validade, falha de registry só avisa no hook.
- **Lint/typecheck:** Oxlint + `oxlint-tsgolint` type-aware sobre o TypeScript 7, sem ESLint; paridade documentada e regras sem equivalente listadas.
- **Build do servidor:** spike comprova decorators do NestJS no TypeScript 7; plano B mantém `typescript` 6.0.3.
- **Node 26:** `.node-version`, `engines`, CI e docs; Corepack explícito se não empacotado.

### Contratos e dados

- Scripts raiz mantêm os nomes dos gates (`check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check`, `security:dependencies`).
- Auditor expõe os códigos de saída `0` (sem advisories), `1` com `registry-indisponivel` (registry inacessível) e falha em High/Critical.
- `GET /api/health` responde 200 com o servidor compilado.

### Fluxo

PR 1 (Yarn 4) → PR 2 (validação Zod, outra spec) → PR 3 (Oxlint/TS7 com spike do servidor) → PR 4 (Node 26, a partir do LTS). Cada PR só avança com os gates aplicáveis verdes; o spike do servidor define a adoção do TypeScript 7 ou o plano B.

## Mapeamento de requisitos

| Requisito | Abordagem                                              | Evidência planejada                 |
| --------- | ------------------------------------------------------ | ----------------------------------- |
| FR-001    | packageManager, `.yarnrc.yml`, lockfile, `--immutable` | `yarn install --immutable` (SC-001) |
| FR-002    | Scripts `foreach` e peers `vite` explícitos            | `yarn check:all` (SC-002)           |
| FR-003    | Auditor em duas execuções por ambiente                 | Testes de auditoria (SC-003)        |
| FR-004    | Workflows com corepack antes de setup-node             | Testes de workflows + hook          |
| FR-005    | Oxlint + tsgolint sem ESLint, paridade documentada     | Lint no TS 7 + doc de paridade      |
| FR-006    | Spike de decorators do NestJS no build do servidor     | `GET /api/health` 200 (SC-004)      |
| FR-007    | Node 26 em `.node-version`, engines, CI e docs         | CI instala de `.node-version`       |

## Estratégia test-first

1. Escrever/ajustar os testes de auditoria e de workflows esperando o comportamento do Yarn 4 e confirmar a falha com o comando oficial;
2. Aplicar a mudança mínima (packageManager, `.yarnrc.yml`, scripts, workflows);
3. Confirmar os testes direcionados passando;
4. Integrar com os gates oficiais (`check:all`, `test:gates`, `test:sdd`);
5. Demonstrar os critérios (SC-001..SC-004) e medir SC-005;
6. Refatorar mantendo os gates verdes. A documentação de CI/local/auditoria usa revisão estrutural, exceção prevista no guia de tarefas.

## Riscos, rollout e rollback

| Risco                                             | Mitigação                                             | Rollback/contingência                          |
| ------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Decorators do NestJS falham no TypeScript 7       | Spike dedicado com `GET /api/health`                  | Plano B: manter `typescript` 6.0.3             |
| Corepack ausente no Node 26                       | Instalar Corepack explicitamente no CI e nas docs     | Fixar versão do Corepack na instalação         |
| Regra de lint sem equivalente no Oxlint           | Documentar paridade e lista de regras sem equivalente | Registrar lacuna sem remover regra em silêncio |
| Lockfile alterado por instalação não reproduzível | `yarn install --immutable` nos gates                  | Reverter para o lockfile regenerado anterior   |

## Constitution Check — pós-design

| Princípio/gate                     | Resultado | Evidência ou exceção                                                 |
| ---------------------------------- | --------- | -------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | Design converge com `spec.md`; nenhuma decisão nova fora da spec.    |
| II. Uma fonte vigente              | PASS      | Abordagem referencia FR por ID; sem spec concorrente.                |
| III. Rastreabilidade               | PASS      | Todo FR tem abordagem e evidência na tabela.                         |
| IV. Test-first e incremental       | PASS      | PRs empilhadas com gates por frente; doc com revisão estrutural.     |
| V. Evidência honesta               | PASS      | Spike comprova decorators; plano B registrado sem acerto otimista.   |
| VIII. Clareza e operação segura    | PASS      | Sem operação destrutiva; mudança sem efeito no comportamento da app. |

## Complexidade e desvios

| Necessidade                              | Impacto | Alternativa mais simples rejeitada | Aprovação                                    |
| ---------------------------------------- | ------- | ---------------------------------- | -------------------------------------------- |
| Documentação de CI/auditoria via revisão | baixo   | Teste unitário de documentação     | Prevista no guia de tarefas; Gate 2 registra |
