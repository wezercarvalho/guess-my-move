# Tarefas — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `implementing`. As Fases 1 a 4 (T001 a T012) descrevem a 1ª implementação deste refino e estão concluídas; a Fase 5 (T015 a T021) é a emenda da recalibração do 2º teste (CQ-009), também concluída, e SUBSTITUI os parâmetros/gatilho descritos nas Fases 1 a 3 (armar por `armRatio`, gatilho por razão esticada sustentada, escala 3 a 20, detector que não compõe o de pinça, rodada sem exigir pinça aberta antes). A Fase 6 (T022 a T026) é a emenda do reconhecedor de gestos, do guia de etapas e do veto de palma aberta (CQ-010), também concluída. A validação (T013) foi reexecutada após as emendas. Só a última tarefa (T014, teste manual do maintainer e Gate 3) segue PENDENTE e depende do maintainer.

## Fase 1 — Detector de estalo: direção, gatilho e força logarítmica (packages/marbles)

- [x] T001 [US-001] [US-002] [FR-001] [FR-002] [FR-003] Escrever testes falhando em `packages/marbles/test/flick.test.ts`: o detector mede a direção pela orientação da mão (`handDirection`, pulso → base do dedo médio, espelhada, `null` quando degenerado); classifica a abertura como gatilho rápido (subida <= `slowMs` 80 ms E velocidade de pico >= `minOpenSpeed` 2 razão/s); e `flickShot` converte a velocidade de abertura em força pela escala logarítmica (`power = clamp(ln(v/powerLowSpeed)/ln(powerHighSpeed/powerLowSpeed), 0, 1)` com `powerLowSpeed` 10 e `powerHighSpeed` 200; `v<=10`→300 unid/s, `v>=200`→1100 unid/s, um ponto no meio) e devolve `null` no lento, no fraco e no sem direção; `maxOpenSpeed` não existe mais na API
- [x] T002 [US-001] [US-002] [FR-001] [FR-002] [FR-003] Implementar em `packages/marbles/src/flick.ts`: escala logarítmica em `flickShot`; adicionar `powerLowSpeed`/`powerHighSpeed`, remover `maxOpenSpeed`, manter `minShotSpeed`/`maxShotSpeed`; baixar `slowMs` de 300 para 80 ms; manter `handDirection`, a direção e a medição de velocidade de pico; ajustar `index.ts`, e confirmar verde

## Fase 2 — Rodada com direção e força do estalo (packages/marbles)

- [x] T003 [US-001] [FR-001] Escrever testes falhando em `packages/marbles/test/round.test.ts`: no modo estalo, ao armar, a rodada publica a direção de prévia da orientação da mão no snapshot, e o tiro disparado tem a direção medida no início da abertura
- [x] T004 [US-001] [US-002] [FR-002] [FR-003] [FR-004] Escrever testes falhando em `packages/marbles/test/round.test.ts`: `observeFlick` dispara o tiro no gatilho rápido com direção medida e a velocidade da força logarítmica; cancela sem contar tiro no lento, no fraco e no sem direção; perda > 300 ms cancela e qualquer perda zera o armado; sem alterar os casos do modo pinça
- [x] T005 [US-001] [US-002] [FR-001] [FR-002] [FR-003] [FR-004] Implementar `observeFlick` e o snapshot em `packages/marbles/src/round.ts` com a direção da orientação da mão e a força logarítmica, e confirmar verde

## Fase 3 — Web: quadros novos, painel, tela (apps/web)

