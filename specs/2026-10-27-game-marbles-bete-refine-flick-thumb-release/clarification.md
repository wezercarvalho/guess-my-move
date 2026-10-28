# Clarificação — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-27`

As decisões CQ-001 a CQ-008 refletem o refino do modo estalo (alpha) do bete aprovado pelo maintainer wezercarvalho na sessão do dashboard em 2026-10-27, depois de ler no painel os números do primeiro teste com a mão real. Houve uma **correção de rumo** registrada em CQ-001: uma primeira versão deste refino tentou dar ao estalo a mira relativa da pinça (direção e força pelo arrasto); o maintainer corrigiu ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo"), porque isso apagava a diferença entre as duas mecânicas. Os Gates 1 e 2 foram aprovados de forma antecipada ("pode fazer então, abre um PR"), antes da redação dos documentos. Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta`: é a fonte vigente completa do modo estalo, e a spec de criação passa a `superseded` apontando para esta (ver CQ-008 e a seção `## Substituição` daquela spec).

## Log de decisões

### CQ-001 — Correção de rumo: pinça e estalo são mecânicas distintas

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** O estalo deve passar a mirar e regular a força pelo arrasto relativo, como a pinça?
- **Decisão:** NÃO. O estalo é uma mecânica própria, distinta da pinça, e o refino DEVE estruturar essa distinção e aplicá-la a cada modo. Na pinça, a força é regulada pela mão (arrasto, estilingue). No estalo, a força é regulada pelo movimento do polegar (velocidade de abertura) e a mecânica é mais complexa. Uma versão anterior deste refino apagou a diferença (direção e força pelo arrasto) e foi corrigida. Mantêm-se a direção pela orientação da mão e a força pela velocidade de abertura; o que muda é a escala de força (de linear para logarítmica) e o gatilho (mais rígido).
- **Razão:** Palavras do maintainer: "Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo". Reduzir o estalo à mira da pinça eliminaria a razão de existir de um segundo modo e descartaria o estalo real do polegar que a issue #72 quer avaliar.
- **Alternativas rejeitadas:** Mira e força pelo arrasto relativo (apaga a distinção entre os modos, rejeitada pelo maintainer); abandonar o modo estalo (a issue #72 pede torná-lo jogável, não removê-lo).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, Objetivos, Fora de escopo, FR-001, FR-009, seção `## Distinção entre os modos`.

### CQ-002 — Direção pela orientação da mão, não pelo arrasto

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** De onde vem a direção do tiro no modo estalo?
- **Decisão:** Da orientação da mão no plano da imagem (vetor do pulso, landmark 0, à base do dedo médio, landmark 9, com x pela proporção da imagem e espelhado, normalizado), medida no início da abertura. A tela mostra uma seta de direção a partir da bolinha enquanto armado. Sem direção medida (vetor degenerado), o estalo cancela como "sem direção".
- **Razão:** É a direção própria do estalo, independente do arrasto da mão; a seta de prévia deixa o jogador ajustar a mão antes de soltar. No teste os vetores apontaram para cima e para a esquerda e nenhum tiro acertou, mas isso é incerteza a medir (H-04), não motivo para trocar a fonte pela da pinça.
- **Alternativas rejeitadas:** Direção pelo arrasto relativo (apaga a distinção, CQ-001); corrigir por profundidade (a câmera não a vê); alternativas de orientação (inclinação do pulso, mão de lado) ficam como trabalho futuro, não entrega.
- **Seções atualizadas em `spec.md`:** Resumo, US-001, US-002, FR-001, FR-003, H-04.

### CQ-003 — Força pela velocidade de abertura numa escala logarítmica

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** Como a força do tiro do estalo é regulada, já que no teste ela saía sempre no máximo?
- **Decisão:** Pela velocidade de abertura do polegar (pico da inclinação da razão entre amostras consecutivas), convertida numa escala LOGARÍTMICA: `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)` com `powerLowSpeed` = 10 e `powerHighSpeed` = 200; a velocidade do tiro é `minShotSpeed + power × (maxShotSpeed − minShotSpeed)` com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. O parâmetro linear `maxOpenSpeed` (8) é removido.
- **Razão:** No teste, as 15 velocidades (9,1 a 199 razão/s) ficaram todas acima do teto linear de 8, saturando no máximo. A escala log espalha a faixa observada (10 a 200) entre força 0 e 1. A faixa vem só da amplitude observada; o maintainer não disse quais foram fracos ou fortes, então a variação de ~22 vezes pode ser em parte a força do dedo, não confirmada (H-02).
- **Alternativas rejeitadas:** Manter a escala linear com teto maior (continuaria saturando numa webcam de poucos quadros e não separa os estalos observados); trocar a força pelo arrasto (apaga a distinção, CQ-001).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, US-001, FR-002, H-02, seção `## Distinção entre os modos`.

### CQ-004 — Endurecer o limite de abertura lenta

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Qual deve ser o limite de duração da subida para contar como estalo?
- **Decisão:** `slowMs` cai de 300 para 80 ms. Acima disso a abertura é lenta e o tiro é cancelado. `minOpenSpeed` segue em 2 razão/s.
- **Razão:** Duas aberturas de 103 e 192 ms contaram como tiro porque o limite era 300 ms; 13 das 15 aberturas ficaram em 37 ms ou menos. 80 ms separa o estalo de uma abertura comum com folga sobre os 37 ms observados e rejeita as duas lentas. É palpite de uma sessão (H-01).
- **Alternativas rejeitadas:** Manter 300 ms (deixa passar aberturas lentas); baixar para 40 ms (arriscaria cancelar estalos legítimos numa webcam lenta).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-002, FR-003, H-01.

### CQ-005 — O que sai e o que entra na configuração

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Quais parâmetros mudam com a escala logarítmica?
- **Decisão:** Sai `maxOpenSpeed` (teto linear de 8, que não serve à escala log). Entram `powerLowSpeed` (10) e `powerHighSpeed` (200). Mantêm-se `minShotSpeed` (300), `maxShotSpeed` (1100), `minOpenSpeed` (2, corte de abertura fraca) e `slowMs` (agora 80). A direção pela orientação da mão (`handDirection`), a seta de direção e a medição de velocidade de abertura permanecem.
- **Razão:** A escala linear de 2 a 8 estava errada (saturava); a log precisa de dois pontos de referência (`powerLowSpeed`, `powerHighSpeed`) no lugar de um teto único. Nada que define a mecânica própria do estalo (direção da mão, força pela abertura) é removido.
- **Alternativas rejeitadas:** Manter `maxOpenSpeed` desligado (confunde a configuração); remover a medição de velocidade de abertura (é justamente a fonte da força).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, FR-002, FR-006.

### CQ-006 — Processar só quadros novos da câmera e mostrar a taxa real

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como medir a taxa real da câmera e não reprocessar quadros repetidos?
- **Decisão:** O laço processa o detector só quando a câmera entrega um quadro novo, com `requestVideoFrameCallback` quando disponível e recuo para a comparação de `video.currentTime` quando não (por exemplo no jsdom). O painel passa a mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s). Vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos. Registrada a hipótese (H-03) de que a taxa real pode ser menor que os 86/s processados.
- **Razão:** Foram processados cerca de 86 quadros/s, mais do que uma webcam comum (30/s); o laço `requestAnimationFrame` só pulava quando `currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo. Medir a taxa real é o que confirma ou refuta o reprocessamento, e numa abertura de um quadro a velocidade é limitada pela taxa de quadros (H-05).
- **Razão da escolha técnica:** `requestVideoFrameCallback` é a API específica para quadros de vídeo; o recuo por `currentTime` mantém os testes em jsdom funcionando sem a API.
- **Alternativas rejeitadas:** Confiar na taxa do `requestAnimationFrame` (não é a taxa da câmera); só comparar `currentTime` (menos preciso que rVFC quando disponível).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-003, FR-005, FR-006, H-03, H-05.

### CQ-007 — Rótulo alpha, textos, força e resultado do último estalo

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Como a tela orienta o gesto e o que o painel reporta?
- **Decisão:** A orientação do modo estalo passa a ser "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta"; o rótulo "Estalo (alpha)" é mantido. O painel mostra Armado, a velocidade da abertura, a duração da subida, a FORÇA do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem direção`. Nenhum texto afirma desempenho, correspondência da direção ao estalo real ou viabilidade sem medição; a decisão da issue #72 é do maintainer após o teste manual.
- **Razão:** O gesto é apontar e estalar (não arrastar); a tela precisa dizer isso e que a força vem do polegar. A força em porcentagem e o resultado `sem direção` dão ao maintainer o que calibrar. A viabilidade do estalo segue não testada com a mão.
- **Alternativas rejeitadas:** Remover o rótulo alpha (afirma estabilidade não medida); texto de arrasto de mira (descreveria a mecânica da pinça, não a do estalo).
- **Seções atualizadas em `spec.md`:** Resumo, US-004, FR-006, FR-007, NFR-002, NFR-003.

