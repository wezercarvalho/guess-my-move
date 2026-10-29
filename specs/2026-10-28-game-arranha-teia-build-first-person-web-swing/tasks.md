# Tarefas — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `validated`. CQs resolvidas (CQ-001 a CQ-008), plano, tarefas e checklists prontos; os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-28 e o Gate 3 foi concedido pelo merge do PR da issue #76, com risco aceito (sem teste ao vivo com a mão real nem medição de fps numa GPU real; a CQ-007 acrescenta pose, lados e teia no céu não medidos com mão real; a CQ-008 refaz a jogabilidade reprovada na PR #77 — corda que puxa, teia persistente, soltar pela palma, câmera automática — também não medida com mão real; a CQ-009 acrescenta uma teia por mão (as duas ao mesmo tempo), também não medida com as duas mãos reais). O código foi implementado test-first e todas as tarefas abaixo (T001 a T024) estão marcadas `[x]` com evidência registrada em `validation.md`.

## Fase 1 — Pacote puro: tipos e vetores (packages/swing)

- [x] T001 [US-001] [FR-002] Criar o esqueleto do pacote `@guess-my-move/swing` (configuração de Vitest e build do workspace) e confirmar os tipos de `src/city.ts` (`City`, `CityBuilding`, `CityRoad`), com `src/index.ts` exportando a API pública planejada; escrever o teste de tipos/exportações falhando e confirmar a falha esperada
- [x] T002 [US-001] [FR-002] Escrever os testes falhando de `src/vec.ts` (operações de vetor 3D) e de `src/cityIndex.ts` (grade espacial, raycast a partir de ponto e direção, teste de colisão do jogador contra parede, telhado, chão e limite, e altura de apoio) e implementá-los até os testes ficarem verdes

## Fase 2 — Pacote puro: teia, física, gatilho e direção (packages/swing)

- [x] T003 [US-001] [FR-003] Escrever os testes falhando de `src/web.ts` (mira assistida: três raios do olho com pitch + 35°, + 20° e + 8°, alcance 140 m, primeiro ponto com y >= y do jogador + 8 m e distância horizontal >= 12 m, "errou" sem acerto) e implementar até verde
- [x] T004 [US-001] [US-002] [US-004] [FR-004] Escrever os testes falhando de `src/physics.ts` (gravidade 20, arrasto exp(-0,1 dt), velocidade máxima 60, passo fixo 1/120 s, corda inextensível que remove a velocidade radial e encurta a 4 m/s até 10 m, colisões: restituição 0,3 na parede e solta a teia, pouso no telhado, chão com atrito e corrida automática 8 m/s, parede invisível no limite) e implementar até verde
- [x] T005 [US-001] [US-002] [FR-005] Escrever os testes falhando de `src/trigger.ts` (funções puras com tempo em ms: lança com `ILoveYou` score >= 0,7 em 2 quadros seguidos; solta após 250 ms sem o gesto) e implementar até verde
- [x] T006 [US-005] [US-006] [FR-006] Escrever os testes falhando de `src/steering.ts` (centro da palma pela média dos landmarks 0, 5, 9, 13, 17 espelhado em x; zona morta 0,10, saturação 0,35; guinada 90°/s e inclinação 60°/s; sem mão, taxa zero; teclado nas mesmas taxas) e implementar até verde

## Fase 3 — Pacote puro: spawn e mundo (packages/swing)

- [x] T007 [US-001] [US-004] [FR-002] [FR-004] Escrever os testes falhando de `src/spawn.ts` (busca em espiral por um ponto a >= 15 m de qualquer prédio, y = 90 m, velocidade inicial 10 m/s para a frente) e de `src/world.ts` (sessão: estado, `step` com passo fixo e acumulador e dt máximo 0,05 s, `reset`) e implementar até verde

## Fase 4 — Pipeline de dados da cidade (apps/web/scripts)

- [x] T008 [US-003] [FR-001] [NFR-004] Escrever o teste `node:test` falhando de `apps/web/scripts/city-from-osm.mjs` (conversor puro de uma entrada OSM de exemplo para o formato `City` v1, em metros, plano local rotacionado 29°, com atribuição ODbL, sem rede) e implementar o conversor; implementar `apps/web/scripts/build-city.mjs` (busca na Overpass e grava `apps/web/public/swing/midtown.json`) e gerar o JSON versionado uma vez (fora do tempo de jogo)

