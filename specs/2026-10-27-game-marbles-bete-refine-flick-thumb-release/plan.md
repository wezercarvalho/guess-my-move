# Plano — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Resumo técnico

No pacote puro `@guess-my-move/marbles`, o detector de estalo (`flick.ts`) deixa de compor o detector de pinça (só reaproveita `pinchRatio`) e passa a modelar o polegar se esticando de uma vez: arma com a razão <= `armRatio` (1,05); quando a razão chega a >= `extendRatio` (1,2), procura o mínimo da razão nos últimos `baseWindowMs` (250 ms) como base da subida, exige `razão − base >= minRise` (0,4) senão veredito `weak`, e confirma o estalo só se as `confirmSamples` (3) primeiras amostras ficarem >= `extendRatio`, senão veredito `unsustained`. A força usa a escala logarítmica em `flickShot` com `powerLowSpeed` 3 e `powerHighSpeed` 20 (antes 10 e 200), mantendo `minShotSpeed` (300) e `maxShotSpeed` (1100); a velocidade de abertura é o pico da inclinação da razão da base à última amostra de confirmação. Saem `slowMs`, `minOpenSpeed`, `riseStartRatio` e a histerese 0,35/0,55 do estalo; entram `armRatio`, `extendRatio`, `confirmSamples`, `minRise` e `baseWindowMs` (`historyMs` 400 mantido). A direção vem da orientação da mão (`handDirection`, pulso → base do dedo médio, espelhada) medida na base. A rodada (`round.ts`) no modo estalo começa a mira assim que a mão está armada (sem exigir a pinça vista aberta antes); `observeFlick` dispara ao confirmar o estalo com direção medida convertendo a velocidade de abertura em força logarítmica; cancela no fraco, no não sustentado e no sem direção, e zera o armado na perda da mão. O modo pinça NÃO muda. No app web, o laço de quadros do `MarblesController` processa o detector só em quadros novos da câmera (`requestVideoFrameCallback` quando disponível, recuo para `video.currentTime` quando não) e conta os quadros novos por segundo (taxa real medida de cerca de 15/s); o painel mostra "Quadros novos da câmera/s" nos dois modos e, no estalo, Armado, a velocidade da abertura, a FORÇA do último estalo (0 a 100%) e o resultado (`disparado`, `fraco demais`, `não sustentado`, `sem direção`); a tela mantém a seta de direção a partir da bolinha e atualiza o texto de orientação. O replay das duas séries gravadas (`flick-replay.test.ts`, fixture em `flick-sessions.ts`) protege contra regressão. A física, o campo, o alvo e o jogo de cartas não mudam. A spec de criação do estalo passa a `superseded` e esta é a fonte vigente completa do modo estalo.

