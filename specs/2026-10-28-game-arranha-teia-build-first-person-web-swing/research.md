# Pesquisa — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Pergunta

Como entregar Arranha-Teia — passeio em primeira pessoa por um trecho real de Midtown com balanço de teia lançada pelo gesto ILoveYou — concentrando a lógica num pacote puro de TypeScript testável sem navegador, trazendo a cidade do OpenStreetMap para um JSON versionado com atribuição ODbL, renderizando com Three.js empacotado sem CDN, e sem afirmar desempenho nem realismo sem medição?

## Fatos verificáveis

### Reconhecedor de gestos do MediaPipe (categoria ILoveYou)

O MediaPipe Gesture Recognizer, já usado no jogo das bolinhas, inclui a categoria **`ILoveYou`** entre os gestos pré-treinados que devolve por quadro com um score. É o mesmo modelo já versionado no app (o `gesture_recognizer.task`), cujo hash é fixado em `apps/web/scripts/prepare-assets.mjs`. O gatilho de Arranha-Teia consome esse score sem trocar o modelo nem acrescentar um novo ativo de IA. Fecha a H-01: a categoria existe no modelo já presente.

### Dados da cidade da Overpass (consulta de teste, 2026-10-28)

Consulta de teste à Overpass API para a bbox de Midtown (lat 40.7540..40.7620, lon -73.9900..-73.9805):

- A Overpass respondeu **HTTP 200** com **569 prédios** e **177 vias** na área.
- Dos 569 prédios, **481 têm a tag `height`** e **93 têm `building:levels`**; os demais ficam sem altura explícita e são estimados (andares × 3,3 m, padrão 15 m).
- A consulta é parte do **pipeline de dados** (`apps/web/scripts/build-city.mjs`), rodada uma vez para gerar `apps/web/public/swing/midtown.json`; **não é feita em tempo de jogo**. Fecha a H-02: há geometria suficiente para um passeio coerente.

### Licença dos dados (ODbL)

Os dados do OpenStreetMap estão sob a **Open Database License (ODbL)**, que exige **atribuição**. O jogo exibe na tela "Dados do mapa © colaboradores do OpenStreetMap (ODbL)". A atribuição é obrigatória e fica visível e legível (FR-001, US-003).

### Three.js (dependência nova)

- **Versão:** **Three.js 0.186.0**, fixada exatamente.
- **Licença:** **MIT**, que permite empacotar e redistribuir pelo app.
- **Entrega:** empacotada pelo Vite (sem CDN), de modo que nenhuma requisição vai a terceiros (NFR-004). É a **única dependência nova** (CQ-001, H-03).

## Decisões de arquitetura

### Lógica pura separada da apresentação

Toda a lógica determinística fica em `@guess-my-move/swing`, sem navegador nem câmera, testável em Vitest:

| Módulo         | Responsabilidade                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `city.ts`      | Tipos do formato de cidade v1 (`City`, `CityBuilding`, `CityRoad`), já definido                                                                                                                                                                                                 |
| `vec.ts`       | Operações de vetor 3D puras                                                                                                                                                                                                                                                     |
| `cityIndex.ts` | Grade espacial, raycast a partir de ponto e direção, teste de colisão do jogador, consulta de altura de apoio                                                                                                                                                                   |
| `web.ts`       | Mira assistida da teia (cinco raios a partir do olho, +50°/+38°/+26°/+15°/+6°, alcance 160 m, ponto válido >= 12 m / >= 15 m — CQ-008; antes três raios +35°/+20°/+8°, 140 m)                                                                                                   |
| `pose.ts`      | Pose de teia por geometria (`isWebPose`, em 3D a partir da CQ-008), punho (`isFist`), palma (`isOpenPalm`), lado da mão (`handSide`), `handMetrics` e sinal de teia (`webSignal`) — CQ-007/CQ-008                                                                               |
| `cue.ts`       | Dica do próximo gesto a partir do estado (`swingCue`: start, swing, release, throw, low, ground); usa `webs.length > 0` — CQ-007/CQ-009                                                                                                                                         |
| `physics.ts`   | Passo fixo do jogador (gravidade 20, arrasto, velocidade máxima 60, corda inextensível que encurta, corda que puxa — assist/punho —, deslize na parede, salto do chão, colisões); uma teia por mão (`webs[]`, assistência dividida por n) — CQ-008/CQ-009                       |
| `trigger.ts`   | Gatilho do gesto por funções puras: `ILoveYou` lança, punho segura/puxa, palma solta, 600 ms solta sozinho; devolve `{ held, pull }` (CQ-008)                                                                                                                                   |
| `spawn.ts`     | Busca em espiral por um ponto livre, y = 90 m, velocidade inicial 10 m/s; a partir da CQ-008 prefere um prédio de subida 30 m a >= 50 m à frente (corda longa)                                                                                                                  |
| `world.ts`     | Sessão do mundo: estado, `step` (passo fixo com acumulador), `reset`, câmera automática que segue o movimento (CQ-008) e entrada por lado (`SwingInput` `{ held, pull? }` com `SlotFlags`, `hud.webSides`) — CQ-009; a direção por joystick da mão / `steering.ts` foi removida |

