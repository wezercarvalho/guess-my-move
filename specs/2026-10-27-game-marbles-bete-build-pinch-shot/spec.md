---
id: 2026-10-27-game-marbles-bete-build-pinch-shot
title: Bete de bolinhas de gude solo com tiro por pinça pela câmera
slug: game-marbles-bete-build-pinch-shot
strategy: sdd
domain: game
capability: marbles-bete
objective: build-pinch-shot
summary: Novo jogo solo de bolinhas de gude na variante bete, 100% local no Chrome desktop, em que o jogador mira e dispara a bolinha de tiro com um gesto de pinça da mão lido pela câmera (estilingue), sobre uma física arcade determinística, reaproveitando a câmera e o rastreador de mão da spec do árbitro por visão computacional sem alterar o jogo de cartas.
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - bolinhas de gude
    - bete
    - tiro por pinça
    - estilingue
    - física arcade
    - packages/marbles
    - marbles.html
code_paths:
    - packages/marbles/
    - apps/web/
related_specs:
    - 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser
supersedes: []
branch: feat/67-bete-pinca
constitution_version: 1.0.0
created_at: 2026-10-27
updated_at: 2026-10-27
---

# Bete de bolinhas de gude solo com tiro por pinça pela câmera

## Resumo

O jogador abre uma página nova do app, liga a câmera e joga o bete de bolinhas de gude sozinho: uma bolinha de tiro e um alvo parado em um campo 2D visto de cima. Para atirar, o jogador faz o gesto de pinça (junta polegar e indicador) perto da bolinha de tiro, arrasta a mão para trás como um estilingue e abre a pinça para disparar. Uma física arcade determinística move as bolinhas; a rodada termina no primeiro contato entre a bolinha de tiro e o alvo, mostrando o número de tiros. Todo o processamento é local no navegador, sem rede para imagem e sem gravação. A câmera e o rastreador de mão são reaproveitados da spec `2026-10-26-vision-hand-gesture-referee-replace-llm-guesser` sem alteração; o jogo de cartas (Acenar) não muda e fica isolado.

## Problema

O repositório tem hoje um único jogo (Acenar, por cartas) e uma infraestrutura de câmera e rastreamento de mão no navegador validada pela spec do árbitro por visão computacional. Falta um segundo modo de jogo que exercite o controle por gesto de forma contínua e espacial, e que sirva de prova de que a câmera e o rastreador podem alimentar mecânicas diferentes sem acoplamento ao jogo de cartas. O bete de bolinhas de gude é uma mecânica simples, testável sem câmera na parte de física e tiro, e adequada para um gesto de pinça que mapeia naturalmente para um estilingue.

## Objetivos

- Oferecer um jogo solo de bete em uma página nova do app, jogável no Chrome desktop com uma mão pela câmera.
- Manter a lógica de física, pinça, tiro e rodada pura em TypeScript, sem DOM e sem MediaPipe, testável em Node.
- Reaproveitar câmera, rastreador de mão e desenho do esqueleto já existentes, sem alterar o jogo de cartas nem extrair um pacote compartilhado.
- Mostrar, para depuração e calibração, o que o detector de pinça está lendo, como no painel do jogo de cartas.
- Preservar a privacidade: nenhum quadro sai do navegador, é gravado ou registrado.

## Fora de escopo

