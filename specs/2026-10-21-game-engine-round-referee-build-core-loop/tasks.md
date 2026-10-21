# Tarefas — 2026-10-21-game-engine-round-referee-build-core-loop

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- A coluna "Issue" liga cada incremento ao item de trabalho no GitHub.

## Fase 1 — Setup do pacote

- [x] T001 [FR-001] Criar o pacote `packages/core` TypeScript puro (sem framework, sem I/O) com Vitest e scripts de build/test (issue #11)

## Fase 2 — Carta e fronteira (issue #11)

- [x] T002 [US-001] [FR-001] Escrever teste falhando de `Card = { id, locale, public, evaluation }` com acesso separado em `packages/core/src/card` (issue #11)
- [x] T003 [US-001] [FR-002] Implementar o schema da carta, validação e a carta Acenar em JSON/TypeScript (issue #11)
- [x] T004 [US-001] [FR-003] Escrever teste de fronteira que falha se `evaluation` cruzar o caminho do adivinhador (issue #11)
- [x] T005 [US-001] [FR-003] Implementar a separação que mantém `evaluation` fora do adivinhador e confirmar os testes verdes (issue #11)

## Fase 3 — Árbitro semântico determinístico (issue #13)

- [x] T006 [US-003] [FR-007] Escrever teste falhando de normalização (minúsculas, acentos, pontuação, variantes triviais) em `packages/core/src/referee` (issue #13)
- [x] T007 [US-003] [FR-008] Escrever teste falhando dos casos `dar tchau` (alias), `acenar`/`waving` (aceitos) e ausência de substring (issue #13)
- [x] T008 [US-003] [FR-008] Implementar a comparação por equivalência devolvendo `{ isCorrect, method, matchedAnswer? }` (issue #13)
- [x] T009 [US-003] [FR-009] Implementar rejeição de insuficientes (`levantar a mão`) e `undetermined` em dúvida material (issue #13)

## Fase 4 — Fallback opcional por LLM (issue #14)

- [x] T010 [US-003] [FR-010] Escrever teste falhando da interface injetável de fallback desligada por padrão → `undetermined` (issue #14)
- [x] T011 [US-003] [FR-010] Implementar a interface injetável e a política conservadora (erro/dúvida → `undetermined`, nunca acerto inventado) (issue #14)
- [x] T012 [US-003] [FR-011] Registrar método e motivo resumido do veredito, inclusive quando o fallback é usado (issue #14)

## Fase 5 — Máquina de estados da rodada (issue #12)

- [x] T013 [US-002] [FR-004] Escrever teste falhando das transições `idle → ... → (correct | retry | finished)` em `packages/core/src/round` (issue #12)
- [x] T014 [US-002] [FR-004] Implementar a máquina de estados com transições explícitas (issue #12)
- [x] T015 [US-002] [FR-005] Implementar limites configuráveis de tentativas e tempo por rodada (issue #12)
- [x] T016 [US-002] [FR-006] Implementar os estados de exceção sem marcar acerto indevido e com estado íntegro após erro de provedor (issue #12)

## Fase 6 — Histórico de rejeitados e documentação (issue #15)

- [ ] T017 [US-004] [FR-012] Escrever teste falhando de `rejectedGuesses` contendo só palpites do modelo, sem dado da carta, descartado ao fim da rodada (issue #15)
- [ ] T018 [US-004] [FR-012] Implementar a montagem de `rejectedGuesses` a partir do histórico em memória (issue #15)
- [ ] T019 [US-004] [FR-013] Atualizar o README com instalação, modos mock e real, testes e privacidade para execução por terceiros (issue #15)

## Fase final — Convergência

- [ ] T020 [FR-003] Revisar o tratamento de erros ponta a ponta e reconciliar com a spec da PoC (issue #15)
- [ ] T021 [SC-001] Executar os gates oficiais e registrar `validation.md` com comandos e resultados reais (issue #13)
- [ ] T022 [SC-003] Reconciliar spec, plano, tarefas, implementação e evidências do núcleo (issue #12)

## Cobertura

| Requisito | Tarefas          | Evidência esperada               |
| --------- | ---------------- | -------------------------------- |
| FR-001    | T001, T002       | Teste de schema + carta Acenar   |
| FR-002    | T003             | Teste de validação               |
| FR-003    | T004, T005, T020 | Teste de fronteira (SC-002)      |
| FR-004    | T013, T014       | Teste de transições (SC-003)     |
| FR-005    | T015             | Teste de limites                 |
| FR-006    | T016             | Teste de erro de provedor        |
| FR-007    | T006             | Teste de normalização            |
| FR-008    | T007, T008       | Teste de alias/canônico (SC-001) |
| FR-009    | T009             | Teste de insuficiente/dúvida     |
| FR-010    | T010, T011       | Teste de fallback off/on         |
| FR-011    | T012             | Teste de registro                |
| FR-012    | T017, T018       | Teste de histórico (SC-002)      |
| FR-013    | T019             | Revisão estrutural + SC-004      |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Ordem sugerida: #11 → #13 → #14 → #12 → #15.
- O árbitro (#13) e o fallback (#14) dependem da carta (#11); a máquina de estados (#12) consome árbitro e histórico; `rejectedGuesses` (#15) depende do motor.
- O contrato de fronteira (`GuesserInput`/`GuesserResult`) vem da spec da PoC; este núcleo não faz I/O.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** wezercarvalho
- **Data:** `2026-10-21`
- **Lacunas:** nenhuma — cada FR tem ao menos uma tarefa formal; objetivos, fora de escopo, histórias, requisitos e critérios de sucesso convergem entre `spec.md`, `clarification.md`, `plan.md` e este arquivo, e com os critérios das issues #11–#15.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `plan.md`, `tasks.md`
- **Referência:** instrução explícita do maintainer na sessão de 2026-10-21 ("considere todos os gates aprovados" para as issues existentes).
- **Exceções:** documentação (FR-013) validada por revisão estrutural em vez de teste unitário, conforme o guia de tarefas e o plano.