### Convenção de mundo (fatos de D-05)

Metros; Y para cima; para a frente é -Z; yaw 0 olha para -Z e yaw positivo vira para +X (direita); pitch positivo olha para cima, limitado a ±60°. Jogador como ponto de raio 1,0 m, altura do olho 1,7 m acima do chão.

### Física (valores de jogo, não realistas — CQ-005)

| Parâmetro               | Valor                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| gravidade               | 20 m/s²                                                                                                                                                                                                                                                            |
| arrasto no ar           | `v *= exp(-0,1 dt)`                                                                                                                                                                                                                                                |
| velocidade máxima       | 60 m/s (216 km/h)                                                                                                                                                                                                                                                  |
| passo fixo              | 1/120 s com acumulador (dt máximo por quadro 0,05 s)                                                                                                                                                                                                               |
| alcance da teia         | 160 m (CQ-008; antes 140 m)                                                                                                                                                                                                                                        |
| mira assistida          | cinco raios do olho com pitch + 50°, + 38°, + 26°, + 15°, + 6°, do mais inclinado ao mais raso (CQ-008; antes três raios)                                                                                                                                          |
| ponto válido            | y >= y do jogador + 12 m e distância horizontal >= 15 m (CQ-008; antes 25 m / 30 m)                                                                                                                                                                                |
| corda que puxa          | `assist` 12 m/s² em direção ao ponto; com o punho, `pullAssist` 40 m/s², `pullReel` 16 m/s, `pullImpulse` 9 m/s (CQ-008); com mais de uma teia presa, `assist` e `pullAssist` são divididos pelo número de teias (CQ-009)                                          |
| uma teia por mão        | `webs: ActiveWeb[]`, no máximo uma por lado (`side` obrigatório, `pulling?` por teia; `SwingState.pulling` global removido); impulso do punho por teia (dois punhos = dois impulsos) e impulso de chão uma vez só; corrida automática só sem nenhuma teia (CQ-009) |
| deslize na parede       | a teia não solta ao bater; `wallFriction` 2 por s, restituição 0,1; solta só por palma aberta ou pose perdida > 600 ms (CQ-008)                                                                                                                                    |
| salto ao lançar do chão | `launchBoost` 14 m/s em direção ao ponto mais `launchLift` 6 m/s para cima; sem corrida automática com a teia presa (CQ-008)                                                                                                                                       |
| teia no céu             | sem prédio alcançável, prende a 60 m à frente e 70 m acima, até 220 m de altura (virtual, reserva); prédio tem preferência (CQ-007)                                                                                                                                |
| desvio por lado         | 28° a partir da CQ-008 (antes 18°): esquerda à esquerda, direita à direita, as duas ao centro                                                                                                                                                                      |
| câmera                  | automática: guinada e inclinação seguem o movimento (inclinação 12° + metade da inclinação da velocidade, entre -20° e 35°) — a direção por joystick da mão foi removida (CQ-008)                                                                                  |
| área jogável            | caixa dos prédios + 120 m, nunca além do mapa (`playBounds`, CQ-007)                                                                                                                                                                                               |
| corda                   | inextensível quando esticada (remove a velocidade radial para fora)                                                                                                                                                                                                |
| encurtamento da corda   | 4 m/s até o mínimo de 10 m                                                                                                                                                                                                                                         |
| restituição na parede   | (**superado pela CQ-008**) antes 0,3 na normal e a teia soltava; agora a teia persiste e o jogador desliza (ver linha "deslize na parede")                                                                                                                         |
| chão (y = 1,7)          | zera a velocidade vertical, atrito forte, corrida automática 8 m/s (não atua com a teia presa — CQ-008)                                                                                                                                                            |

### Gatilho e direção