Emenda (CQ-010): o jogo das bolinhas passa a usar o `GestureRecognizer` do MediaPipe (`realGestureLoader` em `mediapipeTracker.ts`; modo de vídeo, uma mão) em vez do `HandLandmarker`, trazendo o gesto pronto de maior pontuação da primeira mão (`HandGesture { name, score }`) por `flick.update(..., gesture?)`; o jogo de cartas segue com o `HandLandmarker`. Como os gestos prontos NÃO reconheceram a pose do estalo na conferência offline, o gesto NÃO é gatilho: entra como **veto de palma aberta** (novo veredito `open_hand`, resultado `mão aberta`, quando `Open_Palm` tem pontuação >= `gestureMinScore` 0,8 em alguma amostra de confirmação) e como **diagnóstico** na linha "Gesto reconhecido" do painel. A `FlickReading` ganha `phase` (`idle`/`armed`/`pending`) e `gesture`. A tela do modo estalo ganha o `FlickGuide` (lista ordenada "Etapas do estalo" com quatro etapas, etapa atual por `aria-current`, dica por `aria-live`), com `flickStep.ts` mapeando o estado da rodada e a fase para a etapa 1 a 4. O ativo `gesture_recognizer.task` (SHA-256 fixado, cerca de 8,4 MB, não versionado) é baixado por `prepare:assets` junto do `hand_landmarker.task`. A licença do `.task` não foi lida na fonte; nada foi testado ao vivo (Gate 3 pendente).

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente (o `engines` do repositório pede >=26.12.1; os scripts de documentação e SDD rodam no Node 24), Yarn 4.18.1 via Corepack, TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5.
- **Dependências:** nenhuma nova. A escala logarítmica usa `Math.log`; `requestVideoFrameCallback` é API nativa do navegador, com recuo para `currentTime`. O `GestureRecognizer` já vem do pacote `@mediapipe/tasks-vision` (sem nova dependência); o modelo `gesture_recognizer.task` é baixado por `prepare:assets` (SHA-256 fixado, não versionado, licença do `.task` não lida na fonte).
- **Provedores externos:** nenhum. Nenhuma imagem sai do navegador.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagens), pureza da lógica em Node, isolamento do modo pinça e do jogo de cartas, Chrome desktop, honestidade de evidência (sem afirmar desempenho, correspondência da direção ao estalo real ou viabilidade do estalo sem medição).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                  |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; a correção de rumo (CQ-001) atualizou `spec.md` antes dos artefatos downstream.                |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente e a completa do modo estalo; a spec de criação passa a `superseded`.                                |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de requisitos.                                                              |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando; o detector de estalo reaproveita `pinchRatio` sem compor o detector de pinça.   |
| V. Evidência honesta                        | PASS      | NFR-002 e H-01 a H-05 limitam afirmações; os limiares e a faixa da escala são palpites de uma sessão e a viabilidade é do maintainer. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem (FR-008); sem chaves; o refino não introduz novo dado sensível.                                                  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/`.                                                    |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o modo pinça (salvo quadros repetidos), seus testes e arquivos fora do escopo são preservados.                    |

## Pesquisa e decisões

- `research.md` — distinção entre as mecânicas (pinça regula força pela mão, estalo pelo polegar esticando de uma vez); direção pela orientação da mão medida na base da subida; força pela velocidade de abertura numa escala logarítmica de 3 a 20 razão/s (antes 10 a 200); gatilho por razão esticada sustentada (`armRatio` 1,05, `extendRatio` 1,2, `minRise` 0,4, `confirmSamples` 3, `baseWindowMs` 250 ms) em lugar do gatilho por duração curta; o detector deixa de compor o de pinça; a rodada arma sem exigir pinça aberta antes; processamento só de quadros novos (`requestVideoFrameCallback` com recuo para `currentTime`, taxa real medida de cerca de 15/s); e a decisão de marcar a spec de criação do estalo como `superseded`.

## Estrutura afetada

```text
packages/marbles/
  src/
    flick.ts                              detector reescrito: arma por armRatio; candidato por extendRatio; confirma por confirmSamples; força log 3..20 em flickShot; veto open_hand pelo gesto Open_Palm (gestureMinScore 0,8); FlickReading.phase e .gesture; remover slowMs/minOpenSpeed/riseStartRatio/histerese; adicionar armRatio/extendRatio/confirmSamples/minRise/baseWindowMs/openHandGesture/gestureMinScore; manter handDirection e a direção na base
    round.ts                              observeFlick arma sem exigir pinça aberta antes; dispara ao confirmar com direção medida e força log; cancela fraco/não sustentado/sem direção; snapshot com direção de prévia
    index.ts                              ajustar a API exportada (sem maxOpenSpeed/slowMs/minOpenSpeed; com os novos parâmetros; FlickVerdict)
    pinch.ts (pinchRatio), shot.ts, physics.ts   reusados, NÃO alterados em comportamento
  test/
    flick.test.ts                         testar armar/candidato/confirmação, escala log 3..20 (extremos e meio), fraco, não sustentado, sem direção, perda da mão; sem slowMs/maxOpenSpeed
    flick-replay.test.ts                  replay das duas séries gravadas (vídeo A: 1 confirmado por volta de 8,97 s; vídeo B: 6 estalos, forças 0,26 a 0,93)
    fixtures/flick-sessions.ts            séries lidas do painel (só números)
    round.test.ts                         casos de observeFlick com força log e cancelamento por fraco/não sustentado/sem direção; casos do modo pinça inalterados
