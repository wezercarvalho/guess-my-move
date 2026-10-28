---
id: 2026-10-28-game-arranha-teia-build-first-person-web-swing
title: Arranha-Teia, passeio em primeira pessoa com balanço de teia por gesto na web
slug: game-arranha-teia-build-first-person-web-swing
strategy: sdd
domain: game
capability: arranha-teia
objective: build-first-person-web-swing
summary: Entrega o jogo Arranha-Teia, um passeio livre em primeira pessoa por um trecho real de Midtown Manhattan (dados do OpenStreetMap sob ODbL) no navegador, em que o gesto ILoveYou da câmera lança uma teia que, enquanto durar, faz o jogador balançar como um pêndulo e, ao desfazer o gesto, solta e voa. A lógica fica num pacote puro de TypeScript (vetores, índice espacial da cidade com raycast e colisão, mira assistida da teia, física do balanço com passo fixo, gatilho do gesto com histerese, direção pela mão com zona morta e a sessão do mundo), com testes primeiro e funções puras. O navegador acrescenta uma tela Three.js 0.186.0 empacotada sem CDN, HUD, efeito de velocidade por campo de visão e linhas radiais, um conversor de OSM para um JSON de cidade versionado e um card no menu inicial com entrada própria no Vite, mantendo a privacidade dos outros jogos (processamento local, sem gravar nem enviar imagem, sem requisição a terceiros) e o teclado como alternativa à mão. Gates 1 e 2 aprovados antecipadamente pelo maintainer em 2026-10-28; o código ainda será implementado test-first e o Gate 3 fica para depois, sem afirmar desempenho sem medição.
status: validated
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - Arranha-Teia
    - teia
    - balanço
    - pêndulo
    - primeira pessoa
    - Midtown
    - OpenStreetMap
    - ODbL
    - Three.js
    - gesto ILoveYou
    - mira assistida
    - histerese
    - zona morta
    - índice espacial
    - raycast
    - efeito de velocidade
    - packages/swing
    - city.ts
    - Overpass
code_paths:
    - packages/swing/
    - apps/web/
related_specs:
    - 2026-10-27-game-marbles-bete-refine-flick-thumb-release
    - 2026-10-28-frontend-design-system-adopt-dark-gold
supersedes: []
branch: feat/76-arranha-teia
constitution_version: 1.0.0
created_at: 2026-10-28
updated_at: 2026-10-28
---

# Arranha-Teia, passeio em primeira pessoa com balanço de teia por gesto na web

## Resumo

Arranha-Teia é um jogo novo do monorepo: um passeio livre em primeira pessoa por um trecho real de Midtown Manhattan, no navegador, em que a câmera lê a mão e o gesto ILoveYou lança uma teia. Enquanto o gesto durar, o jogador balança preso à teia como um pêndulo; ao desfazer o gesto, solta e voa pela cidade, ganhando velocidade com a gravidade. A cidade vem do OpenStreetMap (dados sob ODbL, com atribuição obrigatória na tela), convertida uma vez para um JSON de cidade versionado no app; nada é buscado de terceiros em tempo de jogo.

A entrega separa com nitidez a lógica pura da apresentação. Um pacote puro de TypeScript (`@guess-my-move/swing`) concentra tudo que é testável sem navegador e sem câmera: tipos e vetores, um índice espacial da cidade com raycast e teste de colisão, a mira assistida da teia (três raios a partir do olho), a física do balanço com passo fixo e acumulador, o gatilho do gesto com histerese contra falha do reconhecedor, a direção derivada da mão como um joystick com zona morta, o spawn em espiral e a sessão do mundo que junta estado, passo e reinício. O `apps/web` acrescenta a camada visível: uma cena Three.js 0.186.0 empacotada (sem CDN), o HUD com velocidade, altura, teias e distância, o efeito de velocidade por campo de visão e linhas radiais, um controlador que liga a câmera (ou o teclado) à sessão, a página própria no Vite e um card no menu inicial. Um conversor de OSM para o formato de cidade e um script que consulta a Overpass e grava o JSON completam o pipeline de dados.

O jogo reaproveita o reconhecedor de gestos do MediaPipe já usado nas bolinhas (o modelo inclui a categoria ILoveYou), mantém a privacidade dos outros jogos (processamento local, sem gravar nem enviar imagem, sem requisição a terceiros) e oferece o teclado como alternativa completa à mão. Os valores de física são de jogo, não realistas, e não se afirma desempenho (fps) sem medição numa GPU real. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-28; esta entrega documental fixa a intenção, o plano e as tarefas, e a implementação test-first com a validação e o Gate 3 seguem depois.