- **Gatilho (trigger.ts):** funções puras, tempo em ms. A partir da CQ-008: a pose `ILoveYou` (2 quadros) lança; a pose ou o punho `Closed_Fist` seguram; o punho com a teia presa **puxa**; `Open_Palm` por 2 quadros **solta**; sem pose nem punho por 600 ms solta sozinho; devolve `{ held, pull }`. A geometria decide primeiro: o rótulo `Open_Palm` do reconhecedor, sem a geometria, é ignorado (antes da CQ-008: lança com score >= 0,7 em 2 quadros, solta após 250 ms de histerese — FR-005).
- **Duas mãos e pose geométrica (pose.ts — CQ-007/CQ-008):** o reconhecedor passa a `numHands` 2 (`realTwoHandGestureLoader`, `HandTracker.detectAll` processando até duas mãos). A pose de teia é medida por geometria (`isWebPose`), independente da orientação e da mão: indicador e mindinho esticados (ponta/base do pulso >= 1,5), médio e anelar dobrados (<= 1,3), polegar aberto (ponta a >= 0,6 da palma); vale como `ILoveYou` com score máximo (`webSignal`), ou o rótulo do reconhecedor com score >= 0,7. A partir da CQ-008 as distâncias são em **3D** (usam o `z` do MediaPipe quando existe — hipótese não medida ao vivo) e a pose expõe o punho fechado (`isFist`), a palma aberta (`isOpenPalm`) e `handMetrics` (alcance dos 4 dedos e abertura do polegar) para o painel de depuração. O lado vem da posição na tela espelhada (`handSide`): esquerda lança à esquerda (desvio de 28° a partir da CQ-008), direita à direita, as duas ao centro; passar a usar a outra mão lança uma teia nova do outro lado. Os limiares são palpites, validados só com landmarks sintéticos girados (0, 45, 90, 180, 270 graus, espelhados), não com mão real.
- **Câmera automática (world.ts — CQ-008, supera a direção por joystick da mão):** a direção por joystick da mão (`steering.ts`, centro da palma espelhado para taxas de guinada e inclinação) foi **removida** (o módulo e seu teste apagados). A câmera é automática: guinada e inclinação seguem o movimento (inclinação = 12° + metade da inclinação da velocidade, entre -20° e 35°), para a outra mão não precisar girar a câmera e não atrapalhar a pose. As setas do teclado ainda ajustam o olhar e a tecla `C` puxa (FR-006, superado pela CQ-008).

### Render e efeito de velocidade

Three.js 0.186.0 empacotado; cena sem luzes (MeshBasicMaterial com cor por vértice simulando o sol), névoa e céu em degradê de fim de tarde, janelas por textura procedural em canvas, chão com as ruas desenhadas num `CanvasTexture`; teia como cilindro fino. Efeito de velocidade: campo de visão de 70° (parado) a 100° (60 m/s) e linhas radiais na borda proporcionais à velocidade. **Não** se afirma que é desfoque de movimento real (NFR-003). Nada de textura, fonte ou som de terceiros (D-04).

Para a imersão da CQ-007, a camada visível (`apps/web/src/swing`) acrescenta: a prévia da mira projetada na tela para cada mão (`reticle.ts`: anel dourado quando o alvo está à vista, seta na borda quando fora do quadro, rótulos "esq." e "dir."), a corda saindo do pulso do lado que lançou e mais fina (`cityRenderer.ts`), as dicas e o guia "Como jogar" de 4 etapas com a etapa atual destacada (`guide.ts`, alimentado por `swingCue`), o medidor "Teia: esquerda/direita/centro/solta" no HUD e um contorno dourado (soltar) ou vermelho (perto do chão) no palco (`SwingScreen.tsx`). O controlador (`swingController.ts`) usa `detectAll` com até duas mãos, escolhe o lado por `handSide`, e a `mediapipeTracker.ts` expõe `detectAll` com `numHands` 2.

### Pipeline de dados (fora do tempo de jogo)

- `apps/web/scripts/city-from-osm.mjs`: conversor **puro** de uma entrada OSM para o formato `City` (metros, plano local rotacionado 29°, atribuição ODbL); testado por `node:test` sem rede.
- `apps/web/scripts/build-city.mjs`: busca na Overpass e grava `apps/web/public/swing/midtown.json`; rodado uma vez, nunca em tempo de jogo.

## Riscos e limitações (declarados)