## Fase 5 — Render, controlador e tela (apps/web/src/swing)

- [x] T009 [US-001] [US-003] [FR-007] Implementar `apps/web/src/swing/cityRenderer.ts` (Three.js 0.186.0 empacotado, cena sem luzes com cor por vértice, névoa, céu em degradê, janelas e ruas por textura procedural, teia como cilindro fino) e `speedLines.ts` (campo de visão 70°→100° e linhas radiais com a velocidade), sem textura nem fonte de terceiros
- [x] T010 [US-001] [US-002] [US-005] [US-006] [FR-006] [FR-007] Escrever os testes falhando e implementar `apps/web/src/swing/swingController.ts`, `useSwingGame.ts` e `SwingScreen.tsx` ligando o reconhecedor e o teclado à sessão `world`, com HUD (velocidade km/h, altura m, teias lançadas, distância m), atribuição ODbL e botão "Voltar ao início", e confirmar os testes verdes

## Fase 6 — Menu, Vite e páginas (apps/web)

- [x] T011 [US-003] [FR-008] Escrever o teste de páginas falhando e acrescentar `apps/web/swing.html`, a entrada `swing` no `vite.config.ts` e um card novo no `HomePage` que leve ao jogo (sem mudar o layout nem o comportamento das telas existentes), e confirmar o teste verde

## Fase 7 — Documentação

- [x] T012 [FR-001] [FR-007] [FR-008] [FR-009] [NFR-005] Atualizar o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md` e o `docs/product/PROJECT_SPEC.md` para descrever Arranha-Teia (o pacote puro, o pipeline de dados da cidade, a cena Three.js, o HUD, o efeito de velocidade e a privacidade), declarando as limitações sem medição (anel externo simples, pátios preenchidos, alturas estimadas, sem validação com mão real, fps não medido numa GPU real)

## Fase 8 — Gates e verificação visual

- [x] T013 [SC-001] [SC-002] [SC-003] [SC-004] [SC-005] [NFR-002] [NFR-003] [NFR-004] [NFR-005] Executar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` e, com o código implementado, também `yarn check:all`, `yarn test:gates` e `yarn security:dependencies`; rodar a inspeção visual em Chromium headless (WebGL por software, câmera simulada) e registrar como TEXTO em `validation.md` (cidade e HUD visíveis, atribuição ODbL, efeito de velocidade com a velocidade, nenhuma requisição a terceiros), sem salvar imagens no repositório

## Fase final — Convergência (Gate 3)

- [x] T014 [SC-003] [SC-006] [NFR-003] [NFR-006] Fechar o Gate 3 com risco aceito: registrar em `validation.md` o veredito, o escopo aprovado, os riscos aceitos (aparência e desempenho ao vivo numa GPU real não medidos; sem validação com a mão real) e as observações, e atualizar o estado da spec para `validated` ao fim, sem afirmar desempenho sem medição

## Fase 9 — Emenda CQ-007: duas mãos, pose, imersão e dicas

