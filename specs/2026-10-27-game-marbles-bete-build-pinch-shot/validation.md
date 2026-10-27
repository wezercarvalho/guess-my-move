# Validação — 2026-10-27-game-marbles-bete-build-pinch-shot

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-27`
- **Executor/revisor:** kirocrew (agente); teste manual e Gate 3 pendentes do maintainer wezercarvalho
- **Commit:** a registrar no fechamento do Gate 3

## Resumo do resultado

Implementação concluída e gates automatizados verdes. Falta o teste manual do maintainer no Chrome desktop com a câmera real (T019), que decide SC-002, SC-003 e NFR-002. A física, o detector de pinça, o tiro e a rodada têm testes sem câmera. Na VPS, o Chromium com o MediaPipe real carregou a página `marbles.html`, deixou o detector pronto e leu a razão da pinça de uma mão real (clipe de aceno), mas nenhuma pinça foi testada com câmera real: os limiares, o ganho e a física são palpites ainda não calibrados.

## Conclusão das tarefas

- **Concluídas:** 18 (T001 a T018)
- **Pendentes:** 1 (T019, teste manual do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                          | Resultado |
| --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T003, T004 | `physics.test.ts` (15 testes: movimento, atrito, parada, paredes, colisão elástica, determinismo, entrada imutável)                | PASS      |
| FR-002    | T003, T004 | `physics.test.ts` (contato `[0, 1]`, sem tunelamento a 1100 unid/s, sem contato quando passa perto) e `round.test.ts` (acerto)     | PASS      |
| FR-003    | T005, T006 | `pinch.test.ts` (11 testes: razão, invariância à escala, proporção, histerese, ponto espelhado, mão ausente, limiares próprios)    | PASS      |
| FR-004    | T007, T008 | `shot.test.ts` (8 testes: direção, ganho, limite de 220, cancelamento abaixo de 30, parâmetros próprios)                           | PASS      |
| FR-005    | T009, T010 | `round.test.ts` (22 testes: pega a 70 unidades, mira, perda de mão, erro volta ao início, acerto, nova rodada, estados de exceção) | PASS      |
| FR-006    | T013, T014 | `MarblesScreen.test.tsx` (9 testes), `fieldView.test.ts` (6) e captura de tela do Chromium                                         | PASS      |
| FR-007    | T011, T012 | `marblesController.test.ts` (12 testes com relógio, quadros e rastreador injetados) e execução no Chromium com o MediaPipe real    | PASS      |
| FR-008    | T013, T014 | `MarblesScreen.test.tsx` (rótulos do painel) e painel lido no Chromium (delegate CPU, 295 quadros, mediana 66 ms, p95 85 ms)       | PASS      |
| FR-009    | T015       | busca no código sem rede, armazenamento ou gravação; Chromium: 51 requisições, todas GET para a própria origem, nenhuma com corpo  | PASS      |
| FR-010    | T001, T016 | pacote sem dependência do `core`; nenhum arquivo do jogo de cartas alterado; testes do `core` (68) e da web existentes verdes      | PASS      |
| FR-011    | T017       | `README.md`, `architecture-guide.md` e `PROJECT_SPEC.md` atualizados; `yarn docs:format:check` e `yarn sdd:check` verdes           | PASS      |

## Histórias e critérios de aceitação

| História/cenário     | Demonstração                                                                                                                 | Resultado |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / acerto      | Testes do controlador e da tela com mão simulada: pinça, arrasto, soltar e acerto. Falta a pinça com câmera real no desktop. | BLOCKED   |
| US-002 / erro        | Testes da rodada: a bolinha volta ao início e o jogador atira de novo.                                                       | PASS      |
| US-003 / depuração   | Testes da tela e painel lido no Chromium com o MediaPipe real.                                                               | PASS      |
| US-004 / privacidade | Busca no código e inspeção de rede no Chromium.                                                                              | PASS      |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                           |
| ---------------------------- | ---------- | --------- | ------------------------------------------------------------------------------ |
| `yarn check:all`             | 2026-10-27 | PASS      | typecheck, lint (0 erros, 0 avisos), core 68, marbles 56, web 93 testes, build |
| `yarn sdd:check`             | 2026-10-27 | PASS      | catálogo, estados, gates, cobertura e links válidos                            |
| `yarn test:sdd`              | 2026-10-27 | PASS      | 109 testes                                                                     |
| `yarn docs:format:check`     | 2026-10-27 | PASS      | todos os documentos no estilo do Prettier                                      |
| `yarn test:gates`            | 2026-10-27 | PASS      | 231 testes                                                                     |
| `yarn security:dependencies` | 2026-10-27 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                      |

Os comandos rodaram no Node 24 da VPS, e o `package.json` pede Node 26; o `pr-gate` remoto roda no Node do projeto.

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** a página `marbles.html` no Chromium headless de uma VPS compartilhada, com `?delegate=cpu` e a câmera simulada pelo clipe de aceno `01-aceno-direita-normal` recortado na região da webcam (640 por 480). Uma execução de cerca de 12 s.
- **Leitura da pinça:** em 24 amostras do painel, a mão estava visível em 10; a razão da pinça nessas 10 foi de 0,36 a 0,75 (mão aberta acenando) e a pinça nunca fechou. A menor razão (0,36) ficou perto do limiar de fechamento (0,35). É uma amostra pequena de uma única mão aberta, mas indica que o limiar pode precisar de ajuste para não fechar sozinho.
- **Quadros e latência (CPU, VPS):** 295 quadros processados; latência mediana de 66 ms e p95 de 85 ms. Não representa o desktop do maintainer.
- **Rede:** 51 requisições, todas GET para a própria origem (página, módulos e arquivos do MediaPipe), nenhuma com corpo e nenhuma externa.
- **Limitações:** nenhuma pinça foi feita com câmera real; não há medição de reconhecimento da pinça nem de acerto do alvo; uma pessoa, uma câmera simulada por gravação de tela, uma execução. Não permite concluir nada sobre a jogabilidade, que é o que SC-002, SC-003 e NFR-002 exigem (T019).

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passou.
- **Contratos:** `packages/marbles` sem dependência de `packages/core`; tipos de ponto estruturais compatíveis com os landmarks do MediaPipe.
- **Privacidade e segredos:** nenhum frame persistido ou logado; nenhuma chave; o modelo `.task` continua sem versionar.
- **Isolamento:** `index.html`, `App.tsx`, `src/round/`, `src/card/`, `src/camera/`, `src/tracker/` e `packages/core` sem alteração; o `vite.config.ts` ganhou a segunda entrada.
- **UTF-8 e acentuação:** conferidos na revisão dos documentos.
- **Alterações fora de escopo:** `.kiro/settings/` (já existente e não rastreado) preservado.

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                                            |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 antes do código; o atrito foi corrigido na spec antes de a física ser implementada.         |
| II. Uma fonte vigente                       | PASS      | Spec nova, sem substituir as anteriores; catálogo atualizado.                                           |
| III. Rastreabilidade                        | PASS      | Matriz acima cobre os 11 FR.                                                                            |
| IV. Test-first e incremental                | PASS      | Testes escritos antes de cada módulo; falha por módulo inexistente confirmada no pacote `marbles`.      |
| V. Evidência honesta                        | PASS      | Amostra, condições e a ausência de pinça com câmera real declaradas; nenhum número de desempenho geral. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem; busca no código sem armazenamento ou gravação.                                    |
| VII. Neutralidade e contexto sob demanda    | PASS      | Contexto técnico atualizado em `docs/development-context/`.                                             |
| VIII. Clareza, preservação, operação segura | PASS      | Jogo de cartas preservado; alterações preexistentes preservadas.                                        |

## Convergência

- **Divergências encontradas:** o atrito inicial de 700 unid/s² deixava o acerto quase impossível (arrasto mínimo de cerca de 144 unidades contra 150 disponíveis); trocado para 400 e a conta registrada em `research.md`, antes de implementar a física. O slug da spec ficou `game-marbles-bete-build-pinch-shot`, porque o validador exige id igual a data mais slug.
- **Artefatos reabertos:** `spec.md`, `plan.md`, `clarification.md` e `research.md` receberam o novo atrito.
- **Reexecuções:** os testes da física foram ajustados ao novo atrito e voltaram a passar.

## Limitações e riscos residuais

| Limitação/risco                                                          | Impacto                                    | Responsável | Aceite   |
| ------------------------------------------------------------------------ | ------------------------------------------ | ----------- | -------- |
| Limiares da pinça, ganho e física são palpites não calibrados            | A jogabilidade pode ficar difícil          | maintainer  | pendente |
| A razão da mão aberta chegou a 0,36, perto do limiar de fechamento 0,35  | Pinça pode fechar sozinha                  | maintainer  | pendente |
| Reconhecimento da pinça depende da taxa de quadros e da perda da mão     | Tiro perdido em movimento rápido           | maintainer  | pendente |
| Sem suavização do tremor da mão na primeira entrega                      | Mira instável                              | maintainer  | pendente |
| Mapear o quadro inteiro da câmera ao campo pode exigir movimentos largos | Cansaço do braço e dificuldade de precisão | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Escopo aprovado:** pendente do teste manual (T019)
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende do teste do maintainer no Chrome desktop.