- [x] T006 [US-003] [FR-005] [FR-006] Escrever testes falhando em `apps/web/src/marbles`: o laço processa o detector só por quadro novo (`requestVideoFrameCallback` quando disponível; recuo para a comparação de `video.currentTime` sem reprocessar repetido no jsdom) e conta os quadros novos da câmera por segundo (janela de 1 s), expostos no snapshot
- [x] T007 [US-003] [US-004] [FR-005] [FR-006] Implementar o laço por quadro novo e a contagem no `MarblesController`, expor a FORÇA do último estalo (0 a 100%) e mapear o resultado como `disparado`/`lento demais`/`fraco demais`/`sem direção`, e confirmar verde
- [x] T008 [US-001] [US-004] [FR-006] [FR-007] Escrever testes falhando em `apps/web/src/marbles`: a tela orienta "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta", mantém o rótulo "Estalo (alpha)" e o seletor "Modo de tiro", desenha a seta de direção a partir da bolinha de tiro enquanto armado; o painel mostra a taxa da câmera, a força e o resultado do último estalo por `aria-live`
- [x] T009 [US-001] [US-004] [FR-006] [FR-007] Implementar os textos em `MarblesScreen`, a seta de direção em `fieldView` e as linhas novas do `DebugPanel` (taxa da câmera, força, resultado), e confirmar verde
- [x] T010 [US-005] [FR-008] Verificar a privacidade por busca no código (`fetch`, `XMLHttpRequest`, `sendBeacon`, `console.`, persistência) e por execução no Chromium com inspeção de rede
- [x] T011 [FR-009] Confirmar que os testes do modo pinça (`packages/marbles`) e do jogo de cartas passam, com o modo pinça inalterado salvo o não reprocessar quadros repetidos, e a pinça regulando a força pelo arrasto

## Fase 4 — Documentação

- [x] T012 [FR-010] Atualizar o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o `specs/README.md` para descrever o estalo como mecânica distinta da pinça (direção pela orientação da mão, força logarítmica pela velocidade de abertura, gatilho rápido) e o processamento só de quadros novos; marcar a spec `2026-10-27-game-marbles-bete-build-flick-beta` como `superseded` (status, `related_specs`, seção `## Substituição`) e refletir no catálogo

## Fase 5 — Recalibração do estalo com o 2º teste (emenda, CQ-009; já CONCLUÍDA)

- [x] T015 [US-001] [US-002] [FR-002] [FR-003] Reescrever os testes (test-first) em `packages/marbles/test/flick.test.ts` para o detector novo: armar por `armRatio` (1,05); candidato por `extendRatio` (1,2) com base no mínimo dos últimos `baseWindowMs` (250 ms); veredito `weak` quando a subida da base < `minRise` (0,4); confirmação por `confirmSamples` (3) amostras e veredito `unsustained` quando a razão volta abaixo de 1,2 antes de confirmar; escala log de 3 a 20 razão/s (extremos e meio); sem `slowMs`/`minOpenSpeed`/`maxOpenSpeed`/histerese
- [x] T016 [US-001] [US-002] [FR-002] [FR-003] Implementar o detector novo em `packages/marbles/src/flick.ts`: fases `idle`/`armed`/`pending`, `FlickVerdict` (`confirmed`/`weak`/`unsustained`), base, confirmação e `peakSlope`; reaproveitar `pinchRatio` sem compor o detector de pinça; ajustar `index.ts`, e confirmar verde
- [x] T017 [SC-001] Criar a fixture `packages/marbles/test/fixtures/flick-sessions.ts` (as duas séries lidas do painel quadro a quadro, só números) e o replay `packages/marbles/test/flick-replay.test.ts`: vídeo A (mão fechada em movimento) sobra 1 confirmado por volta de 8,97 s e >= 5 não sustentados sem tiro; vídeo B seis estalos confirmados (cerca de 22, 26, 28, 30, 32 e 34 s) com forças diferentes (0,26 a 0,93)
- [x] T018 [US-001] [FR-003] Ajustar `observeFlickReading` em `packages/marbles/src/round.ts` para armar a mira assim que a mão está armada, SEM exigir a pinça vista aberta antes (modo pinça inalterado), atualizar `packages/marbles/test/round.test.ts`, e confirmar verde
- [x] T019 [US-003] [US-004] [FR-006] Atualizar o `MarblesController` e o painel em `apps/web/src/marbles` para o novo `FlickOutcome` (`disparado`, `fraco demais`, `não sustentado`, `sem direção`, sem `lento demais`) mapeado pelo `verdict`, com os testes do controlador e do painel, e confirmar verde
- [x] T020 [US-004] [FR-007] Atualizar os textos de orientação do estalo em `apps/web/src/marbles/MarblesScreen.tsx` ("feche a mão com o polegar preso contra o indicador... estique o polegar de uma vez, deixando-o esticado"; "Armado! ... estique o polegar de uma vez, deixando-o esticado"), manter o rótulo "Estalo (alpha)", atualizar `MarblesScreen.test.tsx`, e confirmar verde
- [x] T021 [FR-010] Reescrever a documentação (clarification CQ-009 e CQ-010, `spec.md`, `plan.md`, `research.md`, `tasks.md`, `validation.md`, `README.md`, guia de arquitetura, `PROJECT_SPEC.md`, `specs/README.md`) para o detector novo, o reconhecedor de gestos, o guia de etapas e o veto de palma aberta, com a ressalva de sobreajuste e o Gate 3 mantido pendente

