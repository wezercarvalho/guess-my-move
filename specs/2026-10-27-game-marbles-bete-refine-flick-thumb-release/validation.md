# Validação — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-27`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho pendente (Gate 3)
- **Commit:** a registrar no fechamento do Gate 3

## Resumo do resultado

Implementação concluída e gates automatizados verdes; o Gate 3 e o teste manual do maintainer (T014) continuam pendentes. O estalo é uma mecânica distinta da pinça: a direção vem da orientação da mão (pulso à base do dedo médio, espelhada, medida no início da abertura) e a força, da velocidade com que o polegar solta, numa escala logarítmica de 10 a 200 razão/s (antes linear de 2 a 8, que saturava). O gatilho rápido caiu de 300 para 80 ms. A pinça não mudou: direção e força vêm do arrasto. O laço processa o detector só por quadro novo da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`) e o painel mostra os quadros novos da câmera por segundo e, no estalo, a força do último estalo. Os testes cobrem tudo sem câmera; no Chromium da VPS com câmera simulada o caminho `requestVideoFrameCallback` funcionou. Nenhum estalo foi exercitado com mão nesta versão; a viabilidade e a correspondência da direção ao estalo real continuam desconhecidas.

## Conclusão das tarefas

- **Concluídas:** 13 (T001 a T013)
- **Pendentes:** 1 (T014, teste manual do maintainer e Gate 3)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                                                             | Resultado |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001, T003 | `flick.test.ts` (orientação da mão, direção no início da subida) e `round.test.ts` (prévia acompanha a mão; arrasto não muda a velocidade do estalo)                  | PASS      |
| FR-002    | T001, T002 | `flick.test.ts`: escala logarítmica de 10 a 200 razão/s para 300 a 1100 unid/s, extremos, média geométrica no meio, leituras reais de 9,1 a 199, sem `maxOpenSpeed`   | PASS      |
| FR-003    | T001, T004 | `flick.test.ts` (37 ms rápido, 80 ms limite, 81 e 103 ms lentos, fraco) e `round.test.ts` (dispara, cancela por lento, fraco e sem direção)                           | PASS      |
| FR-004    | T004, T005 | `round.test.ts` (perda da mão por mais e menos de 300 ms; detector que zera o armado) e `flick.test.ts` (perder a mão zera o armado)                                  | PASS      |
| FR-005    | T006, T007 | `marblesController.test.ts`: só processa por quadro novo com e sem `requestVideoFrameCallback`; cancela a espera ao parar                                             | PASS      |
| FR-006    | T007, T009 | `marblesController.test.ts` e `MarblesScreen.test.tsx`: taxa da câmera nos dois modos; força e resultado (`disparado`, `lento demais`, `fraco demais`, `sem direção`) | PASS      |
| FR-007    | T008, T009 | `MarblesScreen.test.tsx` (orientação, rótulo alpha, seletor) e `fieldView.test.ts` (seta de direção, sem elástico da pinça)                                           | PASS      |
| FR-008    | T010       | busca no código sem `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.` nem persistência; Chromium: 52 requisições, todas GET para a própria origem                   | PASS      |
| FR-009    | T011       | testes da pinça em `packages/marbles` e do jogo de cartas passam (`yarn check:all`); a pinça segue regulada pelo arrasto                                              | PASS      |
| FR-010    | T012       | README, guia de arquitetura, `PROJECT_SPEC.md` e `specs/README.md` atualizados; `yarn docs:format:check` e `yarn sdd:check`                                           | PASS      |

NFR-002 segue em aberto até o teste do maintainer: os textos não afirmam desempenho nem viabilidade e declaram os limiares como palpites.

## Histórias e critérios de aceitação

| História/cenário           | Demonstração                                                                      | Resultado |
| -------------------------- | --------------------------------------------------------------------------------- | --------- |
| US-001 / direção do estalo | `flick.test.ts`, `round.test.ts` e `fieldView.test.ts`; nenhuma mira com mão real | PASS      |
| US-002 / força do polegar  | `flick.test.ts`, `round.test.ts` e `marblesController.test.ts`; sem mão real      | PASS      |
| US-003 / quadros novos     | controlador em jsdom e Chromium com câmera simulada (`requestVideoFrameCallback`) | PASS      |
| US-004 / tela e painel     | `MarblesScreen.test.tsx`                                                          | PASS      |
| US-005 / privacidade       | busca no código e inspeção de rede no Chromium                                    | PASS      |

Critérios que dependem de mão real (SC-002, SC-003) e da câmera do maintainer ficam na T014.

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                           |
| ---------------------------- | ---------- | --------- | -------------------------------------------------------------- |
| `yarn docs:format:check`     | 2026-10-27 | PASS      | todos os documentos no estilo do Prettier                      |
| `yarn sdd:check`             | 2026-10-27 | PASS      | catálogo, estados, gates, cobertura e links válidos            |
| `yarn test:sdd`              | 2026-10-27 | PASS      | 109 testes                                                     |
| `yarn check:all`             | 2026-10-27 | PASS      | typecheck, lint, testes (core 68, marbles 102, web 128), build |
| `yarn test:gates`            | 2026-10-27 | PASS      | 231 testes                                                     |
| `yarn security:dependencies` | 2026-10-27 | PASS      | nenhuma vulnerabilidade em nenhum nível                        |

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** a página `marbles.html?mode=estalo&delegate=cpu` no Chromium headless de uma VPS compartilhada, com a câmera simulada pelo dispositivo falso do Chromium (`--use-fake-device-for-media-stream`, sem mão no quadro). Uma execução de cerca de 9 s.
- **Taxa da câmera:** o painel mostrou 18,3 quadros novos da câmera por segundo, com `requestVideoFrameCallback` disponível e 148 quadros processados no total; o dispositivo falso é nominalmente de 20 quadros por segundo. Isto só mostra que a contagem funciona; não é a taxa da webcam do maintainer.
- **Rede:** 52 requisições, todas GET para a própria origem, nenhuma com corpo e nenhuma externa.
- **Leitura de origem do refino:** a sessão de teste do maintainer (cerca de 40 s, Chrome desktop, câmera real) registrou 15 aberturas, velocidade de abertura de 9,1 a 199 razão/s, subida de 11 a 13 ms em 8 delas, 103 e 192 ms em duas, cerca de 86 quadros processados por segundo e latência mediana de 9 ms; 8 tiros e nenhum acerto. Foi lida do painel em vídeo de tela, que não faz parte do repositório.
- **Limitações:** nenhuma medição do estalo com a escala logarítmica de força; a taxa real da webcam do maintainer continua desconhecida; os limiares são palpites de uma única sessão.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passa.
- **Contratos:** `packages/marbles` não depende de `packages/core`; a orientação da mão, o detector de estalo e `flickShot` não usam relógio próprio (o tempo entra por argumento).
- **Privacidade e segredos:** busca no código sem `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, `localStorage`, `sessionStorage`, `indexedDB`, `MediaRecorder`, `toDataURL` nem `toBlob` fora dos testes; sem chaves.
- **UTF-8 e acentuação:** conferidos.
- **Alterações fora de escopo:** a marcação da spec antiga como `superseded`, prevista em `plan.md`.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado |
| ---------------------------------- | --------- | ---------------------------- |
| I. Intenção antes da implementação | PENDENTE  | a preencher no Gate 3        |

