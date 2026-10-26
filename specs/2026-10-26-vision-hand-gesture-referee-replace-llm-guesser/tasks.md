# Tarefas — 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.

## Fase 1 — Remoção do caminho do LLM (issue 63)

- [x] T001 [US-004] [FR-011] Remover `apps/server`, `packages/providers` e `packages/benchmark`, os workspaces e scripts correspondentes, o proxy do Vite e o `.env.example`, atualizar o lockfile e confirmar `yarn check:all` verde

## Fase 2 — Critério tipado da carta

- [x] T002 [US-002] [FR-001] [FR-002] Escrever testes falhando do schema da carta com `evaluation.criterion` (estrito, valores positivos, Acenar válido) e da fronteira de `toPublicCard` em `packages/core/test`
- [x] T003 [US-002] [FR-001] [FR-002] Confirmar a falha esperada com `yarn workspace @guess-my-move/core test`
- [x] T004 [US-002] [FR-001] [FR-002] Implementar o critério `hand-angle-oscillation` no schema, na carta Acenar e nos contratos
- [x] T005 [US-002] [FR-001] [FR-002] Confirmar os testes da carta passando

## Fase 3 — Ângulo e avaliador do gesto

- [x] T006 [US-002] [FR-003] Escrever testes falhando de `handAngleDeg` (cima, direita, esquerda, vetor degenerado) em `packages/core/test/gesture-angle.test.ts`
- [x] T007 [US-002] [FR-003] Implementar `handAngleDeg` em `packages/core/src/gesture/angle.ts` e confirmar verde
- [x] T008 [US-002] [FR-004] Escrever testes falhando de `evaluateOscillation` (janela, mínimo de amostras, histerese, lacunas, ruído abaixo da amplitude) em `packages/core/test/gesture-oscillation.test.ts`
- [x] T009 [US-002] [FR-004] Implementar `evaluateOscillation` em `packages/core/src/gesture/oscillation.ts` e confirmar verde
- [x] T010 [US-002] [FR-014] [SC-001] Gerar `packages/core/test/fixtures/clip-angles.json` com tempo e ângulo dos 12 clipes (apenas números) e escrever o teste de regressão 5 de 5 e 0 de 7 em `gesture-clips.test.ts`
- [x] T011 [US-002] [FR-004] [SC-001] Confirmar o teste dos clipes passando e refatorar mantendo verde

## Fase 4 — Máquina de estados da rodada

- [x] T012 [US-001] [FR-005] Escrever testes falhando da rodada (fluxo feliz, câmera negada, falha do detector, cancelamento, limite de 10 s, reconhecimento no primeiro instante, descarte de amostras) em `packages/core/test/round.test.ts`
- [x] T013 [US-001] [FR-005] Reescrever `packages/core/src/round` com `start`, `observe`, `tick`, `trackerFailed` e confirmar verde
- [x] T014 [US-004] [FR-011] Remover do core o árbitro semântico, o adivinhador, os schemas de palpite, os contratos de provedor e seus testes, e ajustar a API pública

## Fase 5 — Detector e ativos

- [x] T015 [FR-009] Escrever testes falhando de `prepare-assets` (hash correto reaproveita, hash errado falha, destino ausente baixa) em `apps/web/scripts/prepare-assets.test.mjs`
- [x] T016 [FR-009] Implementar `apps/web/scripts/prepare-assets.mjs`, ligar a `dev` e `build`, ignorar `public/mediapipe/` no Git, adicionar `@mediapipe/tasks-vision` 1.1.1 e confirmar verde
- [x] T017 [FR-007] Escrever testes falhando da fábrica do MediaPipe (GPU, recuo para CPU, `close`) com o módulo simulado em `apps/web/src/tracker`
- [x] T018 [FR-007] Implementar `HandTracker` e `createMediaPipeHandTracker` e confirmar verde

## Fase 6 — Tela da rodada