## Fase 6 — Reconhecedor de gestos, guia de etapas e veto de palma aberta (emenda, CQ-010; já CONCLUÍDA)

- [x] T022 [US-002] [FR-002] [FR-003] Escrever testes falhando e implementar o veto de palma aberta em `packages/marbles`: `FlickReading` ganha `phase` (`idle`/`armed`/`pending`) e `gesture`; `flick.update(landmarks, aspect, nowMs, gesture?)` recebe o gesto pronto; novo veredito `open_hand` quando alguma amostra de confirmação tem `openHandGesture` (`Open_Palm`) com pontuação >= `gestureMinScore` (0,8); `flickShot` devolve `null` no `open_hand`; ajustar `index.ts`, e confirmar verde
- [x] T023 [US-005] [FR-008] [FR-011] Escrever testes falhando e implementar o `realGestureLoader` (GestureRecognizer: landmarks + gesto pronto da primeira mão) em `apps/web/src/tracker/mediapipeTracker.ts` e `TrackedHand.gesture` em `handTracker.ts` para o jogo das bolinhas, mantendo o `HandLandmarker` (`realMediaPipeLoader`) no jogo de cartas, em `mediapipeTracker.test.ts`, e confirmar verde
- [x] T024 [FR-008] [FR-011] Escrever testes falhando e implementar em `apps/web/scripts/prepare-assets.mjs` o download do `gesture_recognizer.task` (SHA-256 fixado) junto do `hand_landmarker.task`, servido pelo app e não versionado, em `prepare-assets.test.mjs`, e confirmar verde
- [x] T025 [US-006] [FR-012] [NFR-005] Escrever testes falhando e implementar o `FlickGuide` (`apps/web/src/marbles/FlickGuide.tsx`) e o `flickStep` (`flickStep.ts`): lista ordenada "Etapas do estalo", etapa atual por `aria-current="step"` mapeada de `state` + `phase`, dica por `aria-live="polite"` para `fraco demais`/`não sustentado`/`mão aberta`/`sem direção`; montar no `MarblesScreen` no modo estalo, em `FlickGuide.test.tsx` e `MarblesScreen.test.tsx`, e confirmar verde
- [x] T026 [US-004] [FR-006] Atualizar o `MarblesController` e o `MarblesDebugPanel` em `apps/web/src/marbles` para a linha "Gesto reconhecido" (nome e pontuação, ou traço) e o novo resultado `mão aberta` no `FlickOutcome`, em `marblesController.test.ts` e `MarblesScreen.test.tsx`, e confirmar verde

## Fase final — Convergência (PENDENTE)

