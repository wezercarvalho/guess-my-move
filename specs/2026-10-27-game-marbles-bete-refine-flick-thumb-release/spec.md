---
id: 2026-10-27-game-marbles-bete-refine-flick-thumb-release
title: Refino do modo de tiro por estalo (alpha) do bete, com força pela abertura do polegar
slug: game-marbles-bete-refine-flick-thumb-release
strategy: sdd
domain: game
capability: marbles-bete
objective: refine-flick-thumb-release
summary: Torna o modo estalo (alpha) do bete jogável mantendo-o como uma mecânica própria, distinta da pinça — o estalo é o polegar se esticando de uma vez a partir da mão fechada com o polegar preso contra o indicador; a direção vem da orientação da mão no plano da imagem (pulso à base do dedo médio, espelhada), medida na base da subida, e a força vem da VELOCIDADE DE ABERTURA do polegar (pico da inclinação da razão), convertida em velocidade do tiro numa escala LOGARÍTMICA de 3 a 20 razão/s (antes 10 a 200). O gatilho deixa de depender da pinça fechada e da duração curta — a mão arma com a razão até armRatio (1,05) e o estalo dispara quando a razão atinge extendRatio (1,2) subindo pelo menos minRise (0,4) acima do mínimo recente (baseWindowMs 250 ms) e FICA esticada por confirmSamples (3) amostras; cancelamentos fraco demais, não sustentado e sem direção. Saem slowMs (80), minOpenSpeed (2), riseStartRatio (0,4) e a histerese 0,35/0,55 no estalo; entram armRatio, extendRatio, confirmSamples, minRise e baseWindowMs. Processa só quadros novos da câmera via requestVideoFrameCallback com recuo para currentTime (taxa real medida de cerca de 15 quadros/s) e mostra a taxa real, Armado, a velocidade da abertura, a força e o resultado do último estalo no painel. O jogo das bolinhas passa a usar o GestureRecognizer do MediaPipe (modelo gesture_recognizer.task, baixado por prepare:assets e servido pelo próprio app) em vez do HandLandmarker, trazendo o gesto pronto da mão — usado como veto de palma aberta (veredito open_hand, resultado mão aberta, quando Open_Palm tem pontuação >= 0,8 durante a confirmação) e como diagnóstico na linha Gesto reconhecido do painel, NÃO como gatilho, porque os gestos prontos não reconheceram a pose do estalo na conferência offline. O modo estalo ganha um guia de etapas na tela (quatro etapas com a atual marcada por aria-current e uma dica aria-live para o estalo que não disparou). O jogo de cartas segue com o HandLandmarker. Fonte vigente completa do modo estalo; substitui a spec de criação do modo estalo (issue #72).
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - estalo
    - estalo alpha
    - força pela abertura
    - velocidade de abertura
    - escala logarítmica
    - gatilho por razão esticada
    - orientação da mão
    - quadros novos
    - requestVideoFrameCallback
    - rVFC
    - taxa da câmera
    - reconhecedor de gestos
    - gesture recognizer
    - gesture_recognizer.task
    - gesto pronto
    - veto de palma aberta
    - mão aberta
    - guia de etapas
    - etapas do estalo
    - bete
    - packages/marbles
code_paths:
    - packages/marbles/
    - apps/web/
related_specs:
    - 2026-10-27-game-marbles-bete-build-flick-beta
    - 2026-10-27-game-marbles-bete-build-pinch-shot
supersedes:
    - 2026-10-27-game-marbles-bete-build-flick-beta
branch: feat/72-refina-estalo
constitution_version: 1.0.0
created_at: 2026-10-27
updated_at: 2026-10-28
---

# Refino do modo de tiro por estalo (alpha) do bete, com força pela abertura do polegar

## Resumo

O modo estalo (alpha) do bete, entregue pela spec de criação, não ficou jogável nos testes com a mão real: a força saía sempre no máximo, aberturas lentas disparavam e, no 2º teste, a pose real do estalo nunca armava e a mão fechada em movimento disparava falso. Este refino **não** transforma o estalo numa cópia da pinça: pinça e estalo são duas mecânicas diferentes e esta spec estrutura essa distinção. Na pinça, a força é regulada pela mão (arrasto, estilingue). O estalo é o **polegar se esticando de uma vez** a partir da mão fechada com o polegar preso contra o indicador: a razão polegar-indicador sobe de uma faixa baixa para uma faixa alta e **fica** alta por alguns quadros. A **velocidade de abertura** do polegar (pico da inclinação da razão entre amostras consecutivas) é convertida em velocidade do tiro numa escala **logarítmica** de 3 a 20 razão/s (antes 10 a 200, que colocava a faixa real perto de força 0). A direção continua vindo da **orientação da mão** no plano da imagem (vetor do pulso à base do dedo médio, espelhado), medida na **base da subida** (o mínimo recente da razão), com uma seta de direção a partir da bolinha enquanto armado — e não do arrasto. O gatilho deixa de depender da pinça fechada e da duração curta: a mão arma com a razão <= `armRatio` (1,05) e o estalo só dispara quando a razão chega a >= `extendRatio` (1,2), subindo pelo menos `minRise` (0,4) acima do mínimo dos últimos `baseWindowMs` (250 ms) **e** ficando esticada por `confirmSamples` (3) amostras seguidas (cerca de 200 ms a 15 quadros/s); subida pequena cancela como `fraco demais`, uma volta abaixo de 1,2 antes de confirmar cancela como `não sustentado`, e a falta de direção medida cancela como `sem direção`. Saem da configuração `slowMs` (80 ms), `minOpenSpeed` (2), `riseStartRatio` (0,4) e a histerese 0,35/0,55 no estalo; entram `armRatio`, `extendRatio`, `confirmSamples`, `minRise` e `baseWindowMs`. Como esta spec é a fonte vigente completa do modo estalo, ela declara também o que vem da spec de criação e continua valendo (seletor "Modo de tiro", rótulo "Estalo (alpha)", `?mode=estalo`, troca de modo reinicia a rodada, perda da mão por mais de 300 ms cancela, privacidade). No modo estalo a mira começa assim que a mão está armada, sem exigir ter visto a pinça aberta antes (o modo pinça não muda). O laço de quadros passa a processar o detector só quando a câmera entrega um quadro novo (`requestVideoFrameCallback`, com recuo para `currentTime`) nos dois modos, e o painel mostra os quadros novos da câmera por segundo (taxa real medida de cerca de 15 quadros/s). Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta`.

Atendendo ao pedido do maintainer de detectar o estalo "por troca de gestos" e de uma ajuda na tela com as etapas, o jogo das bolinhas (e só ele) passa a usar o `GestureRecognizer` do MediaPipe (modelo `gesture_recognizer.task`, baixado por `prepare:assets` junto do `hand_landmarker.task` e servido pelo próprio app) em vez do `HandLandmarker`: ele entrega os mesmos landmarks MAIS o gesto pronto de maior pontuação da primeira mão (`HandGesture { name, score }`). Numa conferência offline muito limitada (recortes de baixa resolução de duas gravações de tela), os gestos prontos NÃO reconheceram a pose do estalo (`Closed_Fist` e `Thumb_Up` nunca apareceram), então o gesto NÃO vira gatilho: o gatilho por razão continua o da CQ-009. O gesto entra como **veto de palma aberta** — novo veredito `open_hand` (resultado no painel `mão aberta`): se alguma das `confirmSamples` amostras de confirmação tiver `Open_Palm` com pontuação >= `gestureMinScore` (0,8), o estalo é cancelado, por ser a mão se abrindo e não o polegar esticando — e como **diagnóstico** na linha "Gesto reconhecido" do painel. A tela do modo estalo ganha um **guia de etapas** (`FlickGuide`): uma lista ordenada "Etapas do estalo" com quatro etapas, a etapa atual marcada por `aria-current="step"` e uma dica em região `aria-live="polite"` para o último estalo que não disparou (`fraco demais`, `não sustentado`, `mão aberta`, `sem direção`). O jogo de cartas segue com o `HandLandmarker`.

## Problema

Dois testes do modo estalo com a mão real, lidos do painel de depuração no Chrome desktop do maintainer (números lidos quadro a quadro; os vídeos de tela não fazem parte do repositório), mostraram que o gatilho estava errado.

O **1º teste** (sessão de cerca de 40 s) mostrou três falhas: a força era sempre a máxima (as 15 aberturas tiveram velocidade de 9,1 a 199 razão/s, toda acima do teto linear `maxOpenSpeed` = 8, saturando em 1100 unid/s); aberturas lentas disparavam (duas de 103 e 192 ms contaram como tiro porque o limite era 300 ms); e a direção não acompanhava a intenção (os dois vetores legíveis apontaram para cima e para a esquerda e nenhum dos 8 tiros acertou).

O **2º teste** mediu a taxa real da webcam em 14,6 a 15,3 quadros novos/s (cerca de 15, cerca de 67 ms entre amostras) e mostrou que o desenho corrigido do 1º teste (armar fechando a pinça, subida <= 80 ms) ainda não servia à pose real:

- **A mão fechada em movimento disparava falso.** O vídeo A (cerca de 16 s), com a mão FECHADA em movimento e sem estalo, gerou 9 disparos. Com o punho fechado a razão fica em 0,05 a 0,35 (armada pelo critério da pinça) e oscilações do rastreamento a fazem saltar para 0,8 a 1,4 num único quadro; o critério antigo (<= 0,35 e depois >= 0,55) aceitava. A cerca de 15 quadros/s, o limite de 80 ms só aceitava a subida de um quadro, e a oscilação sobe num quadro tão rápido quanto um estalo: a duração e a velocidade não separam os dois casos.
- **A pose real do estalo nunca armava.** No vídeo B (cerca de 37 s), dos 12,1 s ao fim a razão ficou em 0,6 a 1,0 (polegar preso contra o indicador dobrado) e subia para 1,2 a 2,0 ao esticar o polegar, voltando depois; nunca chegou a <= 0,35, então a mão nunca armava pelo critério da pinça. Seis estalos nítidos (cerca de 21,5; 25,8; 28,1; 30,3; 32,2 e 34,2 s) tiveram base 0,6 a 1,0, pico 1,4 a 2,0, com a razão >= 1,2 por pelo menos 3 amostras (cerca de 0,7 a 1 s).
- **A velocidade não separa estalo de oscilação.** A velocidade de abertura dos estalos reais foi de 5 a 10 razão/s (limitada pela taxa de 15 quadros/s: a subida acontece em 1 a 2 quadros); os disparos falsos do vídeo A tinham velocidades iguais ou maiores (6 a 19 razão/s). O que separa o estalo da oscilação é a razão ficar ESTICADA por vários quadros, que a oscilação não sustenta.

A correção de rumo (maintainer, 2026-10-27) foi estruturar a distinção entre as mecânicas e aplicá-la a cada modo, **não** apagar a diferença. A pinça é um estilingue regulado pela mão; o estalo é regulado pelo polegar e é mais complexo. Mantêm-se a direção pela orientação da mão e a força pela velocidade de abertura, agora numa escala logarítmica de 3 a 20 razão/s (a faixa real de 5 a 10 ficava perto de força 0 na escala 10 a 200). O gatilho deixa de depender da pinça fechada e da duração curta: arma pela razão baixa (<= 1,05) e dispara quando a razão fica esticada (>= 1,2) por vários quadros; a seta de prévia deixa o jogador ajustar a mão.

A suspeita de reprocessamento de quadros do 1º teste foi medida: a taxa real da câmera é de cerca de 15 quadros/s (o laço antes processava cerca de 86/s por não pular quadros repetidos). O laço passa a processar o detector só em quadros novos da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`).