## Problema

O repositório hoje tem o jogo de cartas e o bete de bolinhas, ambos parados na mesa: a câmera lê um gesto e o resultado é um tiro ou uma jogada local, sem deslocamento no espaço. Não há nenhuma experiência de movimento contínuo em primeira pessoa, nem um uso do gesto como um controle sustentado (segurar para agir, soltar para parar) em vez de um disparo único. Também não existe no app nenhum mundo tridimensional navegável nem um pipeline que traga geometria real de cidade para dentro do jogo.

A issue #76 pede um jogo em que a pessoa atravessa um pedaço de cidade real balançando por teias lançadas com a mão. Isso exige quatro coisas que o app ainda não tem: (1) uma representação de cidade em coordenadas de metros, com prédios e ruas, derivada de uma fonte aberta e com a atribuição que a licença exige; (2) uma física de balanço (pêndulo preso a um ponto, corda inextensível quando esticada, gravidade, arrasto e colisão com prédios, telhados, chão e os limites do mapa); (3) um gatilho de gesto sustentado, robusto à falha momentânea do reconhecedor, que lance a teia e a solte ao desfazer o gesto; e (4) uma camada 3D com HUD e um efeito de velocidade, tudo sem quebrar a privacidade (processamento local, sem gravar nem enviar imagem) e sem requisição a terceiros em tempo de jogo.

O risco maior não é a renderização, e sim a lógica: a mira assistida precisa achar um ponto de ancoragem plausível acima e à frente do jogador; a física precisa manter o jogador sempre em movimento (sem travar contra um prédio ou no chão); e o gatilho precisa não piscar quando o reconhecedor perde o gesto por um quadro. Toda essa lógica é determinística e deve ser testável sem navegador. A referência de outros sites e de outros projetos serve só para padrões de fluxo; nenhuma marca ou personagem de terceiros aparece nos arquivos do repositório.

## Objetivos

- Representar um trecho real de Midtown Manhattan como um JSON de cidade versionado (prédios e ruas em coordenadas de metros, plano local rotacionado para as avenidas correrem ao longo de Z), derivado do OpenStreetMap com a atribuição ODbL exibida na tela.
- Concentrar a lógica num pacote puro de TypeScript testável sem navegador: vetores, índice espacial com raycast e colisão, mira assistida da teia, física do balanço com passo fixo, gatilho do gesto com histerese, direção pela mão e a sessão do mundo.
- Lançar a teia pelo gesto ILoveYou com mira assistida (três raios a partir do olho) e, enquanto o gesto durar, balançar como um pêndulo com corda inextensível que encurta; ao desfazer o gesto, soltar e voar.
- Manter o jogador sempre em movimento: colisão que amortece contra prédios, pouso no telhado, corrida automática no chão e parede invisível no limite do mapa, sem estados de travamento.
- Renderizar a cena em primeira pessoa com Three.js empacotado (sem CDN), HUD (velocidade, altura, teias lançadas, distância) e efeito de velocidade por campo de visão e linhas radiais, sem afirmar que é desfoque de movimento real.
- Oferecer o teclado como alternativa completa à mão (segurar para teia, setas para direção) e preservar a privacidade: processamento local, sem gravar nem enviar imagem, sem requisição a terceiros.
- Entregar test-first, com os gates oficiais verdes e sem afirmar desempenho (fps) sem medição numa GPU real.

## Fora de escopo

- Multiplayer, placar on-line, salvamento de progresso ou qualquer persistência de estado entre partidas.
- Qualquer marca, personagem, textura, fonte ou som de terceiros: a cena usa só geometria própria e texturas procedurais; nenhum ativo de terceiros é adicionado.
- Outras cidades ou a escolha de cidade pelo jogador: esta entrega fixa um trecho de Midtown; outras regiões ficam para depois.
- IA jogadora e qualquer exposição do critério de avaliação a uma IA futura (regra da constituição): este jogo não tem carta nem avaliação secreta, então nada a expor, mas também não se adiciona nenhum gancho para isso.
- Medir ou afirmar desempenho (fps, latência) numa GPU real, suavidade do balanço ou realismo físico: os valores são de jogo e o que não for medido fica declarado como pendente.
- Mudar o jogo de cartas, o bete de bolinhas, o detector de gestos compartilhado ou o design system: este jogo reaproveita o reconhecedor e herda a paleta pelos tokens, sem alterá-los.

