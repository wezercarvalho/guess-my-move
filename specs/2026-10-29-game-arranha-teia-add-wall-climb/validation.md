# Validação — 2026-10-29-game-arranha-teia-add-wall-climb

## Estado

- **Spec:** `spec.md`
- **Status:** `implementing` (Gate 3 pendente do teste ao vivo do maintainer)
- **Constituição:** 1.0.0
- **Data:** `2026-10-29`
- **Executor/revisor:** kirocrew (agente); o maintainer wezercarvalho aprovou os Gates 1 e 2 antecipadamente e testará a tela ao vivo (Gate 3)
- **Commit:** branch `feat/81-escalar-paredes` (PR de rascunho/pronta contra `main`)

Esta validação registra a evidência coletada até aqui como TEXTO. **O Gate 3 NÃO está aprovado:** nada foi testado com a mão real nem numa GPU real, e a sensação do agarre e da escalada depende do teste ao vivo do maintainer. A spec permanece em `implementing`; nada é marcado `validated` por conta própria.

## Resumo do resultado

A mudança acrescenta ao Arranha-Teia o **agarre à parede** (issue #81). A lógica nova é pura, no módulo novo `packages/swing/src/climb.ts`: o estado `WallGrip` em `SwingState.grip`, os sinais de gesto `climbSignal` (movimento alternado dos pulsos → subir/descer, com zona morta e saturação) e `pullBackSignal` (afastar a mão da câmera pela profundidade `z` → soltar), e `stepGrip` (entra só com contato de parede mais `grab`, cola o jogador sem gravidade, sobe/desce por `climb * climbSpeed` e sai por quatro condições). O `SwingState` ganhou `grip` e `touchingWall`; o `SwingInput` ganhou `grab`/`climb`/`release`; o `SwingConfig` ganhou `grip: GripConfig`. O `stepPlayer` passou a aceitar o pedido do jogador e a rodar o regime de agarre antes da física normal. A camada web (`swingController.ts`) lê os sinais das mãos, aplica a precedência da palma aberta (com `touchingWall` agarra; sem contato, solta a teia), e as teclas `V` (agarrar) e setas para cima/baixo (subir/descer); o HUD mostra "Agarrado", o guia e a dica trazem a nova mecânica, e o painel de depuração mostra a palma aberta e o puxar-para-trás por mão. O fluxo de teia por mão (CQ-009) não regrediu.

## Conclusão das tarefas

- **Concluídas:** T001 a T009 (sinais, estado de agarre com teste de propriedade, entrada no mundo, controlador com precedência e teclas, HUD/guia/depuração, não regressão, documentação, gates e verificação headless).
- **Pendentes:** T010 — fechar o Gate 3, que depende do teste ao vivo do maintainer. Fica **pendente**; a spec segue `implementing`.
- **Evidência:** `tasks.md`.

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                                          | Resultado |
| --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T002       | `climb.test.ts`: agarra só com contato de parede + `grab`; zera a velocidade e solta as teias; sem contato não agarra                              | PASS      |
| FR-002    | T002, T004 | `climb.test.ts`/`world`: `SwingInput` com `grab`/`climb`/`release`; sobe com `climb` positivo, desce com negativo, altura mantida com `climb` nulo | PASS      |
| FR-003    | T003       | `climb.test.ts`: saídas por `grab` vazio, `release`, teia, topo→telhado e inatividade; **teste de propriedade** (300 ensaios) sai em tempo finito  | PASS      |
| FR-004    | T001       | `climbSignal.test.ts`: sinal positivo/negativo/zona morta/saturação e `pullBackSignal` além do limite, com dados sintéticos                        | PASS      |
| FR-005    | T005       | `swingClimb.test.ts`: a palma aberta em contato com a parede agarra (não só solta a teia)                                                          | PASS      |
| FR-006    | T005       | `swingClimb.test.ts`: `V` agarra em contato, setas sobem/descem; soltar `V` larga                                                                  | PASS      |
| FR-007    | T006       | `SwingScreen.test.tsx`/`guide.test.ts`/`swingClimb.test.ts`: HUD "Agarrado", dica e status do agarre, depuração com palma aberta e puxar-para-trás | PASS      |
| FR-008    | T007       | suíte completa verde: `twoWebs`, `moves`, `sides`, `swingHands`, `SwingScreen` sem regressão                                                       | PASS      |

## Histórias e critérios de aceitação

| História/cenário                     | Demonstração                                                                                                     | Resultado |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / agarrar com as mãos abertas | `climb.test.ts` (entra só com contato + grab, zera velocidade, solta teias); headless: V em contato → "Agarrado" | PASS      |
| US-002 / subir e descer              | `climb.test.ts` (sobe com climb+, desce com climb−, altura mantida com climb nulo); `swingClimb.test.ts` (setas) | PASS      |
| US-003 / soltar da parede            | `climb.test.ts` (saída por `release`); `swingClimb.test.ts` (soltar V larga)                                     | PASS      |
| US-004 / nunca ficar preso           | `climb.test.ts` teste de propriedade (300 ensaios) + piloto aleatório na cidade real (200 ensaios)               | PASS      |
| US-005 / guia, dica e depuração      | `guide.test.ts`, `SwingScreen.test.tsx`, `swingClimb.test.ts`; headless: dica "V agarra na parede"               | PASS      |

Os critérios que dependem da mão real na câmera (a palma como agarre, o movimento alternado como escalada, o "puxar para trás" pela profundidade) ficam pendentes do teste ao vivo do maintainer (Gate 3).

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                           |
| ---------------------------- | ---------- | --------- | ------------------------------------------------------------------------------ |
| `yarn check:static`          | 2026-10-29 | PASS      | typecheck + lint: 0 avisos, 0 erros, 144 arquivos                              |
| `yarn test`                  | 2026-10-29 | PASS      | core 6, marbles 6, swing 14 (150 testes), web 29 arquivos; node:test da web 50 |
| `yarn build`                 | 2026-10-29 | PASS      | `prepare:assets` + `tsc --build` + `vite build`; bundle do swing em `dist`     |
| `yarn test:gates`            | 2026-10-29 | PASS      | 231 testes                                                                     |
| `yarn test:sdd`              | 2026-10-29 | PASS      | 109 testes                                                                     |
| `yarn sdd:check`             | 2026-10-29 | PASS      | catálogo, estados, gates, cobertura e links válidos                            |
| `yarn docs:format:check`     | 2026-10-29 | PASS      | Prettier: todos os arquivos no padrão                                          |
| `yarn security:dependencies` | 2026-10-29 | PASS      | info=0 low=0 moderate=0 high=0 critical=0; nenhuma dependência nova            |

## Medições e evidência visual (registradas como texto)

- **Testes puros do agarre (`packages/swing`, test-first):** `climbSignal.test.ts` (10 testes) e `climb.test.ts` (13 testes), vistos vermelhos antes da implementação. O `climb.test.ts` inclui o **teste de propriedade** de saída em tempo finito: 300 sequências aleatórias de `grab`/`climb`/`release` a partir do agarre, todas saíram do estado agarrado dentro do limite de passos, nenhuma prendeu o jogador. O pacote `swing` passou a ter **150 testes** (eram 127).
- **Testes do controlador (`apps/web`, mãos simuladas e teclado):** `swingClimb.test.ts` (5 testes) — `V` sem parede não agarra; encostar na parede e, com `V`, agarrar e as setas subirem; soltar `V` larga; a palma aberta em contato com a parede agarra (não só solta a teia); a depuração expõe a palma aberta e o puxar-para-trás. Os testes de teia por mão (`swingHands`, `swingController`, `SwingScreen`, `guide`) continuam passando (web swing: **87 testes**).
- **Pilotos automáticos descartáveis na cidade real (`apps/web/public/swing/midtown.json`, 556 prédios; teste removido após rodar, resultados como texto):**
    - **Subir até o topo:** o piloto lançou a teia e puxou até encostar na fachada no passo 211 (y = 107,6 m), agarrou e escalou com `climb = 1` até passar do topo do prédio, saindo do agarre no telhado (`grounded`), sem ficar preso.
    - **Sequências aleatórias:** 27 ensaios que começaram agarrados a prédios reais sortearam entradas aleatórias; o máximo de passos até soltar foi 9 e **nenhum** ensaio prendeu o jogador no agarre.
    - Estes pilotos são idealizados (sem mão humana) e **não** representam a jogabilidade real nem medem sensação.
- **Chromium headless (playwright-cli, build de produção servido por `http.server` em `127.0.0.1:5181`, `?delegate=cpu`, teclado no lugar da mão, sem mão real):** a página "Arranha-Teia" renderiza; o HUD mostra Velocidade, Altura e Teia; a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" aparece; o guia "Como jogar" e a dica "Sem câmera: … V agarra na parede, setas olham/sobem" aparecem; **0 erros no console** (só 4 avisos de desempenho do WebGL por software). Ao segurar Espaço + C o jogo começou e a teia prendeu (status "Abra a mão para soltar e voar!"); ao bater na fachada e pressionar `V`, o medidor passou a **"Agarrado"** e o status a "Agarrado. Alterne as mãos para subir; puxe para soltar." Nenhuma imagem foi guardada no repositório.
- **Rede / privacidade:** o build não usa CDN; o bundle do swing, o JSON da cidade e os assets são servidos pela própria origem (o `http.server` só serviu `127.0.0.1`). O processamento da câmera continua local; nada de imagem é gravado ou enviado.
- **Não medido (risco, pendente do Gate 3):** nada foi testado com a mão real nem numa GPU real; o sinal de "puxar para trás" pela profundidade `z` do MediaPipe é aproximado e não medido ao vivo; o movimento alternado como escalada, a palma aberta como agarre e a velocidade de escalada (`climbSpeed`), a zona morta e a tolerância de inatividade (`gripIdleMs`) são valores de jogo não medidos; fps não medido numa GPU real.

## Validações estruturais e documentais

- **SDD:** `yarn sdd:check` e `yarn test:sdd` passam; `specs/README.md` lista esta spec como `implementing`; os oito FR têm tarefa formal.
- **Privacidade e fronteira:** nenhuma requisição a terceiros; a câmera é local, sem gravar nem enviar imagem; o jogo não expõe critério secreto (não há carta).
- **UTF-8 e acentuação:** conferidos; sem mojibake.
- **Limitações declaradas (NFR-003/NFR-004):** o `z` do MediaPipe é aproximado; a escalada e o agarre não foram testados com a mão real; os valores do agarre são de jogo; fps não medido.

## Gate 3 — Convergência validada

- **Veredito:** PENDENTE — não aprovado.
- **Motivo:** o Gate 3 depende do teste ao vivo do maintainer (a palma como agarre, o movimento alternado como escalada e o "puxar para trás" com a mão real, numa GPU real). Nada disso foi exercitado. A spec permanece em `implementing` com o Gate 3 pendente; o agente não marca `validated` por conta própria.
- **O que falta:** o maintainer testar a tela ao vivo e registrar o veredito (aprovado ou aprovado com risco aceito), ou pedir ajustes nos valores de jogo do agarre.