- [x] T019 [US-001] [FR-006] [FR-012] Escrever testes falhando de `GestureScreen` com `HandTracker` simulado (Começar habilitado só com câmera e detector, reconhecido, tempo esgotado, câmera negada, erro do detector, cancelar, nova rodada)
- [x] T020 [US-001] [FR-006] [FR-012] Implementar `useGestureRound` e `GestureScreen`, mover `CardView` e remover `guess/` e `capture/` do web, e confirmar verde
- [x] T021 [US-003] [FR-008] Escrever testes falhando de `HandOverlay` e `DebugPanel` (21 pontos desenhados, ângulo, inversões, amostras, latência mediana e p95, delegate)
- [x] T022 [US-003] [FR-008] Implementar `HandOverlay` e `DebugPanel` e confirmar verde
- [x] T023 [US-004] [FR-010] [NFR-005] Atualizar `App.tsx` e os textos de privacidade (processamento local), garantir regiões `aria-live` e rótulos, e confirmar verde
- [x] T024 [US-004] [FR-010] Buscar no código `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.` e persistência de imagem ou landmarks, e registrar o resultado

## Fase 7 — Documentação e catálogo

- [ ] T025 [FR-013] Reescrever `docs/product/PROJECT_SPEC.md` para o fluxo por visão computacional e remover as regras do fluxo por LLM
- [ ] T026 [FR-013] Atualizar `README.md`, `AGENTS.md`, `docs/development-context/` (arquitetura, qualidade, CI, desenvolvimento local, privacidade) e a configuração de lint e do hook para o novo desenho
- [ ] T027 [FR-013] Marcar as três specs substituídas como `superseded` com a seção `## Substituição`, atualizar `specs/README.md` e confirmar `yarn sdd:check`, `yarn test:sdd` e `yarn docs:format:check`

## Fase final — Convergência

- [ ] T028 [SC-004] [NFR-004] Executar no Chromium o app real com os 12 clipes como câmera simulada, inspecionar as requisições e registrar reconhecimento, falsos positivos, latência e delegate
- [ ] T029 [SC-005] [NFR-006] Executar `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check` e `yarn test:gates` e registrar `validation.md`
- [ ] T030 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop (tentativas, reconhecimentos, falsos positivos, latência) e reconciliar spec, plano, tarefas, implementação e evidências

## Cobertura

| Requisito | Tarefas          | Evidência esperada                                     |
| --------- | ---------------- | ------------------------------------------------------ |
| FR-001    | T002, T004       | `card.test.ts`, `schemas.test.ts`                      |
| FR-002    | T002, T004       | `schemas.test.ts`                                      |
| FR-003    | T006, T007       | `gesture-angle.test.ts`                                |
| FR-004    | T008, T009, T011 | `gesture-oscillation.test.ts`, `gesture-clips.test.ts` |
| FR-005    | T012, T013       | `round.test.ts`                                        |
| FR-006    | T019, T020       | `GestureScreen.test.tsx`                               |
| FR-007    | T017, T018       | `mediapipeTracker.test.ts`                             |
| FR-008    | T021, T022       | `HandOverlay.test.tsx`, `DebugPanel.test.tsx`          |
| FR-009    | T015, T016       | `prepare-assets.test.mjs`                              |
| FR-010    | T023, T024       | busca no código e inspeção de rede                     |
| FR-011    | T001, T014       | `yarn check:all`, busca por referências                |
| FR-012    | T019, T020       | `GestureScreen.test.tsx`                               |
| FR-013    | T025, T026, T027 | `yarn docs:format:check`, `yarn sdd:check`             |
| FR-014    | T010             | `gesture-clips.test.ts`                                |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- T001 antes de tudo; as Fases 2 a 4 são sequenciais no `packages/core`; a Fase 5 pode começar depois de T005.
- As Fases 5 e 6 dependem do núcleo (Fases 2 a 4); T025 a T027 podem andar em paralelo com a Fase 6.
- T028 depende de T022; T029 e T030 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação do maintainer wezercarvalho
- **Data:** `2026-10-26`
- **Lacunas:** nenhuma. Todos os FR têm tarefa formal; SC-001 a SC-005 e NFR-002, NFR-004 a NFR-006 têm tarefa de evidência; NFR-001 e NFR-003 são cobertos pela redação dos documentos e pela ausência de DOM nos testes do núcleo.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-26`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-26 ("os gates podem ser considerados já aprovados") e issue 63 do repositório.
- **Exceções:** nenhuma