### CQ-008 — Relação com a spec de criação do estalo (substituição)

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta` ou só se relaciona com ela?
- **Decisão:** Substitui. Como `spec.md` é a única fonte vigente do comportamento e este refino redefine a escala de força, o gatilho e o processamento de quadros do modo estalo, a spec de criação deixa de ser a fonte vigente. Por isso esta spec é a **fonte vigente completa** do modo estalo: declara também o que vem da spec de criação e continua valendo (seletor "Modo de tiro", rótulo alpha, `?mode=estalo`, troca de modo reinicia a rodada, armar ao fechar a pinça vista aberta antes, perda de mão > 300 ms cancela, privacidade, direção pela orientação da mão). O validador estrutural (`scripts/sdd/check-state.mjs`) permite marcar a antiga como `superseded` desde que ela traga `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres); ambos atendidos. A antiga passa a `superseded` apontando para esta, esta declara `supersedes: [2026-10-27-game-marbles-bete-build-flick-beta]` e o `specs/README.md` é atualizado. A spec do modo pinça (`build-pinch-shot`) continua `validated` e entra só em `related_specs`.
- **Razão:** Marcar a antiga como `superseded` mantém uma única fonte vigente (Princípio II) e não quebra `yarn sdd:check`. Deixá-la `validated` manteria dois textos divergentes (escala linear x logarítmica, gatilho de 300 x 80 ms).
- **Alternativas rejeitadas:** Deixar a antiga `validated` e só relacionar (texto vigente contraditório); reescrever a antiga no lugar (apagaria o histórico da decisão de criação, que o Git deve preservar).
- **Seções atualizadas em `spec.md`:** frontmatter (`supersedes`, `related_specs`), Resumo, FR-010; e a spec antiga (`status`, `related_specs`, seção `## Substituição`) e `specs/README.md`.

