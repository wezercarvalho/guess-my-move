# Tarefas — 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- A coluna "Issue" liga cada incremento ao item de trabalho no GitHub.

## Fase 1 — Yarn 4 (issue #43)

- [x] T001 [US-001] [FR-001] Declarar `packageManager: yarn@4.18.1` e `.yarnrc.yml` com `nodeLinker: node-modules` (issue #43)
- [x] T002 [US-001] [FR-001] Regenerar o lockfile preservando as versões resolvidas e garantir `yarn install --immutable` reproduzível (issue #43)
- [x] T003 [US-001] [FR-002] Migrar os scripts raiz para `yarn workspaces foreach --all --topological` (issue #43)
- [x] T004 [US-001] [FR-002] Declarar os peers de vitest (`vite`) explicitamente nos workspaces (issue #43)
- [x] T005 [US-002] [FR-003] Implementar o auditor em duas execuções (`--environment production` e `development`) com a mesma política e aviso de registry no hook (issue #43)
- [x] T006 [US-002] [FR-003] Escrever/ajustar os testes do auditor cobrindo advisories e `registry-indisponivel` (issue #43)
- [x] T007 [FR-004] Atualizar `pr-gate`, `dependency-audit` e hook com `corepack enable` antes do `setup-node` e `cache: yarn` (issue #43)
- [x] T008 [FR-004] Ajustar os testes de workflows e gate/hook para o Yarn 4 (issue #43)
- [x] T009 [NFR-001] Documentar CI, execução local e auditoria com Yarn 4 e adicionar o `.gitignore` do Yarn 4 (issue #43)

## Fase 2 — Oxlint e TypeScript 7 (issue #45)

- [x] T010 [US-003] [FR-005] Adicionar Oxlint + `oxlint-tsgolint` (type-aware) e remover ESLint e `typescript-eslint` (issue #45)
- [x] T011 [US-003] [FR-005] Documentar a paridade das regras (`recommendedTypeChecked`, react-hooks, react-refresh) e listar regras sem equivalente (issue #45)
- [x] T012 [US-004] [FR-006] Executar o spike de decorators do NestJS no build do servidor e registrar a estratégia escolhida na clarificação (issue #45)
- [x] T013 [US-004] [FR-006] Comprovar `GET /api/health` 200 no servidor compilado ou acionar o plano B mantendo `typescript` 6.0.3 e registrando o bloqueio (issue #45)
- [x] T014 [NFR-003] Medir e registrar o tempo de typecheck+lint antes e depois (SC-005) (issue #45)

## Fase 3 — Node 26 (issue #46)

- [ ] T015 [US-004] [FR-007] Definir Node 26 em `.node-version` e `engines` e atualizar a documentação (issue #46)
- [ ] T016 [FR-007] Ajustar o CI para instalar a versão de `.node-version` e instalar o Corepack explicitamente se o Node 26 não o distribuir (issue #46)

## Fase final — Convergência

- [ ] T017 [NFR-003] Executar os gates oficiais (`check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check`) e registrar os resultados (issue #46)
- [ ] T018 [NFR-002] Reconciliar spec, plano, tarefas, implementação e evidências sem alterar o comportamento da aplicação (issue #46)

## Cobertura

| Requisito | Tarefas    | Evidência esperada                  |
| --------- | ---------- | ----------------------------------- |
| FR-001    | T001, T002 | `yarn install --immutable` (SC-001) |
| FR-002    | T003, T004 | `yarn check:all` (SC-002)           |
| FR-003    | T005, T006 | Testes de auditoria (SC-003)        |
| FR-004    | T007, T008 | Testes de workflows + hook          |
| FR-005    | T010, T011 | Lint no TS 7 + doc de paridade      |
| FR-006    | T012, T013 | `GET /api/health` 200 (SC-004)      |
| FR-007    | T015, T016 | CI instala de `.node-version`       |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Ordem das PRs empilhadas: #43 (Yarn 4) → validação Zod (outra spec) → #45 (Oxlint/TS7) → #46 (Node 26).
- O spike do servidor (#45) condiciona a adoção do TypeScript 7 ou o plano B.
- O merge do Node 26 (#46) ocorre a partir de 2026-10-28 (LTS).

## Análise de consistência

- **Status:** aprovada
- **Revisor:** wezercarvalho
- **Data:** `2026-10-21`
- **Lacunas:** nenhuma — cada FR tem ao menos uma tarefa formal; objetivos, fora de escopo, histórias, requisitos e critérios convergem entre `spec.md`, `clarification.md`, `plan.md` e este arquivo, e com os critérios das issues #43, #45 e #46.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `plan.md`, `tasks.md`
- **Referência:** instrução explícita do mantenedor na sessão de 2026-10-21 (gates 1 e 2 aprovados para as issues #43, #45 e #46).
- **Exceções:** documentação de CI/auditoria (T009) validada por revisão estrutural em vez de teste unitário, conforme o guia de tarefas e o plano.
