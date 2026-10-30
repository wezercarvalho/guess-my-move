# Tarefas — 2026-10-30-game-guitar-build-air-chords-poc

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Issues: #96 menu, #97 modelo, #98 dedos, #99 conferência, #100 batida, #101 som, #102 tela, #103 lição, #104 ajuste e depuração; iniciativa #95.

## Fase 1 — Setup e fundações

- [x] T001 [FR-004] Criar o pacote `packages/guitar` (package.json, tsconfig, vitest) no molde de `packages/swing` e registrá-lo nos workspaces
- [x] T002 [FR-004] Confirmar `yarn install --immutable`, `yarn workspace @guess-my-move/guitar typecheck` e o teste de fumaça do pacote

## Fase 2 — Menu e página (#96)

- [x] T003 [US-001] [FR-003] Escrever teste falhando do componente `Badge` em `apps/web/src/design/Badge.test.tsx`
- [x] T004 [US-001] [FR-003] Implementar `Badge` e seus estilos com tokens em `apps/web/src/design`
- [x] T005 [US-001] [FR-001] Escrever teste falhando do menu com quatro cards e o selo em `apps/web/src/home/HomePage.test.tsx`
- [x] T006 [US-001] [FR-001] Implementar o card do Violão no Ar em `HomePage.tsx`
- [x] T007 [US-001] [FR-002] Escrever teste falhando de `guitar.html` e da entrada do Vite em `apps/web/scripts/pages.test.mjs`
- [x] T008 [US-001] [FR-002] Criar `apps/web/guitar.html`, a entrada no Vite e o ponto de montagem provisório

## Fase 3 — Modelo do braço e acordes (#97)

- [x] T009 [US-002] [FR-004] Escrever testes falhando de tríade, afinação e ordem de ensino em `packages/guitar/test/chords.test.ts`
- [x] T010 [US-002] [FR-004] Implementar `theory.ts`, `chords.ts` e `index.ts`
- [x] T011 [US-002] [FR-005] Escrever testes falhando das casas (regra dos 12 semitons), zonas de corda e casa, e posicionamento em `packages/guitar/test/board.test.ts`
- [x] T012 [US-002] [FR-005] Implementar `board.ts`

## Fase 4 — Mãos e dedos (#98)

- [x] T013 [US-002] [FR-007] Escrever testes falhando do filtro One Euro em `packages/guitar/test/oneEuro.test.ts` e implementar `oneEuro.ts`
- [x] T014 [US-002] [FR-006] Escrever testes falhando dos papéis das mãos (lado da tela, rótulo ausente, canhoto, uma mão) em `packages/guitar/test/hands.test.ts`
- [x] T015 [US-002] [FR-006] Implementar `hands.ts`
- [x] T016 [US-002] [FR-007] Escrever testes falhando de permanência, histerese, polegar, fora do braço e tolerância em `packages/guitar/test/fingers.test.ts`
- [x] T017 [US-002] [FR-007] Implementar `fingers.ts`

## Fase 5 — Conferência do acorde (#99)

- [x] T018 [US-002] [FR-008] [FR-009] Escrever testes falhando dos cenários de US-002 (certo, falta dedo, dedo errado, abafada, casa mais alta) em `packages/guitar/test/evaluate.test.ts`
- [x] T019 [US-002] [FR-008] [FR-009] Implementar `evaluate.ts` (estado por corda, correção única e cordas soando)
- [x] T020 [US-002] [FR-010] Escrever testes iniciais de estabilidade no tempo; comportamento substituído por `ChordRecognition` em T043

## Fase 6 — Batida (#100)

- [x] T021 [US-003] [FR-011] Escrever testes falhando da batida (direção, força, escala 2x, limiar, zona, refratário, salto, reinício) em `packages/guitar/test/strum.test.ts`
- [x] T022 [US-003] [FR-011] Implementar `strum.ts`

## Fase 7 — Som (#101)

- [x] T023 [US-003] [FR-012] Escrever testes falhando da síntese (fundamental a 1%, decaimento, determinismo) em `packages/guitar/test/synth.test.ts`
- [x] T024 [US-003] [FR-012] Implementar `synth.ts`
- [x] T025 [US-003] [FR-013] Escrever testes falhando do plano da batida (ordem, atraso, ganho, abafadas, formato errado) e implementar `strumPlan.ts`
- [x] T026 [US-003] [FR-014] Escrever testes falhando do tocador com `AudioContext` simulado (bloqueado, desbloqueio, agendamento) em `apps/web/src/guitar/audioPlayer.test.ts`
- [x] T027 [US-003] [FR-014] Implementar `audioPlayer.ts`

## Fase 8 — Tela (#102)

- [x] T028 [US-002] [FR-015] Escrever testes falhando do controlador com rastreador falso (mãos, acorde certo, batida, câmera negada) em `apps/web/src/guitar/guitarController.test.ts`
- [x] T029 [US-002] [FR-015] Implementar `guitarController.ts`, `useGuitarGame.ts` e `boardOverlay.ts`
- [x] T030 [US-002] [FR-015] [NFR-001] Escrever testes falhando da tela (braço, status de uma linha, privacidade, canhoto, câmera negada) em `apps/web/src/guitar/GuitarScreen.test.tsx`
- [x] T031 [US-002] [FR-015] Implementar `GuitarScreen.tsx`, `main.tsx` e `guitar.css`
- [x] T032 [US-002] [SC-002] Demonstrar com o teste de fumaça de câmera, reconhecimento, batida e som