### CQ-009 — Calibração do estalo com o 2º teste: armar pela razão baixa não serve para a pose real

- **Data:** `2026-10-28`
- **Impacto:** crítico
- **Pergunta:** O gatilho desenhado em CQ-003 a CQ-005 (armar fechando a pinça vista
  aberta antes, histerese 0,35/0,55, duração da subida <= `slowMs` 80 ms,
  `minOpenSpeed` 2 razão/s, escala de força 10 a 200) sustenta a pose real do
  estalo, à vista dos números do 2º teste do maintainer?
- **Decisão:** NÃO; o gatilho foi recalibrado. Esta é uma **emenda da mesma
  entrega** (issue #72, mesma branch `feat/72-refina-estalo`), não uma spec nova:
  os Gates 1 e 2 já aprovados de forma antecipada pelo maintainer para o #72
  continuam valendo. O estalo passa a ser modelado como o polegar se **esticando
  de uma vez** a partir da mão fechada com o polegar preso contra o indicador, e
  NÃO mais como a pinça fechada que abre rápido. Mudanças:
    - **Armar pela razão baixa, não pela histerese da pinça.** A mão arma com a
      razão <= `armRatio` (1,05) e continua armada enquanto a razão fica abaixo de
      `extendRatio`. O detector de estalo deixa de compor o detector de pinça (só
      reaproveita `pinchRatio`); saem a histerese 0,35/0,55, `closeRatio`/`openRatio`,
      `riseStartRatio` (0,4), `slowMs` (80) e `minOpenSpeed` (2).
    - **Gatilho por razão esticada sustentada, não por duração curta.** Estando
      armada, quando a razão chega a >= `extendRatio` (1,2) procura-se o mínimo da
      razão nos últimos `baseWindowMs` (250 ms) — a base da subida. Se
      `razão − base < minRise` (0,4), veredito `fraco demais` (`weak`), cancela. O
      candidato só vira estalo se as `confirmSamples` (3) primeiras amostras seguidas
      (cerca de 200 ms a 15 quadros/s) ficarem >= `extendRatio`; se alguma voltar
      abaixo de 1,2, veredito `não sustentado` (`unsustained`), cancela e rearma se a
      razão estiver <= `armRatio`. O resultado `lento demais` sai.
    - **Força numa escala de 3 a 20 razão/s.** `powerLowSpeed` cai de 10 para 3 e
      `powerHighSpeed` de 200 para 20; a velocidade de abertura é o pico da inclinação
      da razão da base até a última amostra de confirmação. `minShotSpeed` (300) e
      `maxShotSpeed` (1100) ficam. A bolinha só alcança o alvo com força >= cerca de
      0,31 (velocidade de abertura >= cerca de 5,4 razão/s).
    - **Rodada arma sem exigir pinça aberta antes** (`round.ts`): no modo estalo a
      mira começa assim que a mão está armada, porque a pose de estalo fica armada
      logo após o tiro e exigir "aberta antes" desperdiçava o primeiro estalo. O modo
      pinça NÃO muda (continua exigindo a pinça vista aberta).
- **Evidência (2º teste, lida quadro a quadro do painel; só números):** taxa real
  da câmera de 14,6 a 15,3 quadros novos/s (cerca de 15, cerca de 67 ms entre
  amostras), então o limite anterior de 80 ms só aceitava a subida de um quadro.
  Vídeo A (cerca de 16 s): mão FECHADA em movimento, sem estalo, gerou 9 disparos
  falsos no critério antigo — com o punho fechado a razão fica em 0,05 a 0,35
  (armada pela pinça) e oscilações do rastreamento a fazem saltar para 0,8 a 1,4
  num único quadro, que o antigo <= 0,35 depois >= 0,55 aceitava. Vídeo B (cerca de
  37 s): seis estalos nítidos (cerca de 21,5; 25,8; 28,1; 30,3; 32,2 e 34,2 s) com
  base 0,6 a 1,0 e pico 1,4 a 2,0, razão >= 1,2 por pelo menos 3 amostras
  (cerca de 0,7 a 1 s); as tentativas anteriores a 12,1 s usavam outra pose
  (polegar contra a ponta do indicador, razão 0,05 a 0,4, subindo no máximo a
  cerca de 1,0) e NÃO disparam no novo critério. As velocidades de abertura dos
  estalos reais (5 a 10 razão/s) são iguais ou menores que as dos disparos falsos
  do vídeo A (6 a 19 razão/s): a velocidade NÃO separa estalo de oscilação; o que
  separa é a razão ficar esticada por vários quadros. Os números foram conferidos
  em 6 instantes contra leitura manual (0,59; 0,48; 0,79; 1,37; 1,17; 1,06, iguais);
  a série lida está em `packages/marbles/test/fixtures/flick-sessions.ts`.
- **Razão:** Com cerca de 15 quadros/s, um limite de duração de 80 ms só aceitava a
  subida de um quadro, e a oscilação do rastreamento da mão fechada sobe num quadro
  tão rápido quanto um estalo — a duração e a velocidade não separam os dois casos.
  O que separa é a razão ficar ESTICADA por vários quadros, que a oscilação não
  sustenta. Armar pela pinça fechada (razão <= 0,35) também não servia: na pose real
  de estalo a razão fica em 0,6 a 1,0 (polegar preso contra o indicador dobrado) e
  nunca chega a <= 0,35, então a mão nunca armava; armar com `armRatio` 1,05 cobre
  essa pose. A escala 10 a 200 colocava toda a faixa real (5 a 10 razão/s) perto de
  força 0; 3 a 20 espalha a faixa observada entre 0 e 1.
- **Alternativas rejeitadas:** Manter o gatilho por duração curta (<= 80 ms) — a
  cerca de 15 quadros/s não distingue estalo de oscilação de um quadro; manter o
  armar pela pinça fechada (<= 0,35) — a pose real de estalo nunca arma; manter a
  escala 10 a 200 — satura em força 0 para a faixa real de 5 a 10 razão/s.
- **Limitação conhecida (replay das duas séries, `flick-replay.test.ts`):** no vídeo
  A, dos 9 disparos falsos sobrou 1 confirmado (cerca de 8,97 s), que é a mão se
  abrindo depois do punho — a razão sozinha não distingue abrir a mão de esticar o
  polegar; não resolvido. No vídeo B, os seis estalos confirmam (cerca de 22, 26,
  28, 30, 32 e 34 s), com forças de 0,26 a 0,93. Os limiares foram escolhidos
  olhando DUAS sessões de UMA pessoa e UMA webcam de cerca de 15 quadros/s; o replay
  protege contra regressão mas não prova o estalo com outra mão, outra webcam ou ao
  vivo. Nenhum estalo ao vivo foi testado após esta mudança (Gate 3 / T014 segue
  pendente do teste do maintainer).
- **Seções atualizadas em `spec.md`:** frontmatter (`summary`, `updated_at`),
  Resumo, Problema, Objetivos, Atores, US-001, US-002, US-004 e critérios, FR-001,
  FR-002, FR-003, FR-004, FR-006, FR-007, edge cases, H-01, H-02, H-03, H-05,
  critérios de sucesso e a tabela "Distinção entre os modos".

### CQ-010 — Estalo por troca de gestos prontos? Reconhecedor de gestos, guia de etapas e veto de palma aberta

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** O maintainer pediu que o estalo passasse a ser detectado "por
  troca de gestos" (usar os gestos prontos do MediaPipe — `Closed_Fist`,
  `Open_Palm`, `Thumb_Up` — para armar e disparar) e uma ajuda na tela com as
  etapas do estalo. Os gestos prontos reconhecem a pose do estalo (punho com o
  polegar preso; polegar para cima) a ponto de substituir o gatilho por razão da
  CQ-009?
