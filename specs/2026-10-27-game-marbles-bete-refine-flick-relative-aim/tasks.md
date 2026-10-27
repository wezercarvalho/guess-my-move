# Tarefas — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `implementing`. As tarefas de implementação, validação e Gate 3 estão PENDENTES.

## Fase 1 — Detector de estalo como classificador de gatilho (packages/marbles)

- [ ] T001 [US-002] [FR-002] [FR-003] Escrever testes falhando em `packages/marbles/test/flick.test.ts`: o detector classifica a abertura só como gatilho rápido (subida <= `slowMs` 80 ms E velocidade de abertura >= `minOpenSpeed` 2 razão/s) ou não; a soltura não traz mais `direction`; `handDirection`, `flickShot`, `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed` não existem mais na API
- [ ] T002 [US-002] [FR-002] [FR-003] Implementar em `packages/marbles/src/flick.ts`: remover `handDirection`, o campo `direction`, `flickShot` e os parâmetros de força; baixar `slowMs` de 300 para 80 ms; manter a medição de duração e velocidade de abertura como dado; ajustar `index.ts`, e confirmar verde

## Fase 2 — Rodada com mira relativa (packages/marbles)

- [ ] T003 [US-001] [FR-001] Escrever testes falhando em `packages/marbles/test/round.test.ts`: no modo estalo, enquanto armado, a posição alvo da mira é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale`, e o tiro previsto vem de `computeShot` (reaproveitado do modo pinça), publicado no snapshot como na pinça
- [ ] T004 [US-001] [US-002] [FR-003] [FR-004] Escrever testes falhando em `packages/marbles/test/round.test.ts`: `observeFlick` dispara o tiro previsto no gatilho rápido com arrasto suficiente; cancela sem contar tiro no lento, no fraco e no sem arrasto ("sem tiro"); perda > 300 ms cancela e qualquer perda zera o armado; sem alterar os casos do modo pinça
- [ ] T005 [US-001] [US-002] [FR-001] [FR-003] [FR-004] Implementar `observeFlick` e o snapshot em `packages/marbles/src/round.ts` usando a pinça virtual e `computeShot`, e confirmar verde

## Fase 3 — Web: quadros novos, painel, tela (apps/web)

- [ ] T006 [US-003] [FR-005] [FR-006] Escrever testes falhando em `apps/web/src/marbles`: o laço processa o detector só por quadro novo (`requestVideoFrameCallback` quando disponível; recuo para a comparação de `video.currentTime` sem reprocessar repetido no jsdom) e conta os quadros novos da câmera por segundo (janela de 1 s), expostos no snapshot
- [ ] T007 [US-003] [US-004] [FR-005] [FR-006] Implementar o laço por quadro novo e a contagem no `MarblesController`, mapear o resultado do último estalo como `disparado`/`lento demais`/`fraco demais`/`sem tiro` (sem `sem direção`), e confirmar verde
- [ ] T008 [US-001] [US-004] [FR-006] [FR-007] Escrever testes falhando em `apps/web/src/marbles`: a tela orienta "feche a pinça, arraste a mão para longe do alvo e abra os dedos rápido para atirar", mantém o rótulo "Estalo (alpha)", desenha a previsão do tiro (linha e seta) como na pinça e não desenha a seta de orientação da mão; o painel mostra a taxa da câmera e o resultado do último estalo por `aria-live`
- [ ] T009 [US-001] [US-004] [FR-006] [FR-007] Implementar os textos em `MarblesScreen`, a previsão do tiro e a remoção da seta de orientação em `fieldView`, e as linhas novas do `DebugPanel`, e confirmar verde
- [ ] T010 [US-005] [FR-008] Verificar a privacidade por busca no código (`fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, persistência) e por execução no Chromium com inspeção de rede
- [ ] T011 [FR-009] Confirmar que os testes do modo pinça (`packages/marbles`) e do jogo de cartas passam, com o modo pinça inalterado salvo o não reprocessar quadros repetidos

## Fase 4 — Documentação

- [ ] T012 [FR-010] Atualizar o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o `specs/README.md` para descrever o estalo com mira relativa e gatilho rápido e o processamento só de quadros novos; marcar a spec `2026-10-27-game-marbles-bete-build-flick-beta` como `superseded` (status, `related_specs`, seção `## Substituição`) e refletir no catálogo

## Fase final — Convergência (PENDENTE)

- [ ] T013 [SC-001] [SC-005] [NFR-004] Executar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`; quando o código estiver implementado, também `yarn check:all`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md`
- [ ] T014 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop com a mira relativa (disparou, em quantas tentativas, acertou o alvo, disparo falso), a taxa real da câmera lida no painel e a decisão da issue #72, e fechar o Gate 3

## Cobertura

| Requisito | Tarefas                | Evidência esperada                              |
| --------- | ---------------------- | ----------------------------------------------- |
| FR-001    | T003, T005             | `round.test.ts`                                 |
| FR-002    | T001, T002             | `flick.test.ts`, busca no código                |
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
- **Lacunas:** nenhuma. Todos os dez FR têm tarefa formal; SC-001 é coberto pelos testes das Fases 1 a 3; SC-002 e SC-003 pela tarefa de evidência manual (T014); SC-004 pela T011 e SC-005 pela T013; NFR-001 pela pureza da mira relativa e do classificador de gatilho, NFR-002 pelos textos sem afirmação de desempenho, NFR-003 pelo `aria-live` e pelo `fieldset`, e NFR-004 pelos comandos finais. A spec está em `implementing`: a implementação (T002, T005, T007, T009), a validação (T013) e o Gate 3 (T014) seguem pendentes.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("pode fazer então, abre um PR") e issue 72 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada no chat, antes da redação. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