## Convergência

- **Divergências encontradas:** a primeira versão desta entrega tirou do estalo a direção pela mão e a força pelo polegar e o deixou quase igual à pinça; o maintainer apontou que a força do estalo é regulada pelo polegar e que a mecânica é distinta. A spec foi reescrita (CQ-001) e a pasta renomeada de `refine-flick-relative-aim` para `refine-flick-thumb-release` antes do merge. A causa do problema original era a escala linear de 2 a 8 razão/s, que saturava; o maintainer confirmou que fez estalos de forças diferentes de propósito. A hipótese de que o laço relia quadros repetidos da câmera continua sem confirmação.
- **Artefatos reabertos:** `spec.md`, `clarification.md`, `research.md`, `plan.md`, `tasks.md` e `checklists/specification.md`.
- **Reexecuções:** os gates completos rodaram depois da reescrita e das últimas mudanças de código.

## Limitações e riscos residuais

| Limitação/risco                                                            | Impacto                                                         | Responsável | Aceite   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------- | -------- |
| Estalo com direção pela mão e força logarítmica não testado com a mão      | Viabilidade da issue #72 desconhecida                           | maintainer  | pendente |
| `slowMs` de 80 ms e `minOpenSpeed` de 2 razão/s são palpites de uma sessão | Pode cancelar estalos legítimos ou passar aberturas lentas      | maintainer  | pendente |
| A faixa 10 a 200 da escala de força vem só da amplitude observada          | A força pode não corresponder ao esforço real do polegar (H-02) | maintainer  | pendente |
| A direção pela orientação da mão pode não corresponder ao estalo real      | O tiro pode não ir aonde o jogador quer (H-04)                  | maintainer  | pendente |
| Taxa real da câmera ainda não medida                                       | Hipótese de reprocessamento (H-03) aberta                       | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** pendente (maintainer wezercarvalho)
- **Data:** pendente
- **Escopo aprovado:** pendente
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende dos gates automatizados verdes (já passam) e do teste manual do maintainer no Chrome desktop com a direção pela orientação da mão, a força logarítmica e a taxa real da câmera. A issue #72 permanece aberta até esse registro.
