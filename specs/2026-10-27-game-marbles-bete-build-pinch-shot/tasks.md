# Tarefas — 2026-10-27-game-marbles-bete-build-pinch-shot

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.

## Fase 0 — Fundações

- [x] T001 [FR-010] Criar o pacote `packages/marbles` (`package.json` com `@guess-my-move/marbles`, `tsconfig.json`, `vitest.config.ts`), registrar o workspace em `package.json` e atualizar o `yarn.lock`
- [x] T002 [FR-010] Adicionar a segunda entrada do Vite `apps/web/marbles.html` em `build.rollupOptions.input`, sem alterar `index.html`

## Fase 1 — Física e contato

- [x] T003 [US-001] [FR-001] [FR-002] Escrever testes falhando de física e contato (passo fixo, atrito, parada, paredes, colisão elástica, determinismo e primeiro contato) em `packages/marbles/test/physics.test.ts`
- [x] T004 [US-001] [FR-001] [FR-002] Implementar `packages/marbles/src/physics.ts` e o contato, e confirmar verde

## Fase 2 — Pinça e tiro

- [x] T005 [US-001] [FR-003] Escrever testes falhando do detector de pinça (razão, histerese, ponto espelhado, correção de proporção, mão ausente) em `packages/marbles/test/pinch.test.ts`
- [x] T006 [US-001] [FR-003] Implementar `packages/marbles/src/pinch.ts` e confirmar verde
- [x] T007 [US-001] [FR-004] Escrever testes falhando do tiro (direção, velocidade limitada a 220/1100, cancelamento abaixo de 30) em `packages/marbles/test/shot.test.ts`
- [x] T008 [US-001] [FR-004] Implementar `packages/marbles/src/shot.ts` e confirmar verde

## Fase 3 — Rodada

- [x] T009 [US-002] [FR-005] Escrever testes falhando da rodada (pega até 70 unidades, mira, perda de mão > 300 ms, erro volta ao início, acerto, nova rodada, `camera_denied`, `tracker_error`, `snapshot`) em `packages/marbles/test/round.test.ts`
- [x] T010 [US-002] [FR-005] Implementar `packages/marbles/src/round.ts` (`createBeteRound`) e `index.ts`, e confirmar verde

## Fase 4 — Web

- [x] T011 [US-001] [FR-007] Escrever testes falhando do controlador com relógio, quadros e rastreador injetados em `apps/web/src/marbles`
- [x] T012 [US-001] [FR-007] Implementar o controlador e o hook `useMarblesGame` reaproveitando `useCamera`, `HandTracker` e o espelhamento, e confirmar verde
- [x] T013 [US-003] [FR-006] [FR-008] Escrever testes falhando da tela e do painel (canvas, elástico, seta, contador, mensagens `aria-live`, razão da pinça, estado, latências) em `apps/web/src/marbles`
- [x] T014 [US-003] [FR-006] [FR-008] Implementar `MarblesScreen` (canvas 2D e `drawHand`) e `DebugPanel`, e confirmar verde
- [x] T015 [US-004] [FR-009] Verificar a privacidade por busca no código (`fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, persistência) e por execução no Chromium com inspeção de rede
- [x] T016 [FR-010] Confirmar que o jogo de cartas continua passando sem alteração de código (testes do Acenar verdes, `index.html` e `src/round/` intactos)
- [x] T017 [FR-011] Atualizar `docs/product/PROJECT_SPEC.md`, `README.md` e o guia de arquitetura em `docs/development-context/` com o modo bete, o pacote `packages/marbles` e a segunda entrada

## Fase final — Convergência

- [x] T020 [FR-012] Escrever testes falhando do menu inicial (um card por jogo, links relativos para `cards.html` e `marbles.html`, link de volta ao menu) em `apps/web/src/home`
- [x] T021 [FR-012] Implementar o menu em `index.html` e `src/home`, mover a página do jogo de cartas para `cards.html` sem alterar `src/main.tsx` nem o código do jogo, e adicionar o link de volta nas duas páginas
- [x] T022 [FR-006] Escrever testes falhando do guia visual da mão (cursor no campo com a pinça aberta e fechada, mensagem quando a mão não é vista, câmera ao lado do campo)
- [x] T023 [FR-006] [FR-007] Implementar o cursor da mão no campo, as mensagens de orientação e o layout em duas colunas, publicando a posição da mão no snapshot do controlador a cada quadro

## Fase final — Convergência

- [x] T018 [SC-005] [NFR-004] Executar `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md`
- [ ] T019 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop (acerto com a pinça, reconhecimento e latência) e fechar o Gate 3

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                |
| --------- | ---------------------- | ------------------------------------------------- |
| FR-001    | T003, T004             | `physics.test.ts`                                 |
| FR-002    | T003, T004             | `physics.test.ts`                                 |
| FR-003    | T005, T006             | `pinch.test.ts`                                   |
| FR-004    | T007, T008             | `shot.test.ts`                                    |
| FR-005    | T009, T010             | `round.test.ts`                                   |
| FR-006    | T013, T014, T022, T023 | `MarblesScreen.test.tsx`                          |
| FR-007    | T011, T012             | controlador com rastreador simulado, Chromium     |
| FR-008    | T013, T014             | `DebugPanel.test.tsx`                             |
| FR-009    | T015                   | busca no código e inspeção de rede                |
| FR-010    | T001, T002, T016       | `yarn check:all`, testes do jogo de cartas verdes |
| FR-011    | T017                   | `yarn docs:format:check`, `yarn sdd:check`        |
| FR-012    | T020, T021             | `HomePage.test.tsx`, build com três páginas       |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- T001 e T002 antes de tudo; as Fases 1 a 3 são sequenciais em `packages/marbles`.
- A Fase 4 depende do pacote (Fases 1 a 3); T017 pode andar em paralelo com T011 a T016.
- T015 e T016 dependem de T014; T018 e T019 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação do maintainer wezercarvalho
- **Data:** `2026-10-27`
- **Lacunas:** nenhuma. Todos os FR têm tarefa formal; SC-001 é coberto pelos testes das Fases 1 a 3; SC-002, SC-003, SC-004 e SC-005 têm tarefa de evidência; NFR-001 é coberto pela pureza do pacote, NFR-003 pela tela com `aria-live`, e NFR-002 e NFR-004 pelas tarefas finais.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 e issue 67 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada dos Gates 1 e 2, dada no chat antes da redação dos documentos.
