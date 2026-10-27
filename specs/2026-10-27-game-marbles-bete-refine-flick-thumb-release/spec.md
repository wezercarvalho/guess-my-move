---
id: 2026-10-27-game-marbles-bete-refine-flick-thumb-release
title: Refino do modo de tiro por estalo (alpha) do bete, com força pela abertura do polegar
slug: game-marbles-bete-refine-flick-thumb-release
strategy: sdd
domain: game
capability: marbles-bete
objective: refine-flick-thumb-release
summary: Torna o modo estalo (alpha) do bete jogável mantendo-o como uma mecânica própria, distinta da pinça — a direção vem da orientação da mão no plano da imagem (pulso à base do dedo médio, espelhada), medida no início da abertura, e a força vem da VELOCIDADE DE ABERTURA do polegar (pico da inclinação da razão), convertida em velocidade do tiro numa escala LOGARÍTMICA; endurece o gatilho (subida de até 80 ms, era 300, e velocidade >= 2 razão/s); remove o teto linear maxOpenSpeed (8) e passa a escala a log com powerLowSpeed 10 e powerHighSpeed 200; processa só quadros novos da câmera via requestVideoFrameCallback com recuo para currentTime e mostra a taxa real da câmera, Armado, a velocidade e a duração da abertura, a força e o resultado do último estalo no painel. Fonte vigente completa do modo estalo; substitui a spec de criação do modo estalo (issue #72).
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
    - gatilho rápido
    - orientação da mão
    - quadros novos
    - requestVideoFrameCallback
    - rVFC
    - taxa da câmera
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
updated_at: 2026-10-27
---

# Refino do modo de tiro por estalo (alpha) do bete, com força pela abertura do polegar

## Resumo

O modo estalo (alpha) do bete, entregue pela spec de criação, não ficou jogável no primeiro teste com a mão real: a força saía sempre no máximo, aberturas lentas disparavam e a direção não acompanhava a intenção. Este refino **não** transforma o estalo numa cópia da pinça: pinça e estalo são duas mecânicas diferentes e esta spec estrutura essa distinção. Na pinça, a força é regulada pela mão (arrasto, estilingue). No estalo, a força é regulada pelo movimento do polegar: a **velocidade de abertura** do polegar (pico da inclinação da razão entre amostras consecutivas) é convertida em velocidade do tiro numa escala **logarítmica**, que resolve a saturação observada (toda abertura estourava o teto linear de 8). A direção continua vindo da **orientação da mão** no plano da imagem (vetor do pulso à base do dedo médio, espelhado), medida no início da abertura, com uma seta de direção a partir da bolinha enquanto armado — e não do arrasto. O gatilho endurece: a subida de abertura passa de até 300 ms para até 80 ms, mantendo a velocidade mínima de 2 razão/s; abaixo disso (lento, fraco ou sem direção medida) cancela sem contar tiro. Como esta spec é a fonte vigente completa do modo estalo, ela declara também o que vem da spec de criação e continua valendo (seletor "Modo de tiro", rótulo "Estalo (alpha)", `?mode=estalo`, troca de modo reinicia a rodada, armar ao fechar a pinça vista aberta antes, perda da mão por mais de 300 ms cancela, privacidade). O laço de quadros passa a processar o detector só quando a câmera entrega um quadro novo (`requestVideoFrameCallback`, com recuo para `currentTime`) nos dois modos, e o painel mostra os quadros novos da câmera por segundo. Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta`.

## Problema

O primeiro teste do modo estalo com a mão real, lido do painel de depuração no Chrome desktop do maintainer (números de uma sessão de cerca de 40 s; os vídeos de tela não fazem parte do repositório), mostrou três falhas:

- **A força era sempre a máxima.** Nas 15 aberturas registradas, a velocidade de abertura foi de 9,1 a 199 razão/s, toda acima do teto linear configurado (`maxOpenSpeed` = 8 razão/s), então todos os tiros saíram com a força máxima (1100 unid/s). A escala linear de 2 a 8 razão/s está errada: satura de imediato. Em 8 das 15 a subida durou 11 a 13 ms (um quadro).
- **Aberturas lentas também disparavam.** Duas aberturas de 103 e 192 ms contaram como tiro porque o limite lento era 300 ms. Em 13 das 15 a subida ficou em 37 ms ou menos.
- **A direção não acompanhava a intenção.** No teste, os dois vetores legíveis da seta apontavam para cima e para a esquerda (mão de frente para a câmera, dedos para cima), e nenhum dos 8 tiros acertou o alvo.

A correção de rumo (maintainer, 2026-10-27) foi estruturar a distinção entre as mecânicas e aplicá-la a cada modo, **não** apagar a diferença. A pinça é um estilingue regulado pela mão; o estalo é regulado pelo polegar e é mais complexo. Uma versão anterior deste refino tentou dar ao estalo a mira relativa da pinça (direção e força pelo arrasto); isso apagava a diferença entre os modos e foi corrigido. Mantém-se, portanto, a direção pela orientação da mão e a força pela velocidade de abertura — trocando a escala de força de linear para logarítmica e endurecendo o gatilho —, e a seta de prévia deixa o jogador ajustar a mão.

Há ainda uma suspeita não confirmada: foram processados cerca de 86 quadros/s, mais do que uma webcam comum entrega (30 quadros/s); o laço em `apps/web` usa `requestAnimationFrame` e só pula quando `video.currentTime` não muda, o que pode não marcar quadros novos da câmera em fluxos ao vivo. É hipótese a medir, não fato.

## Objetivos

- Estruturar a distinção entre pinça e estalo como requisito e aplicá-la a cada modo: a pinça regula a força pela mão (arrasto) e não muda; o estalo regula a força pelo polegar (velocidade de abertura) e a direção pela orientação da mão.
- Trocar a escala de força do estalo de linear para logarítmica, resolvendo a saturação (`power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)`), e converter `power` em velocidade do tiro entre `minShotSpeed` e `maxShotSpeed`.
- Endurecer o gatilho de abertura lenta (de 300 para 80 ms) mantendo a velocidade mínima de 2 razão/s, para separar o estalo de uma abertura comum da mão.
- Remover o parâmetro `maxOpenSpeed` (teto linear) da configuração, substituindo-o por `powerLowSpeed` e `powerHighSpeed`.
- Processar o detector só em quadros novos da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`) e mostrar a taxa real da câmera no painel, nos dois modos.
- Mostrar no painel do estalo Armado, a velocidade da abertura, a duração da subida, a FORÇA do último estalo (0 a 100%) e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem direção`).
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

- **Jogador:** no modo estalo, aponta a mão para o alvo, fecha a pinça (polegar atrás do indicador) para armar, confere a seta de direção a partir da bolinha e abre os dedos rápido para disparar; a força vem da velocidade com que o polegar solta. Erra e tenta de novo.
- **Maintainer:** testa no Chrome desktop, lê a taxa real da câmera, a força e o resultado do último estalo no painel, calibra os limiares e decide a viabilidade da issue #72 (Gate 3).
- **Detector de estalo:** lógica pura que compõe o detector de pinça, mede a subida da abertura (duração e velocidade de pico), mede a direção pela orientação da mão no início da abertura e classifica a abertura como gatilho rápido ou não.
- **Motor da rodada:** lógica pura que, no modo estalo, arma ao fechar depois de vista aberta, publica a direção de prévia, dispara ao abrir num gatilho rápido com direção medida convertendo a velocidade de abertura em força logarítmica, e cancela no lento, no fraco, no sem direção ou na perda da mão.
- **Laço de quadros da câmera:** processa o detector só quando a câmera entrega um quadro novo e conta os quadros novos por segundo.

## Histórias de usuário

### US-001 — Atirar o estalo com a força do polegar e acertar o alvo (P1)

Como jogador, quero apontar a mão para o alvo, fechar a pinça e abrir os dedos rápido, para que a bolinha parta na direção que apontei e com uma força proporcional à rapidez com que meu polegar soltou, e eu consiga acertar o alvo.

**Teste independente:** no Chrome desktop com a câmera ativa e o modo estalo selecionado, apontar a mão para o alvo, fechar a pinça (a tela mostra a seta de direção a partir da bolinha de tiro), e abrir os dedos rápido; a bolinha parte na direção apontada com a força da velocidade de abertura e, ao tocar o alvo, a rodada termina mostrando o número de tiros. Uma abertura mais rápida do polegar leva a bolinha mais longe que uma abertura mais lenta.

**Critérios de aceitação:**

1. **Dado** que a pinça foi vista aberta e depois fecha, **quando** a mão está armada, **então** a tela mostra uma seta de direção a partir da bolinha de tiro, com a direção corrente da orientação da mão (pulso à base do dedo médio, espelhada).
2. **Dado** um gatilho de abertura rápido com direção medida, **quando** a pinça abre, **então** o tiro dispara na direção medida no início da abertura, e a velocidade do tiro vem da velocidade de abertura do polegar por uma escala logarítmica, não do arrasto da mão.
3. **Dado** que a velocidade de abertura é `v` razão/s, **quando** o tiro dispara, **então** `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)` com `powerLowSpeed` = 10 e `powerHighSpeed` = 200, e a velocidade do tiro é `minShotSpeed + power × (maxShotSpeed − minShotSpeed)` com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s: `v` <= 10 dá força 0 (300 unid/s) e `v` >= 200 dá força 1 (1100 unid/s).

### US-002 — Disparar só com um estalo rápido, com direção e força (P1)

Como jogador, quero que só um estalo rápido, com a mão apontada e o polegar soltando com força, conte como tiro, para que relaxar a mão devagar ou um gesto sem direção não gaste um tiro.

**Teste independente:** no modo estalo, abrir a pinça devagar (subida acima de 80 ms), com o polegar fraco (velocidade de abertura abaixo de 2 razão/s) ou sem a direção da mão legível; em nenhum dos casos a bolinha parte nem o contador de tiros sobe, e o painel mostra "lento demais", "fraco demais" ou "sem direção"; abrir a pinça rápido com a mão apontada dispara.

**Critérios de aceitação:**

1. **Dado** que a mão está armada, **quando** a pinça abre com subida <= `slowMs` (80 ms) e velocidade de abertura >= `minOpenSpeed` (2 razão/s) e há direção medida, **então** dispara com a direção medida e a força logarítmica da velocidade de abertura.
2. **Dado** que a mão está armada, **quando** a subida é maior que `slowMs` ou a velocidade de abertura é menor que `minOpenSpeed`, **então** o estalo é classificado como lento ou fraco e o tiro é CANCELADO, sem contar tiro.
3. **Dado** que a mão está armada, **quando** a abertura é um gatilho rápido mas a direção da mão não pôde ser medida (vetor degenerado), **então** o resultado é "sem direção" e nada é disparado, sem contar tiro.
4. **Dado** que a mão some por mais de 300 ms durante a mira, **quando** a mão volta, **então** o estado armado foi zerado e abrir a pinça não dispara.

### US-003 — Processar só quadros novos e ver a taxa real da câmera (P1)

Como maintainer, quero que o detector rode só quando a câmera entrega um quadro novo e ver quantos quadros novos por segundo a câmera entrega, para saber a taxa real da webcam e não a do laço de desenho.

**Teste independente:** no modo estalo ou pinça, o painel mostra "Quadros novos da câmera/s" com a contagem em uma janela de 1 s; em um ambiente com `requestVideoFrameCallback`, o detector é chamado uma vez por quadro novo da câmera; em um ambiente sem (por exemplo jsdom), o laço recua para a comparação de `currentTime` e não reprocessa o mesmo quadro.

**Critérios de aceitação:**

1. **Dado** um ambiente com `requestVideoFrameCallback`, **quando** o laço roda, **então** o detector é chamado uma vez por quadro novo entregue pela câmera, e não uma vez por quadro de desenho.
2. **Dado** um ambiente sem `requestVideoFrameCallback`, **quando** o laço roda, **então** ele recua para a comparação de `video.currentTime` e não reprocessa um `currentTime` repetido.
3. **Dado** qualquer um dos dois modos, **quando** o painel é consultado, **então** mostra os quadros novos da câmera por segundo (contagem em janela de 1 s).

### US-004 — Entender o modo estalo pela tela e ver a força e o resultado do último estalo (P2)

Como jogador, quero que a tela me diga como atirar no estalo e me mostre a força e o que aconteceu no último estalo, para eu corrigir o gesto.

**Teste independente:** no modo estalo, a tela orienta "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta", mantém o rótulo "Estalo (alpha)" e o painel mostra Armado, a velocidade da abertura, a duração da subida, a força do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem direção`.