## Atores

- **Jogador com câmera:** abre a tela, mostra a mão, faz o gesto ILoveYou para lançar a teia, balança e solta ao desfazer o gesto; usa a mão como joystick para guinar e inclinar; lê o HUD.
- **Jogador com teclado:** joga sem câmera: segura Espaço para lançar a teia e usa as setas para direção, com as mesmas taxas da mão.
- **Maintainer:** aprova a intenção e o escopo (Gates 1 e 2), confere a tela no Chrome desktop e aceita o risco de não haver teste ao vivo com a mão (Gate 3 com risco aceito).
- **Pessoa que usa teclado para navegar a interface:** alcança o card do jogo no menu, o botão "Voltar ao início" e os controles da tela com foco visível e ordem previsível.
- **Pipeline de dados da cidade:** o conversor de OSM e o script da Overpass produzem o JSON de cidade versionado; rodam fora do jogo, uma vez, e não fazem parte do tempo de jogo.

## Histórias de usuário

### US-001 — Lançar a teia e balançar com o gesto (P1)

Como jogador com câmera, quero fazer o gesto ILoveYou para lançar uma teia num prédio à frente e balançar preso a ela, para me deslocar pela cidade sem cair.

**Teste independente:** com a câmera (ou o teclado, segurando Espaço), fazer o gesto; se houver um ponto de ancoragem válido à frente e acima, a teia prende e o jogador passa a balançar como um pêndulo, encurtando a corda; sem ponto válido, "a teia errou" e nada prende.

**Critérios de aceitação:**

1. **Dado** o jogador no ar com um prédio à frente e acima, **quando** o gesto ILoveYou é sustentado, **então** a mira assistida escolhe o primeiro ponto válido (y acima do jogador e à frente) e a teia prende nele.
2. **Dado** a teia presa, **quando** a corda estica, **então** o jogador balança como um pêndulo (a velocidade radial para fora é removida) e a corda encurta até o mínimo enquanto o gesto durar.

### US-002 — Soltar a teia e voar (P1)

Como jogador, quero desfazer o gesto para soltar a teia e voar com a velocidade acumulada, para encadear balanços e ganhar distância.

**Teste independente:** com a teia presa, desfazer o gesto (ou soltar Espaço); depois da histerese, a teia solta e o jogador segue em voo livre com a velocidade do momento, sob gravidade e arrasto.

**Critérios de aceitação:**

1. **Dado** a teia presa, **quando** o gesto deixa de ser detectado por tempo acima da histerese, **então** a teia solta e o jogador fica em voo livre com a velocidade do instante da soltura.
2. **Dado** o voo livre, **quando** o tempo passa, **então** a gravidade e o arrasto agem e a velocidade é limitada ao máximo do jogo.

### US-003 — Passear por uma cidade real com atribuição (P1)

Como jogador, quero atravessar um trecho reconhecível de Midtown com prédios e ruas reais, para que o passeio tenha a forma de uma cidade de verdade, com o crédito dos dados visível.

**Teste independente:** abrir a tela; a cidade carregada do JSON versionado tem prédios e ruas em posições coerentes com Midtown; a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" aparece na tela.

**Critérios de aceitação:**

1. **Dado** a tela aberta, **quando** a cidade é carregada, **então** ela vem do JSON versionado no app (sem requisição a terceiros) e mostra prédios e ruas em coordenadas de metros no plano local.
2. **Dado** a cidade na tela, **quando** o jogo roda, **então** a atribuição ODbL do OpenStreetMap é exibida de forma legível.

### US-004 — Nunca ficar preso (P1)

Como jogador, quero que o jogo nunca me deixe travado contra um prédio ou parado no chão, para que o passeio seja sempre contínuo.

**Teste independente:** conduzir o jogador contra a parede de um prédio, até um telhado, até o chão e até o limite do mapa; em cada caso o jogo responde sem travar (amortece e empurra para fora; pousa em pé; corre automático no chão; para a velocidade para fora no limite).

**Critérios de aceitação:**

1. **Dado** o jogador batendo num prédio, **quando** há colisão, **então** a velocidade é amortecida na normal, a teia solta e o jogador é empurrado para fora, sem ficar preso.
2. **Dado** o jogador no chão, **quando** ele toca o piso, **então** a velocidade vertical zera, há atrito forte e uma corrida automática para a frente, de modo que ele nunca fica parado.

