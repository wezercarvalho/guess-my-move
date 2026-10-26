# Validação — 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-26`
- **Executor/revisor:** kirocrew (agente); teste manual e Gate 3 pendentes do maintainer wezercarvalho
- **Commit:** a registrar no fechamento do Gate 3

## Resumo do resultado

Implementação concluída e gates automatizados verdes. Falta o teste manual do maintainer no Chrome desktop (T030), que decide SC-002, SC-003 e NFR-002. Na validação ponta a ponta no Chromium de uma VPS, com a câmera simulada pelos 12 clipes de referência, 2 dos 5 acenos foram reconhecidos e nenhum dos 7 confusores gerou falso positivo; o detector rodou a 5 a 7 quadros por segundo, e a reanálise das séries indica que o reconhecimento cai com menos amostras por segundo (ver Medições). Esse resultado não é a medida do desktop do maintainer.

## Conclusão das tarefas

- **Concluídas:** 29 (T001 a T029)
- **Pendentes:** 1 (T030, teste manual do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                           | Resultado |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T002, T004       | `card.test.ts` (projeção pública sem critério), `schemas.test.ts`                                   | PASS      |
| FR-002    | T002, T004       | `schemas.test.ts` (campos estritos, positivos), carta Acenar em `card/acenar.ts`                    | PASS      |
| FR-003    | T006, T007       | `gesture-angle.test.ts` (8 testes, inclui proporção da imagem)                                      | PASS      |
| FR-004    | T008, T009, T011 | `gesture-oscillation.test.ts` (9), `gesture-clips.test.ts` (14)                                     | PASS      |
| FR-005    | T012, T013       | `round.test.ts` (17 testes: fluxo, limite de 10 s, exceções, transições inválidas)                  | PASS      |
| FR-006    | T019, T020       | `GestureScreen.test.tsx` (16 testes) e execução no Chromium                                         | PASS      |
| FR-007    | T017, T018       | `mediapipeTracker.test.ts` (GPU, recuo, delegate forçado, parâmetro de URL) e execução no Chromium  | PASS      |
| FR-008    | T021, T022       | `handOverlay.test.ts`, `DebugPanel.test.tsx`, captura de tela do Chromium                           | PASS      |
| FR-009    | T015, T016       | `prepare-assets.test.mjs` (6 testes), `yarn prepare:assets` real com hash verificado, build         | PASS      |
| FR-010    | T023, T024       | busca no código sem rede, armazenamento, log ou exportação de imagem; inspeção de rede no Chromium  | PASS      |
| FR-011    | T001, T014       | `apps/server`, `packages/providers`, `packages/benchmark` removidos; `yarn check:all` verde         | PASS      |
| FR-012    | T019, T020       | `GestureScreen.test.tsx` (falha ao carregar, erro de inferência, tentar de novo)                    | PASS      |
| FR-013    | T025, T026, T027 | documentos reescritos; `yarn docs:format:check`, `yarn sdd:check`, `yarn test:sdd`                  | PASS      |
| FR-014    | T010             | `fixtures/clip-angles.json` só com tempo e ângulo; teste confirma que cada amostra tem dois números | PASS      |

## Histórias e critérios de aceitação

| História/cenário   | Demonstração                                                                                          | Resultado |
| ------------------ | ----------------------------------------------------------------------------------------------------- | --------- |
| US-001 / cenário 1 | Testes de tela e Chromium: 2 de 5 acenos reconhecidos a 5 a 7 quadros/s; falta o Chrome do maintainer | BLOCKED   |
| US-001 / cenário 2 | Testes de tela e Chromium: "não reconhecido" ao fim de 10 s                                           | PASS      |
| US-001 / cenário 3 | Testes de tela e 7 de 7 confusores sem falso positivo no Chromium                                     | PASS      |
| US-001 / cenário 4 | `GestureScreen.test.tsx`: câmera negada, sem detector e sem rodada                                    | PASS      |
| US-002 / 1 a 3     | `gesture-oscillation.test.ts`, `gesture-clips.test.ts` (5 de 5 e 0 de 7 a 15 amostras/s)              | PASS      |
| US-003 / 1 e 2     | `handOverlay.test.ts`, `DebugPanel.test.tsx`; painel lido no Chromium                                 | PASS      |
| US-004 / 1         | Chromium: 47 requisições por clipe, todas GET ao próprio app; nenhuma com corpo                       | PASS      |
| US-004 / 2         | Busca no repositório: sem os pacotes removidos nem referências a provedores no código                 | PASS      |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                                        |
| ---------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------- |
| `yarn check:all`             | 2026-10-26 | PASS      | typecheck, lint (0 erros, 0 avisos), core 68 testes, web 66 testes, scripts 6 testes, build |
| `yarn sdd:check`             | 2026-10-26 | PASS      | catálogo, estados, gates, cobertura e links válidos                                         |
| `yarn test:sdd`              | 2026-10-26 | PASS      | 109 testes                                                                                  |
| `yarn docs:format:check`     | 2026-10-26 | PASS      | todos os documentos no estilo do Prettier                                                   |
| `yarn test:gates`            | 2026-10-26 | PASS      | hook, auditor e workflows                                                                   |
| `yarn security:dependencies` | 2026-10-26 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                                   |

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** o app real (Vite, `?delegate=cpu`) no Chromium headless de uma VPS compartilhada. A câmera foi simulada reproduzindo cada um dos 12 clipes de referência, recortados na região da webcam e reduzidos a 640 por 480 em um canvas. Cada clipe começou a tocar no clique em Começar. Uma execução por clipe.
- **Reconhecimento no app:** acenos 01 (6,3 s) e 02 (8,9 s) reconhecidos; 03 (devagar), 04 (rápido) e 05 (longe) não reconhecidos. Confusores 06 a 12: nenhum reconhecido. Resultado: 2 de 5 acenos e 0 de 7 falsos positivos.
- **Taxa de quadros e latência de inferência (CPU, VPS):** 34 a 76 quadros processados em 10 s (cerca de 3 a 8 por segundo); latência mediana por quadro de 100 a 210 ms e p95 de 190 a 430 ms entre os clipes.
- **GPU na VPS:** o delegate GPU usa WebGL por software (SwiftShader) e levou cerca de 1,3 s por quadro (mediana, 5 quadros); por isso existe `?delegate=cpu|gpu`.
- **Relação com a taxa de amostras:** reavaliando as séries de ângulo dos 12 clipes com menos amostras por segundo, o resultado cai com a taxa: 15 por segundo, 5 de 5 acenos; 7,5 por segundo, 7 de 10; 5 por segundo, 9 de 15; sem falso positivo nos três casos. O reconhecimento depende da taxa de quadros do dispositivo.
- **Limitações:** uma pessoa, uma câmera simulada por gravação de tela, uma execução por clipe, VPS sem GPU. Não permite concluir recall, falsos positivos, latência ou taxa de quadros do Chrome desktop do maintainer, que é o que SC-002, SC-003 e NFR-002 exigem (T030).

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passou.
- **Contratos:** `Card` estrito com critério tipado; API pública do core reduzida e coberta por testes.
- **Privacidade e segredos:** nenhum frame persistido ou logado; nenhuma chave no bundle ou no repositório; o modelo `.task` não é versionado.
- **Fronteira de informação:** `card.test.ts` falha se `evaluation` ou o critério aparecerem em `toPublicCard`.
- **UTF-8 e acentuação:** conferidos na revisão dos documentos.
- **Alterações fora de escopo:** `.kiro/settings/` (já existente e não rastreado) preservado; os padrões de escopo do gate, que citam `.env.example`, não foram alterados.

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                             |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 antes do código; descobertas (proporção, delegate) atualizaram a spec antes. |
| II. Uma fonte vigente                       | PASS      | Três specs anteriores `superseded`; `PROJECT_SPEC.md` aponta para a spec vigente.        |
| III. Rastreabilidade                        | PASS      | Matriz acima cobre os 14 FR.                                                             |
| IV. Test-first e incremental                | PASS      | Falhas esperadas confirmadas antes da implementação nos blocos do núcleo e do detector.  |
| V. Evidência honesta                        | PASS      | Amostra, condições e a dependência da taxa de quadros declaradas; nenhuma taxa geral.    |
| VI. Fronteira, privacidade e segredos       | PASS      | Teste de fronteira; sem rede para imagens; modelo não versionado.                        |
| VII. Neutralidade e contexto sob demanda    | PASS      | Contexto técnico atualizado em `docs/development-context/`.                              |
| VIII. Clareza, preservação, operação segura | PASS      | Remoção restrita ao escopo autorizado; alterações preexistentes preservadas.             |

## Convergência

- **Divergências encontradas:** a proporção da imagem e o desempenho do delegate GPU por software; ambos incorporados à spec (FR-003, FR-007, H-03) antes do código.
- **Artefatos reabertos:** `spec.md`, `plan.md` e `research.md` receberam essas duas descobertas.
- **Reexecuções:** o ponta a ponta foi repetido com a entrada em 640 por 480, porque a 1360 por 1020 a latência inviabilizava a medição na VPS.

## Limitações e riscos residuais

| Limitação/risco                                             | Impacto                            | Responsável | Aceite   |
| ----------------------------------------------------------- | ---------------------------------- | ----------- | -------- |
| Reconhecimento depende da taxa de quadros; medido só na VPS | Pode falhar em máquinas lentas     | maintainer  | pendente |
| Amostra de uma pessoa e uma câmera                          | Generalização desconhecida         | maintainer  | pendente |
| Licença do arquivo do modelo não confirmada na fonte        | Bloqueia redistribuição do arquivo | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-26`
- **Escopo aprovado:** pendente do teste manual (T030)
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende do teste do maintainer no Chrome desktop.