- [x] T013 [SC-001] [SC-005] [NFR-004] Executar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd`; quando o código estiver implementado, também `yarn check:all`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md`
- [ ] T014 [SC-002] [SC-003] [NFR-002] Registrar o teste manual do maintainer no Chrome desktop com a direção pela orientação da mão e a força logarítmica (disparou, em quantas tentativas, a força lida, acertou o alvo, disparo falso), a taxa real da câmera lida no painel e a decisão da issue #72, e fechar o Gate 3

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                    |
| --------- | ---------------------- | ----------------------------------------------------- |
| FR-001    | T001, T002, T003, T005 | `flick.test.ts`, `round.test.ts`                      |
| FR-002    | T001, T002, T004, T005 | `flick.test.ts`, `round.test.ts`                      |
| FR-003    | T001, T002, T004, T005 | `flick.test.ts`, `round.test.ts`                      |
| FR-004    | T004, T005             | `round.test.ts`                                       |
| FR-005    | T006, T007             | testes do controlador em jsdom                        |
| FR-006    | T006, T007, T008, T009 | testes do controlador e do painel                     |
| FR-007    | T008, T009             | `MarblesScreen.test.tsx`, `fieldView.test.ts`         |
| FR-008    | T010                   | busca no código e inspeção de rede                    |
| FR-009    | T011                   | testes do modo pinça e do jogo de cartas verdes       |
| FR-010    | T012, T021             | `yarn docs:format:check`, `yarn sdd:check`            |
| FR-011    | T023, T024             | `mediapipeTracker.test.ts`, `prepare-assets.test.mjs` |
| FR-012    | T025                   | `FlickGuide.test.tsx`, `MarblesScreen.test.tsx`       |

Emenda (CQ-009): T015/T016 cobrem FR-002 e FR-003 com o detector novo, T017 o replay (SC-001), T018 FR-003 (rodada sem exigir pinça aberta antes), T019 FR-006, T020 FR-007 e T021 FR-010. Emenda (CQ-010): T022 cobre o veto `open_hand` (FR-002, FR-003), T023 o `GestureRecognizer` (FR-008, FR-011), T024 o ativo novo (FR-008, FR-011), T025 o guia de etapas (FR-012) e T026 a linha "Gesto reconhecido" e o resultado `mão aberta` (FR-006).

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (`flick.ts`) antes da Fase 2 (`round.ts`); ambas antes da Fase 3 web.
- T012 pode andar em paralelo com T006 a T011.
- T010 e T011 dependem de T009; T013 e T014 fecham a entrega.
- Fase 5 (emenda CQ-009): T015/T016 antes de T017 e T018; T019 e T020 dependem de T016/T018; T013 foi reexecutada depois de T015 a T021.
- Fase 6 (emenda CQ-010): T022 antes de T026 (o veto define o resultado `mão aberta`); T023 antes de T024 (o loader usa o modelo que o `prepare:assets` baixa) e T026 (o controlador lê o gesto do tracker); T025 depende de T022 (a fase do detector mapeia a etapa). T013 foi reexecutada depois de T022 a T026.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação do maintainer wezercarvalho
- **Data:** `2026-10-28`
- **Lacunas:** nenhuma. Todos os doze FR têm tarefa formal; SC-001 é coberto pelos testes das Fases 1 a 3 e pelo replay da Fase 5 (T017), e SC-006 pelos testes da Fase 6 (T023 a T026); SC-002 e SC-003 pela tarefa de evidência manual (T014); SC-004 pela T011 e SC-005 pela T013; NFR-001 pela pureza da direção, do detector (armar/candidato/confirmação) e da escala logarítmica, NFR-002 pelos textos sem afirmação de desempenho ou de correspondência da direção e com a ressalva de sobreajuste, NFR-003 pelo `aria-live` e pelo `fieldset`, NFR-004 pelos comandos finais e NFR-005 pelo `aria-current`/`aria-live` do guia e pela ressalva sobre os gestos prontos. As emendas CQ-009 (Fase 5) e CQ-010 (Fase 6) reescreveram o gatilho e a escala de força e acrescentaram o reconhecedor de gestos, o guia de etapas e o veto de palma aberta, aprovadas como parte da mesma entrega do #72; só a T014 (Gate 3) segue pendente.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo" e "pode fazer então, abre um PR") e issue 72 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada no chat, após a correção de rumo. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