### US-005 — Dirigir com a mão como um joystick (P1)

Como jogador com câmera, quero inclinar e girar a direção do voo movendo a mão em relação ao centro, para mirar o próximo balanço.

**Teste independente:** com a mão detectada, deslocar o centro da palma do centro do quadro; o deslocamento vira taxas de guinada e inclinação com zona morta e saturação; sem mão, a câmera mantém a direção; o teclado produz as mesmas taxas.

**Critérios de aceitação:**

1. **Dado** a mão detectada fora da zona morta, **quando** ela se desloca do centro, **então** o eixo x controla a guinada e o eixo y a inclinação, nas taxas máximas definidas, com saturação.
2. **Dado** nenhuma mão detectada, **quando** o quadro passa, **então** a direção da câmera é mantida (sem giro espúrio), e o teclado produz as mesmas taxas quando usado.

### US-006 — Jogar sem câmera, pelo teclado (P2)

Como jogador sem câmera ou que prefere o teclado, quero segurar uma tecla para lançar a teia e usar as setas para dirigir, para jogar sem a mão.

**Teste independente:** sem usar a mão, segurar Espaço lança e mantém a teia; soltar solta; as setas guinam e inclinam nas mesmas taxas da mão.

**Critérios de aceitação:**

1. **Dado** o jogo aberto sem mão, **quando** Espaço é segurado, **então** a teia é lançada e mantida enquanto a tecla estiver pressionada, e solta ao soltar a tecla.
2. **Dado** o jogo aberto, **quando** as setas são usadas, **então** a direção muda nas mesmas taxas máximas de guinada e inclinação da mão.

### US-007 — Privacidade preservada (P1)

Como jogador, quero a garantia de que a câmera não grava nem envia imagem e de que a página não fala com terceiros, para jogar sem risco de privacidade.

**Teste independente:** inspecionar as requisições de rede ao carregar e jogar; o JSON da cidade e o Three.js vêm da própria origem; nenhuma requisição vai a domínio de terceiros; nenhuma imagem ou vídeo da câmera é gravado ou enviado.

**Critérios de aceitação:**

1. **Dado** a tela do jogo, **quando** carregada e em jogo, **então** nenhuma requisição vai a domínio de terceiros (a cidade e o Three.js saem da própria origem).
2. **Dado** o processamento da câmera, **quando** o jogo roda, **então** nenhuma imagem ou vídeo é gravado ou enviado; o processamento é local, como nos outros jogos.

## Requisitos funcionais