- **Decisão:** PARCIALMENTE. Esta é uma **emenda da mesma entrega** (issue #72,
  mesma branch `feat/72-refina-estalo`); os Gates 1 e 2 já aprovados de forma
  antecipada pelo maintainer para o #72 continuam valendo, como na CQ-009. O jogo
  das bolinhas passa a usar o `GestureRecognizer` do MediaPipe (`realGestureLoader`
  em `apps/web/src/tracker/mediapipeTracker.ts`; modo de vídeo, uma mão) em vez do
  `HandLandmarker`, que entrega os mesmos landmarks MAIS o gesto pronto de maior
  pontuação da primeira mão; o jogo de cartas segue com o `HandLandmarker`. Mas os
  gestos prontos NÃO reconheceram a pose do estalo na conferência offline, então
  eles NÃO substituem o gatilho por razão: o gatilho da CQ-009 (armar por
  `armRatio`, confirmar por razão esticada sustentada) permanece. Mudanças:
    - **Gesto pronto como diagnóstico e veto, não como gatilho.** O gesto do quadro
      (`HandGesture { name, score }`) entra no detector por `update(landmarks,
aspect, nowMs, gesture?)` e aparece no painel na linha "Gesto reconhecido"
      (nome e pontuação, ou traço). NÃO se exige `Closed_Fist` para armar nem
      `Thumb_Up` para disparar, porque a conferência não os viu.
    - **Veto de palma aberta.** Novo veredito `open_hand` (resultado no painel: `mão
aberta`): se alguma das `confirmSamples` (3) amostras de confirmação tiver o
      gesto `openHandGesture` (`Open_Palm`) com pontuação >= `gestureMinScore`
      (0,8), o estalo é cancelado — é a mão se abrindo, não o polegar esticando. A
      `FlickReading` ganhou `phase` (`idle`, `armed`, `pending`) e `gesture`. Todo o
      resto do detector da CQ-009 continua igual.
    - **Guia de etapas na tela.** Novo componente `apps/web/src/marbles/FlickGuide.tsx`
      no modo estalo: lista ordenada "Etapas do estalo" com quatro etapas (1 fechar a
      mão com o polegar preso contra o indicador; 2 apontar a mão para o alvo, com a
      seta mostrando a direção; 3 esticar o polegar para cima de uma vez e deixá-lo
      esticado; 4 a bolinha rola, a força vem da rapidez), com a etapa atual marcada
      por `aria-current="step"` (1: pronto e sem armar; 2: armado; 3: confirmando o
      polegar esticado; 4: bolinha rolando ou acerto) e uma dica em região
      `aria-live="polite"` para o último estalo que não disparou (`fraco demais`,
      `não sustentado`, `mão aberta`, `sem direção`). A pinça não tem guia (fora de
      escopo).
    - **Ativo novo.** `gesture_recognizer.task` (float16, v1, cerca de 8,4 MB,
      SHA-256 `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`,
      URL `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`),
      baixado por `yarn prepare:assets` junto do `hand_landmarker.task`, servido pelo
      próprio app e não versionado. A licença desse `.task` NÃO foi lida na fonte (a
      mesma ressalva que o README já faz para o outro modelo).