## Fase 9 — Lição guiada (#103)

- [x] T033 [US-004] [FR-016] Escrever testes falhando do guia, das dicas e do progresso em `apps/web/src/guitar/guide.test.ts`
- [x] T034 [US-004] [FR-016] Implementar `guide.ts`
- [x] T035 [US-004] [FR-016] [NFR-005] Escrever testes falhando do diagrama e implementar `ChordDiagram.tsx`; seleção removida em T044

## Fase 10 — Ajuste, depuração e teclado (#104)

- [x] T036 [US-005] [FR-017] Escrever testes falhando do ajuste do braço, da gaveta de depuração, do teclado e do clique
- [x] T037 [US-005] [FR-017] Implementar `GuitarDebugPanel.tsx`, o ajuste do braço e o teclado e o clique no controlador

## Fase final — Convergência

- [x] T038 [NFR-001] [NFR-002] Escrever e executar o teste de varredura: sem rede, sem arquivo de áudio e sem registro de imagem em `apps/web/src/guitar` e `packages/guitar`
- [x] T039 [SC-001] Atualizar README, guia de arquitetura e catálogo `specs/README.md`
- [x] T040 [SC-001] [SC-002] [SC-003] Executar `yarn check:all`, `yarn sdd:check`, `yarn docs:format:check` e `yarn test:gates`, capturar a tela no Chromium e registrar `validation.md`
- [x] T041 [SC-001] Reconciliar spec, plano, tarefas, implementação e evidências

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                  |
| --------- | ---------------------- | --------------------------------------------------- |
| FR-001    | T005, T006             | `HomePage.test.tsx`                                 |
| FR-002    | T007, T008             | `pages.test.mjs`                                    |
| FR-003    | T003, T004             | `Badge.test.tsx`                                    |
| FR-004    | T001, T002, T009, T010 | `chords.test.ts`                                    |
| FR-005    | T011, T012             | `board.test.ts`                                     |
| FR-006    | T014, T015             | `hands.test.ts`                                     |
| FR-007    | T013, T016, T017       | `oneEuro.test.ts`, `fingers.test.ts`                |
| FR-008    | T018, T019             | `evaluate.test.ts`                                  |
| FR-009    | T018, T019             | `evaluate.test.ts`                                  |
| FR-010    | T020                   | `evaluate.test.ts` (estabilidade)                   |
| FR-011    | T021, T022             | `strum.test.ts`                                     |
| FR-012    | T023, T024             | `synth.test.ts`                                     |
| FR-013    | T025                   | `strumPlan.test.ts`                                 |
| FR-014    | T026, T027             | `audioPlayer.test.ts`                               |
| FR-015    | T028, T029, T030, T031 | `guitarController.test.ts`, `GuitarScreen.test.tsx` |
| FR-016    | T033, T034, T035       | `guide.test.ts`, `ChordDiagram.test.tsx`            |
| FR-017    | T036, T037             | testes do controlador e da gaveta                   |
| NFR-001   | T030, T038             | teste de varredura                                  |
| NFR-002   | T038                   | teste de varredura                                  |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Ordem: T001 e T002; T003 a T008 (independente); T009 a T012; T013 a T017 dependem de T011; T018 a T020 dependem de T010 e T017; T021 e T022 independentes dos acordes; T023 a T027 dependem de T010 e T019; T028 a T032 dependem de todas as anteriores; T033 a T037 dependem de T031; a fase final fecha.
- Nada marcado `[P]`: o ambiente tem 2 núcleos e pouca memória, e as tarefas são executadas em série.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente)
- **Data:** `2026-10-30`
- **Lacunas:** nenhuma. Cada FR tem tarefa formal; as hipóteses H-01 a H-04 e os parâmetros iniciais ficam declarados e dependem do teste ao vivo; a decisão sobre dedos extras (CQ-003) está refletida em FR-008 e na issue #95.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** pedido do maintainer na sessão do dashboard em 2026-10-30 (06:16 UTC): "Após isso pode desenvolver elas e me entrega um PR em draft consolidado no final para que eu teste."; issues 95 a 104 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada **inferida** do pedido de desenvolver depois das issues prontas, não de uma frase de aprovação dos gates. O Gate 3 segue para o maintainer, após o teste ao vivo; o agente não o concede.

## Fase 11 — Revisão após o primeiro teste ao vivo (#95)

- [x] T042 [US-002] [FR-008] Pesquisar proporção real do braço e reconhecimento por posição sem seleção prévia
- [x] T043 [US-002] [FR-008, FR-010] Escrever testes falhando dos cinco formatos, independência do dedo, forma extra e troca estável
- [x] T044 [US-002] [FR-008, FR-010, FR-016] Implementar `recognizeChord`, `ChordRecognition` e remover a seleção de acorde da tela e do overlay
- [x] T045 [US-003] [FR-011] Escrever a regressão de jitter e exigir deslocamento acumulado para reconhecer a batida
- [x] T046 [US-004] [FR-015, FR-017] Reduzir o braço para 18% da altura, ampliar a câmera e mover os painéis para baixo
- [x] T047 [SC-002] Atualizar documentação, rodar testes direcionados e inspecionar a tela com câmera sintética no Chromium
