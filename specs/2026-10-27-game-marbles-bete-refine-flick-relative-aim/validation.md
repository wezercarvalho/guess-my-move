# Validação — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-27`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho pendente (Gate 3)
- **Commit:** a registrar no fechamento do Gate 3

## Resumo do resultado

Implementação concluída e gates automatizados verdes; o Gate 3 e o teste manual do maintainer (T014) continuam pendentes. O estalo passou a mirar pelo arrasto relativo da mão, reaproveitando a pinça virtual e `computeShot` do modo pinça, e a abertura rápida (subida de até 80 ms e velocidade de pelo menos 2 razão/s) é só o gatilho. Saíram do código `handDirection`, a direção na leitura e na soltura, a seta de orientação, `flickShot` e os parâmetros de força por velocidade de abertura. O resultado `sem direção` foi trocado por `sem tiro`. O laço processa o detector só por quadro novo da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`) e o painel mostra os quadros novos da câmera por segundo. Os testes cobrem tudo sem câmera; no Chromium da VPS com câmera simulada o caminho `requestVideoFrameCallback` funcionou. Nenhum estalo foi exercitado com mão e a viabilidade continua desconhecida.

## Conclusão das tarefas

- **Concluídas:** 13 (T001 a T013)
- **Pendentes:** 1 (T014, teste manual do maintainer e Gate 3)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                                                  | Resultado |
| --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T003, T005 | `round.test.ts`: pinça virtual igual à bolinha mais o arrasto vezes a escala; previsão igual à do modo pinça                                               | PASS      |
| FR-002    | T001, T002 | `flick.test.ts`: sem `handDirection`, `flickShot`, `direction` nem parâmetros de força; `slowMs` 80 e `minOpenSpeed` 2                                     | PASS      |
| FR-003    | T001, T004 | `flick.test.ts` (37 ms rápido, 80 ms limite, 81 e 103 ms lentos, fraco) e `round.test.ts` (dispara, cancela por lento, fraco, arrasto curto e sem arrasto) | PASS      |
| FR-004    | T004, T005 | `round.test.ts` (perda da mão por mais e menos de 300 ms; detector que zera o armado) e `flick.test.ts` (perder a mão zera o armado)                       | PASS      |
| FR-005    | T006, T007 | `marblesController.test.ts`: só processa por quadro novo com e sem `requestVideoFrameCallback`; cancela a espera ao parar                                  | PASS      |
| FR-006    | T007, T009 | `marblesController.test.ts` e `MarblesScreen.test.tsx`: taxa da câmera nos dois modos; resultados `disparado`, `lento demais`, `fraco demais`, `sem tiro`  | PASS      |
| FR-007    | T008, T009 | `MarblesScreen.test.tsx` (orientação e rótulo alpha) e `fieldView.test.ts` (previsão como na pinça, sem seta de orientação)                                | PASS      |
| FR-008    | T010       | busca no código sem `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.` nem persistência; Chromium: 52 requisições, todas GET para a própria origem        | PASS      |
| FR-009    | T011       | testes do modo pinça em `packages/marbles` e do jogo de cartas passam (`yarn check:all`)                                                                   | PASS      |
| FR-010    | T012       | README, guia de arquitetura, `PROJECT_SPEC.md` e `specs/README.md` atualizados; `yarn docs:format:check` e `yarn sdd:check`                                | PASS      |

NFR-002 segue em aberto até o teste do maintainer: os textos não afirmam desempenho nem viabilidade e declaram os limiares como palpites.

## Histórias e critérios de aceitação

| História/cenário       | Demonstração                                                                      | Resultado |
| ---------------------- | --------------------------------------------------------------------------------- | --------- |
| US-001 / mira relativa | `round.test.ts` e `fieldView.test.ts`; nenhuma mira com mão real                  | PASS      |
| US-002 / gatilho       | `flick.test.ts` e `round.test.ts`; nenhum gatilho com mão real                    | PASS      |
| US-003 / quadros novos | controlador em jsdom e Chromium com câmera simulada (`requestVideoFrameCallback`) | PASS      |
| US-004 / tela e painel | `MarblesScreen.test.tsx`                                                          | PASS      |
| US-005 / privacidade   | busca no código e inspeção de rede no Chromium                                    | PASS      |

Critérios que dependem de mão real (SC-002, SC-003) e da câmera do maintainer ficam na T014.

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                          |
| ---------------------------- | ---------- | --------- | ------------------------------------------------------------- |
| `yarn docs:format:check`     | 2026-10-27 | PASS      | todos os documentos no estilo do Prettier                     |
| `yarn sdd:check`             | 2026-10-27 | PASS      | catálogo, estados, gates, cobertura e links válidos           |
| `yarn test:sdd`              | 2026-10-27 | PASS      | 109 testes                                                    |
| `yarn check:all`             | 2026-10-27 | PASS      | typecheck, lint, testes (core 68, marbles 95, web 130), build |
| `yarn test:gates`            | 2026-10-27 | PASS      | 231 testes                                                    |
| `yarn security:dependencies` | 2026-10-27 | PASS      | nenhuma vulnerabilidade em nenhum nível                       |

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** a página `marbles.html?mode=estalo&delegate=cpu` no Chromium headless de uma VPS compartilhada, com a câmera simulada pelo dispositivo falso do Chromium (`--use-fake-device-for-media-stream`, sem mão no quadro). Uma execução de cerca de 9 s.
- **Taxa da câmera:** o painel mostrou 18,8 quadros novos da câmera por segundo, com `requestVideoFrameCallback` disponível e 151 quadros processados no total; o dispositivo falso é nominalmente de 20 quadros por segundo. Isto só mostra que a contagem funciona; não é a taxa da webcam do maintainer.
- **Rede:** 52 requisições, todas GET para a própria origem, nenhuma com corpo e nenhuma externa.
- **Leitura de origem do refino:** a sessão de teste do maintainer (cerca de 40 s, Chrome desktop, câmera real) registrou 15 aberturas, velocidade de abertura de 9,1 a 199 razão/s, subida de 11 a 13 ms em 8 delas, 103 e 192 ms em duas, cerca de 86 quadros processados por segundo e latência mediana de 9 ms; 8 tiros e nenhum acerto. Foi lida do painel em vídeo de tela, que não faz parte do repositório.
- **Limitações:** nenhuma medição do estalo com a mira relativa; a taxa real da webcam do maintainer continua desconhecida; os limiares são palpites de uma única sessão.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passa.
- **Contratos:** `packages/marbles` não depende de `packages/core`; a mira do estalo reusa `computeShot` e a pinça virtual do modo pinça sem relógio próprio (o tempo entra por argumento).
- **Privacidade e segredos:** busca no código sem `fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, `localStorage`, `sessionStorage`, `indexedDB`, `MediaRecorder`, `toDataURL` nem `toBlob` fora dos testes; sem chaves.
- **UTF-8 e acentuação:** conferidos.
- **Alterações fora de escopo:** a marcação da spec antiga como `superseded`, prevista em `plan.md`.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado |
| ---------------------------------- | --------- | ---------------------------- |
| I. Intenção antes da implementação | PENDENTE  | a preencher no Gate 3        |

