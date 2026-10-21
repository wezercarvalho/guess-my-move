# Tarefas — 2026-10-21-backend-api-validation-centralize-zod-nestjs12

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- A coluna "Issue" liga cada incremento ao item de trabalho no GitHub.

## Fase 1 — Schemas no núcleo (issue #44)

- [x] T001 [US-001] [FR-001] Escrever os testes de schema (frame, requisição, resposta, erro, carta) em `packages/core/test/schemas.test.ts` (issue #44)
- [x] T002 [US-001] [FR-001] [FR-002] Implementar os schemas em `packages/core/src/schemas/` (`builders.ts`, `card.ts`, `guess.ts`) com `zod/mini`, objetos estritos e `exactOptional`, derivando os tipos por `z.infer` (issue #44)
- [x] T003 [US-002] [FR-003] Implementar `checkGuessLimits` e os tipos de limite em `packages/core/src/schemas/guess.ts` (issue #44)
- [x] T004 [US-001] [FR-007] Reescrever `validateCard`/`isCard`/`parseCard` sobre o `cardSchema` mantendo a API pública e as mensagens em português (issue #44)

## Fase 2 — Validação no servidor (issue #44)

- [x] T005 [US-002] [FR-003] Escrever os testes do pipe em `apps/server/test/guess-request.pipe.test.ts` (issue #44)
- [x] T006 [US-002] [FR-003] Implementar o `GuessRequestPipe` estendendo o `StandardSchemaValidationPipe`, com `guessRequestSchema` e `checkGuessLimits` (issue #44)
- [x] T007 [US-002] [FR-004] Implementar `guessLimitsFromConfig` e `jsonBodyLimitBytes` em `apps/server/src/guess/limits.ts` (issue #44)
- [x] T008 [US-002] [FR-004] Centralizar o parser JSON e o filtro de erro em `configureHttp` (`app.setup.ts`), consumido por `main.ts` e pelos testes (issue #44)
- [x] T009 [US-003] [FR-005] Escrever os testes de ambiente em `apps/server/test/environment.test.ts` (issue #44)
- [x] T010 [US-003] [FR-005] Validar as variáveis de ambiente com schema Zod no `validationSchema` do `@nestjs/config`, preservando os padrões e tratando vazio como ausente (issue #44)

## Fase 3 — Cliente e remoção do legado (issue #44)

- [x] T011 [US-002] [FR-006] Validar resposta (`guessResponseSchema`) e erro (`apiErrorSchema`) no cliente web, mapeando resposta fora do contrato para `invalid_model_response` (issue #44)
- [x] T012 [FR-007] Remover `class-validator`, `class-transformer` e o parser manual `apps/server/src/guess/payload.ts` (issue #44)
- [x] T013 [NFR-002] Ajustar os chamadores do benchmark aos tipos mais estritos derivados dos schemas (issue #44)
- [x] T014 [NFR-001] Medir e registrar o crescimento do bundle (74,14 → 80,29 kB gzip) e a rejeição do Zod clássico (issue #44)

## Fase final — Convergência

- [x] T015 [US-002] [SC-002] [SC-003] Comprovar o fluxo HTTP e2e em `apps/server/test/http.e2e.test.ts` (corpo ~200 kB = 200; campo `card` = 400) (issue #44)
- [x] T016 [NFR-003] Reconciliar spec, plano, tarefas e implementação mantendo a API pública da rota e das cartas (issue #44)
- [x] T017 [SC-001] Documentar a arquitetura da validação centralizada (issue #44)
- [ ] T018 [SC-001] Registrar `validation.md` e o Gate 3 (decisão do mantenedor) (issue #44)

## Cobertura

| Requisito | Tarefas    | Evidência esperada                       |
| --------- | ---------- | ---------------------------------------- |
| FR-001    | T001, T002 | Testes de schema (SC-001)                |
| FR-002    | T002       | Campo extra = `invalid_payload` (SC-003) |
| FR-003    | T005, T006 | Testes de pipe (SC-001)                  |
| FR-004    | T007, T008 | Corpo ~200 kB = 200 (SC-002)             |
| FR-005    | T009, T010 | `PORT=abc` derruba o boot (SC-004)       |
| FR-006    | T011       | Teste do cliente web (SC-001)            |
| FR-007    | T004, T012 | Lockfile sem as libs (SC-005)            |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Ordem: schemas do núcleo (Fase 1) → validação no servidor (Fase 2) → cliente e remoção do legado (Fase 3) → convergência.
- Esta é a PR empilhada após o Yarn 4 (#43) e antes do Oxlint/TypeScript 7 (#45).
- T013 depende de T002 (tipos derivados); T012 depende de T010 (ambiente já sobre Zod).

## Análise de consistência

- **Status:** aprovada
- **Revisor:** wezercarvalho
- **Data:** `2026-10-21`
- **Lacunas:** nenhuma — cada FR tem ao menos uma tarefa formal; objetivos, fora de escopo, histórias, requisitos e critérios convergem entre `spec.md`, `clarification.md`, `plan.md` e este arquivo, e com os critérios da issue #44.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `plan.md`, `tasks.md`
- **Referência:** instrução explícita do mantenedor na sessão de 2026-10-21 (gates 1 e 2 aprovados para a issue #44).
- **Exceções:** o registro de `validation.md` e o Gate 3 permanecem com o mantenedor (T018 aberta).
