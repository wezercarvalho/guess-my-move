# Validação — 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento (implementação e gates concluídos; Gate 3 pendente)
- **Constituição:** 1.0.0
- **Data:** `2026-10-31`
- **Executor/revisor:** kirocrew (agente); Gate 3 pendente do teste do maintainer
- **Commit:** branch `feat/109-layout-e-feedback-na-tela`; PR a registrar

## Resumo do resultado

Em janelas de computador (a partir de 960 × 560 px) a tela do Arranha-Teia ocupa a janela sem rolagem da página. As mensagens (estados e avisos) aparecem sobre o jogo, na base do palco, por funções puras testadas. Em janelas menores o layout empilha e a página rola.

## Conclusão das tarefas

- **Concluídas:** 7 (T001 a T007)
- **Pendentes:** 0 (Gate 3 continua sendo aprovação do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                       | Resultado |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T004, T005 | `swing-layout.test.mjs`; Chromium: documento 1440×900 e 1280×720 iguais à janela                                | PASS      |
| FR-002    | T004, T005 | Chromium 390×844: documento de 1207 px, a página rola                                                           | PASS      |
| FR-003    | T004, T005 | `SwingScreen.test.tsx` (botão no cabeçalho, gaveta recolhida); `swing-layout.test.mjs` (`position: fixed`)      | PASS      |
| FR-004    | T001       | `feedback.test.ts`: `deriveChips` (trava, agarre, contagem com barra, subindo e descendo, parede, rosto, vazio) | PASS      |
| FR-005    | T002       | `feedback.test.ts`: `feedbackEvents` (liberada, soltou, teia presa e solta, rosto detectado, fora do jogo)      | PASS      |
| FR-006    | T003, T005 | `SwingFeedback.test.tsx`; Chromium: centrado (0,50), de 71% a 98% da altura do palco, `pointer-events: none`    | PASS      |
| FR-007    | T004       | `SwingScreen.test.tsx`: o título "Direção do olhar" aparece uma vez no painel                                   | PASS      |
| FR-008    | T006       | `check:all` verde: core 68, marbles 159, swing 227, web 407 Vitest + 78 node:test                               | PASS      |

## Histórias e critérios de aceitação

| História/cenário                  | Demonstração                                                                       | Resultado |
| --------------------------------- | ---------------------------------------------------------------------------------- | --------- |
| US-001 / ver o jogo sem rolar     | Chromium 1440×900 e 1280×720: documento do tamanho da janela                       | PASS      |
| US-002 / saber o que aconteceu    | Funções puras e componente com estados simulados; estados reais só com mão e rosto | PASS      |
| US-003 / mensagens que não cobrem | Pior caso (2 avisos e 3 estados) de 71% a 98% da altura, centro livre              | PASS      |
| US-004 / depurar sem alargar      | Gaveta fixa, fechada por padrão; teste do contrato do CSS                          | PASS      |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                                   |
| ---------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------- |
| `yarn check:all`             | 2026-10-31 | PASS      | typecheck, lint, core 68, marbles 159, swing 227, web 407 Vitest + 78 node:test, build |
| `yarn test:gates`            | 2026-10-31 | PASS      | 231 testes                                                                             |
| `yarn test:sdd`              | 2026-10-31 | PASS      | 109 testes                                                                             |
| `yarn sdd:check`             | 2026-10-31 | PASS      | catálogo, estados, gates, cobertura e links válidos                                    |
| `yarn docs:format:check`     | 2026-10-31 | PASS      | todos os arquivos no padrão após `docs:format:fix`                                     |
| `yarn security:dependencies` | 2026-10-31 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                              |

## Medições e benchmark

Chromium headless (canal `chromium`, WebGL por software), `dist` servido em `127.0.0.1`, sem câmera:

| Janela   | Altura do documento | Resultado                   |
| -------- | ------------------- | --------------------------- |
| 1440×900 | 900                 | sem rolagem; palco 1062×761 |
| 1280×720 | 720                 | sem rolagem                 |
| 390×844  | 1207                | empilhado; a página rola    |

A altura vem da captura de página inteira, que mede o documento. Com o `body` em `overflow: hidden`, conferi a imagem para confirmar que nada ficou cortado em 1440×900 (a coluna lateral sobra cerca de 170 px). Nenhum fps foi medido: o WebGL por software não prova desempenho.

## Validações estruturais e documentais

- **Links e catálogo:** `sdd:check`, `test:sdd` e `docs:format:check` passaram.
- **Privacidade e segredos:** nenhum dado novo; a câmera não foi alterada; o aviso de privacidade mantém a redação única.
- **Fronteira de informação:** não alterada.
- **UTF-8 e acentuação:** preservadas.
- **Alterações fora de escopo:** nenhuma; física, gestos, cidades e a tela das bolinhas não mudaram.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado                                                           |
| ---------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | Spec e Gates 1/2 antes do código                                                       |
| III. Rastreabilidade               | PASS      | FR-001 a FR-008 têm tarefa e evidência                                                 |
| IV. Test-first                     | PASS      | Funções puras, componente e testes da tela vistos falhar antes do código (ver abaixo)  |
| V. Evidência honesta               | PASS      | Layout medido só nos três tamanhos; sem fps; estados com mão e rosto reais não medidos |
| VI. Privacidade e segredos         | PASS      | Sem dado novo                                                                          |
| VIII. Preservação                  | PASS      | Mudança restrita ao Arranha-Teia; as bolinhas e a seleção de mapas não mudaram         |

## Convergência

- **Divergências encontradas:** (1) o `?raw` de CSS vem vazio no Vitest, então o contrato do CSS virou `node:test` (`swing-layout.test.mjs`); (2) a primeira versão ainda cortava a coluna lateral, então os contadores e os botões foram para o cabeçalho, o status e o guia viraram um painel, e o aviso de privacidade (mesma redação) foi para o rodapé do palco; (3) "Rosto de volta" enganava na primeira detecção, então virou "Rosto detectado".
- **Artefatos reabertos:** `spec.md` (texto do aviso de rosto) e o CSS.
- **Test-first:** vistos falhar antes do código: `feedback.test.ts` (módulo inexistente), `SwingFeedback.test.tsx` (módulo inexistente), os 5 testes novos de `SwingScreen.test.tsx` e a versão em Vitest do contrato do layout (10 vermelhos). O `swing-layout.test.mjs` e o teste do efeito no `body` foram escritos depois, sem vermelho observado.

## Limitações e riscos residuais

| Limitação/risco                                                | Impacto                                               | Responsável | Aceite             |
| -------------------------------------------------------------- | ----------------------------------------------------- | ----------- | ------------------ |
| Estados reais (travada, agarrado, contagem) não vistos ao vivo | Posição e leitura só conferidas com estados simulados | maintainer  | pendente do Gate 3 |
| Janelas entre 960 × 560 e 1280 × 720 com a câmera ativa        | A coluna lateral pode rolar sozinha                   | maintainer  | pendente do Gate 3 |
| "Como jogar" fica recolhido por padrão                         | O guia de cinco etapas exige um clique                | maintainer  | pendente do Gate 3 |
| Valores de jogo (1,6 s, três avisos, 960 × 560 px)             | Ajustáveis após o teste                               | maintainer  | pendente do Gate 3 |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Escopo aprovado:** pendente do teste ao vivo do layout e das mensagens
- **Riscos aceitos:** pendente
- **Observações:** gates finais concluídos; aguarda o teste do maintainer e a spec permanece `validating`.