## Convergência

- **Divergências encontradas:** a hipótese de que o laço relia quadros repetidos da câmera ficou sem confirmação; o laço já comparava `currentTime`, que num fluxo ao vivo pode mudar a cada quadro de exibição, então a correção por `requestVideoFrameCallback` e o contador no painel foram mantidos como medição.
- **Artefatos reabertos:** nenhum.
- **Reexecuções:** os gates completos rodaram depois das últimas mudanças de código e de texto.

## Limitações e riscos residuais

| Limitação/risco                                                            | Impacto                                                    | Responsável | Aceite   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- | -------- |
| Estalo com mira relativa não testado com a mão                             | Viabilidade da issue #72 desconhecida                      | maintainer  | pendente |
| `slowMs` de 80 ms e `minOpenSpeed` de 2 razão/s são palpites de uma sessão | Pode cancelar estalos legítimos ou passar aberturas lentas | maintainer  | pendente |
| Taxa real da câmera ainda não medida                                       | Hipótese de reprocessamento (H-02) aberta                  | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** pendente (maintainer wezercarvalho)
- **Data:** pendente
- **Escopo aprovado:** pendente
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende da implementação do código, dos gates automatizados verdes e do teste manual do maintainer no Chrome desktop com a mira relativa e a taxa real da câmera. A issue #72 permanece aberta até esse registro.
