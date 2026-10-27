---
id: 2026-10-27-game-marbles-bete-refine-flick-relative-aim
title: Refino do modo de tiro por estalo (alpha) do bete, com mira relativa
slug: game-marbles-bete-refine-flick-relative-aim
strategy: sdd
domain: game
capability: marbles-bete
objective: refine-flick-relative-aim
summary: Torna o modo estalo (alpha) do bete jogável mirando pelo arrasto relativo da mão, como na pinça, e usando a abertura rápida só como gatilho (subida de no máximo 80 ms e velocidade de abertura a partir de 2 razão/s); endurece o limite de abertura lenta de 300 para 80 ms; remove a direção pela orientação da mão, a seta de direção, o flickShot e os parâmetros de força por velocidade de abertura; e processa só quadros novos da câmera via requestVideoFrameCallback com recuo para currentTime, mostrando a taxa real da câmera no painel. Substitui em parte o comportamento de direção e força da spec de criação do modo estalo (issue #72).
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - estalo
    - estalo alpha
    - mira relativa
    - gatilho rápido
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

# Refino do modo de tiro por estalo (alpha) do bete, com mira relativa

## Resumo

O modo estalo (alpha) do bete, entregue pela spec de criação, não ficou jogável no primeiro teste com a mão real: a força era sempre a máxima, aberturas lentas disparavam e a direção não acompanhava a intenção, e nenhum dos tiros acertou o alvo. Este refino troca o que define direção e força: a mira passa a vir do arrasto relativo da mão, exatamente como no modo pinça (que acertou o alvo), e a abertura rápida vira só o gatilho. Ao fechar a pinça a mira começa em qualquer ponto; a "pinça virtual" é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale`, e direção e força vêm do arrasto. Ao abrir, se a abertura for rápida (subida <= `slowMs`, que cai de 300 para 80 ms, e velocidade de abertura >= `minOpenSpeed`) e houver tiro previsto, dispara com a velocidade do arrasto; se for lenta, fraca ou sem arrasto suficiente, cancela sem contar tiro. Saem do código e da spec vigente a orientação da mão, a seta de direção do estalo, a conversão de velocidade de abertura em força e os parâmetros `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed`. O laço de quadros passa a processar o detector só quando a câmera entrega um quadro novo (`requestVideoFrameCallback`, com recuo para a comparação de `currentTime`), e o painel passa a mostrar os quadros novos da câmera por segundo, para medir a taxa real da webcam. Esta spec substitui em parte o comportamento de direção e força da `2026-10-27-game-marbles-bete-build-flick-beta`.

## Problema

O primeiro teste do modo estalo com a mão real, lido do painel de depuração no Chrome desktop do maintainer (números de uma sessão de cerca de 40 s; os vídeos não fazem parte do repositório), mostrou três falhas:

- **A força era sempre a máxima.** Nas 15 aberturas registradas, a velocidade de abertura foi de 9,1 a 199 razão/s, toda acima do teto configurado (8 razão/s), então todos os tiros saíram com a força máxima (1100 unid/s). Em 8 das 15 a subida durou 11 a 13 ms (um quadro); a velocidade media o salto da razão por quadro, não a força do dedo.
- **Aberturas lentas também disparavam.** Duas aberturas de 103 e 192 ms contaram como tiro porque o limite lento era 300 ms. Em 13 das 15 a subida ficou em 37 ms ou menos.
- **A direção não acompanhava a intenção.** A direção vinha da orientação da mão no plano da imagem; com a palma para a câmera e os dedos para cima, os dois vetores legíveis apontavam para cima e para a esquerda, e o alvo ficava à direita. Nenhum dos 8 tiros acertou o alvo.

Há ainda uma suspeita não confirmada: foram processados cerca de 86 quadros/s, mais do que uma webcam comum entrega (30 quadros/s); o laço em `apps/web` usa `requestAnimationFrame` e só pula quando `video.currentTime` não muda, o que pode não marcar quadros novos da câmera em fluxos ao vivo. É hipótese a medir, não fato.

O modo pinça, com a mesma câmera, acertou o alvo porque mira pelo arrasto relativo. A proposta é dar ao estalo a mesma mira e reduzir o estalo ao papel de gatilho, mantendo o rótulo alpha enquanto a viabilidade do estalo em si não for testada com a mão.

## Objetivos

- Fazer o modo estalo mirar pelo arrasto relativo da mão, reaproveitando a lógica da pinça virtual do modo pinça, sem duplicá-la.
- Usar a abertura rápida apenas como gatilho; direção e força do tiro vêm do arrasto, não da velocidade de abertura.
- Endurecer o limite de abertura lenta (de 300 para 80 ms) para separar o estalo de uma abertura comum da mão.
- Remover do código e da spec vigente a orientação da mão, a seta de direção do estalo, a conversão de velocidade de abertura em força e seus parâmetros.
- Processar o detector só em quadros novos da câmera (`requestVideoFrameCallback`, com recuo para `currentTime`) e mostrar a taxa real da câmera no painel, nos dois modos.
- Preservar o modo pinça (salvo o processar só quadros novos), a física, o campo, o alvo, o jogo de cartas e a privacidade, sem regressão.

## Fora de escopo

- Estalo com a mão de lado e a câmera baixa (segundo cenário observado): não se sabe se o detector segue a mão nessa posição; fica como pergunta aberta, não entrega.
- Segunda mão, novos modelos de detecção e novos modos de tiro além de pinça e estalo.
- Ajustar `aimScale` ou mudar a mira do modo pinça; o modo pinça só muda por processar quadros repetidos a menos.
- Afirmar taxa de quadros, latência, taxa de reconhecimento do estalo ou viabilidade do estalo sem medição no desktop do maintainer.
- Fechar a questão da viabilidade do estalo: o modo segue alpha; a decisão depende do teste manual do maintainer (Gate 3).

## Atores

- **Jogador:** no modo estalo, fecha a pinça, arrasta a mão para longe do alvo para mirar (como na pinça) e abre os dedos rápido para disparar; erra e tenta de novo.
- **Maintainer:** testa no Chrome desktop, lê a taxa real da câmera e o resultado do último estalo no painel, calibra os limiares e decide a viabilidade da issue #72 (Gate 3).
- **Detector de estalo:** lógica pura que compõe o detector de pinça, mede a subida da abertura (duração e velocidade) e classifica a abertura como gatilho rápido ou não, sem produzir direção nem força.
- **Motor da rodada:** lógica pura que, no modo estalo, usa a mira relativa da pinça virtual para prever o tiro enquanto a pinça está fechada e dispara esse tiro previsto quando a abertura é um gatilho rápido; cancela quando é lenta, fraca ou sem arrasto, ou quando perde a mão.
- **Laço de quadros da câmera:** processa o detector só quando a câmera entrega um quadro novo e conta os quadros novos por segundo.

## Histórias de usuário

### US-001 — Mirar o estalo pelo arrasto, como na pinça (P1)

Como jogador, quero mirar o tiro do estalo arrastando a mão para longe do alvo, do mesmo jeito que na pinça, para que a bolinha vá na direção e com a força que eu escolhi e eu consiga acertar o alvo.

**Teste independente:** no Chrome desktop com a câmera ativa e o modo estalo selecionado, fechar a pinça (a tela mostra a previsão do tiro — linha e seta — a partir da bolinha de tiro, como na pinça), arrastar a mão para longe do alvo e abrir os dedos rápido; a bolinha parte na direção e com a força do arrasto e, ao tocar o alvo, a rodada termina mostrando o número de tiros.

**Critérios de aceitação:**

1. **Dado** que a pinça foi vista aberta e depois fecha, **quando** a mão está armada, **então** a mira relativa começa em qualquer ponto e a posição alvo da mira é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale`, exatamente como no modo pinça.
2. **Dado** que a mão está armada e arrastada o suficiente, **quando** a pinça está fechada, **então** a tela mostra a previsão do tiro (linha e seta) a partir da bolinha de tiro, com a direção e a força do arrasto corrente.
3. **Dado** um gatilho de abertura rápido com arrasto suficiente, **quando** a pinça abre, **então** o tiro dispara com a direção e a velocidade do arrasto previsto (`computeShot`), e não com a velocidade de abertura.

### US-002 — Disparar só com um estalo rápido e um arrasto real (P1)

Como jogador, quero que só um estalo rápido com a mão de fato arrastada conte como tiro, para que relaxar a mão devagar ou um gesto sem mira não gaste um tiro.

**Teste independente:** no modo estalo, abrir a pinça devagar (subida acima de 80 ms) ou sem ter arrastado a mão; em nenhum dos casos a bolinha parte nem o contador de tiros sobe, e o painel mostra "lento demais", "fraco demais" ou "sem tiro"; abrir a pinça rápido depois de um arrasto real dispara.

**Critérios de aceitação:**

1. **Dado** que a mão está armada, **quando** a pinça abre com subida <= `slowMs` (80 ms) e velocidade de abertura >= `minOpenSpeed` (2 razão/s) e há tiro previsto, **então** dispara com a velocidade do arrasto.
2. **Dado** que a mão está armada, **quando** a subida é maior que `slowMs` ou a velocidade de abertura é menor que `minOpenSpeed`, **então** o estalo é classificado como lento ou fraco e o tiro é CANCELADO, sem contar tiro.
3. **Dado** que a mão está armada, **quando** a abertura é um gatilho rápido mas não houve arrasto suficiente, **então** não há tiro previsto, o resultado é "sem tiro" e nada é disparado, sem contar tiro.
4. **Dado** que a mão some por mais de 300 ms durante a mira, **quando** a mão volta, **então** o estado armado foi zerado e abrir a pinça não dispara.

### US-003 — Processar só quadros novos e ver a taxa real da câmera (P1)

Como maintainer, quero que o detector rode só quando a câmera entrega um quadro novo e ver quantos quadros novos por segundo a câmera entrega, para saber a taxa real da webcam e não a do laço de desenho.

**Teste independente:** no modo estalo ou pinça, o painel mostra "Quadros novos da câmera/s" com a contagem em uma janela de 1 s; em um ambiente com `requestVideoFrameCallback`, o detector é chamado uma vez por quadro novo da câmera; em um ambiente sem (por exemplo jsdom), o laço recua para a comparação de `currentTime` e não reprocessa o mesmo quadro.

**Critérios de aceitação:**

1. **Dado** um ambiente com `requestVideoFrameCallback`, **quando** o laço roda, **então** o detector é chamado uma vez por quadro novo entregue pela câmera, e não uma vez por quadro de desenho.
2. **Dado** um ambiente sem `requestVideoFrameCallback`, **quando** o laço roda, **então** ele recua para a comparação de `video.currentTime` e não reprocessa um `currentTime` repetido.
3. **Dado** qualquer um dos dois modos, **quando** o painel é consultado, **então** mostra os quadros novos da câmera por segundo (contagem em janela de 1 s).

### US-004 — Entender o modo estalo pela tela e ver o resultado do último estalo (P2)

Como jogador, quero que a tela me diga como atirar no estalo e me mostre o que aconteceu no último estalo, para eu corrigir o gesto.

**Teste independente:** no modo estalo, a tela orienta "feche a pinça, arraste a mão para longe do alvo e abra os dedos rápido para atirar", mantém o rótulo "Estalo (alpha)" e o painel mostra o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem tiro`; o resultado `sem direção` deixa de existir.

**Critérios de aceitação:**

1. **Dado** o modo estalo, **quando** a tela é exibida, **então** a orientação pede fechar a pinça, arrastar para longe do alvo e abrir os dedos rápido, e o rótulo "Estalo (alpha)" é mantido.
2. **Dado** um estalo, **quando** o painel é consultado, **então** o resultado do último estalo é um de `disparado`, `lento demais`, `fraco demais` ou `sem tiro`, e nunca `sem direção`.

### US-005 — Privacidade local (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador no modo estalo, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante o jogo no modo estalo; só há carregamento do app e dos ativos do detector, servidos pelo próprio app; nenhuma requisição carrega imagem, vídeo ou landmarks.

**Critérios de aceitação:**

1. **Dado** uma partida completa no modo estalo, **quando** as requisições são inspecionadas, **então** nenhuma carrega imagem, vídeo ou landmarks e nenhuma vai a domínio de terceiros.
2. **Dado** o código, **quando** buscado, **então** não há persistência, log ou envio de quadros, vídeo ou landmarks, e o aviso de privacidade informa que o processamento é local.

## Requisitos funcionais

- **FR-001:** No modo estalo, a rodada DEVE mirar pelo arrasto relativo da mão reaproveitando a lógica da pinça virtual do modo pinça (sem duplicá-la): ao fechar a pinça (vista aberta antes), a mira começa em qualquer ponto e a posição alvo da mira é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale` (1,5), e a direção e a força previstas vêm do arrasto por `computeShot`.
- **FR-002:** O detector de estalo DEVE deixar de produzir direção e força: ao abrir, DEVE apenas classificar a abertura como gatilho rápido ou não, medindo a duração da subida e a velocidade de abertura; `handDirection`, o campo `direction` na leitura e na soltura, a seta de direção do estalo, `flickShot` e a conversão da velocidade de abertura em força DEVEM ser removidos do pacote e da tela. Os parâmetros `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed` DEVEM ser removidos da configuração.
- **FR-003:** No modo estalo, a rodada DEVE disparar o tiro previsto pelo arrasto (`computeShot`) quando a abertura for um gatilho rápido — duração da subida <= `slowMs` (reduzido de 300 para 80 ms) E velocidade de abertura >= `minOpenSpeed` (2 razão/s) — E houver tiro previsto (arrasto suficiente); DEVE cancelar sem contar tiro quando a abertura for lenta (subida > `slowMs`), fraca (velocidade < `minOpenSpeed`) ou sem arrasto suficiente; a velocidade e a direção do tiro vêm do arrasto, não da velocidade de abertura.
- **FR-004:** No modo estalo, perder a mão por mais de 300 ms durante a mira DEVE cancelar e qualquer perda da mão DEVE zerar o estado armado, de modo que voltar a abrir não dispare; a velocidade e a duração da abertura continuam medidas e mostradas no painel, mas NÃO definem a força.
- **FR-005:** O laço de quadros do app DEVE processar o detector somente quando a câmera entrega um quadro novo, usando `requestVideoFrameCallback` quando disponível e recuando para a comparação de `video.currentTime` quando não (por exemplo no jsdom), sem reprocessar um `currentTime` repetido; isso vale para os modos pinça e estalo, e o comportamento do modo pinça NÃO muda além de não reprocessar quadros repetidos.
- **FR-006:** O painel de depuração DEVE mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s) nos dois modos, e, no modo estalo, mostrar o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem tiro`; o resultado `sem direção` DEVE deixar de existir. A velocidade de abertura e a duração da subida continuam exibidas como dado.
- **FR-007:** A tela do modo estalo DEVE orientar "feche a pinça, arraste a mão para longe do alvo e abra os dedos rápido para atirar", manter o rótulo "Estalo (alpha)" e mostrar a previsão do tiro (linha e seta) a partir da bolinha de tiro enquanto a pinça está fechada, como no modo pinça; a seta de direção da orientação da mão DEVE ser removida.
- **FR-008:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-009:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas (Acenar) NÃO DEVEM ter seu comportamento alterado: os testes existentes de `packages/marbles` do modo pinça e do jogo de cartas DEVEM continuar passando.
- **FR-010:** A documentação (o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o catálogo `specs/README.md`) DEVE descrever o modo estalo com mira relativa e gatilho rápido e o processamento só de quadros novos da câmera, sem contradizer o modo pinça nem o jogo de cartas, e marcar a spec de criação do estalo como substituída em parte.

## Requisitos não funcionais

- **NFR-001:** A mira relativa do estalo, a classificação do gatilho e a parte de estalo da rodada DEVEM ser puras e executáveis em Node sem DOM e sem MediaPipe, reaproveitando a pinça virtual sem duplicá-la.
- **NFR-002:** Nenhum texto DEVE afirmar desempenho (taxa de quadros, latência, quadros por estalo, taxa de reconhecimento) ou viabilidade do estalo sem medição; todos os limiares DEVEM ser declarados como palpites apoiados em uma única sessão de teste, e a taxa real da câmera DEVE ser tratada como dado a medir.
- **NFR-003:** A orientação do modo estalo e o resultado do último estalo DEVEM ser anunciados por região `aria-live`, e o seletor de modo DEVE continuar acessível (`fieldset` com legenda e rótulos textuais).
- **NFR-004:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` DEVEM passar ao final da entrega; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` DEVEM continuar verdes quando o código for implementado.

## Edge cases

- Abrir a pinça devagar sem querer (subida > 80 ms): o estalo é classificado como lento e o tiro é cancelado; o novo limite de 80 ms é mais rígido que o anterior de 300 ms (pode cancelar estalos legítimos numa webcam lenta; risco H-01).
- Abrir rápido sem ter arrastado a mão: não há tiro previsto, o resultado é "sem tiro" e nada dispara.
- Mão apontada para a câmera: não há mais direção pela orientação da mão, então deixa de ser um caso de erro de direção; a mira vem só do arrasto.
- Mão perdida por mais de 300 ms enquanto armado: o tiro é cancelado; qualquer perda zera o armado, e voltar a abrir não dispara.
- Câmera sem `requestVideoFrameCallback` (jsdom nos testes): o laço recua para a comparação de `currentTime` e não reprocessa quadros repetidos.
- Webcam de 30 quadros/s: a taxa real mostrada no painel pode ser bem menor que os 86/s processados antes; um estalo curto pode ter poucas amostras, o que degrada a medição da subida (H-02, H-03).
- Troca de modo no meio de uma mira: a rodada reinicia e o estado armado é descartado.

## Hipóteses e dependências

- **H-01:** Todos os limiares novos e mantidos (`slowMs` = 80 ms, `minOpenSpeed` = 2 razão/s, histerese herdada 0,35/0,55, `aimScale` = 1,5, perda de 300 ms) são palpites apoiados em uma única sessão de cerca de 40 s, não medidos; o limite de 80 ms deriva de 13 das 15 aberturas terem ficado em 37 ms ou menos, com duas de 103 e 192 ms a serem rejeitadas.
- **H-02:** A taxa de 86 quadros/s processados pode ser maior que a taxa real da câmera (hipótese de reprocessamento de quadros repetidos pelo laço `requestAnimationFrame`); o painel de quadros novos da câmera por segundo é o que mede isso, e a taxa real pode ser menor que os 86/s processados — a medir no teste do maintainer.
- **H-03:** Uma webcam de 30 quadros/s pode dar poucas amostras por estalo, o que degrada a medição da subida; a amostragem real decide se o gatilho rápido é mensurável.
- **H-04:** O estalo real observado em um segundo vídeo (mão de lado, perto do peito, bolinha na ponta do indicador dobrado, câmera baixa e mão grande e cortada) pode não ser seguido pelo detector; essa posição está fora do escopo e é incerteza, não entrega.
- **Dependências:** o modo pinça da spec `2026-10-27-game-marbles-bete-build-pinch-shot` (pinça virtual, `computeShot`, física, campo, alvo, câmera e rastreador), reaproveitado; a spec de criação do estalo `2026-10-27-game-marbles-bete-build-flick-beta`, cujo comportamento de direção e força é substituído em parte; Chrome desktop como alvo.

## Critérios mensuráveis de sucesso

- **SC-001:** A mira relativa no estalo, o gatilho rápido, os cancelamentos (lento, fraco, sem arrasto), a remoção da direção e a contagem de quadros novos têm testes automáticos que passam em Node sem câmera.
- **SC-002:** Em teste manual do maintainer no Chrome desktop, fica registrado se o tiro por estalo com mira relativa disparou, em quantas tentativas, se acertou o alvo e se houve disparo falso (Gate 3), junto com a taxa real da câmera mostrada no painel.
- **SC-003:** A taxa real de quadros novos da câmera por segundo é lida no painel e registrada, confirmando ou refutando a hipótese de reprocessamento (H-02), ou a lacuna é declarada.
- **SC-004:** O modo pinça (salvo o não reprocessar quadros repetidos) e o jogo de cartas continuam passando sem regressão, comprovado pelos seus testes.
- **SC-005:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` passam; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` passam quando o código for implementado.