- **Evidência (conferência offline dos gestos prontos, MUITO limitada; só números):**
  rodando o Gesture Recognizer nos recortes de câmera de duas gravações de tela
  (foto de baixa resolução com o esqueleto desenhado por cima; a taxa de detecção
  ficou baixa e não é a do app ao vivo). Vídeo B (estalos, 9,5 a 35,5 s): 390
  quadros, mão detectada em 151; rótulos `None` 127, `Open_Palm` 23 (pontuações 0,50
  a 0,65), `Pointing_Up` 1; `Closed_Fist` e `Thumb_Up` ZERO. Os `Open_Palm`
  apareceram também em dois estalos reais (cerca de 32,4 a 32,9 s e 34,4 a 34,5 s,
  com o polegar esticado, razão 1,0 a 1,4), por isso a pontuação mínima do veto é
  0,8 (acima do observado nos estalos reais) e não 0,5. Vídeo A (punho em
  movimento): 238 quadros, mão em 35, todos `None` (nenhum `Closed_Fist`). Os
  landmarks do `GestureRecognizer` coincidiram com os do `HandLandmarker` até a 2ª
  casa decimal da razão nos 6 quadros em que ambos detectaram (0,67; 0,86; 0,61;
  0,72; 0,67; 0,75), o que sugere que a pinça não muda; é conferência pequena, não
  prova. Em Chromium headless com câmera simulada (sem mão real), o
  `gesture_recognizer.task` carregou do próprio app, 160 quadros processados, 15,0
  quadros novos/s, delegate CPU, 10 requisições todas GET sem corpo e só para a
  própria origem, e o guia apareceu com a etapa 1 marcada; nenhum estalo real foi
  testado ao vivo.