- O estalo real da bolinha com o dedo (issue #68) e qualquer gesto de tiro além da pinça.
- Outros modos de bete (triângulo, cova), multijogador e pontuação além do contador de tiros.
- Campo 3D, física não arcade, suavização de tremor da mão e detecção automática do início do tiro.
- Celular e navegadores além do Chrome desktop; duas mãos.
- Alterar o jogo de cartas (`index.html`, `App.tsx`, `src/round/`) ou a lógica do árbitro por visão.
- Afirmar taxa de quadros, latência ou taxa de reconhecimento da pinça sem medição no desktop do maintainer.

## Atores

- **Jogador:** liga a câmera, mira com a pinça, dispara e tenta acertar o alvo; erra e atira de novo.
- **Maintainer:** testa no Chrome desktop, calibra os limiares da pinça e o ganho de velocidade pelos números do painel, e aprova os gates.
- **Detector de pinça:** lógica pura que, a partir dos landmarks da mão, decide se a pinça está fechada e devolve o ponto e a razão.
- **Motor da rodada:** lógica pura que combina física, pinça e tiro em uma máquina de estados, independente de DOM.

## Histórias de usuário

### US-001 — Atirar com a pinça e acertar o alvo (P1)

Como jogador, quero mirar com a pinça e disparar a bolinha como num estilingue, para acertar o alvo e ver em quantos tiros consegui.

**Teste independente:** no Chrome desktop com a câmera ativa, fechar a pinça perto da bolinha de tiro, arrastar a mão para trás e abrir a pinça; a bolinha parte na direção da bolinha para a pinça e, ao tocar o alvo, a rodada termina mostrando o número de tiros.

**Critérios de aceitação:**

1. **Dado** que a bolinha de tiro está parada e a mão visível, **quando** o jogador fecha a pinça a até 70 unidades da bolinha, arrasta para trás e abre a pinça, **então** a bolinha é disparada com direção da pinça para a bolinha e velocidade proporcional ao arrasto.
2. **Dado** que a bolinha de tiro está em movimento, **quando** ela toca o alvo pela primeira vez, **então** a rodada termina no estado de acerto e o número de tiros é exibido.
3. **Dado** um arrasto menor que 30 unidades, **quando** a pinça abre, **então** o tiro é cancelado e nenhum disparo ocorre.
4. **Dado** que o arrasto excede 220 unidades, **quando** a pinça abre, **então** a velocidade é limitada ao máximo (1100 unidades por segundo).

### US-002 — Errar e atirar de novo (P1)

Como jogador, quero que, ao errar, tudo volte ao início para eu atirar outra vez, para continuar até acertar.

**Teste independente:** disparar sem acertar; quando todas as bolinhas param, a bolinha de tiro volta a (150, 300) e o alvo a (550, 300), e o contador de tiros mantém a contagem acumulada.

**Critérios de aceitação:**

1. **Dado** que a bolinha de tiro foi disparada e não houve contato, **quando** todas as bolinhas param, **então** a bolinha de tiro volta a (150, 300), o alvo volta a (550, 300) e o jogador pode atirar de novo.
2. **Dado** uma rodada em andamento, **quando** o jogador aciona **Nova rodada**, **então** o número de tiros zera e as posições iniciais são restauradas.
3. **Dado** que a mão some por mais de 300 ms durante a mira, **quando** o tempo é excedido, **então** o tiro em preparação é cancelado e a bolinha permanece parada na posição inicial.

### US-003 — Ver o que o detector de pinça lê (P2)

Como maintainer, quero ver a razão da pinça, se ela está fechada, a mão desenhada e os números de desempenho, para calibrar os limiares.

**Teste independente:** durante o jogo, o esqueleto da mão é desenhado sobre o vídeo e o painel mostra delegate, estado da rodada, razão da pinça, pinça fechada, mão visível, quadros processados e latências mediana e p95.

**Critérios de aceitação:**

1. **Dado** uma mão visível, **quando** o jogo está ativo, **então** os pontos e as conexões da mão são desenhados sobre o vídeo espelhado.
2. **Dado** que quadros foram processados, **quando** o painel é consultado, **então** mostra a razão atual da pinça, o estado fechado/aberto, a mão visível, os quadros processados e as latências mediana e p95.

### US-004 — Privacidade local (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante o jogo; só há carregamento do app e dos ativos do detector, servidos pelo próprio app; nenhuma requisição carrega imagem, vídeo ou landmarks.

**Critérios de aceitação:**

1. **Dado** uma partida completa, **quando** as requisições são inspecionadas, **então** nenhuma carrega imagem, vídeo ou landmarks e nenhuma vai a domínio de terceiros.
2. **Dado** o código, **quando** buscado, **então** não há persistência, log ou envio de quadros, vídeo ou landmarks, e o aviso de privacidade informa que o processamento é local.

## Requisitos funcionais

- **FR-001:** O pacote DEVE expor um mundo de física arcade determinístico com passo fixo de 1/120 s, bolinhas circulares de raio 14, atrito constante de 400 unidades por segundo ao quadrado, parada abaixo de 8 unidades por segundo, restituição 0,8 nas paredes do campo 800 x 600 e colisão elástica de restituição 1,0 entre bolinhas de massas iguais; a mesma entrada DEVE produzir a mesma saída.
- **FR-002:** O pacote DEVE detectar o primeiro contato entre a bolinha de tiro e o alvo (distância entre centros menor ou igual à soma dos raios) e sinalizá-lo como acerto, sem depender de DOM.
- **FR-003:** O pacote DEVE expor um detector de pinça puro que, a partir dos landmarks 4 (ponta do polegar), 8 (ponta do indicador), 0 (pulso) e 9 (base do dedo médio), calcula a razão `distância(4, 8) / distância(0, 9)` com o eixo x multiplicado pela proporção da imagem, aplica histerese (fecha com razão <= 0,35, abre com razão >= 0,55), devolve o ponto da pinça como ponto médio das pontas espelhado em x, e trata a ausência de mão como pinça aberta sem ponto.
- **FR-004:** O pacote DEVE calcular o tiro a partir do arrasto: direção do ponto da pinça para a bolinha de tiro, velocidade igual a 5 vezes a distância do arrasto limitada a 220 unidades (velocidade máxima 1100 unidades por segundo), e cancelamento quando o arrasto é menor que 30 unidades.
- **FR-005:** O pacote DEVE expor `createBeteRound()` com máquina de estados `idle | ready | aiming | rolling | hit | camera_denied | tracker_error` e eventos `cameraReady()`, `denyCamera()`, `trackerFailed(msg)`, `observePinch(reading, nowMs)`, `advance(dtMs)` e `newRound()`, de modo que: a pega só inicia a mira com a pinça fechada a até 70 unidades da bolinha de tiro parada; perder a mão por mais de 300 ms durante a mira cancela o tiro; o erro (tudo parado sem contato) volta a bolinha de tiro a (150, 300) e o alvo a (550, 300); o primeiro contato leva a `hit`; `newRound()` reinicia tiros e posições; `snapshot()` devolve estado, posições, tiros, dados da mira e resultado.
- **FR-006:** A tela DEVE desenhar em canvas 2D o campo, a bolinha de tiro, o alvo, a linha do elástico e a seta de previsão durante a mira, o contador de tiros, as mensagens de estado e um botão **Nova rodada**, e DEVE anunciar o estado e o resultado por região `aria-live`. Sempre que o detector enxergar a mão, a tela DEVE desenhar no campo um cursor na posição da pinça (cor distinta para pinça aberta e fechada); quando não enxergar, DEVE dizer isso e orientar o jogador a mostrar a mão inteira, com a palma voltada para a câmera, na altura do peito e com boa luz. A câmera DEVE ficar visível ao lado do campo em telas largas.
- **FR-007:** A página DEVE reaproveitar sem alterar `useCamera`, `CameraPanel`, `HandTracker`/`createMediaPipeHandTracker` e `drawHand`, usar uma mão, selecionar o delegate automaticamente ou por parâmetro de URL, e espelhar em x o vídeo de preview e o esqueleto.
- **FR-008:** A tela DEVE exibir um painel de depuração com delegate em uso, estado da rodada, razão da pinça, pinça fechada, mão visível, quadros processados e latências mediana e p95, como no jogo de cartas.
- **FR-009:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks do modo bete; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-010:** O pacote `packages/marbles` (`@guess-my-move/marbles`) DEVE conter apenas lógica pura, sem DOM, sem MediaPipe e sem depender de `@guess-my-move/core`, e o jogo de cartas NÃO DEVE ter sua lógica, seus componentes e seus testes alterados (`App.tsx`, `src/round/`, `src/card/`, `packages/core`); a página do bete DEVE ser uma segunda entrada do Vite (`marbles.html`). Emenda de 2026-10-27, a pedido do maintainer: o jogo de cartas passa a ser servido em `cards.html` (a mesma entrada `src/main.tsx`, só com outro nome de arquivo HTML) para que `index.html` seja o menu da FR-012.
- **FR-012:** A página inicial (`index.html`) DEVE ser um menu com um card por jogo, cada um com título, descrição curta e link: o jogo de cartas (Acenar), em `cards.html`, e as bolinhas de gude (bete), em `marbles.html`. Os links DEVEM ser relativos e as páginas dos jogos DEVEM oferecer um link de volta ao menu.
- **FR-011:** A documentação (`PROJECT_SPEC`, `README`, guia de arquitetura) DEVE descrever o novo modo bete, o pacote `packages/marbles` e a segunda entrada do app, sem contradizer o fluxo do jogo de cartas.

## Requisitos não funcionais

- **NFR-001:** A física, o detector de pinça, o tiro e a rodada DEVEM ser puros e executáveis em Node sem DOM e sem MediaPipe.
- **NFR-002:** Nenhum texto DEVE afirmar taxa de quadros nem latência sem medição; a medição no Chrome desktop do maintainer DEVE ser registrada em `validation.md`.
- **NFR-003:** O estado e o resultado DEVEM ser anunciados por região `aria-live` e os controles DEVEM ter rótulo textual.
- **NFR-004:** `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies` DEVEM passar ao final da entrega.

## Edge cases

- Nenhuma mão visível ao iniciar: nenhuma pega é possível; o estado permanece `ready`.
- Mão some entre fechar a pinça e disparar por mais de 300 ms: o tiro em preparação é cancelado e a bolinha permanece em (150, 300).
- Arrasto muito curto (menor que 30 unidades): o disparo é cancelado ao abrir a pinça.
- Arrasto muito longo (maior que 220 unidades): a velocidade satura no máximo.
- Pinça fechada longe da bolinha (mais de 70 unidades): não inicia a mira.
- Duas mãos no quadro: apenas a primeira devolvida pelo rastreador é considerada.
- Câmera negada ou falha do rastreador: a rodada entra em `camera_denied` ou `tracker_error` com mensagem, sem travar o jogo.
- Bolinhas em repouso instável perto do limiar de 8 unidades por segundo: a parada é determinística pelo passo fixo.

## Hipóteses e dependências

- **H-01:** Os limiares da pinça (0,35 e 0,55), o raio de pega (70), o ganho de velocidade (5x) e os limites (30 e 220 unidades) são placeholders de calibração, não medidos; serão ajustados com uso real.
- **H-02:** Mapear o quadro inteiro da câmera ao campo (com x espelhado) é suficiente para mirar; a validação é no teste do maintainer.
- **H-03:** O reconhecimento da pinça depende da taxa de quadros e da perda de mão em movimento rápido (visto na spec do Acenar); por isso o arrasto é lento por desenho.
- **Dependências:** reaproveitamento da câmera e do rastreador de mão da spec `2026-10-26-vision-hand-gesture-referee-replace-llm-guesser` (MediaPipe Hand Landmarker), sem alteração dessa lógica; Chrome desktop como alvo.

## Critérios mensuráveis de sucesso

- **SC-001:** A física, o contato, o detector de pinça, o tiro e a rodada têm testes automáticos que passam em Node sem câmera (determinismo, histerese, limites e cancelamento cobertos).
- **SC-002:** Em teste manual do maintainer no Chrome desktop, o jogador consegue fechar a pinça, arrastar e acertar o alvo (Gate 3), com o resultado registrado em `validation.md`.
- **SC-003:** As medições de reconhecimento da pinça e de latência no desktop do maintainer são registradas em `validation.md`, ou a lacuna é declarada explicitamente.
- **SC-004:** O jogo de cartas (Acenar) continua passando sem alteração de código, comprovado por seus testes e pela ausência de mudança em seus arquivos.
- **SC-005:** `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies` passam.