**Critérios de aceitação:**

1. **Dado** o modo estalo, **quando** a tela é exibida, **então** a orientação pede fechar a pinça com a mão apontada para o alvo e abrir os dedos rápido, informa que a força vem da velocidade com que o polegar solta, e o rótulo "Estalo (alpha)" é mantido.
2. **Dado** um estalo, **quando** o painel é consultado, **então** mostra Armado (sim/não), a velocidade da abertura, a duração da subida, a força do último estalo (0 a 100%) e o resultado do último estalo como um de `disparado`, `lento demais`, `fraco demais` ou `sem direção`.

### US-005 — Privacidade local (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador no modo estalo, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante o jogo no modo estalo; só há carregamento do app e dos ativos do detector, servidos pelo próprio app; nenhuma requisição carrega imagem, vídeo ou landmarks.

**Critérios de aceitação:**

1. **Dado** uma partida completa no modo estalo, **quando** as requisições são inspecionadas, **então** nenhuma carrega imagem, vídeo ou landmarks e nenhuma vai a domínio de terceiros.
2. **Dado** o código, **quando** buscado, **então** não há persistência, log ou envio de quadros, vídeo ou landmarks, e o aviso de privacidade informa que o processamento é local.

## Requisitos funcionais

- **FR-001:** O modo estalo DEVE ser uma mecânica distinta do modo pinça: a direção do tiro DEVE vir da orientação da mão no plano da imagem (vetor do pulso, landmark 0, à base do dedo médio, landmark 9, com x pela proporção da imagem e espelhado, normalizado), medida no início da abertura, e a força DEVE vir da velocidade de abertura do polegar; o estalo NÃO DEVE usar o arrasto relativo da mão para direção nem para força. A tela DEVE mostrar uma seta de direção a partir da bolinha de tiro enquanto armado.
- **FR-002:** A velocidade de abertura do estalo DEVE ser convertida em força por uma escala LOGARÍTMICA: `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)`, com `v` = velocidade de abertura de pico em razão/s, `powerLowSpeed` = 10 e `powerHighSpeed` = 200; a velocidade do tiro DEVE ser `minShotSpeed + power × (maxShotSpeed − minShotSpeed)`, com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. O parâmetro linear `maxOpenSpeed` (8) DEVE ser removido da configuração; `minShotSpeed` e `maxShotSpeed` DEVEM ser mantidos e `powerLowSpeed` e `powerHighSpeed` DEVEM ser acrescentados.
- **FR-003:** No modo estalo, a rodada DEVE disparar o tiro quando a abertura for um gatilho rápido — duração da subida <= `slowMs` (reduzido de 300 para 80 ms) E velocidade de abertura >= `minOpenSpeed` (mantido em 2 razão/s) — E houver direção medida; DEVE cancelar sem contar tiro quando a abertura for lenta (subida > `slowMs`), fraca (velocidade < `minOpenSpeed`) ou sem direção medida; a direção vem da orientação da mão e a força, da velocidade de abertura.
- **FR-004:** No modo estalo, perder a mão por mais de 300 ms durante a mira DEVE cancelar e qualquer perda da mão DEVE zerar o estado armado, de modo que voltar a abrir não dispare; a velocidade e a duração da abertura continuam medidas e mostradas no painel.
- **FR-005:** O laço de quadros do app DEVE processar o detector somente quando a câmera entrega um quadro novo, usando `requestVideoFrameCallback` quando disponível e recuando para a comparação de `video.currentTime` quando não (por exemplo no jsdom), sem reprocessar um `currentTime` repetido; isso vale para os modos pinça e estalo, e o comportamento do modo pinça NÃO muda além de não reprocessar quadros repetidos.
- **FR-006:** O painel de depuração DEVE mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s) nos dois modos, e, no modo estalo, mostrar Armado (sim/não), a razão da pinça, a velocidade de abertura do último estalo (razão/s), a duração da subida (ms), a FORÇA do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem direção`.
- **FR-007:** A tela do modo estalo DEVE orientar "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta", manter o rótulo "Estalo (alpha)", oferecer o seletor de modo "Modo de tiro" (dois botões de rádio "Pinça" e "Estalo (alpha)" num `fieldset` com legenda) e mostrar a seta de direção a partir da bolinha de tiro enquanto armado; o modo inicial DEVE vir de `?mode=estalo` (qualquer outro valor ou ausência = pinça) e trocar de modo DEVE reiniciar a rodada (tiros zerados).
- **FR-008:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-009:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas (Acenar) NÃO DEVEM ter seu comportamento alterado: os testes existentes de `packages/marbles` do modo pinça e do jogo de cartas DEVEM continuar passando; a pinça regula a força pelo arrasto da mão e NÃO DEVE passar a usar a velocidade de abertura.
- **FR-010:** A documentação (o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o catálogo `specs/README.md`) DEVE descrever o modo estalo como mecânica distinta da pinça (direção pela orientação da mão, força logarítmica pela velocidade de abertura, gatilho rápido) e o processamento só de quadros novos da câmera, sem contradizer o modo pinça nem o jogo de cartas, e marcar a spec de criação do estalo como substituída.

## Requisitos não funcionais

- **NFR-001:** A orientação da mão, a classificação do gatilho, a escala logarítmica de força e a parte de estalo da rodada DEVEM ser puras e executáveis em Node sem DOM e sem MediaPipe, compondo o detector de pinça sem alterá-lo.
- **NFR-002:** Nenhum texto DEVE afirmar desempenho (taxa de quadros, latência, quadros por estalo, taxa de reconhecimento), correspondência da direção ao estalo real ou viabilidade do estalo sem medição; todos os limiares e a faixa 10 a 200 da escala de força DEVEM ser declarados como palpites apoiados em uma única sessão de teste, e a taxa real da câmera DEVE ser tratada como dado a medir.
- **NFR-003:** A orientação do modo estalo e o resultado do último estalo DEVEM ser anunciados por região `aria-live`, e o seletor de modo DEVE continuar acessível (`fieldset` com legenda e rótulos textuais).
- **NFR-004:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` DEVEM passar ao final da entrega; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` DEVEM continuar verdes quando o código for implementado.

## Edge cases

- Abrir a pinça devagar sem querer (subida > 80 ms): o estalo é classificado como lento e o tiro é cancelado; o novo limite de 80 ms é mais rígido que o anterior de 300 ms (pode cancelar estalos legítimos numa webcam lenta; risco H-01).
- Abrir rápido sem a direção da mão legível (vetor pulso–base do médio degenerado): o resultado é "sem direção" e nada dispara.
- Abertura de um único quadro: a velocidade de abertura pode ser limitada pela taxa de quadros, não pela força do polegar; a escala logarítmica suaviza, mas a amostragem real decide a medição (H-02, H-05).
- Mão perdida por mais de 300 ms enquanto armado: o tiro é cancelado; qualquer perda zera o armado, e voltar a abrir não dispara.
- Câmera sem `requestVideoFrameCallback` (jsdom nos testes): o laço recua para a comparação de `currentTime` e não reprocessa quadros repetidos.
- Webcam de 30 quadros/s: a taxa real mostrada no painel pode ser bem menor que os 86/s processados antes; um estalo curto pode ter poucas amostras, o que degrada a medição da subida e da velocidade de pico (H-02, H-05).
- Troca de modo no meio de uma mira: a rodada reinicia e o estado armado é descartado.

## Hipóteses e dependências

- **H-01:** Todos os limiares (`slowMs` = 80 ms, `minOpenSpeed` = 2 razão/s, histerese herdada 0,35/0,55) são palpites apoiados em uma única sessão de cerca de 40 s, não medidos; o limite de 80 ms deriva de 13 das 15 aberturas terem ficado em 37 ms ou menos, com duas de 103 e 192 ms a serem rejeitadas.
- **H-02:** A faixa 10 a 200 razão/s da escala logarítmica de força vem só da amplitude observada (15 velocidades de 9,1 a 199 razão/s); o maintainer NÃO informou quais estalos foram fracos e quais fortes, então a variação de cerca de 22 vezes pode ser, em parte, a força do polegar, mas isso NÃO está confirmado. A escala e seus extremos são palpites de uma sessão.
- **H-03:** A taxa de 86 quadros/s processados pode ser maior que a taxa real da câmera (hipótese de reprocessamento de quadros repetidos pelo laço `requestAnimationFrame`); o painel de quadros novos da câmera por segundo é o que mede isso, e a taxa real pode ser menor que os 86/s processados — a medir no teste do maintainer.
- **H-04:** A direção pela orientação da mão no plano da imagem pode não corresponder ao estalo real (no teste, os dois vetores apontavam para cima e para a esquerda e nenhum dos 8 tiros acertou; a mão pode estar de lado, a câmera baixa, a bolinha na ponta do indicador dobrado). Isso NÃO foi medido: o estalo real vai para a frente (profundidade), eixo que a câmera não vê. A direção pela orientação da mão é mantida nesta entrega porque a seta de prévia deixa o jogador ajustar a mão; as alternativas (inclinação do pulso, posição da mão, orientação do indicador com a mão de lado) ficam como trabalho futuro e pergunta aberta. Um segundo vídeo (bolinha real, mão de lado perto do peito, sem esqueleto) mostra o estalo real; não se sabe se o detector segue a mão nessa posição.
- **H-05:** Numa abertura de um quadro, a velocidade de abertura é limitada pela taxa de quadros, não pela força do polegar; registrada como risco e como motivo do item de quadros novos da câmera. Uma webcam de 30 quadros/s pode dar poucas amostras por estalo, o que degrada a medição da subida e da velocidade de pico.
- **Dependências:** o modo pinça da spec `2026-10-27-game-marbles-bete-build-pinch-shot` (detector de pinça, física, campo, alvo, câmera e rastreador), reaproveitado sem alteração de comportamento; a spec de criação do estalo `2026-10-27-game-marbles-bete-build-flick-beta`, substituída por esta; Chrome desktop como alvo.

## Critérios mensuráveis de sucesso

- **SC-001:** A direção pela orientação da mão no estalo, o gatilho rápido (80 ms, 2 razão/s), os cancelamentos (lento, fraco, sem direção), a escala logarítmica de força (extremos e meio), a perda da mão e a contagem de quadros novos têm testes automáticos que passam em Node sem câmera.
- **SC-002:** Em teste manual do maintainer no Chrome desktop, fica registrado se o tiro por estalo com direção pela orientação da mão e força pela velocidade de abertura disparou, em quantas tentativas, com que força lida no painel, se acertou o alvo e se houve disparo falso (Gate 3), junto com a taxa real da câmera mostrada no painel.
- **SC-003:** A taxa real de quadros novos da câmera por segundo é lida no painel e registrada, confirmando ou refutando a hipótese de reprocessamento (H-03), ou a lacuna é declarada.
- **SC-004:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas continuam passando sem regressão, comprovado pelos seus testes, e a pinça continua regulando a força pelo arrasto.
- **SC-005:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` passam; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` passam quando o código for implementado.

## Distinção entre os modos (pinça x estalo)

O estalo NÃO é uma pinça com um gatilho mais rígido: são duas mecânicas diferentes. Na pinça, a força é regulada pela mão (arrasto, como um estilingue); no estalo, a força é regulada pelo movimento do polegar (a velocidade de abertura), e a mecânica é mais complexa. Esta tabela é normativa: o estalo NÃO pode usar o arrasto para direção nem para força, e a pinça NÃO muda.

| Aspecto | Pinça (padrão, NÃO muda)                                                      | Estalo (alpha)                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Armar   | fechar a pinça (vista aberta antes), em qualquer ponto                        | igual: fechar a pinça (polegar atrás do indicador)                                                                                                                                          |
| Direção | do arrasto relativo da mão (estilingue): vetor da pinça virtual até a bolinha | da orientação da mão no plano da imagem (pulso à base do dedo médio, espelhada), medida no INÍCIO da abertura; seta de direção a partir da bolinha enquanto armado                          |
| Força   | distância arrastada (`computeShot`)                                           | VELOCIDADE DE ABERTURA do polegar (pico da inclinação da razão entre amostras consecutivas), convertida em velocidade do tiro numa escala LOGARÍTMICA                                       |
| Gatilho | qualquer abertura da pinça                                                    | abertura rápida: subida de até 80 ms (era 300) E velocidade de abertura >= 2 razão/s; lenta ou fraca cancela sem contar tiro; sem direção medida cancela                                    |
| Prévia  | linha do elástico + seta de previsão do tiro                                  | só a seta de direção (a força só se conhece ao soltar)                                                                                                                                      |
| Painel  | razão, pinça, mão, quadros, latência                                          | os da pinça + Armado, Velocidade da abertura, Duração da subida, FORÇA do último estalo (0 a 100%), Resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem direção`) |
