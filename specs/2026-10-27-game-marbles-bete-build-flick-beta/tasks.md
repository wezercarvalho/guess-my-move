# Tarefas — 2026-10-27-game-marbles-bete-build-flick-beta

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.

## Fase 1 — Detector de estalo

- [x] T001 [US-001] [FR-001] [FR-002] Escrever testes falhando de `handDirection` (pulso→base do médio, x corrigido e espelhado, normalizado, `null` degenerado) e do detector de estalo (histerese herdada, histórico de 400 ms, soltura rápido/lento, pico de velocidade, duração, direção no início da abertura, perda zera o armado) em `packages/marbles/test/flick.test.ts`
- [x] T002 [US-001] [FR-001] [FR-002] Implementar `packages/marbles/src/flick.ts` (`handDirection`, `createFlickDetector`, `DEFAULT_FLICK`) compondo `createPinchDetector`, e confirmar verde
- [x] T003 [US-001] [FR-003] Escrever testes falhando de `flickShot` (mapeamento linear 2–8 razão/s para 300–1100 unid/s, limites nos extremos, `null` para lento e para fraco) em `packages/marbles/test/flick.test.ts`
- [x] T004 [US-001] [FR-003] Implementar `flickShot` em `packages/marbles/src/flick.ts`, e confirmar verde

## Fase 2 — Rodada

- [x] T005 [US-001] [FR-004] Escrever testes falhando de `observeFlick` e do snapshot (arma só ao fechar depois de vista aberta, direção de pré-visualização, dispara no estalo rápido, cancela no lento, no fraco e na perda > 300 ms, `fire` recebe a velocidade) em `packages/marbles/test/round.test.ts`, sem alterar os casos do modo pinça
- [x] T006 [US-001] [FR-004] Implementar `observeFlick` e `snapshot().flick` em `packages/marbles/src/round.ts`, fazer `fire` receber a velocidade e exportar a API do estalo em `index.ts`, e confirmar verde

## Fase 3 — Web

- [x] T007 [US-002] [FR-005] [FR-007] Escrever testes falhando do controlador (modo inicial por `?mode=estalo`, roteamento por modo, troca reinicia a rodada e os detectores, `mode` e debug do estalo no snapshot) em `apps/web/src/marbles`
- [x] T008 [US-002] [FR-005] [FR-007] Implementar `mode`/`setMode(mode)` e o roteamento por modo no `MarblesController`, publicando `mode` e as linhas do estalo no snapshot, e confirmar verde
- [x] T009 [US-002] [US-003] [FR-005] [FR-006] [FR-007] Escrever testes falhando da tela e do desenho (seletor "Modo de tiro" com rádio Pinça/Estalo alpha, mensagens por estado, seta de direção em `drawField`, rótulo alpha, `aria-live`, linhas de depuração do estalo) em `apps/web/src/marbles`
- [x] T010 [US-001] [US-003] [FR-005] [FR-006] [FR-007] Implementar o seletor e as mensagens em `MarblesScreen`, a seta de direção em `fieldView.drawField` e as linhas do estalo no `DebugPanel`, e confirmar verde
- [x] T011 [US-004] [FR-008] Verificar a privacidade no modo estalo por busca no código (`fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, persistência) e por execução no Chromium com inspeção de rede
- [x] T012 [FR-009] Confirmar que os testes do modo pinça (`packages/marbles`) e do jogo de cartas passam sem alteração de código e sem mudança de comportamento

## Fase 4 — Documentação

- [x] T013 [FR-010] Atualizar `README.md` da raiz, `docs/development-context/README.md`, `docs/development-strategies/README.md`, `docs/development-strategies/sdd/README.md` (somente se algo ali ficar desatualizado), `specs/README.md`, o guia de arquitetura e o `PROJECT_SPEC` para descrever os dois modos de tiro do bete (pinça e estalo alpha)

## Fase final — Convergência

- [x] T014 [SC-005] [NFR-004] Executar `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md`
- [x] T015 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop com os números do estalo (disparou, em quantas tentativas, disparo falso, velocidade de abertura, duração, quadros por estalo) e fechar o Gate 3 com a decisão da issue #68

## Cobertura

| Requisito | Tarefas                | Evidência esperada                              |
| --------- | ---------------------- | ----------------------------------------------- |
| FR-001    | T001, T002             | `flick.test.ts`                                 |
| FR-002    | T001, T002             | `flick.test.ts`                                 |
| FR-003    | T003, T004             | `flick.test.ts`                                 |
| FR-004    | T005, T006             | `round.test.ts`                                 |
| FR-005    | T007, T008, T009, T010 | testes do controlador e da tela                 |
| FR-006    | T009, T010             | `MarblesScreen.test.tsx`                        |
| FR-007    | T007, T008, T009, T010 | `DebugPanel.test.tsx`                           |
| FR-008    | T011                   | busca no código e inspeção de rede              |
| FR-009    | T012                   | testes do modo pinça e do jogo de cartas verdes |
| FR-010    | T013                   | `yarn docs:format:check`, `yarn sdd:check`      |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (`flick.ts`) antes da Fase 2 (`round.ts`); ambas antes da Fase 4 web.
- T013 pode andar em paralelo com T007 a T012.
- T011 e T012 dependem de T010; T014 e T015 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação do maintainer wezercarvalho
- **Data:** `2026-10-27`
- **Lacunas:** nenhuma. Todos os FR têm tarefa formal; SC-001 é coberto pelos testes das Fases 1 a 3; SC-002, SC-003, SC-004 e SC-005 têm tarefa de evidência; NFR-001 é coberto pela pureza do módulo `flick.ts`, NFR-003 pela tela com `fieldset` e `aria-live`, e NFR-002 e NFR-004 pelas tarefas finais.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 e issue 68 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada no chat, antes da redação. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
