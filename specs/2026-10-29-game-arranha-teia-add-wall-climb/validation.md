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

A mudança acrescenta ao Arranha-Teia o **agarre à parede** (issue #81). A lógica nova é pura, no módulo novo `packages/swing/src/climb.ts`: o estado `WallGrip` em `SwingState.grip`, o sinal de gesto `climbSignal` (deslocamento vertical dos pulsos → `climb = clamp(up − down)`: descer uma mão por vez sobe, as duas subindo juntas descem, com zona morta e saturação), e `stepGrip` (entra só com contato de parede mais `grab`, cola o jogador sem gravidade, sobe/desce por `climb * climbSpeed` e sai por punho segurado, perder o agarre além da tolerância, teia ou topo). O `SwingState` ganhou `grip` e `touchingWall`; o `SwingInput` ganhou `grab`/`climb`/`releaseFist`; o `SwingConfig` ganhou `grip: GripConfig` (com `grabGraceMs`/`fistReleaseMs`). O `stepPlayer` passou a aceitar o pedido do jogador e a rodar o regime de agarre antes da física normal. A camada web (`swingController.ts`) lê os sinais das mãos, aplica a precedência da palma aberta (com `touchingWall` agarra; sem contato, solta a teia), e as teclas `V` (agarrar) e setas para cima/baixo (subir/descer); o HUD mostra "Agarrado", o guia e a dica trazem a nova mecânica (cue `wall`/`grip`), e o painel de depuração mostra a palma aberta e o punho por mão, além do contato/agarre/sinal. O fluxo de teia por mão (CQ-009) não regrediu.

**Emenda CQ-010 (2026-10-30):** após a revisão do dono (não entendeu como agarrar; a escalada não andava), a escalada e a soltura foram refeitas test-first — `climbSignal` passou de `(dyEsq − dyDir)/2` (que cancelava o movimento alternado) para `up − down`; a soltura passou do `z` do MediaPipe (código morto: `z` com origem no pulso ≈ 0) para o **punho fechado** segurado por tempo; acrescentadas a tolerância `grabGraceMs` e a dica de parede. Ver `clarification.md` CQ-010.

## Conclusão das tarefas

- **Concluídas:** T001 a T009 e **T011** (sinais, estado de agarre com teste de propriedade, entrada no mundo, controlador com precedência e teclas, HUD/guia/depuração, não regressão, documentação, gates e verificação headless; T011 refez a escalada/soltura da CQ-010).
- **Pendentes:** T010 — fechar o Gate 3, que depende do teste ao vivo do maintainer. Fica **pendente**; a spec segue `implementing`.
- **Evidência:** `tasks.md`.

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                                                                                            | Resultado |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T002             | `climb.test.ts`: agarra só com contato de parede + `grab`; zera a velocidade e solta as teias; sem contato não agarra                                                | PASS      |
| FR-002    | T002, T004, T011 | `climb.test.ts`/`world`: `grab`/`climb`/`releaseFist`; sobe com `climb`+, desce com −, altura mantida com nulo; braçadas alternadas = subida líquida                 | PASS      |
| FR-003    | T003, T011       | `climb.test.ts`: saídas por perder o agarre além de `grabGraceMs`, punho `fistReleaseMs`, teia, topo→telhado e inatividade; **propriedade** finita                   | PASS      |
| FR-004    | T001, T011       | `climbSignal.test.ts`: `up − down` (uma mão desce sobe, as duas sobem descem), zona morta, saturação, com dados sintéticos                                           | PASS      |
| FR-005    | T005             | `swingClimb.test.ts`: a palma aberta em contato com a parede agarra (não só solta a teia)                                                                            | PASS      |
| FR-006    | T005             | `swingClimb.test.ts`: `V` agarra em contato, setas sobem/descem; soltar `V` larga                                                                                    | PASS      |
| FR-007    | T006, T011       | `SwingScreen.test.tsx`/`guide.test.ts`/`swingClimb.test.ts`: HUD "Agarrado", status de parede/agarre, depuração palma/punho por mão e global                         | PASS      |
| FR-008    | T007             | suíte completa verde: `twoWebs`, `moves`, `sides`, `swingHands`, `SwingScreen` sem regressão                                                                         | PASS      |
| FR-009    | T012             | `headClimb.test.ts` (13): espera de 2 s, histerese, parada lateral, retomar exige esperar; `swingHeadClimb.test.ts` (6): sobe/desce pelo olhar, fica agarrado parado | PASS      |

## Histórias e critérios de aceitação

| História/cenário                     | Demonstração                                                                                                                             | Resultado |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / agarrar com as mãos abertas | `climb.test.ts` (entra só com contato + grab, zera velocidade, solta teias); `swingClimb.test.ts`: V/palma em contato → "Agarrado"       | PASS      |
| US-002 / subir e descer              | `climb.test.ts` (sobe com climb+, desce com climb−, altura com nulo, braçadas alternadas = subida líquida); `swingClimb.test.ts` (setas) | PASS      |
| US-003 / soltar da parede            | `climb.test.ts` (punho segurado `fistReleaseMs`); `swingClimb.test.ts` (punho fechado na câmera solta; soltar V larga)                   | PASS      |
| US-004 / nunca ficar preso           | `climb.test.ts` teste de propriedade (300 ensaios: fase aleatória + saída garantida por grace/punho)                                     | PASS      |
| US-005 / guia, dica e depuração      | `guide.test.ts` (status wall/grip, 5ª etapa), `SwingScreen.test.tsx`, `swingClimb.test.ts` (depuração palma/punho)                       | PASS      |

Os critérios que dependem da mão real na câmera (a palma como agarre, a escalada por deslocamento das mãos, o punho fechado como soltura) ficam pendentes do teste ao vivo do maintainer (Gate 3).

## Comandos executados

| Comando exato                         | Data       | Resultado | Evidência/observação                                                           |
| ------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------ |
| `yarn check:static`                   | 2026-10-29 | PASS      | typecheck + lint: 0 avisos, 0 erros, 144 arquivos                              |
| `yarn test`                           | 2026-10-29 | PASS      | core 6, marbles 6, swing 14 (150 testes), web 29 arquivos; node:test da web 50 |
| `yarn build`                          | 2026-10-29 | PASS      | `prepare:assets` + `tsc --build` + `vite build`; bundle do swing em `dist`     |
| `yarn test:gates`                     | 2026-10-29 | PASS      | 231 testes                                                                     |
| `yarn test:sdd`                       | 2026-10-29 | PASS      | 109 testes                                                                     |
| `yarn sdd:check`                      | 2026-10-29 | PASS      | catálogo, estados, gates, cobertura e links válidos                            |
| `yarn docs:format:check`              | 2026-10-29 | PASS      | Prettier: todos os arquivos no padrão                                          |
| `yarn security:dependencies`          | 2026-10-29 | PASS      | info=0 low=0 moderate=0 high=0 critical=0; nenhuma dependência nova            |
| `yarn check:static` (CQ-010)          | 2026-10-30 | PASS      | typecheck + oxlint: 0 avisos, 0 erros, 144 arquivos, 136 regras                |
| `yarn test` (CQ-010)                  | 2026-10-30 | PASS      | core 68, marbles 111, swing 153, web 255 (vitest) + 50 (node:test)             |
| `yarn build` (CQ-010)                 | 2026-10-30 | PASS      | `prepare:assets` + `tsc --build` + `vite build`; swing bundle 570 kB           |
| `yarn test:gates` (CQ-010)            | 2026-10-30 | PASS      | 231 testes                                                                     |
| `yarn test:sdd` (CQ-010)              | 2026-10-30 | PASS      | 109 testes                                                                     |
| `yarn sdd:check` (CQ-010)             | 2026-10-30 | PASS      | catálogo, estados, gates, cobertura e links válidos                            |
| `yarn docs:format:check` (CQ-010)     | 2026-10-30 | PASS      | após `yarn docs:format:fix`: todos os arquivos no padrão                       |
| `yarn security:dependencies` (CQ-010) | 2026-10-30 | PASS      | info=0 low=0 moderate=0 high=0 critical=0; nenhuma dependência nova            |
| `yarn check:static` (CQ-011)          | 2026-10-30 | PASS      | typecheck + oxlint: 0 avisos, 0 erros, 154 arquivos                            |
| `yarn test` (CQ-011)                  | 2026-10-30 | PASS      | core 68, marbles 111, swing 188, web 304 (vitest) + 50 (node:test)             |
| `yarn build` (CQ-011)                 | 2026-10-30 | PASS      | `prepare:assets` + `tsc --build` + `vite build`                                |
| `yarn test:gates` (CQ-011)            | 2026-10-30 | PASS      | 231 testes                                                                     |
| `yarn test:sdd` (CQ-011)              | 2026-10-30 | PASS      | 109 testes                                                                     |
| `yarn sdd:check` (CQ-011)             | 2026-10-30 | PASS      | catálogo, estados, gates, cobertura e links válidos                            |
| `yarn security:dependencies` (CQ-011) | 2026-10-30 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                      |

## Medições e evidência visual (registradas como texto)

- **Emenda CQ-010 (2026-10-30), test-first:** `climbSignal.test.ts` foi reescrito (8 testes: `up − down`, uma mão desce sobe, as duas sobem descem, uma mão ausente conta dy = 0, zona morta, saturação) e `climb.test.ts` ganhou a tolerância `grabGraceMs`, a soltura por punho `fistReleaseMs` e um teste explícito de que **braçadas alternadas dão subida líquida positiva** (`position.y` final > inicial + 1 m); o teste de propriedade foi reescrito (fase aleatória de 600 passos + saída garantida por grace OU punho) e segue verde em 300 ensaios. Vistos vermelhos antes do código: a 1ª rodada falhou em 3 testes (o objeto de grip inline no `physics.ts` não inicializava `graceMs`/`fistMs` → `NaN`; a propriedade precisava de uma saída determinística porque o punho exige ser segurado). Corrigidos, pacote `swing` passou a **153 testes** (eram 151).
- **Testes puros do agarre (`packages/swing`):** `climbSignal.test.ts` (8) e `climb.test.ts` (16), com o **teste de propriedade** de saída em tempo finito (300 ensaios, nenhum prende o jogador). Dados sintéticos; nada afirma precisão.
- **Testes do controlador (`apps/web`, mãos simuladas e teclado):** `swingClimb.test.ts` (6 testes) — `V` sem parede não agarra; encostar e, com `V`, agarrar e as setas subirem; soltar `V` larga; a palma aberta em contato agarra; **o punho fechado na câmera, segurado, solta** (fluxo completo controlador→física); a depuração expõe palma e punho por mão. Os testes de teia por mão (`swingHands`, `swingController`, `SwingScreen`, `guide`) continuam passando (web vitest: **255 testes**, 29 arquivos).
- **Pilotos automáticos descartáveis na cidade real (`apps/web/public/swing/midtown.json`, 556 prédios; teste removido após rodar, resultados como texto):**
    - **Subir até o topo:** o piloto lançou a teia e puxou até encostar na fachada no passo 211 (y = 107,6 m), agarrou e escalou com `climb = 1` até passar do topo do prédio, saindo do agarre no telhado (`grounded`), sem ficar preso.
    - **Sequências aleatórias:** 27 ensaios que começaram agarrados a prédios reais sortearam entradas aleatórias; o máximo de passos até soltar foi 9 e **nenhum** ensaio prendeu o jogador no agarre.
    - Estes pilotos são idealizados (sem mão humana) e **não** representam a jogabilidade real nem medem sensação.
    - **CQ-010 (2026-10-30):** um piloto descartável foi escrito para a cidade real para reconfirmar a subida líquida e a soltura por punho, mas o arnês não conseguiu manter o jogador prensado na fachada tempo suficiente para o agarre entrar de forma confiável (limitação do roteiro de teste, não do código); o arquivo foi removido. A integração controlador→física do agarre, da subida pelas setas e da **soltura por punho na câmera** fica coberta por `swingClimb.test.ts` (que leva o jogador até a fachada pela própria física e exercita o fluxo completo).
- **Chromium headless (playwright-cli, rodada de 2026-10-29, build de produção servido por `http.server` em `127.0.0.1:5181`, `?delegate=cpu`, teclado no lugar da mão, sem mão real):** a página "Arranha-Teia" renderiza; o HUD mostra Velocidade, Altura e Teia; a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" aparece; o guia "Como jogar" e a dica "Sem câmera: … V agarra na parede, setas olham/sobem" aparecem; **0 erros no console** (só 4 avisos de desempenho do WebGL por software). Ao segurar Espaço + C o jogo começou e a teia prendeu; ao bater na fachada e pressionar `V`, o medidor passou a **"Agarrado"**. Nenhuma imagem foi guardada no repositório. **CQ-010 não re-rodou o headless:** os textos de status mudaram ("Parede: abra a mão para agarrar." e "Agarrado. Desça uma mão por vez para subir. Punho solta.") e estão cobertos pelos testes de `guide.ts`/`SwingScreen`, mas a inspeção visual ao vivo da nova dica fica para o Gate 3.
- **Rede / privacidade:** o build não usa CDN; o bundle do swing, o JSON da cidade e os assets são servidos pela própria origem (o `http.server` só serviu `127.0.0.1`). O processamento da câmera continua local; nada de imagem é gravado ou enviado.
- **Emenda CQ-011 (2026-10-30), escalar olhando:** `headClimb.test.ts` (13 testes) e `swingHeadClimb.test.ts` (6, controlador com rosto e mão simulados) foram escritos antes do código, mas não rodei cada um em vermelho antes de implementar (o módulo ainda não existia). Eles cobrem: nada acontece antes dos 2 s; depois de 2 s olhando para cima sobe e para baixo desce; olhar para o lado ou voltar ao centro para; retomar exige esperar de novo; histerese entre 12° e 7°; sem agarre, em Automática ou sem rosto não age; parado agarrado por 20 s não solta. A saída por inatividade foi removida (o teste antigo virou "parado agarrado não solta" e foi visto vermelho antes de remover o código). O Chromium headless **não** foi re-rodado nesta emenda.
- **Não medido (risco, pendente do Gate 3):** nada foi testado com a mão real nem numa GPU real; a escalada por deslocamento vertical das mãos, a palma aberta como agarre, o punho fechado como soltura, a velocidade de escalada (`climbSpeed`), a zona morta, a tolerância `grabGraceMs`, o tempo de punho `fistReleaseMs` e os tempos do olhar (2 s de espera, 12°/7°/20°, velocidade 0,8) são valores de jogo não medidos; fps não medido numa GPU real; a inspeção visual da nova dica de parede não foi re-rodada em headless na rodada CQ-010.

## Validações estruturais e documentais

- **SDD:** `yarn sdd:check` e `yarn test:sdd` passam; `specs/README.md` lista esta spec como `implementing`; os oito FR têm tarefa formal.
- **Privacidade e fronteira:** nenhuma requisição a terceiros; a câmera é local, sem gravar nem enviar imagem; o jogo não expõe critério secreto (não há carta).
- **UTF-8 e acentuação:** conferidos; sem mojibake.
- **Limitações declaradas (NFR-003/NFR-004):** o sinal de soltar é o punho fechado segurado por tempo (o `z` do MediaPipe foi abandonado na CQ-010 por ser ~0); a escalada e o agarre não foram testados com a mão real; os valores do agarre são de jogo; fps não medido.

## Gate 3 — Convergência validada

- **Veredito:** PENDENTE — não aprovado.
- **Motivo:** o Gate 3 depende do teste ao vivo do maintainer (a palma como agarre, a escalada descendo uma mão por vez e o punho fechado como soltura, com a mão real, numa GPU real). Nada disso foi exercitado. A spec permanece em `implementing` com o Gate 3 pendente; o agente não marca `validated` por conta própria.
- **O que falta:** o maintainer testar a tela ao vivo e registrar o veredito (aprovado ou aprovado com risco aceito), ou pedir ajustes nos valores de jogo do agarre.