apps/web/
  src/marbles/
    marblesController.ts                  laço por quadro novo (rVFC com recuo para currentTime); contagem de quadros novos/s; força e resultado do último estalo (disparado/fraco demais/não sustentado/mão aberta/sem direção)
    FlickGuide.tsx                        guia de etapas (lista ordenada, etapa atual por aria-current, dica por aria-live)
    flickStep.ts                          mapeia o estado da rodada + a fase do detector para a etapa 1 a 4
    fieldView.ts                          manter a seta de direção a partir da bolinha enquanto armado
    MarblesScreen.tsx                     texto de orientação do estalo (esticar o polegar de uma vez); rótulo alpha mantido; aria-live; monta o FlickGuide no modo estalo
    MarblesDebugPanel.tsx                 linha "Quadros novos da câmera/s"; linha "Gesto reconhecido"; FORÇA do último estalo (0 a 100%); resultado (disparado/fraco demais/não sustentado/mão aberta/sem direção)
  src/tracker/
    mediapipeTracker.ts                   realGestureLoader (GestureRecognizer: landmarks + gesto pronto) para o jogo das bolinhas; realMediaPipeLoader (HandLandmarker) segue no jogo de cartas
    handTracker.ts                        TrackedHand.gesture opcional
  scripts/prepare-assets.mjs              baixa também o gesture_recognizer.task (SHA-256 fixado), servido pelo app, não versionado
  src/card/, src/round/ do jogo de cartas  NÃO alterados