O maintainer também pediu detectar o estalo "por troca de gestos" (os gestos prontos do MediaPipe) e uma ajuda na tela com as etapas. Uma conferência offline muito limitada (o `GestureRecognizer` rodado em recortes de baixa resolução de duas gravações de tela, com o esqueleto desenhado por cima e taxa de detecção baixa) mostrou que os gestos prontos NÃO reconhecem a pose do estalo: no vídeo B (estalos) os 151 quadros com mão deram `None` 127, `Open_Palm` 23 (pontuações 0,50 a 0,65) e `Pointing_Up` 1, com `Closed_Fist` e `Thumb_Up` em ZERO; no vídeo A (punho em movimento) os 35 quadros com mão foram todos `None`. Por isso os gestos prontos não podem ser o gatilho; entram como veto de palma aberta com pontuação alta (>= 0,8, acima dos 0,50 a 0,65 vistos em dois estalos reais) e como diagnóstico, e o guia de etapas atende ao pedido de ajuda na tela.

## Objetivos

- Estruturar a distinção entre pinça e estalo como requisito e aplicá-la a cada modo: a pinça regula a força pela mão (arrasto) e não muda; o estalo é o polegar se esticando de uma vez a partir da mão fechada, com a direção pela orientação da mão e a força pela velocidade de abertura.
- Trocar o gatilho do estalo de "pinça fechada que abre rápido (<= 80 ms)" para "razão esticada sustentada": armar com a razão <= `armRatio` (1,05) e disparar quando a razão chega a >= `extendRatio` (1,2), subindo pelo menos `minRise` (0,4) acima do mínimo dos últimos `baseWindowMs` (250 ms) e ficando esticada por `confirmSamples` (3) amostras seguidas.
- Trocar a escala logarítmica de força de 10 a 200 para 3 a 20 razão/s, para que a faixa real observada (5 a 10 razão/s) se espalhe entre força 0 e 1 em vez de saturar perto de 0.
- Remover da configuração `slowMs` (80), `minOpenSpeed` (2), `riseStartRatio` (0,4) e a histerese 0,35/0,55 no estalo; acrescentar `armRatio`, `extendRatio`, `confirmSamples`, `minRise` e `baseWindowMs`, mantendo `powerLowSpeed`, `powerHighSpeed`, `minShotSpeed`, `maxShotSpeed` e `historyMs`.
- No modo estalo, começar a mira assim que a mão está armada, sem exigir ter visto a pinça aberta antes (o modo pinça continua exigindo).
- Processar o detector só em quadros novos da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`) e mostrar a taxa real da câmera no painel, nos dois modos.
- Mostrar no painel do estalo Armado, a velocidade da abertura, a FORÇA do último estalo (0 a 100%) e o resultado do último estalo (`disparado`, `fraco demais`, `não sustentado`, `mão aberta`, `sem direção`).
- Trocar o detector do jogo das bolinhas do `HandLandmarker` para o `GestureRecognizer` do MediaPipe (modelo `gesture_recognizer.task`, baixado por `prepare:assets` e servido pelo próprio app), trazendo o gesto pronto da mão como VETO de palma aberta (veredito `open_hand`) e como diagnóstico no painel, SEM torná-lo o gatilho do estalo; o jogo de cartas continua com o `HandLandmarker`.
- Mostrar na tela do modo estalo um guia de etapas (quatro etapas, a atual marcada por `aria-current` e uma dica `aria-live` para o estalo que não disparou), atendendo ao pedido de uma ajuda na tela com as etapas.
- Preservar o modo pinça (salvo o processar só quadros novos), a física, o campo, o alvo, o jogo de cartas e a privacidade, sem regressão.

## Fora de escopo

- Trocar a fonte de direção ou de força do estalo pelo arrasto relativo da mão: o estalo NÃO usa o arrasto para direção nem para força; isso seria apagar a distinção entre os modos.
- Estalo com a mão de lado e a câmera baixa (segundo cenário observado): não se sabe se o detector segue a mão nessa posição; fica como pergunta aberta, não entrega.
- Alternativas de direção (inclinação do pulso, posição da mão, orientação do indicador com a mão de lado): ficam como trabalho futuro e pergunta aberta, não entrega.
- Segunda mão, novos modelos de detecção e novos modos de tiro além de pinça e estalo.
- Ajustar `aimScale` ou mudar a mira do modo pinça; o modo pinça só muda por processar quadros repetidos a menos.
- Afirmar taxa de quadros, latência, taxa de reconhecimento do estalo, correspondência da direção ao estalo real ou viabilidade do estalo sem medição no desktop do maintainer.
- Fechar a questão da viabilidade do estalo: o modo segue alpha; a decisão depende do teste manual do maintainer (Gate 3).

## Atores

- **Jogador:** no modo estalo, fecha a mão com o polegar preso contra o indicador (armar), aponta a mão para o alvo, confere a seta de direção a partir da bolinha e estica o polegar de uma vez, deixando-o esticado, para disparar; a força vem da rapidez com que o polegar estica. Erra e tenta de novo.
- **Maintainer:** testa no Chrome desktop, lê a taxa real da câmera, a razão da pinça (faixa na pose armada e esticada), Armado, a velocidade da abertura, a força e o resultado do último estalo (incluindo `não sustentado` e `fraco demais`) no painel, calibra os limiares e decide a viabilidade da issue #72 (Gate 3).
- **Detector de estalo:** lógica pura que reaproveita a razão da pinça (`pinchRatio`), arma com a razão <= `armRatio`, procura o mínimo da razão nos últimos `baseWindowMs` como base da subida, confirma o estalo quando a razão fica >= `extendRatio` por `confirmSamples` amostras, mede a velocidade de abertura de pico da base até a última amostra de confirmação e mede a direção pela orientação da mão na base. Recebe o gesto pronto do quadro (`HandGesture`) por `update(..., gesture?)` e cancela o estalo (veredito `open_hand`) se alguma amostra de confirmação tiver `Open_Palm` com pontuação >= `gestureMinScore`. Não compõe mais o detector de pinça.
- **Reconhecedor de gestos do app (bolinhas):** o `GestureRecognizer` do MediaPipe (`realGestureLoader`), que entrega os mesmos landmarks do `HandLandmarker` MAIS o gesto pronto de maior pontuação da primeira mão; alimenta o detector e a linha "Gesto reconhecido" do painel. O jogo de cartas continua com o `HandLandmarker`.
- **Guia de etapas (tela do estalo):** componente que mostra as quatro etapas do estalo, destaca a etapa atual por `aria-current` e, após um estalo que não disparou, uma dica em região `aria-live`.
- **Motor da rodada:** lógica pura que, no modo estalo, começa a mira assim que a mão está armada (sem exigir pinça aberta antes), publica a direção de prévia, dispara ao confirmar o estalo com direção medida convertendo a velocidade de abertura em força logarítmica, e cancela no fraco, no não sustentado, no sem direção ou na perda da mão.
- **Laço de quadros da câmera:** processa o detector só quando a câmera entrega um quadro novo e conta os quadros novos por segundo.

## Histórias de usuário

### US-001 — Atirar o estalo com a força do polegar e acertar o alvo (P1)

Como jogador, quero fechar a mão com o polegar preso contra o indicador, apontá-la para o alvo e esticar o polegar de uma vez, para que a bolinha parta na direção que apontei e com uma força proporcional à rapidez com que meu polegar esticou, e eu consiga acertar o alvo.

**Teste independente:** no Chrome desktop com a câmera ativa e o modo estalo selecionado, fechar a mão com o polegar preso contra o indicador (a tela mostra a seta de direção a partir da bolinha de tiro), apontar para o alvo e esticar o polegar de uma vez, deixando-o esticado; a bolinha parte na direção apontada com a força da velocidade de abertura e, ao tocar o alvo, a rodada termina mostrando o número de tiros. Um estalo mais rápido do polegar leva a bolinha mais longe que um mais lento.

**Critérios de aceitação:**

1. **Dado** que a mão está armada (razão <= `armRatio` 1,05), **quando** a mira está ativa, **então** a tela mostra uma seta de direção a partir da bolinha de tiro, com a direção corrente da orientação da mão (pulso à base do dedo médio, espelhada).
2. **Dado** um estalo confirmado com direção medida, **quando** a razão fica esticada por `confirmSamples` amostras, **então** o tiro dispara na direção medida na base da subida, e a velocidade do tiro vem da velocidade de abertura do polegar por uma escala logarítmica, não do arrasto da mão.
3. **Dado** que a velocidade de abertura é `v` razão/s, **quando** o tiro dispara, **então** `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)` com `powerLowSpeed` = 3 e `powerHighSpeed` = 20, e a velocidade do tiro é `minShotSpeed + power × (maxShotSpeed − minShotSpeed)` com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s: `v` <= 3 dá força 0 (300 unid/s) e `v` >= 20 dá força 1 (1100 unid/s). A bolinha só alcança o alvo com força >= cerca de 0,31 (velocidade de abertura >= cerca de 5,4 razão/s).

### US-002 — Disparar só com um estalo sustentado, com direção e força (P1)

Como jogador, quero que só um estalo de verdade — o polegar esticando de uma vez e ficando esticado, com a mão apontada — conte como tiro, para que uma oscilação da mão fechada ou uma esticada pequena não gaste um tiro.

**Teste independente:** no modo estalo, esticar o polegar só um pouco (subida da razão abaixo de `minRise`), esticar e voltar a fechar antes de confirmar (razão cai abaixo de `extendRatio` nas primeiras amostras), abrir a mão inteira (o gesto pronto `Open_Palm` com pontuação >= 0,8) ou estalar sem a direção da mão legível; em nenhum dos casos a bolinha parte nem o contador de tiros sobe, e o painel mostra "fraco demais", "não sustentado", "mão aberta" ou "sem direção"; esticar o polegar de uma vez e deixá-lo esticado, com a mão apontada, dispara.

**Critérios de aceitação:**

1. **Dado** que a mão está armada, **quando** a razão chega a >= `extendRatio` (1,2) subindo pelo menos `minRise` (0,4) acima do mínimo dos últimos `baseWindowMs` (250 ms) e fica >= `extendRatio` por `confirmSamples` (3) amostras seguidas, e há direção medida, **então** dispara com a direção medida e a força logarítmica da velocidade de abertura.
2. **Dado** que a mão está armada, **quando** a subida da razão até o cruzamento é menor que `minRise`, **então** o estalo é classificado como `fraco demais` (`weak`) e o tiro é CANCELADO, sem contar tiro.
3. **Dado** um estalo candidato, **quando** a razão volta abaixo de `extendRatio` antes de completar `confirmSamples` amostras, **então** o estalo é classificado como `não sustentado` (`unsustained`), o tiro é CANCELADO sem contar tiro, e a mão rearma se a razão estiver <= `armRatio`.
4. **Dado** que a mão está armada, **quando** o estalo confirma mas a direção da mão não pôde ser medida (vetor degenerado), **então** o resultado é "sem direção" e nada é disparado, sem contar tiro.
5. **Dado** um estalo candidato, **quando** alguma das `confirmSamples` amostras de confirmação traz o gesto pronto `Open_Palm` com pontuação >= `gestureMinScore` (0,8), **então** o estalo é classificado como `mão aberta` (`open_hand`), o tiro é CANCELADO sem contar tiro (é a mão se abrindo, não o polegar esticando).
6. **Dado** que a mão some por mais de 300 ms durante a mira, **quando** a mão volta, **então** o estado armado foi zerado e esticar o polegar não dispara.

### US-003 — Processar só quadros novos e ver a taxa real da câmera (P1)

Como maintainer, quero que o detector rode só quando a câmera entrega um quadro novo e ver quantos quadros novos por segundo a câmera entrega, para saber a taxa real da webcam e não a do laço de desenho.

**Teste independente:** no modo estalo ou pinça, o painel mostra "Quadros novos da câmera/s" com a contagem em uma janela de 1 s; em um ambiente com `requestVideoFrameCallback`, o detector é chamado uma vez por quadro novo da câmera; em um ambiente sem (por exemplo jsdom), o laço recua para a comparação de `currentTime` e não reprocessa o mesmo quadro.

**Critérios de aceitação:**

1. **Dado** um ambiente com `requestVideoFrameCallback`, **quando** o laço roda, **então** o detector é chamado uma vez por quadro novo entregue pela câmera, e não uma vez por quadro de desenho.
2. **Dado** um ambiente sem `requestVideoFrameCallback`, **quando** o laço roda, **então** ele recua para a comparação de `video.currentTime` e não reprocessa um `currentTime` repetido.
3. **Dado** qualquer um dos dois modos, **quando** o painel é consultado, **então** mostra os quadros novos da câmera por segundo (contagem em janela de 1 s).

### US-004 — Entender o modo estalo pela tela e ver a força e o resultado do último estalo (P2)

Como jogador, quero que a tela me diga como atirar no estalo e me mostre a força e o que aconteceu no último estalo, para eu corrigir o gesto.

**Teste independente:** no modo estalo, a tela orienta "feche a mão com o polegar preso contra o indicador, aponte-a para o alvo e estique o polegar de uma vez, deixando-o esticado. A força vem da rapidez com que o polegar estica.", mantém o rótulo "Estalo (alpha)" e o painel mostra Armado, o gesto reconhecido, a velocidade da abertura, a força do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `fraco demais`, `não sustentado`, `mão aberta` ou `sem direção`.

**Critérios de aceitação:**

1. **Dado** o modo estalo, **quando** a tela é exibida, **então** a orientação pede fechar a mão com o polegar preso contra o indicador, apontá-la para o alvo e esticar o polegar de uma vez deixando-o esticado, informa que a força vem da rapidez com que o polegar estica, e o rótulo "Estalo (alpha)" é mantido.
2. **Dado** um estalo, **quando** o painel é consultado, **então** mostra Armado (sim/não), o gesto reconhecido (nome e pontuação, ou traço), a velocidade da abertura, a força do último estalo (0 a 100%) e o resultado do último estalo como um de `disparado`, `fraco demais`, `não sustentado`, `mão aberta` ou `sem direção`.

### US-006 — Ver as etapas do estalo na tela e o que corrigir (P2)

Como jogador, quero uma ajuda na tela que me mostre as etapas do estalo, qual delas estou fazendo e o que corrigir quando o estalo não dispara, para aprender o gesto.

**Teste independente:** no modo estalo, a tela mostra uma lista ordenada "Etapas do estalo" com quatro etapas (fechar a mão com o polegar preso; apontar a mão para o alvo; esticar o polegar de uma vez e deixá-lo esticado; a bolinha rola, a força vem da rapidez); a etapa atual fica marcada conforme o estado da rodada e, depois de um estalo que não disparou, uma região `aria-live` traz uma dica do que corrigir.

**Critérios de aceitação:**

1. **Dado** o modo estalo, **quando** a tela é exibida, **então** há uma lista ordenada com as quatro etapas do estalo e a etapa atual é marcada por `aria-current="step"` conforme o estado: etapa 1 pronto e sem armar, etapa 2 armado, etapa 3 confirmando o polegar esticado, etapa 4 bolinha rolando ou acerto.
2. **Dado** um estalo que não disparou (`fraco demais`, `não sustentado`, `mão aberta` ou `sem direção`), **quando** a tela é consultada, **então** uma região `aria-live="polite"` traz uma dica correspondente do que corrigir.

### US-005 — Privacidade local (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador no modo estalo, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante o jogo no modo estalo; só há carregamento do app e dos ativos do detector (o `.wasm` e o modelo `gesture_recognizer.task`), servidos pelo próprio app; nenhuma requisição carrega imagem, vídeo ou landmarks.

**Critérios de aceitação:**

1. **Dado** uma partida completa no modo estalo, **quando** as requisições são inspecionadas, **então** nenhuma carrega imagem, vídeo ou landmarks e nenhuma vai a domínio de terceiros.
2. **Dado** o código, **quando** buscado, **então** não há persistência, log ou envio de quadros, vídeo ou landmarks, e o aviso de privacidade informa que o processamento é local.

## Requisitos funcionais

- **FR-001:** O modo estalo DEVE ser uma mecânica distinta do modo pinça: a direção do tiro DEVE vir da orientação da mão no plano da imagem (vetor do pulso, landmark 0, à base do dedo médio, landmark 9, com x pela proporção da imagem e espelhado, normalizado), medida na base da subida (o mínimo recente da razão), e a força DEVE vir da velocidade de abertura do polegar; o estalo NÃO DEVE usar o arrasto relativo da mão para direção nem para força. A tela DEVE mostrar uma seta de direção a partir da bolinha de tiro enquanto armado.
- **FR-002:** A velocidade de abertura do estalo DEVE ser convertida em força por uma escala LOGARÍTMICA: `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)`, com `v` = velocidade de abertura de pico em razão/s (da base da subida até a última amostra de confirmação), `powerLowSpeed` = 3 e `powerHighSpeed` = 20; a velocidade do tiro DEVE ser `minShotSpeed + power × (maxShotSpeed − minShotSpeed)`, com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. Os parâmetros `slowMs`, `minOpenSpeed`, `riseStartRatio` e a histerese da pinça (`closeRatio`/`openRatio`) NÃO DEVEM existir na configuração do estalo; `powerLowSpeed`, `powerHighSpeed`, `minShotSpeed`, `maxShotSpeed` e `historyMs` DEVEM ser mantidos e `armRatio`, `extendRatio`, `confirmSamples`, `minRise`, `baseWindowMs`, `openHandGesture` (`Open_Palm`) e `gestureMinScore` (0,8) DEVEM ser acrescentados.
- **FR-003:** No modo estalo, a rodada DEVE disparar o tiro quando o estalo for confirmado — a mão armada (razão <= `armRatio` 1,05), a razão chegando a >= `extendRatio` (1,2), a subida da base >= `minRise` (0,4) E a razão ficando >= `extendRatio` por `confirmSamples` (3) amostras seguidas — E houver direção medida; DEVE cancelar sem contar tiro quando a subida da base for menor que `minRise` (`fraco demais`), quando a razão voltar abaixo de `extendRatio` antes de confirmar (`não sustentado`), quando alguma amostra de confirmação trouxer o gesto `openHandGesture` (`Open_Palm`) com pontuação >= `gestureMinScore` (`mão aberta`) ou quando não houver direção medida (`sem direção`); a direção vem da orientação da mão na base e a força, da velocidade de abertura.
- **FR-004:** No modo estalo, perder a mão por mais de 300 ms durante a mira DEVE cancelar e qualquer perda da mão DEVE zerar o estado armado, de modo que voltar a esticar o polegar não dispare; a velocidade de abertura continua medida e mostrada no painel.
- **FR-005:** O laço de quadros do app DEVE processar o detector somente quando a câmera entrega um quadro novo, usando `requestVideoFrameCallback` quando disponível e recuando para a comparação de `video.currentTime` quando não (por exemplo no jsdom), sem reprocessar um `currentTime` repetido; isso vale para os modos pinça e estalo, e o comportamento do modo pinça NÃO muda além de não reprocessar quadros repetidos.
- **FR-006:** O painel de depuração DEVE mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s) nos dois modos, e, no modo estalo, mostrar Armado (sim/não), a razão da pinça, o gesto reconhecido ("Gesto reconhecido": nome e pontuação do gesto pronto, ou traço), a velocidade de abertura do último estalo (razão/s), a FORÇA do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `fraco demais`, `não sustentado`, `mão aberta` ou `sem direção`.
- **FR-007:** A tela do modo estalo DEVE orientar "feche a mão com o polegar preso contra o indicador, aponte-a para o alvo e estique o polegar de uma vez, deixando-o esticado. A força vem da rapidez com que o polegar estica.", manter o rótulo "Estalo (alpha)", oferecer o seletor de modo "Modo de tiro" (dois botões de rádio "Pinça" e "Estalo (alpha)" num `fieldset` com legenda) e mostrar a seta de direção a partir da bolinha de tiro enquanto armado; o modo inicial DEVE vir de `?mode=estalo` (qualquer outro valor ou ausência = pinça) e trocar de modo DEVE reiniciar a rodada (tiros zerados).
- **FR-008:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks; os ativos do detector (o `.wasm` e os modelos `hand_landmarker.task` e `gesture_recognizer.task`) DEVEM ser servidos pelo próprio app, sem CDN; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-009:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas (Acenar) NÃO DEVEM ter seu comportamento alterado: os testes existentes de `packages/marbles` do modo pinça e do jogo de cartas DEVEM continuar passando; a pinça regula a força pelo arrasto da mão e NÃO DEVE passar a usar a velocidade de abertura.
- **FR-010:** A documentação (o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o catálogo `specs/README.md`) DEVE descrever o modo estalo como mecânica distinta da pinça (o polegar se esticando de uma vez a partir da mão fechada; direção pela orientação da mão, força logarítmica pela velocidade de abertura, gatilho por razão esticada sustentada), o processamento só de quadros novos da câmera, o reconhecedor de gestos no jogo das bolinhas (modelo `gesture_recognizer.task`, veto de palma aberta e diagnóstico) e o guia de etapas, sem contradizer o modo pinça nem o jogo de cartas, e marcar a spec de criação do estalo como substituída.
- **FR-011:** O jogo das bolinhas DEVE usar o `GestureRecognizer` do MediaPipe (modo de vídeo, uma mão) em vez do `HandLandmarker`, entregando o gesto pronto de maior pontuação da primeira mão (`HandGesture { name, score }`) ao detector e ao painel; o modelo `gesture_recognizer.task` (SHA-256 fixado) DEVE ser baixado por `yarn prepare:assets` e servido pelo próprio app, sem ser versionado. O gesto pronto NÃO DEVE ser o gatilho do estalo (os gestos prontos não reconheceram a pose do estalo na conferência offline); DEVE entrar apenas como veto de palma aberta (veredito `open_hand`) e como diagnóstico no painel. O jogo de cartas (Acenar) DEVE continuar usando o `HandLandmarker`.
- **FR-012:** A tela do modo estalo DEVE mostrar um guia de etapas: uma lista ordenada "Etapas do estalo" com quatro etapas (fechar a mão com o polegar preso contra o indicador; apontar a mão para o alvo com a seta mostrando a direção; esticar o polegar para cima de uma vez e deixá-lo esticado; a bolinha rola e a força vem da rapidez), com a etapa atual marcada por `aria-current="step"` conforme o estado da rodada, e uma dica em região `aria-live="polite"` para o último estalo que não disparou (`fraco demais`, `não sustentado`, `mão aberta`, `sem direção`). O modo pinça NÃO tem guia.

## Requisitos não funcionais

- **NFR-001:** A orientação da mão, a classificação do estalo (armar, candidato, confirmação), a escala logarítmica de força e a parte de estalo da rodada DEVEM ser puras e executáveis em Node sem DOM e sem MediaPipe, reaproveitando `pinchRatio` sem compor o detector de pinça.
- **NFR-002:** Nenhum texto DEVE afirmar desempenho (taxa de quadros, latência, quadros por estalo, taxa de reconhecimento), correspondência da direção ao estalo real ou viabilidade do estalo sem medição; todos os limiares e a faixa 3 a 20 da escala de força DEVEM ser declarados como palpites apoiados em duas sessões de uma pessoa numa webcam de cerca de 15 quadros/s, e nenhum estalo ao vivo foi testado após esta recalibração (Gate 3 pendente).
- **NFR-003:** A orientação do modo estalo e o resultado do último estalo DEVEM ser anunciados por região `aria-live`, e o seletor de modo DEVE continuar acessível (`fieldset` com legenda e rótulos textuais).
- **NFR-004:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` DEVEM passar ao final da entrega; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` DEVEM continuar verdes quando o código for implementado.
- **NFR-005:** O guia de etapas do modo estalo DEVE ser acessível: a lista de etapas DEVE ser uma lista ordenada com rótulo, a etapa atual DEVE ser marcada por `aria-current="step"` e a dica do último estalo DEVE estar em região `aria-live="polite"`. O veto de palma aberta e os gestos prontos NÃO DEVEM ser apresentados como reconhecimento comprovado: o texto DEVE declarar que os gestos prontos não reconheceram a pose do estalo na conferência offline, que o veto não foi medido contra a mão se abrindo de verdade e que nada foi testado ao vivo (Gate 3 pendente).

## Edge cases

- Esticar o polegar só um pouco (subida da razão < `minRise` 0,4): o estalo é classificado como `fraco demais` e o tiro é cancelado.
- Esticar o polegar e voltar a fechar antes de confirmar (razão cai abaixo de `extendRatio` nas primeiras `confirmSamples` amostras): o estalo é classificado como `não sustentado` e o tiro é cancelado; a mão rearma se a razão estiver <= `armRatio`. É assim que uma oscilação do rastreamento da mão fechada (que sobe e volta num quadro) deixa de contar como tiro.
- Estalar sem a direção da mão legível (vetor pulso–base do médio degenerado): o resultado é "sem direção" e nada dispara.
- Subida de 1 a 2 quadros: a velocidade de abertura pode ser limitada pela taxa de quadros, não pela força do polegar; por isso o gatilho exige a razão esticada por `confirmSamples` amostras em vez de uma subida rápida (H-05).
- Mão fechada que se abre depois do punho: a razão sobe e fica alta como num estalo, então pode confirmar um estalo falso; a razão sozinha não distingue abrir a mão de esticar o polegar (limitação conhecida, não resolvida). O veto de palma aberta (`Open_Palm` com pontuação >= 0,8 na confirmação) é a tentativa de pegar esse caso, mas não foi medido contra a mão se abrindo de verdade e pode não ajudar.
- Gesto pronto `Open_Palm` com pontuação >= 0,8 durante a confirmação: o estalo é cancelado como `mão aberta`. Como dois estalos reais tiveram `Open_Palm` com pontuação 0,50 a 0,65, o veto pode, com outra mão/webcam, rotular o polegar esticado como palma aberta com pontuação alta e cancelar um estalo real (H-06).
- Gestos prontos não reconhecem a pose do estalo (na conferência offline `Closed_Fist` e `Thumb_Up` nunca apareceram): por isso o gesto não é o gatilho; o estalo segue detectado pela razão, e o gesto só veta a palma aberta e aparece no painel.
- Mão perdida por mais de 300 ms enquanto armado: o tiro é cancelado; qualquer perda zera o armado, e voltar a esticar o polegar não dispara.
- Câmera sem `requestVideoFrameCallback` (jsdom nos testes): o laço recua para a comparação de `currentTime` e não reprocessa quadros repetidos.
- Webcam de cerca de 15 quadros/s (taxa real medida): um estalo curto tem poucas amostras, o que o gatilho por `confirmSamples` (3 amostras, cerca de 200 ms) absorve (H-01, H-05).
- Troca de modo no meio de uma mira: a rodada reinicia e o estado armado é descartado.

## Hipóteses e dependências

- **H-01:** Todos os limiares (`armRatio` = 1,05; `extendRatio` = 1,2; `confirmSamples` = 3; `minRise` = 0,4; `baseWindowMs` = 250 ms) são palpites calibrados em DUAS gravações de UMA pessoa numa webcam de cerca de 15 quadros/s, não medidos ao vivo; derivam da pose real observada (estalos com base 0,6 a 1,0, pico 1,4 a 2,0, razão >= 1,2 por pelo menos 3 amostras) e de rejeitar as oscilações da mão fechada (que sobem e voltam num quadro).
- **H-02:** A faixa 3 a 20 razão/s da escala logarítmica de força vem só da amplitude observada (estalos reais de 5 a 10 razão/s, limitada pela taxa de 15 quadros/s); o maintainer NÃO informou quais estalos foram fracos e quais fortes, então a variação observada pode ser, em parte, a força do polegar, mas isso NÃO está confirmado. A escala e seus extremos são palpites.
- **H-03:** A taxa real da câmera foi medida em cerca de 15 quadros novos/s (14,6 a 15,3), bem abaixo dos cerca de 86/s que o laço antes processava por reprocessar quadros repetidos; a hipótese de reprocessamento fica confirmada e o laço passa a processar só quadros novos (`requestVideoFrameCallback` com recuo para `currentTime`).
- **H-04:** A direção pela orientação da mão no plano da imagem pode não corresponder ao estalo real (no 1º teste, os dois vetores apontavam para cima e para a esquerda e nenhum dos 8 tiros acertou; a mão pode estar de lado, a câmera baixa). Isso NÃO foi medido: o estalo real vai para a frente (profundidade), eixo que a câmera não vê. A direção pela orientação da mão é mantida nesta entrega porque a seta de prévia deixa o jogador ajustar a mão; as alternativas (inclinação do pulso, posição da mão, orientação do indicador com a mão de lado) ficam como trabalho futuro e pergunta aberta.
- **H-05:** Numa subida de 1 a 2 quadros, a velocidade de abertura é limitada pela taxa de quadros, não pela força do polegar; por isso o gatilho passou a exigir a razão esticada por `confirmSamples` amostras (cerca de 200 ms a 15 quadros/s) em vez de uma subida rápida, e a razão sozinha não distingue abrir a mão de esticar o polegar (limitação conhecida).
- **H-06:** Os gestos prontos do MediaPipe NÃO reconheceram a pose do estalo na conferência offline (`Closed_Fist` e `Thumb_Up` em zero; `Open_Palm` 0,50 a 0,65, visto também em dois estalos reais), uma conferência MUITO limitada (recortes de baixa resolução, taxa de detecção baixa, não a do app ao vivo). Por isso o gesto entra como veto de palma aberta com pontuação >= 0,8 e como diagnóstico, NÃO como gatilho. O veto NÃO foi medido contra a mão se abrindo de verdade (não houve quadros claros de palma aberta), então pode não ajudar, e pode cancelar um estalo real se o reconhecedor rotular o polegar esticado como palma aberta com pontuação alta. Nada foi testado ao vivo. O próximo teste decide entre gestos prontos, treino de gesto próprio (Model Maker) ou outra abordagem.
- **Dependências:** o modo pinça da spec `2026-10-27-game-marbles-bete-build-pinch-shot` (detector de pinça, física, campo, alvo, câmera e rastreador), reaproveitado sem alteração de comportamento; a spec de criação do estalo `2026-10-27-game-marbles-bete-build-flick-beta`, substituída por esta; o modelo `gesture_recognizer.task` do MediaPipe (baixado por `prepare:assets`, SHA-256 fixado, licença do `.task` não lida na fonte); Chrome desktop como alvo.

## Critérios mensuráveis de sucesso

- **SC-001:** A direção pela orientação da mão no estalo, o gatilho por razão esticada sustentada (`armRatio` 1,05, `extendRatio` 1,2, `minRise` 0,4, `confirmSamples` 3, `baseWindowMs` 250 ms), os cancelamentos (fraco demais, não sustentado, mão aberta, sem direção), o veto de palma aberta (`Open_Palm` com pontuação >= `gestureMinScore`), a escala logarítmica de força de 3 a 20 razão/s (extremos e meio), a perda da mão e a contagem de quadros novos têm testes automáticos que passam em Node sem câmera, incluindo o replay das duas séries gravadas.
- **SC-002:** Em teste manual do maintainer no Chrome desktop, fica registrado se o tiro por estalo com direção pela orientação da mão e força pela velocidade de abertura disparou, em quantas tentativas, com que força lida no painel, se acertou o alvo e se houve disparo falso (Gate 3), junto com a taxa real da câmera mostrada no painel.
- **SC-003:** A taxa real de quadros novos da câmera por segundo é lida no painel e registrada, confirmando ou refutando a hipótese de reprocessamento (H-03), ou a lacuna é declarada.
- **SC-004:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas continuam passando sem regressão, comprovado pelos seus testes, e a pinça continua regulando a força pelo arrasto.
- **SC-005:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` passam; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` passam quando o código for implementado.
- **SC-006:** O guia de etapas (quatro etapas, etapa atual por `aria-current`, dica por `aria-live` para cada resultado que não disparou), o reconhecedor de gestos no jogo das bolinhas (gesto pronto exposto no painel) e o preparo do modelo `gesture_recognizer.task` por `prepare:assets` têm testes automáticos que passam sem câmera (`FlickGuide.test.tsx`, `mediapipeTracker.test.ts`, `prepare-assets.test.mjs`, `MarblesScreen.test.tsx`).

## Distinção entre os modos (pinça x estalo)

O estalo NÃO é uma pinça com um gatilho mais rígido: são duas mecânicas diferentes. Na pinça, a força é regulada pela mão (arrasto, como um estilingue); no estalo, a força é regulada pelo movimento do polegar (a velocidade de abertura), e a mecânica é mais complexa. Esta tabela é normativa: o estalo NÃO pode usar o arrasto para direção nem para força, e a pinça NÃO muda.

| Aspecto  | Pinça (padrão, NÃO muda)                                                      | Estalo (alpha)                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Armar    | fechar a pinça (vista aberta antes), em qualquer ponto                        | fechar a mão com o polegar preso contra o indicador: razão <= `armRatio` (1,05); SEM exigir a pinça vista aberta antes                                                                                         |
| Direção  | do arrasto relativo da mão (estilingue): vetor da pinça virtual até a bolinha | da orientação da mão no plano da imagem (pulso à base do dedo médio, espelhada), medida na BASE da subida (mínimo recente); seta de direção a partir da bolinha enquanto armado                                |
| Força    | distância arrastada (`computeShot`)                                           | VELOCIDADE DE ABERTURA do polegar (pico da inclinação da razão da base à confirmação), convertida em velocidade do tiro numa escala LOGARÍTMICA de 3 a 20 razão/s                                              |
| Gatilho  | qualquer abertura da pinça                                                    | razão esticada sustentada: >= `extendRatio` (1,2), subida da base >= `minRise` (0,4) E razão >= 1,2 por `confirmSamples` (3) amostras; `fraco demais`, `não sustentado`, `mão aberta` e `sem direção` cancelam |
| Detector | `HandLandmarker` (landmarks)                                                  | `GestureRecognizer` (landmarks + gesto pronto); o gesto é veto de palma aberta e diagnóstico, NÃO gatilho                                                                                                      |
| Prévia   | linha do elástico + seta de previsão do tiro                                  | só a seta de direção (a força só se conhece ao soltar), mais o guia de etapas na tela                                                                                                                          |
| Painel   | razão, pinça, mão, quadros, latência                                          | os da pinça + Armado, Gesto reconhecido, Velocidade da abertura, FORÇA do último estalo (0 a 100%), Resultado do último estalo (`disparado`, `fraco demais`, `não sustentado`, `mão aberta`, `sem direção`)    |
