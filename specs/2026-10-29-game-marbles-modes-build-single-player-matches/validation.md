# Validação — 2026-10-29-game-marbles-modes-build-single-player-matches

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-29`
- **Executor/revisor:** kirocrew (agente), aguardando revisão do maintainer wezercarvalho
- **Commit:** `ce6933a` (refactor da sessão única e docs; validação registrada neste commit seguinte)

## Resumo do resultado

Os modos de jogo das bolinhas (Bete, Triângulo e Cova), em partidas de 3 rodadas contra a
meta e contra o bot, estão implementados test-first sobre uma arquitetura de quatro peças no
pacote puro (controlador de mira `aim/`, motor de partida `match/`, bot por simulação `bot/`
e os três modos `modes/*`), com a tela conduzindo a partida sobre a **sessão única** do
pacote. Nesta etapa 4 o condutor de partida foi unificado: o condutor passo a passo
(`createMatchSession`) migrou do app web para `packages/marbles/src/match/session.ts` e
`createMatch` passou a ser um laço fino sobre essa mesma sessão, de modo que existe UMA só
implementação das regras de vez, limite de tiros, avaliação, fim de rodada e resultado.
`apps/web/src/marbles/matchSession.ts` foi apagado e o `marblesController` passou a consumir
a sessão do pacote. Um teste de equivalência prova que `createMatch` e a sessão quadro a
quadro convergem para cada modo × adversário.

Revisão pós-PR (2026-10-29): a Cova contra o bot deixava quem completou as 3 covas seguir
recebendo vez, o que inflava a contagem de tiros do desempate (empate no lugar de vitória por
menos tiros) e acumulava o rendimento. Corrigido test-first com `Mode.isFinished` (quem
completou sai da disputa) e rendimento por tiro; título da página, cartão do menu e README
passaram a descrever os três modos.

Todos os cinco gates passam. **Veredito do agente: convergente, aguardando revisão do
maintainer.** O Gate 3 fica PENDENTE do maintainer (não foi concedido pelo agente), com os
riscos aceitos registrados abaixo: sem teste ao vivo com a mão real; valores de jogo iniciais
a calibrar; faixa de acerto do bot como proteção de regressão, não equilíbrio medido; sem
medição de fps.

## Conclusão das tarefas

- **Concluídas:** 30 (T001–T030)
- **Pendentes:** 1 (T031 — fechamento do Gate 3 e promoção a `validated`, do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                                                                                                                                                                                   | Resultado |
| --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001, T002       | `packages/marbles/test/aim.test.ts` (14 testes; controlador de mira pinça/estalo; não importa `physics.ts`/`round.ts`)                                                                                                                                      | PASS      |
| FR-002    | T003, T016       | `packages/marbles/test/flick-replay.test.ts` (3) e `pinch.test.ts`/`flick.test.ts` verdes; paridade do bete preservada                                                                                                                                      | PASS      |
| FR-003    | T004             | `packages/marbles/test/match.test.ts` (resultado da partida 2-1/1-1-1/3 empates/1-2; competidor do tiro corrente)                                                                                                                                           | PASS      |
| FR-004    | T005             | `packages/marbles/test/match.test.ts` (modos de teste: vez alternada, limites, avaliação, esgotamento, vitória antecipada)                                                                                                                                  | PASS      |
| FR-005    | T006             | `packages/marbles/test/match.test.ts` (meta sem vez; bot com ordem alternada por rodada)                                                                                                                                                                    | PASS      |
| FR-006    | T007, T008       | `packages/marbles/test/match.test.ts` (fonte do tiro; cadeia atribuída ao atirador; determinismo) e `match-session-equivalence.test.ts` (6)                                                                                                                 | PASS      |
| FR-007    | T009–T012        | `packages/marbles/test/bot.test.ts` (parada a <= 1 unidade; semente; faixa 55%–80%; teto `gain · maxPull`) e `apps/web/src/marbles/marblesController.test.ts` (semente sorteada por partida)                                                                | PASS      |
| FR-008    | T013–T016        | `packages/marbles/test/bete.test.ts` (12; meta e bot)                                                                                                                                                                                                       | PASS      |
| FR-009    | T021–T023        | `packages/marbles/test/triangle.test.ts` (11; formação, captura, cadeia, meta e bot)                                                                                                                                                                        | PASS      |
| FR-010    | T024–T026        | `packages/marbles/test/hole.test.ts` (11; entrada por velocidade, permanência, meta e bot)                                                                                                                                                                  | PASS      |
| FR-011    | T016, T023, T026 | ajuda não vazia que cita vitória, derrota e empate por modo, em `bete.test.ts`/`triangle.test.ts`/`hole.test.ts` e `apps/web/src/marbles/guideSteps.test.tsx`                                                                                               | PASS      |
| FR-012    | T017–T019        | `apps/web/src/marbles/marblesController.test.ts` e `MarblesScreen.test.tsx` (modo, adversário, placar, rodada, vez, contagem da rodada, legenda) e `fieldView.test.ts` (cor por dono, bolinha parada do outro); `packages/marbles/test/round-score.test.ts` | PASS      |
| FR-013    | T020             | `apps/web/src/marbles/marblesController.test.ts` (fluxo completo por modo × adversário; vez do bot ignora o gesto)                                                                                                                                          | PASS      |
| FR-014    | T027, T028       | `apps/web/src/marbles/guideSteps.test.tsx` (3 modos × 2 adversários; `aria-current`; dica)                                                                                                                                                                  | PASS      |

## Histórias e critérios de aceitação

| História/cenário           | Demonstração                                                                                                                  | Resultado |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / mira reutilizável | `aim.test.ts` exercita pinça e estalo sem alvo/física; `flick-replay.test.ts` prova paridade do bete                          | PASS      |
| US-002 / motor de partida  | `match.test.ts` + `match-session-equivalence.test.ts`: 3 rodadas, vez, resultado, mesma regra pela sessão e por `createMatch` | PASS      |
| US-003 / bot por simulação | `bot.test.ts`: parada a <= 1 unidade, semente determinística, faixa de acerto                                                 | PASS      |
| US-004 / Bete              | `bete.test.ts`: acerto cedo vence, tarde empata, sem acerto perde (meta e bot)                                                | PASS      |
| US-005 / Triângulo         | `triangle.test.ts`: captura para fora do círculo, cadeia, vez alternada                                                       | PASS      |
| US-006 / Cova              | `hole.test.ts`: entrada só devagar nas 3 covas em ordem                                                                       | PASS      |
| US-007 / conduzir na tela  | `marblesController.test.ts` + `MarblesScreen.test.tsx`: escolha, placar, vez, fim de partida                                  | PASS      |
| US-008 / ajuda por modo    | `guideSteps.test.tsx`: 3 modos × 2 adversários, regras de vitória/derrota/empate                                              | PASS      |

## Comandos executados

| Comando exato            | Data       | Resultado | Evidência/observação                                                                                                                    |
| ------------------------ | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn check:static`      | 2026-10-29 | PASS      | `tsc` por workspace sem erro; oxlint: 0 avisos e 0 erros, 154 arquivos, 136 regras.                                                     |
| `yarn test`              | 2026-10-29 | PASS      | Todos os workspaces verdes: core 68 (6 arquivos), marbles 146 (13), swing 127 (12), web vitest 233 (28) + web node:test 50 (15 suítes). |
| `yarn build`             | 2026-10-29 | PASS      | `tsc --build` por workspace + `vite build`; 201 módulos transformados; aviso pré-existente de chunk > 500 kB no `swing` (não bloqueia). |
| `yarn sdd:check`         | 2026-10-29 | PASS      | Catálogo, estados, gates, cobertura e links válidos (verificação estrutural somente leitura).                                           |
| `yarn docs:format:check` | 2026-10-29 | PASS      | "All matched files use Prettier code style!" (após `yarn docs:format:fix` nas tabelas do PROJECT_SPEC.md).                              |

Contagem total de testes: **624** (core 68 + marbles 146 + swing 127 + web vitest 233 + web
node:test 50), todos verdes. O refactor desta etapa removeu `apps/web/src/marbles/matchSession.ts`
(−322 linhas) e acrescentou `packages/marbles/src/match/session.ts` (+334 linhas, migração com
dois acessores novos) e `packages/marbles/test/match-session-equivalence.test.ts` (+141 linhas);
`createMatch` em `packages/marbles/src/match/index.ts` encolheu de ~162 para ~95 linhas úteis ao
virar um laço fino sobre a sessão.

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** não há benchmark ao vivo. A única medição automatizada é o teste de
  faixa de acerto do bot (`bot.test.ts`): 1000 tiros com sementes distintas contra um alvo a
  400 unidades, raio 14, acerto entre 55% e 80%.
- **Métricas:** a faixa 55%–80% é **proteção de regressão**, não equilíbrio medido com uso real.
  Nenhuma taxa de acerto, equilíbrio ou diversão é afirmada.
- **Limitações:** nenhuma medição de fps, de latência ao vivo nem de usabilidade com a mão real.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` PASS (links e catálogo válidos).
- **Contratos:** o contrato de modo (`Mode`) e a fonte do tiro (`ShotSource`) são exercitados
  pelos testes de `match`, dos três modos e do bot; a equivalência prova uma só implementação.
- **Privacidade e segredos:** nenhum frame é persistido ou logado; o controlador não grava nem
  envia imagem; nenhuma chave no bundle ou no repositório (modelos `.task` fora do Git).
- **Fronteira de informação:** não se aplica a este jogo (a fronteira da carta é do jogo de
  cartas); o motor é puro e não vaza estado por outro canal que não o `snapshot()`.
- **UTF-8 e acentuação:** docs e comentários em português com acentos; `docs:format:check` PASS.
- **Alterações fora de escopo:** nenhuma. O jogo de cartas, o Arranha-Teia e o reconhecedor de
  gestos não foram alterados; a mudança é interna ao jogo das bolinhas e à sua documentação.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado                                                                        |
| ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | Gates 1 e 2 aprovados antecipadamente pelo maintainer em 2026-10-29; spec, plano e tarefas.         |
| II. Test-first                     | PASS      | Testes precedem a implementação em todas as fases; teste de equivalência adicionado no refactor.    |
| III. Núcleo puro e determinístico  | PASS      | `match/` sem DOM/MediaPipe/relógio (teste de pureza em `match.test.ts`); tempo entra por argumento. |
| IV. Privacidade local              | PASS      | Nada gravado ou enviado; modelos fora do Git.                                                       |
| V. Sem código órfão                | PASS      | `matchSession.ts` duplicado removido; `createMatch` reescrito sobre a sessão; sem helpers órfãos.   |
| VI. Convergência (Gate 3)          | PENDENTE  | Aguardando revisão do maintainer; veredito do agente: convergente.                                  |

## Convergência

- **Divergências encontradas:** nenhuma. O código, os testes, a spec, o plano e as tarefas
  concordam; a documentação foi atualizada (T029).
- **Artefatos reabertos:** nenhum.
- **Reexecuções:** os cinco gates foram executados uma vez cada, em sequência, todos PASS.

## Limitações e riscos residuais

| Limitação/risco                                               | Impacto                                    | Responsável   | Aceite                     |
| ------------------------------------------------------------- | ------------------------------------------ | ------------- | -------------------------- |
| Sem teste ao vivo com a mão real                              | Usabilidade e jogabilidade não comprovadas | wezercarvalho | Sim (risco aceito, Gate 3) |
| Valores iniciais a calibrar (5/8/9 tiros, limites de vitória) | Equilíbrio não medido                      | wezercarvalho | Sim (risco aceito, Gate 3) |
| Nível do bot e faixa de acerto são proteção de regressão      | Não é equilíbrio medido                    | wezercarvalho | Sim (risco aceito, Gate 3) |
| Velocidade de entrada na cova (120) palpite                   | Pode exigir ajuste com uso                 | wezercarvalho | Sim (risco aceito, Gate 3) |
| Sem medição de fps                                            | Desempenho na tela não medido              | wezercarvalho | Sim (risco aceito, Gate 3) |

## Gate 3 — Convergência validada

- **Veredito:** pendente (veredito do agente: convergente, aguardando revisão do maintainer)
- **Aprovador:** wezercarvalho (maintainer) — pendente
- **Data:** pendente
- **Escopo aprovado:** modos de jogo das bolinhas (FR-001 a FR-014, NFR-001 a NFR-005, SC-001 a SC-006), issues #86 a #93
- **Riscos aceitos:** sem teste ao vivo com a mão real; valores de jogo iniciais a calibrar; faixa de acerto do bot como proteção de regressão, não equilíbrio medido; sem medição de fps
- **Observações:** o agente NÃO concede o Gate 3. Os cinco gates automatizados passam e o condutor de partida é único (equivalência provada). A promoção da spec a `validated` (T031) depende da aprovação do maintainer.