- **Razão:** Nesta conferência os gestos prontos NÃO reconheceram a pose do estalo
  (punho com o polegar preso; polegar para cima) nem o punho do vídeo A; portanto
  trocar o gatilho da CQ-009 por gestos prontos não se sustenta na evidência. O
  gesto fica como veto de palma aberta com pontuação alta (para o caso da mão se
  abrir, a limitação conhecida da CQ-009) e como diagnóstico no painel, que é o que
  o próximo teste ao vivo precisa para decidir entre gestos prontos, treino de gesto
  próprio (Model Maker) ou outra abordagem. O guia de etapas atende diretamente ao
  pedido de "ajuda na tela com as etapas".
- **Alternativas rejeitadas:** Exigir `Closed_Fist` para armar e `Thumb_Up` para
  disparar (os gestos prontos não reconheceram essas poses na conferência; travaria
  o estalo); baixar o veto para pontuação 0,5 (cancelaria dois estalos reais que
  tiveram `Open_Palm` 0,50 a 0,65); manter só o `HandLandmarker` no jogo das
  bolinhas (sem o gesto pronto não há veto nem diagnóstico que o maintainer pediu).
- **Limitação conhecida:** o veto NÃO foi medido contra a mão se abrindo de verdade
  (não houve quadros claros de palma aberta nas gravações), então pode não ajudar; o
  veto pode cancelar um estalo real se o reconhecedor rotular o polegar esticado como
  palma aberta com pontuação >= 0,8; os gestos prontos podem não reconhecer a pose do
  estalo ao vivo; e a conferência offline foi em recortes de baixa resolução, com
  taxa de detecção baixa, não a do app ao vivo. Nada foi testado com mão viva (Gate 3
  / T014 segue pendente).