README.md, docs/development-context/architecture/architecture-guide.md, docs/product/PROJECT_SPEC.md   atualizar
specs/2026-10-27-game-marbles-bete-build-flick-beta/spec.md                                 status superseded + related_specs + seção Substituição
specs/2026-10-27-game-marbles-bete-refine-flick-thumb-release/                               esta spec
specs/README.md                                                                             nova linha e estado da antiga
```

## Design

### Componentes e responsabilidades

- **`flick.ts`** (pacote): o detector de estalo reaproveita `pinchRatio` (sem compor o detector de pinça), arma com a razão <= `armRatio`, procura o mínimo da razão nos últimos `baseWindowMs` como base, confirma o estalo quando a razão fica >= `extendRatio` por `confirmSamples` amostras, e mede a direção pela orientação da mão na base; `flickShot` converte a soltura em `{ velocity, power } | null` pela escala logarítmica de 3 a 20, devolvendo `null` quando o veredito é `weak`, `unsustained` ou sem direção.
- **`round.ts`** (pacote): `observeFlick(reading, nowMs)` começa a mira assim que a mão está armada (sem exigir pinça aberta antes); enquanto armado, publica a direção de prévia no snapshot; ao confirmar o estalo, dispara o tiro com direção medida, passando ao `fire` a velocidade da força log; cancela no fraco, no não sustentado, no sem direção e na perda > 300 ms; qualquer perda zera o armado. O modo pinça segue exigindo a pinça vista aberta antes.
- **`marblesController.ts`** (web): o laço agenda com `requestVideoFrameCallback` quando existe e recua para `requestAnimationFrame` + comparação de `currentTime` quando não; processa o detector só por quadro novo; conta os quadros novos por segundo (janela de 1 s) e expõe no snapshot; mapeia a força (0 a 100%) e o resultado do último estalo (`disparado`, `fraco demais`, `não sustentado`, `sem direção`).
- **tela** (web): `fieldView` desenha a seta de direção a partir da bolinha enquanto armado; `MarblesScreen` atualiza a orientação (esticar o polegar de uma vez) e mantém o rótulo alpha e o `aria-live`; `DebugPanel` ganha a taxa da câmera e a força do último estalo.

### Contratos e dados

- A soltura do estalo (`FlickRelease`) tem `verdict` (`confirmed` | `weak` | `unsustained`), a velocidade de abertura de pico, a duração da subida (da base ao cruzamento) e a direção medida na base.
- `flickShot` aplica a escala logarítmica de 3 a 20; `maxOpenSpeed`, `slowMs`, `minOpenSpeed` e `riseStartRatio` saem de `FlickConfig`, `armRatio`, `extendRatio`, `confirmSamples`, `minRise` e `baseWindowMs` entram; `powerLowSpeed`, `powerHighSpeed`, `minShotSpeed`, `maxShotSpeed` e `historyMs` ficam.
- O tiro do modo estalo tem a direção da orientação da mão e a velocidade da força log; é passado ao `fire` da rodada.
- `snapshot()` do controlador expõe os quadros novos da câmera por segundo, a FORÇA do último estalo (0 a 100%) e o resultado (`disparado`, `fraco demais`, `não sustentado`, `sem direção`).
- `DEFAULT_FLICK`: `armRatio` 1,05, `extendRatio` 1,2, `confirmSamples` 3, `minRise` 0,4, `baseWindowMs` 250 ms, `historyMs` 400 ms, `powerLowSpeed` 3, `powerHighSpeed` 20, `minShotSpeed` 300, `maxShotSpeed` 1100; perda 300 ms; sem `maxOpenSpeed`/`slowMs`/`minOpenSpeed`.

### Fluxo

1. O laço processa o detector só quando a câmera entrega um quadro novo (rVFC, recuo para `currentTime`); o painel conta os quadros novos por segundo.
2. No modo estalo, a mão com a razão <= `armRatio` arma; enquanto armado, a direção pela orientação da mão é publicada e a tela mostra a seta a partir da bolinha.
3. Quando a razão chega a >= `extendRatio`, o detector procura o mínimo recente (base) e abre um candidato; se a subida da base for < `minRise`, veredito `weak`.
4. O candidato só confirma se a razão ficar >= `extendRatio` por `confirmSamples` amostras; ao confirmar com direção medida, dispara o tiro: direção da orientação da mão na base, velocidade pela força log da velocidade de abertura; a física avança; o primeiro contato leva a `hit`.
5. Uma volta abaixo de `extendRatio` antes de confirmar dá `unsustained`; sem direção medida dá `sem direção`; a perda da mão > 300 ms cancela; qualquer perda zera o armado. O painel registra a força e o resultado do último estalo.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                                                                                                            | Evidência planejada                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| FR-001    | `handDirection` (pulso → base do médio, espelhada) na base da subida; seta de direção a partir da bolinha                                                                                            | `flick.test.ts`, `fieldView.test.ts`                                   |
| FR-002    | `flickShot` com escala log de 3 a 20 (`powerLowSpeed` 3/`powerHighSpeed` 20); remover `maxOpenSpeed`                                                                                                 | `flick.test.ts`                                                        |
| FR-003    | Gatilho por razão esticada sustentada (`armRatio`, `extendRatio`, `minRise`, `confirmSamples`); cancela fraco/não sustentado/sem direção                                                             | `flick.test.ts`, `round.test.ts`, `flick-replay.test.ts`               |
| FR-004    | Perda > 300 ms cancela; qualquer perda zera o armado                                                                                                                                                 | `round.test.ts`                                                        |
| FR-005    | Laço por quadro novo: rVFC quando disponível, recuo para `currentTime`                                                                                                                               | testes do controlador em jsdom                                         |
| FR-006    | Painel com "Quadros novos da câmera/s", força (0 a 100%) e resultado do último estalo                                                                                                                | testes do controlador e do painel                                      |
| FR-007    | Texto de orientação; rótulo alpha; seletor de modo; seta de direção a partir da bolinha                                                                                                              | `MarblesScreen.test.tsx`, `fieldView.test.ts`                          |
| FR-008    | Sem rede para imagem; aviso de privacidade                                                                                                                                                           | busca no código e inspeção de rede                                     |
| FR-009    | Modo pinça (salvo quadros repetidos) e jogo de cartas sem mudança; pinça não usa velocidade de abertura                                                                                              | testes existentes verdes                                               |
| FR-010    | Atualizar README, guia de arquitetura, PROJECT_SPEC e catálogo; marcar a antiga superseded                                                                                                           | `yarn docs:format:check`, `yarn sdd:check`                             |
| FR-011    | `realGestureLoader` (GestureRecognizer) no jogo das bolinhas; gesto pronto como veto `open_hand` e diagnóstico; `prepare:assets` baixa o `gesture_recognizer.task`; cartas seguem com HandLandmarker | `flick.test.ts`, `mediapipeTracker.test.ts`, `prepare-assets.test.mjs` |
| FR-012    | `FlickGuide` + `flickStep`: lista ordenada, etapa atual por `aria-current`, dica por `aria-live`                                                                                                     | `FlickGuide.test.tsx`, `MarblesScreen.test.tsx`                        |

## Estratégia test-first

1. Escrever os testes do detector de estalo para o armar (`armRatio`), o candidato (`extendRatio`, `minRise`), a confirmação (`confirmSamples`) com os vereditos `weak` e `unsustained`, a escala logarítmica de 3 a 20 (extremos `v<=3`→0, `v>=20`→1, e um ponto no meio), a velocidade de pico, a direção na base, o cancelamento por sem-direção e a perda da mão, e o teste que prova a remoção de `maxOpenSpeed`/`slowMs`, confirmando a falha esperada; escrever também o replay das duas séries gravadas (`flick-replay.test.ts` com a fixture `flick-sessions.ts`);
2. implementar em `flick.ts` (armar/candidato/confirmação, escala log 3 a 20 em `flickShot`, `armRatio`/`extendRatio`/`confirmSamples`/`minRise`/`baseWindowMs`, remover `maxOpenSpeed`/`slowMs`/`minOpenSpeed`/`riseStartRatio`), e confirmar verde;
3. escrever os testes de `observeFlick` (disparo ao confirmar o estalo com direção e força log, cancelamento por fraco/não sustentado/sem direção, perda da mão, e armar sem exigir pinça aberta antes) sem alterar os casos do modo pinça, implementar na rodada, e confirmar verde;
4. no `apps/web`, escrever os testes do controlador (laço por quadro novo com rVFC e recuo para `currentTime`, contagem de quadros novos/s, força e resultado) e da tela (orientação, seta de direção, linhas do painel), e implementar;
5. verificar privacidade por busca no código e inspeção de rede no Chromium; confirmar os testes do modo pinça e do jogo de cartas sem mudança de comportamento;
6. marcar a spec de criação do estalo como `superseded` e atualizar a documentação e o catálogo;
7. executar os gates oficiais e registrar a validação.

## Riscos, rollout e rollback

| Risco                                                                       | Mitigação                                                                                              | Rollback/contingência                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `armRatio`/`extendRatio`/`confirmSamples` não casam com outra mão ou webcam | Limiares expostos no painel; vereditos `fraco demais`/`não sustentado`; palpite de duas sessões (H-01) | Recalibrar os limiares                      |
| A faixa 3 a 20 da escala log não corresponder à força real                  | Força mostrada em % no painel; é palpite da amplitude observada (H-02)                                 | Recalibrar `powerLowSpeed`/`powerHighSpeed` |
| A direção pela orientação da mão não corresponder ao estalo real            | Seta de prévia deixa ajustar a mão; declarado como incerteza (H-04)                                    | Avaliar alternativas de direção (futuro)    |
| `requestVideoFrameCallback` ausente ou instável no navegador                | Recuo para a comparação de `currentTime`; testes em jsdom cobrem o recuo                               | Manter só o recuo por `currentTime`         |
| A taxa real da câmera revelar poucas amostras por estalo                    | Painel mostra a taxa real; lacuna declarada (H-03, H-05)                                               | Registrar a lacuna na validação             |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                         |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                                                       |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; a spec antiga vira `superseded` para não duplicar o comportamento vigente.                           |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                                                        |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; o detector de estalo reaproveita `pinchRatio` sem compor o de pinça; mudanças pequenas e reversíveis. |
| V. Evidência honesta                        | PASS      | Nenhum desempenho, correspondência de direção ou viabilidade afirmado; limiares e faixa são palpites.                        |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                                                       |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                                                                  |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; modo pinça (salvo quadros repetidos) e arquivos fora do escopo preservados.                              |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