- **Multipolígonos OSM:** relações complexas são reduzidas ao **anel externo simples**; pátios internos são preenchidos. Limitação registrada.
- **Alturas ausentes:** estimadas por andares × 3,3 m, padrão **15 m** quando não há dado (481 de 569 prédios têm `height`; 93 têm `building:levels`).
- **Distribuição de alturas (do `midtown.json` gerado, medida na validação):** mediana **17,6 m**, p90 **61,9 m**, máximo **366 m**, **556 prédios**. É uma distribuição baixa: a 90 m (altura de partida), a mira assistida — que só prende em um ponto >= 8 m acima do jogador — alcança apenas os prédios acima de ~98 m, que são poucos. Por isso `findSpawn` nasce a y = 90 m e prefere o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente, caindo no primeiro ponto livre quando nenhum alcança (CQ-006). Os valores de jogo e a regra do ponto válido (FR-003) não mudaram.
- **Sem validação com mão real:** a verificação é por testes puros e Chromium headless com câmera simulada; o comportamento com a mão real numa GPU não é verificado antes do fecho (CQ-004).
- **Pose, lados e teia no céu não medidos com mão real (CQ-007):** os limiares da pose geométrica (1,5/1,3/0,6), o desvio de 18° por lado, a teia no céu e a sensação de balanço foram validados só com landmarks sintéticos girados (0, 45, 90, 180, 270 graus, espelhados) e com teclado em Chromium headless; nenhuma mão real nem as duas mãos ao vivo foram exercitadas.
- **Mecânica da CQ-008 não medida com mão real:** a jogabilidade da PR #77 foi reprovada no teste do maintainer (a pose de lado não foi reconhecida no começo, a teia sumia a cada batida em prédio e do chão não tirava o jogador) e esta emenda a refaz — corda que puxa (`assist`/punho e impulso), teia persistente com deslize, salto ao lançar do chão, soltar pela palma e segurar pelo punho, mira de cinco raios (alcance 160 m, subida 12 m, horizontal 15 m, desvio 28°), pose em 3D (usa o `z` do MediaPipe) e câmera automática (`steering.ts` removido). Os ganhos (`assist` 12, `pullAssist` 40, `pullReel` 16, `pullImpulse` 9, `launchBoost` 14, `launchLift` 6), a pose em 3D, o punho (`isFist`) e a palma (`isOpenPalm`) por geometria **não foram verificados com mão real** nem numa GPU real; foram validados só com testes puros e inspeção em Chromium headless com teclado.
- **Mecânica da CQ-009 não medida com as duas mãos reais:** uma teia por mão (lançar com a esquerda e depois a direita deixa as duas presas), a assistência de cada corda dividida pelo número de teias presas, o impulso do punho somando por teia (dois punhos = dois impulsos) e o recolhimento que sobe o jogador até o telhado com as duas cordas são decisões de projeto, validadas só por teste puro (`twoWebs.test.ts` e os ajustados) e por inspeção em Chromium headless com teclado (Z/X/Espaço/C); **nenhuma mão real nem as duas mãos ao vivo** foram exercitadas, e o reconhecimento das duas mãos ao mesmo tempo (ordem esquerda/direita pela posição na tela) só foi testado com mãos simuladas.
- **Desempenho (fps) não medido numa GPU real:** o headless usa WebGL por software, que não representa uma GPU; nenhuma afirmação de fps é feita (CQ-005, NFR-003).
- **Valores de física:** são de jogo e podem ser ajustados sem mudar a arquitetura (H-04).

## Verificação prevista (sem afirmar o que não foi medido)

- Testes em Vitest de cada módulo de `@guess-my-move/swing` (vetores, índice espacial com raycast e colisão, mira assistida, física, gatilho com histerese, direção, spawn, mundo), test-first.
- Teste do conversor de OSM (`node:test`) que, de uma entrada de exemplo, produz um `City` v1 com prédios, ruas e atribuição, sem rede.
- Teste de páginas: entrada `swing` no Vite, `apps/web/swing.html` e o card no menu inicial.
- Verificação visual em Chromium headless (WebGL por software, câmera simulada) registrada como TEXTO: cidade e HUD visíveis, atribuição ODbL, efeito de velocidade com a velocidade, nenhuma requisição a terceiros.
- Gates oficiais: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`, `yarn security:dependencies`.

Nada aqui afirma desempenho (fps), suavidade do balanço ou realismo: os valores são de jogo e a aparência e o desempenho ao vivo numa GPU real dependem do teste do maintainer, não feito antes do merge.
