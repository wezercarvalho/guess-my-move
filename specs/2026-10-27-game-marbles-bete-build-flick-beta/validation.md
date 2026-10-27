# Validação — 2026-10-27-game-marbles-bete-build-flick-beta

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-27`
- **Executor/revisor:** kirocrew (agente); teste manual e Gate 3 pendentes do maintainer wezercarvalho
- **Commit:** a registrar no fechamento do Gate 3

## Resumo do resultado

Implementação concluída e gates automatizados verdes. **O estalo não foi testado com a mão de ninguém**: a viabilidade dele é a pergunta da issue #68 e só o teste do maintainer no Chrome desktop (T015) responde a ela. O que existe é o detector, a conversão da abertura em força, a rodada em modo estalo, o seletor de modo e o painel com os números do detector, tudo coberto por testes sem câmera. Na VPS, o Chromium com o MediaPipe real carregou a página com `?mode=estalo`, mostrou o seletor e as linhas novas do painel e deixou o detector pronto, mas sem nenhuma pinça nem estalo. Todos os números do estalo (histerese, 0,40, 300 ms, 2 e 8 razão/s, 300 e 1100 unid/s) são palpites não medidos.

## Conclusão das tarefas

- **Concluídas:** 14 (T001 a T014)
- **Pendentes:** 1 (T015, teste manual do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                                                                                        | Resultado |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T001, T002 | `flick.test.ts` (detector: armar, soltura rápida, lenta e fraca, pico da inclinação, direção do início da subida, mão perdida, reset)                                                            | PASS      |
| FR-002    | T001, T002 | `flick.test.ts` (`handDirection`: cima, espelhamento, baixo, proporção da imagem, vetor unitário, casos degenerados)                                                                             | PASS      |
| FR-003    | T003, T004 | `flick.test.ts` (`flickShot`: mapeamento 2 a 8 para 300 a 1100, limites, direção, cancelamento, parâmetros próprios)                                                                             | PASS      |
| FR-004    | T005, T006 | `round.test.ts` (13 testes do modo estalo: armar, pré-visualização, disparo, força e acerto, lento e fraco, sem direção, erro, perda da mão, detector zerado, rolling)                           | PASS      |
| FR-005    | T007, T008 | `marblesController.test.ts` (`modeFromSearch`, `setMode`, roteamento por modo, troca reinicia) e `MarblesScreen.test.tsx` (seletor, `?mode=estalo`, volta à pinça)                               | PASS      |
| FR-006    | T009, T010 | `MarblesScreen.test.tsx` (mensagens por estado no estalo, rótulo beta), `fieldView.test.ts` (seta de direção, sem elástico) e captura de tela do Chromium                                        | PASS      |
| FR-007    | T007, T010 | `marblesController.test.ts` (armado, velocidade, duração e resultado), `MarblesScreen.test.tsx` (linhas só no estalo) e painel lido no Chromium                                                  | PASS      |
| FR-008    | T011       | busca no código sem rede, armazenamento ou gravação; Chromium: 55 requisições, todas GET para a própria origem, nenhuma com corpo, nenhuma externa                                               | PASS      |
| FR-009    | T012       | testes existentes do modo pinça (`round`, `pinch`, `shot`, `physics`) e do jogo de cartas passam sem alteração; nenhum arquivo do jogo de cartas mudou                                           | PASS      |
| FR-010    | T013       | `README.md` da raiz reescrito, `README.md` de `docs/development-context/` e `docs/development-strategies/`, guia de arquitetura e `PROJECT_SPEC.md` atualizados; formatação e `sdd:check` verdes | PASS      |

## Histórias e critérios de aceitação

| História/cenário     | Demonstração                                                                                                            | Resultado |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / estalo      | Testes do controlador, da tela e da rodada com mão simulada: armar, abrir rápido, disparar e acertar. Falta a mão real. | BLOCKED   |
| US-001 / abrir lento | Testes da rodada e do controlador: a abertura lenta ou fraca cancela sem contar tiro.                                   | PASS      |
| US-002 / trocar      | Testes da tela e do controlador; Chromium: voltar à pinça remove as linhas do estalo e restaura a mensagem da pinça.    | PASS      |
| US-003 / depuração   | Testes da tela e painel lido no Chromium com o MediaPipe real.                                                          | PASS      |
| US-004 / privacidade | Busca no código e inspeção de rede no Chromium.                                                                         | PASS      |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                                               |
| ---------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------------- |
| `yarn check:all`             | 2026-10-27 | PASS      | typecheck, lint (0 erros, 0 avisos), core 68, marbles 96, web 118 testes mais 10 de scripts, build |
| `yarn sdd:check`             | 2026-10-27 | PASS      | catálogo, estados, gates, cobertura e links válidos                                                |
| `yarn test:sdd`              | 2026-10-27 | PASS      | 109 testes                                                                                         |
| `yarn docs:format:check`     | 2026-10-27 | PASS      | todos os documentos no estilo do Prettier                                                          |
| `yarn test:gates`            | 2026-10-27 | PASS      | 231 testes                                                                                         |
| `yarn security:dependencies` | 2026-10-27 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                                          |

Os comandos rodaram no Node 24 da VPS, e o `package.json` pede Node 26; o `pr-gate` remoto roda no Node do projeto.

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** a página `marbles.html?mode=estalo&delegate=cpu` no Chromium headless de uma VPS compartilhada, com a câmera simulada pelo clipe de aceno `01-aceno-direita-normal` recortado na região da webcam. Uma execução de cerca de 6 s.
- **O que o clipe permite verificar:** que o modo estalo carrega, que o seletor e as linhas do painel aparecem (Armado, Velocidade da abertura, Duração da subida, Resultado do último estalo) e que a mão aberta não arma nem dispara ("Armado: não"). Nenhuma pinça foi fechada, então **o estalo em si não foi exercitado**.
- **Rede:** 55 requisições, todas GET para a própria origem, nenhuma com corpo, nenhuma externa.
- **Taxa de quadros disponível:** num teste anterior do maintainer, o detector processou cerca de 83 quadros por segundo com latência mediana de 8 a 10 ms (GPU). É uma medição de uma máquina e não diz nada sobre outras câmeras; com 30 quadros por segundo, um estalo de 50 a 100 ms teria só 2 a 3 amostras (H-04).
- **Limitações:** nenhuma medição do estalo real; não há dado sobre quantos quadros dura um estalo, nem sobre a perda da mão no movimento. Não permite concluir viabilidade, recall nem falso disparo, que é o que SC-002, SC-003 e NFR-002 exigem (T015).

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passou.
- **Contratos:** `packages/marbles` continua sem dependência de `packages/core`; `flick.ts` é puro e sem relógio próprio (o tempo entra por argumento).
- **Privacidade e segredos:** nenhum frame persistido ou logado; nenhuma chave; o modelo `.task` continua sem versionar.
- **Isolamento:** o modo pinça e seus testes não mudaram de comportamento; `App.tsx`, `src/round/`, `src/card/` e `packages/core` sem alteração.
- **UTF-8 e acentuação:** conferidos na revisão dos documentos.
- **Alterações fora de escopo:** `.kiro/settings/` (já existente e não rastreado) preservado.

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                                                                           |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 antes do código.                                                                                                           |
| II. Uma fonte vigente                       | PASS      | Spec nova que estende, sem substituir, a do modo pinça; catálogo atualizado.                                                           |
| III. Rastreabilidade                        | PASS      | Matriz acima cobre os 10 FR.                                                                                                           |
| IV. Test-first e incremental                | PASS      | Testes escritos antes de cada módulo; falha por módulo ausente ou comportamento ausente confirmada no detector, na rodada e na tela.   |
| V. Evidência honesta                        | PASS      | O estalo está rotulado beta, nenhum número de viabilidade ou desempenho é afirmado, e a ausência de teste com mão real está declarada. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem; busca no código sem armazenamento ou gravação.                                                                   |
| VII. Neutralidade e contexto sob demanda    | PASS      | READMEs e guia de arquitetura atualizados.                                                                                             |
| VIII. Clareza, preservação, operação segura | PASS      | Modo pinça e jogo de cartas preservados; alterações preexistentes preservadas.                                                         |

## Convergência

- **Divergências encontradas:** dois testes meus do detector estavam errados antes da implementação (um começava a abertura lenta em 0,39, valor que nunca armaria a pinça, e outro só verificava que a direção "não é nula"); foram corrigidos antes de escrever o código. O texto de introdução da página ainda descrevia só a pinça e foi atualizado.
- **Artefatos reabertos:** nenhum documento da spec precisou voltar atrás.
- **Reexecuções:** os gates completos foram repetidos depois das últimas mudanças de texto.

## Limitações e riscos residuais

| Limitação/risco                                                                         | Impacto                                 | Responsável | Aceite   |
| --------------------------------------------------------------------------------------- | --------------------------------------- | ----------- | -------- |
| O estalo dura poucos quadros e o detector pode perder a mão em movimento rápido         | O modo pode ser inviável nesta câmera   | maintainer  | pendente |
| A direção vem da orientação da mão no plano da imagem; apontar para a câmera a degenera | Tiro na direção errada ou cancelado     | maintainer  | pendente |
| Todos os limiares do estalo são palpites                                                | Disparos falsos ou tiros que nunca saem | maintainer  | pendente |
| Abrir a mão sem querer, rápido, pode disparar                                           | Tiro involuntário                       | maintainer  | pendente |
| Câmera de 30 quadros por segundo pode dar só 2 a 3 amostras por estalo                  | Força imprecisa                         | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Escopo aprovado:** pendente do teste manual (T015)
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende do teste do maintainer no Chrome desktop. A issue #68 não fecha com este trabalho; ela fecha com a decisão do maintainer sobre a viabilidade do estalo.
