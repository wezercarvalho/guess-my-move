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

| Módulo         | Responsabilidade                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `city.ts`      | Tipos do formato de cidade v1 (`City`, `CityBuilding`, `CityRoad`), já definido                               |
| `vec.ts`       | Operações de vetor 3D puras                                                                                   |
| `cityIndex.ts` | Grade espacial, raycast a partir de ponto e direção, teste de colisão do jogador, consulta de altura de apoio |
| `web.ts`       | Mira assistida da teia (três raios a partir do olho, +35°, +20°, +8°, alcance 140 m, regra de ponto válido)   |
| `physics.ts`   | Passo fixo do jogador (gravidade 20, arrasto, velocidade máxima 60, corda inextensível que encurta, colisões) |
| `trigger.ts`   | Gatilho do gesto por funções puras (lança com score >= 0,7 em 2 quadros; solta após 250 ms de histerese)      |
| `steering.ts`  | Centro da palma espelhado em x para taxas de guinada e inclinação com zona morta 0,10 e saturação 0,35        |
| `spawn.ts`     | Busca em espiral por um ponto a >= 15 m de qualquer prédio, y = 90 m, velocidade inicial 10 m/s para a frente |
| `world.ts`     | Sessão do mundo: estado, `step` (passo fixo com acumulador) e `reset`                                         |

### Convenção de mundo (fatos de D-05)

Metros; Y para cima; para a frente é -Z; yaw 0 olha para -Z e yaw positivo vira para +X (direita); pitch positivo olha para cima, limitado a ±60°. Jogador como ponto de raio 1,0 m, altura do olho 1,7 m acima do chão.

### Física (valores de jogo, não realistas — CQ-005)

| Parâmetro             | Valor                                                               |
| --------------------- | ------------------------------------------------------------------- |
| gravidade             | 20 m/s²                                                             |
| arrasto no ar         | `v *= exp(-0,1 dt)`                                                 |
| velocidade máxima     | 60 m/s (216 km/h)                                                   |
| passo fixo            | 1/120 s com acumulador (dt máximo por quadro 0,05 s)                |
| alcance da teia       | 140 m                                                               |
| mira assistida        | três raios do olho com pitch + 35°, + 20°, + 8°, nesta ordem        |
| ponto válido          | y >= y do jogador + 8 m e distância horizontal >= 12 m              |
| corda                 | inextensível quando esticada (remove a velocidade radial para fora) |
| encurtamento da corda | 4 m/s até o mínimo de 10 m                                          |
| restituição na parede | 0,3 na normal (amortece, solta a teia, empurra para fora)           |
| chão (y = 1,7)        | zera a velocidade vertical, atrito forte, corrida automática 8 m/s  |

### Gatilho e direção

- **Gatilho (trigger.ts):** funções puras, tempo em ms; lança quando `ILoveYou` com score >= 0,7 em 2 quadros seguidos; solta depois de 250 ms sem o gesto (histerese contra falha do reconhecedor — FR-005).
- **Direção (steering.ts):** centro da palma = média dos landmarks 0, 5, 9, 13, 17, espelhado em x; deslocamento em relação ao centro (0,5, 0,5) com zona morta 0,10 e saturação 0,35; x controla a guinada (90°/s máx), y a inclinação (60°/s máx, mão acima do centro olha para cima); sem mão, mantém a direção; o teclado produz as mesmas taxas (FR-006).

### Render e efeito de velocidade

Three.js 0.186.0 empacotado; cena sem luzes (MeshBasicMaterial com cor por vértice simulando o sol), névoa e céu em degradê de fim de tarde, janelas por textura procedural em canvas, chão com as ruas desenhadas num `CanvasTexture`; teia como cilindro fino. Efeito de velocidade: campo de visão de 70° (parado) a 100° (60 m/s) e linhas radiais na borda proporcionais à velocidade. **Não** se afirma que é desfoque de movimento real (NFR-003). Nada de textura, fonte ou som de terceiros (D-04).

### Pipeline de dados (fora do tempo de jogo)

- `apps/web/scripts/city-from-osm.mjs`: conversor **puro** de uma entrada OSM para o formato `City` (metros, plano local rotacionado 29°, atribuição ODbL); testado por `node:test` sem rede.
- `apps/web/scripts/build-city.mjs`: busca na Overpass e grava `apps/web/public/swing/midtown.json`; rodado uma vez, nunca em tempo de jogo.

## Riscos e limitações (declarados)

- **Multipolígonos OSM:** relações complexas são reduzidas ao **anel externo simples**; pátios internos são preenchidos. Limitação registrada.
- **Alturas ausentes:** estimadas por andares × 3,3 m, padrão **15 m** quando não há dado (481 de 569 prédios têm `height`; 93 têm `building:levels`).
- **Distribuição de alturas (do `midtown.json` gerado, medida na validação):** mediana **17,6 m**, p90 **61,9 m**, máximo **366 m**, **556 prédios**. É uma distribuição baixa: a 90 m (altura de partida), a mira assistida — que só prende em um ponto >= 8 m acima do jogador — alcança apenas os prédios acima de ~98 m, que são poucos. Por isso `findSpawn` nasce a y = 90 m e prefere o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente, caindo no primeiro ponto livre quando nenhum alcança (CQ-006). Os valores de jogo e a regra do ponto válido (FR-003) não mudaram.
- **Sem validação com mão real:** a verificação é por testes puros e Chromium headless com câmera simulada; o comportamento com a mão real numa GPU não é verificado antes do fecho (CQ-004).
- **Desempenho (fps) não medido numa GPU real:** o headless usa WebGL por software, que não representa uma GPU; nenhuma afirmação de fps é feita (CQ-005, NFR-003).
- **Valores de física:** são de jogo e podem ser ajustados sem mudar a arquitetura (H-04).

## Verificação prevista (sem afirmar o que não foi medido)

- Testes em Vitest de cada módulo de `@guess-my-move/swing` (vetores, índice espacial com raycast e colisão, mira assistida, física, gatilho com histerese, direção, spawn, mundo), test-first.
- Teste do conversor de OSM (`node:test`) que, de uma entrada de exemplo, produz um `City` v1 com prédios, ruas e atribuição, sem rede.
- Teste de páginas: entrada `swing` no Vite, `apps/web/swing.html` e o card no menu inicial.
- Verificação visual em Chromium headless (WebGL por software, câmera simulada) registrada como TEXTO: cidade e HUD visíveis, atribuição ODbL, efeito de velocidade com a velocidade, nenhuma requisição a terceiros.
- Gates oficiais: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`, `yarn security:dependencies`.

Nada aqui afirma desempenho (fps), suavidade do balanço ou realismo: os valores são de jogo e a aparência e o desempenho ao vivo numa GPU real dependem do teste do maintainer, não feito antes do merge.
