# Tarefas — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `implementing`. TODAS as tarefas estão PENDENTES; o agente principal as marca conforme concluir, e a última (teste manual do maintainer e Gate 3) depende dele.

## Fase 1 — Detector de estalo: direção, gatilho e força logarítmica (packages/marbles)

- [x] T001 [US-001] [US-002] [FR-001] [FR-002] [FR-003] Escrever testes falhando em `packages/marbles/test/flick.test.ts`: o detector mede a direção pela orientação da mão (`handDirection`, pulso → base do dedo médio, espelhada, `null` quando degenerado); classifica a abertura como gatilho rápido (subida <= `slowMs` 80 ms E velocidade de pico >= `minOpenSpeed` 2 razão/s); e `flickShot` converte a velocidade de abertura em força pela escala logarítmica (`power = clamp(ln(v/powerLowSpeed)/ln(powerHighSpeed/powerLowSpeed), 0, 1)` com `powerLowSpeed` 10 e `powerHighSpeed` 200; `v<=10`→300 unid/s, `v>=200`→1100 unid/s, um ponto no meio) e devolve `null` no lento, no fraco e no sem direção; `maxOpenSpeed` não existe mais na API
- [x] T002 [US-001] [US-002] [FR-001] [FR-002] [FR-003] Implementar em `packages/marbles/src/flick.ts`: escala logarítmica em `flickShot`; adicionar `powerLowSpeed`/`powerHighSpeed`, remover `maxOpenSpeed`, manter `minShotSpeed`/`maxShotSpeed`; baixar `slowMs` de 300 para 80 ms; manter `handDirection`, a direção e a medição de velocidade de pico; ajustar `index.ts`, e confirmar verde

## Fase 2 — Rodada com direção e força do estalo (packages/marbles)

- [x] T003 [US-001] [FR-001] Escrever testes falhando em `packages/marbles/test/round.test.ts`: no modo estalo, ao armar, a rodada publica a direção de prévia da orientação da mão no snapshot, e o tiro disparado tem a direção medida no início da abertura
- [x] T004 [US-001] [US-002] [FR-002] [FR-003] [FR-004] Escrever testes falhando em `packages/marbles/test/round.test.ts`: `observeFlick` dispara o tiro no gatilho rápido com direção medida e a velocidade da força logarítmica; cancela sem contar tiro no lento, no fraco e no sem direção; perda > 300 ms cancela e qualquer perda zera o armado; sem alterar os casos do modo pinça
- [x] T005 [US-001] [US-002] [FR-001] [FR-002] [FR-003] [FR-004] Implementar `observeFlick` e o snapshot em `packages/marbles/src/round.ts` com a direção da orientação da mão e a força logarítmica, e confirmar verde

## Fase 3 — Web: quadros novos, painel, tela (apps/web)

- [x] T006 [US-003] [FR-005] [FR-006] Escrever testes falhando em `apps/web/src/marbles`: o laço processa o detector só por quadro novo (`requestVideoFrameCallback` quando disponível; recuo para a comparação de `video.currentTime` sem reprocessar repetido no jsdom) e conta os quadros novos da câmera por segundo (janela de 1 s), expostos no snapshot
- [x] T007 [US-003] [US-004] [FR-005] [FR-006] Implementar o laço por quadro novo e a contagem no `MarblesController`, expor a FORÇA do último estalo (0 a 100%) e mapear o resultado como `disparado`/`lento demais`/`fraco demais`/`sem direção`, e confirmar verde
- [x] T008 [US-001] [US-004] [FR-006] [FR-007] Escrever testes falhando em `apps/web/src/marbles`: a tela orienta "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta", mantém o rótulo "Estalo (alpha)" e o seletor "Modo de tiro", desenha a seta de direção a partir da bolinha de tiro enquanto armado; o painel mostra a taxa da câmera, a força e o resultado do último estalo por `aria-live`
- [x] T009 [US-001] [US-004] [FR-006] [FR-007] Implementar os textos em `MarblesScreen`, a seta de direção em `fieldView` e as linhas novas do `DebugPanel` (taxa da câmera, força, resultado), e confirmar verde
- [x] T010 [US-005] [FR-008] Verificar a privacidade por busca no código (`fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, persistência) e por execução no Chromium com inspeção de rede
- [x] T011 [FR-009] Confirmar que os testes do modo pinça (`packages/marbles`) e do jogo de cartas passam, com o modo pinça inalterado salvo o não reprocessar quadros repetidos, e a pinça regulando a força pelo arrasto

## Fase 4 — Documentação

- [x] T012 [FR-010] Atualizar o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o `specs/README.md` para descrever o estalo como mecânica distinta da pinça (direção pela orientação da mão, força logarítmica pela velocidade de abertura, gatilho rápido) e o processamento só de quadros novos; marcar a spec `2026-10-27-game-marbles-bete-build-flick-beta` como `superseded` (status, `related_specs`, seção `## Substituição`) e refletir no catálogo

## Fase final — Convergência (PENDENTE)

- [x] T013 [SC-001] [SC-005] [NFR-004] Executar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`; quando o código estiver implementado, também `yarn check:all`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md`
- [ ] T014 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop com a direção pela orientação da mão e a força logarítmica (disparou, em quantas tentativas, a força lida, acertou o alvo, disparo falso), a taxa real da câmera lida no painel e a decisão da issue #72, e fechar o Gate 3

## Cobertura

| Requisito | Tarefas                | Evidência esperada                              |
| --------- | ---------------------- | ----------------------------------------------- |
| FR-001    | T001, T002, T003, T005 | `flick.test.ts`, `round.test.ts`                |
| FR-002    | T001, T002, T004, T005 | `flick.test.ts`, `round.test.ts`                |
| FR-003    | T001, T002, T004, T005 | `flick.test.ts`, `round.test.ts`                |
| FR-004    | T004, T005             | `round.test.ts`                                 |
| FR-005    | T006, T007             | testes do controlador em jsdom                  |
| FR-006    | T006, T007, T008, T009 | testes do controlador e do painel               |
| FR-007    | T008, T009             | `MarblesScreen.test.tsx`, `fieldView.test.ts`   |
| FR-008    | T010                   | busca no código e inspeção de rede              |
| FR-009    | T011                   | testes do modo pinça e do jogo de cartas verdes |
| FR-010    | T012                   | `yarn docs:format:check`, `yarn sdd:check`      |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (`flick.ts`) antes da Fase 2 (`round.ts`); ambas antes da Fase 3 web.
- T012 pode andar em paralelo com T006 a T011.
- T010 e T011 dependem de T009; T013 e T014 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação do maintainer wezercarvalho
- **Data:** `2026-10-27`
- **Lacunas:** nenhuma. Todos os dez FR têm tarefa formal; SC-001 é coberto pelos testes das Fases 1 a 3; SC-002 e SC-003 pela tarefa de evidência manual (T014); SC-004 pela T011 e SC-005 pela T013; NFR-001 pela pureza da direção, do classificador de gatilho e da escala logarítmica, NFR-002 pelos textos sem afirmação de desempenho ou de correspondência da direção, NFR-003 pelo `aria-live` e pelo `fieldset`, e NFR-004 pelos comandos finais. A spec está em `implementing`: todas as tarefas seguem pendentes, incluindo a implementação, a validação (T013) e o Gate 3 (T014).

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo" e "pode fazer então, abre um PR") e issue 72 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada no chat, após a correção de rumo. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