- **Seções atualizadas em `spec.md`:** frontmatter (`summary`, `updated_at`),
  Resumo, Problema, Objetivos, Atores, US-002, US-004 e critérios, nova US-006,
  FR-002, FR-006, FR-008 (privacidade do novo modelo), FR-011 (reconhecedor e ativo),
  FR-012 (guia de etapas), novo NFR-005 (acessibilidade do guia), edge cases, H-06,
  critérios de sucesso e a tabela "Distinção entre os modos".

## Hipóteses remanescentes

- Os limiares do gatilho (`armRatio` = 1,05; `extendRatio` = 1,2; `confirmSamples` = 3; `minRise` = 0,4; `baseWindowMs` = 250 ms) são palpites calibrados em DUAS sessões de UMA pessoa e UMA webcam de cerca de 15 quadros/s (H-01).
- A faixa 3 a 20 da escala de força vem só da amplitude observada (estalos reais de 5 a 10 razão/s); não se sabe quais estalos foram fracos ou fortes (H-02).
- A taxa real da câmera medida foi de cerca de 15 quadros/s (H-03); o painel de quadros novos por segundo é o que mede isso.
- A direção pela orientação da mão pode não corresponder ao estalo real (H-04); mantida porque a seta de prévia deixa ajustar a mão; alternativas ficam como pergunta aberta.
- Numa subida de 1 a 2 quadros a velocidade de abertura é limitada pela taxa de quadros, não pela força do polegar; por isso o gatilho passou a exigir a razão esticada por vários quadros em vez de uma subida rápida (H-05).
- Limitação conhecida não resolvida: a razão polegar-indicador sozinha não distingue abrir a mão de esticar o polegar, então uma mão fechada que se abre pode confirmar um estalo (1 caso no replay do vídeo A).
- Os gestos prontos do MediaPipe (`Closed_Fist`, `Thumb_Up`) não reconheceram a pose do estalo na conferência offline, então o gesto entra só como veto de palma aberta (pontuação >= 0,8) e diagnóstico, não como gatilho; o veto não foi medido contra a mão se abrindo de verdade e pode não ajudar ou cancelar um estalo real (H-06).

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo" e "pode fazer então, abre um PR") e issue 72 do repositório.
- **Observações:** Aprovação antecipada no chat, após a correção de rumo (CQ-001), a partir dos números do primeiro teste lidos no painel. A recalibração do 2º teste (CQ-009, 2026-10-28) e a troca para o reconhecedor de gestos, o guia de etapas e o veto de palma aberta (CQ-010, 2026-10-28) são emendas da MESMA entrega do #72 (mesma branch); os Gates 1 e 2 já aprovados de forma antecipada pelo maintainer para o #72 permanecem válidos e não foram reabertos. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