- [x] T015 [US-001] [US-005] [FR-005] Duas mãos e pose geométrica: `packages/swing/src/pose.ts` (`isWebPose` por distâncias entre landmarks — indicador e mindinho >= 1,5, médio e anelar <= 1,3, polegar >= 0,6 da palma; `handSide`; `webSignal`), com testes de landmarks sintéticos girados (0, 45, 90, 180, 270 graus, espelhados); o reconhecedor passa a `numHands` 2 (`realTwoHandGestureLoader`, `apps/web/src/tracker/mediapipeTracker.ts` com `detectAll`, consumido por `swingController.detectAll(...).slice(0, 2)`). Evidência: testes de `pose` e `swingHands` verdes (sem mão real)
- [x] T016 [US-001] [US-002] [FR-005] Lado da teia e troca de mão: a mão esquerda lança com desvio de 18° à esquerda (`sideYaw`), a direita à direita, as duas ao centro; passar a usar a outra mão lança uma teia nova do outro lado e encadeia balanços; teclado Espaço centro, Z esquerda, X direita; o lado é uma preferência (desvio inteiro, metade, centro). Evidência: testes de `world`/`swingController` e inspeção visual (Z esquerda, X direita no medidor)
- [x] T017 [US-001] [US-004] [FR-002] [FR-003] Teia no céu e área jogável: `world.ts` prende num ponto no céu (60 m à frente, 70 m acima, até 220 m; `ActiveWeb.virtual`) quando nenhum prédio é alcançável, com preferência pelo prédio; `cityIndex.playBounds` = caixa dos prédios + 120 m, nunca além do mapa; `minRise` 8 -> 25 m e `minHorizontal` 12 -> 30 m. Evidência: testes de `web`, `world`, `cityIndex` e `spawn` verdes
- [x] T018 [US-001] [US-005] [FR-006] [FR-007] Dicas e guia: `cue.ts` (`swingCue`) alimenta a linha de status de uma frase, o guia "Como jogar" de 4 etapas com a etapa atual destacada (`guide.ts`), o medidor "Teia: esquerda/direita/centro/solta" no HUD e o contorno dourado (soltar)/vermelho (perto do chão) no palco (`SwingScreen.tsx`); a mão que faz a pose não gira a câmera e a outra gira (`steerFromHand`), com acompanhamento do movimento (1,2 por s, acima de 8 m/s). Evidência: testes de `cue`, `guide` e `SwingScreen` verdes
- [x] T019 [US-001] [FR-003] [FR-007] Mira projetada na tela: `reticle.ts` desenha a prévia para cada mão (anel dourado quando à vista, seta na borda quando fora do quadro, rótulos "esq." e "dir."); a corda sai do pulso do lado que lançou e ficou mais fina (`cityRenderer.ts`). Evidência: testes de `reticle` verdes e inspeção visual (anel e seta antes de lançar)
- [x] T020 [SC-006] [NFR-003] [NFR-005] Documentação e gates da CQ-007: registrar a emenda em `clarification.md` (CQ-007), refletir em `spec.md` (FR-003, FR-005, FR-006), `plan.md` e `research.md`; atualizar `validation.md` (números de testes, seção da CQ-007 e riscos aceitos, inclusive pose e desvio não medidos com mão real; veredito "aprovado com risco aceito"); atualizar o `README.md` da raiz, o guia de arquitetura e o `PROJECT_SPEC.md`; rodar `yarn docs:format:fix`, `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`. Evidência: documentos atualizados e gates documentais verdes

## Fase 10 — Emenda CQ-008: teia que puxa, teia persistente, soltar pela palma e câmera automática