- **FR-001:** O app DEVE carregar a cidade de um JSON versionado na própria origem (`apps/web/public/swing/midtown.json`), no formato v1 já definido em `packages/swing/src/city.ts` (tipos `City`, `CityBuilding`, `CityRoad`), com prédios e ruas em coordenadas de metros num plano local rotacionado 29° para as avenidas correrem ao longo de Z, e DEVE exibir a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" na tela. Nenhum dado de cidade DEVE ser buscado de terceiros em tempo de jogo.
- **FR-002:** O pacote `@guess-my-move/swing` DEVE prover um índice espacial da cidade (grade) com raycast a partir de um ponto e direção, teste de colisão do jogador (ponto com raio 1,0 m) contra prédios, telhados, chão (y = 1,7) e os limites do mapa, e consulta de altura de apoio, de forma determinística e testável sem navegador. O ponto de partida DEVE nascer a y = 90 m (não no chão) e, por uma busca em espiral, DEVE preferir o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente (a mesma mira assistida do FR-003 com o pitch inicial), caindo no primeiro ponto livre quando nenhum alcança (CQ-006).
- **FR-003:** A teia DEVE ser lançada com mira assistida a partir do olho: três raios com o pitch da câmera somado de +35°, +20° e +8°, nesta ordem, com alcance de 140 m; vale o primeiro raio que acerta um ponto com y >= y do jogador + 25 m e distância horizontal >= 30 m; sem acerto em nenhum prédio, a teia DEVE prender num ponto no céu à frente e acima do jogador (60 m à frente, 70 m acima, só até 220 m de altura; marcado como virtual), e um prédio alcançável sempre tem preferência sobre o céu. A prévia da mira DEVE ser projetada na tela antes de lançar (anel dourado quando o alvo está à vista, seta na borda quando está fora do quadro, com rótulo do lado). O lançamento por uma mão DEVE desviar a mira do lado dessa mão (CQ-007).
- **FR-004:** A física DEVE usar valores de jogo: gravidade 20 m/s², arrasto `v *= exp(-0,1 dt)`, velocidade máxima 60 m/s, passo fixo de 1/120 s com acumulador e dt máximo por quadro de 0,05 s; com a teia presa, a corda é inextensível quando esticada (projeta a posição na esfera e remove a velocidade radial para fora) e encurta a 4 m/s até o mínimo de 10 m.
- **FR-005:** O gatilho do gesto DEVE ser funções puras com tempo em ms: lança quando `ILoveYou` com score >= 0,7 em 2 quadros seguidos; solta depois de 250 ms sem o gesto (histerese contra falha do reconhecedor). O reconhecedor DEVE usar as **duas mãos** (`numHands` 2; `detectAll` processando até duas mãos) e DEVE reconhecer a **pose de teia por geometria** (`isWebPose`), medida só por distâncias entre landmarks e portanto válida em qualquer orientação e em qualquer das duas mãos: indicador e mindinho esticados (ponta/base a partir do pulso >= 1,5), médio e anelar dobrados (<= 1,3) e polegar aberto (ponta a >= 0,6 da palma); essa pose vale como `ILoveYou` com score máximo. O lado vem da posição na tela espelhada: a mão esquerda lança à esquerda (desvio de 18°), a direita à direita, as duas ao centro; passar a usar a outra mão lança uma teia nova do outro lado e encadeia balanços. O teclado espelha o lado: Espaço centro, Z esquerda, X direita (CQ-007).
- **FR-006:** A direção DEVE vir do centro da palma (média dos landmarks 0, 5, 9, 13, 17), espelhado em x, como um joystick: deslocamento em relação ao centro (0,5, 0,5) com zona morta de 0,10 e saturação em 0,35; x controla a guinada (taxa máxima 90°/s) e y a inclinação (taxa máxima 60°/s, mão acima do centro olha para cima); sem mão, a câmera mantém a direção; o teclado DEVE produzir as mesmas taxas (Espaço segura a teia, setas dão direção). A mão que faz a pose de teia NÃO gira a câmera; a outra mão gira (`steerFromHand`). Sem giro manual, a câmera DEVE passar a olhar aos poucos para onde o jogador se move (acompanhamento a 1,2 por s, acima de 8 m/s de velocidade horizontal) (CQ-007).
- **FR-007:** A tela DEVE renderizar a cena em primeira pessoa com Three.js 0.186.0 empacotado (sem CDN), com HUD de velocidade (km/h), altura (m), teias lançadas e distância (m) e um botão "Voltar ao início", e DEVE aplicar o efeito de velocidade por campo de visão de 70° (parado) a 100° (60 m/s) e linhas radiais na borda proporcionais à velocidade, sem afirmar que é desfoque de movimento real.
- **FR-008:** O app DEVE ter uma página própria do jogo (`apps/web/swing.html`), uma entrada `swing` no `vite.config.ts` e um card novo no menu inicial que leve ao jogo, sem mudar o layout nem o comportamento das telas existentes além de acrescentar o card.
- **FR-009:** O jogo DEVE preservar a privacidade como os outros jogos: processamento da câmera local, sem gravar nem enviar imagem ou vídeo, e a página NÃO DEVE fazer nenhuma requisição a domínio de terceiros (o JSON da cidade e o Three.js saem da própria origem).

## Requisitos não funcionais

- **NFR-001:** A lógica do pacote `@guess-my-move/swing` DEVE ser test-first: cada módulo (vetores, índice espacial, teia, física, gatilho, direção, spawn, mundo) tem teste em Vitest escrito antes da implementação, com funções puras e sem dependência de navegador nem de câmera.
- **NFR-002:** Os gates oficiais do repositório DEVEM ficar verdes ao fim: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`; nenhuma dependência nova além do Three.js 0.186.0 (MIT) aprovado.
- **NFR-003:** Nenhuma afirmação de desempenho (fps), suavidade do balanço ou realismo físico DEVE ser feita sem medição registrada numa GPU real; os valores de física são de jogo e declarados como tais, e o headless usa WebGL por software.
- **NFR-004:** Nenhuma requisição DEVE ir a domínio de terceiros em nenhuma página do jogo, inclusive para a biblioteca 3D e para os dados da cidade; todos os ativos DEVEM ser servidos pela própria origem.
- **NFR-005:** A verificação visual em Chromium headless DEVE ser registrada como TEXTO (sem salvar imagens no repositório); as limitações conhecidas (anel externo simples nos multipolígonos OSM, pátios internos preenchidos, alturas ausentes estimadas, sem validação com mão real, fps não medido numa GPU real) DEVEM ser declaradas.
- **NFR-006:** O jogo DEVE ser operável por teclado como alternativa completa à mão, e a atribuição ODbL e o botão "Voltar ao início" DEVEM ser alcançáveis e legíveis.

## Edge cases

- Nenhum ponto de ancoragem válido à frente e acima: nenhum dos três raios acerta um ponto com y >= y do jogador + 8 m e distância horizontal >= 12 m; a teia erra e nada prende, sem travar o jogo.
- Reconhecedor perde o gesto por um quadro: a histerese de 250 ms mantém a teia presa, evitando que ela pisque com uma falha momentânea.
- Sem mão no quadro: a direção não gira espúria; a câmera mantém o rumo até a mão voltar ou o teclado agir.
- Jogador no chão: a velocidade vertical zera, há atrito forte e corrida automática a 8 m/s para a frente, de modo que ele nunca fica parado.
- Colisão com a parede de um prédio: a velocidade é amortecida na normal (restituição 0,3), a teia solta e o jogador é empurrado para fora.
- Limite do mapa: uma parede invisível zera a velocidade para fora, sem deixar sair da cidade.
- Altura de prédio ausente no OSM: estimada por andares × 3,3 m, padrão 15 m quando não há dado; registrado como limitação.
- Multipolígono OSM com relação complexa: só o anel externo simples é usado e pátios internos são preenchidos; registrado como limitação.

## Hipóteses e dependências

- **H-01:** O reconhecedor de gestos do MediaPipe já usado nas bolinhas inclui a categoria `ILoveYou` e devolve um score por quadro; o gatilho usa esse score sem trocar o modelo. Verificável pelo modelo versionado (ver `research.md`).
- **H-02:** A consulta à Overpass para a bbox de Midtown devolve prédios e vias suficientes para um passeio coerente; a resposta de teste registrada em `research.md` traz 569 prédios e 177 vias. A Overpass é usada só no pipeline de dados (fora do jogo), nunca em tempo de jogo.
- **H-03:** O Three.js 0.186.0 (licença MIT) pode ser empacotado e redistribuído pelo app sem CDN; é a única dependência nova, aprovada como CQ na clarificação.
- **H-04:** Os valores de física (gravidade 20, arrasto 0,1, velocidade máxima 60, alcance 140, histerese 250 ms, zona morta 0,10) são de jogo e podem ser ajustados sem mudar a arquitetura; não há alvo de realismo nem de fps.
- **Dependências:** o reconhecedor de gestos e a `CameraPanel` compartilhados em `apps/web/src/camera`; o design system (tokens e componentes) para herdar paleta e fontes; o Vite do `apps/web`; a Overpass API e os dados do OpenStreetMap (ODbL) para o pipeline de dados; o Three.js 0.186.0 empacotado.

## Critérios mensuráveis de sucesso

- **SC-001:** Os testes em Vitest de cada módulo do pacote `@guess-my-move/swing` (vetores, índice espacial com raycast e colisão, mira assistida, física, gatilho com histerese, direção, spawn, mundo) passam sem navegador, exercitando os valores e as regras fixados nos FRs.
- **SC-002:** Um teste do conversor de OSM (node:test) produz, a partir de uma entrada de OSM de exemplo, um JSON no formato v1 (`City`) com prédios e ruas em coordenadas de metros e a atribuição ODbL, sem acessar a rede.
- **SC-003:** A verificação visual em Chromium headless (WebGL por software, câmera simulada) é registrada como texto: a cidade e o HUD aparecem, a atribuição ODbL é exibida, o efeito de velocidade muda o campo de visão com a velocidade e nenhuma requisição vai a domínio de terceiros.
- **SC-004:** Um teste de páginas confirma que a entrada `swing` do Vite existe, que `apps/web/swing.html` carrega a tela e que o menu inicial tem um card que leva ao jogo, sem regressão nas telas existentes.
- **SC-005:** `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies` passam; o Three.js 0.186.0 é a única dependência nova.
- **SC-006:** As limitações conhecidas (anel externo simples, pátios preenchidos, alturas estimadas, sem validação com mão real, fps não medido) estão registradas em `research.md` e nenhuma afirmação de desempenho é feita sem medição.