- [x] T021 [US-001] [US-002] [US-004] [FR-002] [FR-003] [FR-004] [FR-005] [FR-006] Refazer a jogabilidade reprovada na PR #77: `physics.ts` ganha a corda que puxa (`assist` 12, com o punho `pullAssist` 40, `pullReel` 16, `pullImpulse` 9), a teia persistente com deslize na parede (`wallFriction` 2, restituição 0,1, a teia não some ao bater) e o salto ao lançar do chão (`launchBoost` 14, `launchLift` 6, sem corrida automática com a teia presa); `web.ts` passa a cinco raios (+50°/+38°/+26°/+15°/+6°), alcance 160 m, ponto válido >= 12 m / >= 15 m; `spawn.ts` exige um prédio de subida 30 m a >= 50 m à frente; `trigger.ts` passa a lançar pela pose, segurar pela pose/punho, puxar pelo punho, soltar pela palma (`Open_Palm` 2 quadros) e por 600 ms sem pose/punho, devolvendo `{ held, pull }`; `pose.ts` mede em 3D (usa o `z` do MediaPipe) e expõe `isFist`, `isOpenPalm` e `handMetrics`; `world.ts` move a câmera automaticamente (segue o movimento) e `steering.ts` e seu teste são **removidos** (a direção por joystick da mão sai); desvio por lado 28°; `SwingScreen.tsx`/`guide.ts` trazem o guia, status e dicas novos ("Punho fechado puxa. Palma aberta solta.") e o painel de depuração recolhido por padrão (botão "Depuração") com, por mão, o gesto entendido, o rótulo do reconhecedor e as medidas. Evidência: testes de `physics`, `web`, `spawn`, `trigger`, `pose` e `world` verdes (sem mão real); inspeção em Chromium headless com teclado (C puxa); `steering.test` removido com o módulo
- [x] T022 [SC-006] [NFR-003] [NFR-005] Documentação e gates da CQ-008: registrar a emenda em `clarification.md` (CQ-008 e "Hipóteses remanescentes"), refletir em `spec.md` (FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, edge cases e H-04), `plan.md` e `research.md` (steering.ts como superado e a nota da mecânica); atualizar `validation.md` (seção da CQ-008, contagens de testes, Gate 3 mantido "aprovado com risco aceito pelo merge", registrando que a jogabilidade da PR #77 foi reprovada e esta emenda a refaz); atualizar o `README.md` da raiz e o guia de arquitetura só nas linhas do Arranha-Teia (direção pela mão → câmera automática; soltar com a palma); rodar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`. Evidência: documentos atualizados e gates documentais verdes

## Fase 11 — Emenda CQ-009: uma teia por mão, as duas ao mesmo tempo

- [x] T023 [US-001] [US-002] [US-004] [FR-003] [FR-004] [FR-005] [FR-007] Uma teia por mão (test-first): `packages/swing/src/physics.ts` troca `SwingState.web` por `webs: ActiveWeb[]` (uma por lado, `side` obrigatório, `pulling?`), remove `SwingState.pulling`, aplica a restrição de cada corda (3 passadas com mais de uma), divide a assistência pelo número de teias presas (`assist`/n, `pullAssist`/n), recolhe por teia (`reelSpeed`/`pullReel`), faz o impulso do punho por teia e o impulso de chão uma vez só, e deixa a corrida automática atuar só sem nenhuma teia; `world.ts` passa a `SwingInput` `{ held, pull?, yawRate, pitchRate }` com `SlotFlags` por lado (lança na borda, solta só a própria teia, mira e desvio 28° por mão, reserva no céu por teia) e expõe `hud.webSides: WebSide[]`; `cue.ts` usa `webs.length > 0`; `apps/web/src/swing/swingController.ts` alimenta o gatilho de cada mão (teclado Z/X/Espaço, `C` puxa todas), `cityRenderer.ts` desenha uma corda por lado, `SwingScreen.tsx` mostra as miras só do lado sem teia e o medidor "solta/esquerda/direita/centro/as duas". Evidência: novo `packages/swing/test/twoWebs.test.ts` (13 testes) e `moves`, `physics`, `sides`, `sky`, `world`, `cue` (swing) e `swingHands.test.ts`, `SwingScreen.test.tsx` (web) verdes; swing 127 e web swing 74 testes verdes, lint e typecheck verdes (sem mão real)
- [x] T024 [SC-006] [NFR-003] [NFR-005] Documentação e gates da CQ-009: registrar a emenda em `clarification.md` (CQ-009, lista de resolvidas e "Hipóteses remanescentes"), refletir em `spec.md` (FR-003, FR-004, FR-005, FR-007 e o caso de borda do chão; `updated_at` 2026-10-29), `plan.md` e `research.md` (estado por teia `webs`, entrada `held`/`pull` por lado, assistência dividida por n) e `validation.md` (seção da CQ-009, contagens de testes e medição descartável das duas teias), mais o `README.md` da raiz e o `specs/README.md`; rodar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`. Evidência: documentos atualizados e gates documentais verdes

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                                                                                                 |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FR-001    | T008, T012             | teste do conversor; JSON versionado; atribuição na tela                                                                            |
| FR-002    | T001, T002, T007, T021 | `vec`, `cityIndex`, `spawn`/`world` tests (Vitest); spawn com corda longa (CQ-008)                                                 |
| FR-003    | T003, T021, T023       | `web` tests (Vitest); cinco raios e alcance 160 m (CQ-008); uma teia por mão, mira/desvio por mão (CQ-009)                         |
| FR-004    | T004, T007, T021, T023 | `physics`, `world` tests (Vitest); corda que puxa, deslize e salto (CQ-008); corda e assistência por teia, dividida por n (CQ-009) |
| FR-005    | T005, T021, T023       | `trigger`, `pose` tests (Vitest); punho puxa/palma solta, pose 3D (CQ-008); entrada `held`/`pull` por lado, `SlotFlags` (CQ-009)   |
| FR-006    | T006, T010, T021       | `steering` tests (até CQ-007); `world`/controlador: câmera automática, `steering.ts` removido (CQ-008)                             |
| FR-007    | T009, T010, T012, T023 | teste de tela; verificação visual; HUD por lado e corda por mão (CQ-009)                                                           |
| FR-008    | T011                   | teste de páginas (entradas e card)                                                                                                 |
| FR-009    | T012                   | busca no código; verificação visual de rede                                                                                        |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (tipos e vetores) antes das Fases 2 e 3 (teia, física, gatilho, direção, spawn e mundo usam `vec` e `cityIndex`).
- Dentro da Fase 2, T003 (teia) e T004 (física) dependem de T002 (`cityIndex`/`vec`); T005 (gatilho) e T006 (direção) são independentes entre si.
- T007 (spawn e mundo) depois de T002, T003 e T004.
- A Fase 4 (pipeline) pode andar em paralelo com as Fases 1 a 3, mas o JSON é necessário antes da Fase 5.
- A Fase 5 (render e tela) depois das Fases 3 e 4; a Fase 6 (menu, Vite, páginas) depois da Fase 5.
- A Fase 7 (documentação) depois da Fase 6; a Fase 8 e o Gate 3 fecham a entrega, com o Gate 3 após o teste do maintainer (risco aceito).

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação antecipada do maintainer wezercarvalho
- **Data:** `2026-10-28`
- **Lacunas:** nenhuma. Todos os nove FR têm tarefa formal (FR-001 em T008/T012, FR-002 em T001/T002/T007/T021, FR-003 em T003/T021/T023, FR-004 em T004/T007/T021/T023, FR-005 em T005/T021/T023, FR-006 em T006/T010/T021, FR-007 em T009/T010/T012/T023, FR-008 em T011, FR-009 em T012). As emendas CQ-007 (T015 a T020), CQ-008 (T021 implementação, T022 documentação) e CQ-009 (T023 implementação, T024 documentação) são emendas de implementação registradas depois da aprovação antecipada dos Gates 1 e 2; **não abrem um novo Gate 3** — o Gate 3 segue aprovado com risco aceito pelo merge. SC-001 é coberto pelos testes do pacote (T001 a T007, T021, T023); SC-002 pelo teste do conversor (T008); SC-003 pela verificação visual (T013); SC-004 pelo teste de páginas (T011); SC-005 pelos gates (T013); SC-006 pelas limitações em `research.md` e no Gate 3 (T014, T022, T024). NFR-001 pela estratégia test-first de cada módulo (T001 a T007, T021, T023), NFR-002 pelos gates (T013), NFR-003 pela ausência de afirmação de fps (T013/T014/T022/T024), NFR-004 pela busca no código e pela verificação de rede (T012/T013), NFR-005 pela verificação visual registrada como texto e pelas limitações declaradas (T012/T013/T022/T024), NFR-006 pelo teclado como alternativa e pela atribuição e botão alcançáveis (T006/T010). As tarefas estão `[x]`: a implementação foi feita test-first, a inspeção visual em Chromium headless foi registrada como texto em `validation.md`, os Gates 1 e 2 seguem aprovados e o Gate 3 foi concedido pelo merge com risco aceito.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-28`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem do maintainer na sessão do dashboard em 2026-10-28 ("considere os gates aprovados"), aprovando antecipadamente os Gates 1 e 2 e aceitando as recomendações de CQ-001 a CQ-005; issue 76 do repositório (ver `spec.md`).
- **Exceções:** nenhuma. Aprovação antecipada no chat. O Gate 3 segue para o fim, após o código e a verificação visual registrada em `validation.md`, e será concedido com risco aceito (sem teste ao vivo com a mão real e sem medição de fps numa GPU real).
