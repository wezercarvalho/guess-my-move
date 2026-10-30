# Guia de arquitetura

Princípio: **núcleo puro e determinístico, processamento local no navegador**, sem servidor nem infraestrutura antecipada. Este guia complementa a seção 7 do [`PROJECT_SPEC.md`](../../product/PROJECT_SPEC.md); em divergência, a spec aprovada prevalece.

## Camadas

| Camada                            | Responsabilidade                                                                                                 | Não deve                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Núcleo (`packages/core`)          | Schema e carta, ângulo da mão, avaliador da oscilação e máquina de estados da rodada. Puro e determinístico.     | Acessar DOM, câmera, rede ou MediaPipe.                         |
| Aplicação web (React + Vite + TS) | Carta pública, câmera, detector de mão, laço por quadro, desenho do esqueleto e painel de depuração.             | Persistir, logar ou enviar quadros; expor a avaliação da carta. |
| Detector (`src/tracker`)          | Carregar e executar o MediaPipe Hand Landmarker atrás da interface `HandTracker`; devolver landmarks por quadro. | Conter lógica de critério; sair do navegador.                   |

Não há servidor nem adaptador de provedor de IA: o fluxo principal roda inteiro no navegador.

## Bolinhas de gude (bete solo)

Segundo jogo, isolado do jogo de cartas (spec `2026-10-27-game-marbles-bete-build-pinch-shot`, issue #67):

- **`packages/marbles`** (`@guess-my-move/marbles`): lógica pura, sem DOM, câmera ou MediaPipe, e sem depender de `packages/core`. Expõe `stepBodies` e `isAtRest` (física de círculos em passo fixo de 1/120 s, atrito, paredes e colisão elástica), `createPinchDetector` e `pinchRatio` (razão entre a distância das pontas do polegar e do indicador e a escala da mão, com histerese e ponto espelhado), `computeShot` (arrasto vira direção e velocidade) e `createBeteRound` (estados `idle`, `ready`, `aiming`, `rolling`, `hit`, `camera_denied` e `tracker_error`). Os parâmetros padrão (campo 800 x 600, atrito 400, limiares da pinça 0,35 e 0,55, ganho 5) são palpites a calibrar com uso real.
- **`apps/web/marbles.html`** e **`src/marbles/`**: segunda entrada do Vite. O `MarblesController` liga câmera, `HandTracker`, detector de pinça e rodada, e o campo é desenhado em canvas 2D. Reaproveita sem alterar `useCamera`, `CameraPanel`, `HandTracker`, `createMediaPipeHandTracker` e `drawHand`.
- **Modos de tiro** (specs `2026-10-27-game-marbles-bete-build-flick-beta`, substituída, e `2026-10-27-game-marbles-bete-refine-flick-thumb-release`, issues #68 e #72): **Pinça** (padrão) e **Estalo (alpha)**, escolhidos no seletor da tela ou por `?mode=estalo`. As duas mecânicas diferem na força e no gatilho, não na direção. Na pinça, direção e força vêm do arrasto da mão (pinça virtual, `aimScale` e `computeShot`). No estalo, o gesto é o polegar se esticando de uma vez a partir da mão fechada com o polegar preso contra o indicador: a **direção vem da MESMA mira relativa da pinça** (CQ-011, que substituiu a orientação da mão depois que o maintainer achou mirar assim ruim de usar) e a força, da rapidez com que o polegar estica. Em `packages/marbles`, `flick.ts` expõe `createFlickDetector` (reaproveita `pinchRatio` sem compor o detector de pinça; arma com a razão <= `armRatio` 1,05; quando a razão chega a >= `extendRatio` 1,2 procura o mínimo recente como base e exige subida >= `minRise` 0,4; confirma só se a razão ficar esticada por `confirmSamples` 3 amostras, com vereditos `confirmed`/`weak`/`unsustained`/`open_hand`; `FlickRelease.point` guarda a posição da mão travada, base do dedo médio espelhada) e `flickPower` (a velocidade de abertura vira força numa escala logarítmica de 3 a 20 razão/s, devolvendo `{ power, speed }` ou `null`; `weak`, `unsustained` e `open_hand` cancelam). `handDirection` e o campo `direction` foram removidos. `createBeteRound` ganha `observeFlick` e, no modo estalo, ancora a mira na posição da mão ao armar, publica a direção de prévia da mira relativa em `snapshot().flick` (deslocamento × `aimScale`, da pinça virtual para a bolinha; `minPull` 30, abaixo disso cancela como "sem mira") e dispara compondo a velocidade = direção da mira × `speed`; começa a mira assim que a mão está armada, sem exigir a pinça vista aberta antes. Os extremos da escala, o `aimScale` e o `minPull` vêm das gravações de teste e da pinça, não de calibração do estalo. O `MarblesController` roteia cada quadro para o detector do modo e processa o detector só quando a câmera entregou um quadro novo (`requestVideoFrameCallback`, com recuo para `currentTime`), mostrando no painel a taxa de quadros novos da câmera (cerca de 15/s nas gravações). Trocar de modo reinicia a rodada. O jogo das bolinhas usa o `GestureRecognizer` do MediaPipe (`realGestureLoader` em `src/tracker/mediapipeTracker.ts`; modo de vídeo, uma mão) em vez do `HandLandmarker`, trazendo o gesto pronto de maior pontuação da mão (`TrackedHand.gesture`); o jogo de cartas segue com o `HandLandmarker`. O gesto NÃO é gatilho (os gestos prontos não reconheceram a pose do estalo nas gravações): entra como veto de palma aberta em `flick.ts` (veredito `open_hand`/resultado "mão aberta" quando `Open_Palm` tem pontuação >= `gestureMinScore` 0,8 na confirmação) e como diagnóstico na linha "Gesto reconhecido" do painel. A tela do modo estalo monta o `FlickGuide` (lista ordenada "Etapas do estalo", etapa atual por `aria-current` mapeada em `flickStep.ts`, dica por `aria-live`). O ativo `gesture_recognizer.task` é baixado por `prepare:assets` (SHA-256 fixado, não versionado, licença não lida na fonte). Todos os números do estalo são palpites apoiados em duas sessões de uma pessoa (sobreajuste; viabilidade, usabilidade da mira relativa e utilidade do veto pendentes do teste do maintainer).
- O jogo de cartas (`src/round/`, `src/card/`, `packages/core`) não teve código alterado. A única mudança é de página: `index.html` virou o menu com um card por jogo e o jogo de cartas passou a ser servido em `cards.html`, com a mesma entrada `src/main.tsx`.

## Design system (escuro com dourado)

Primeira entrega da issue #74 (spec `2026-10-28-frontend-design-system-adopt-dark-gold`), só em `apps/web`, sem tocar nos núcleos:

- **`apps/web/src/design/`**: um design system pequeno com a identidade escura com dourado do site de referência do maintainer. `tokens.css` define os tokens semânticos (cores tinta/papel/dourado, tipografia Space Grotesk nos títulos e DM Sans no corpo, escala de 4px, raio 0, movimento 0.2s e elevação -3px, foco outline 2px `--gold-bright` offset 5px, borda de controle `--control-border` #77756d com contraste >= 3:1). `fonts.css` declara as duas fontes próprias (`fonts/dm-sans-latin.woff2`, `fonts/space-grotesk-latin.woff2`, woff2 variável 400–700, subset latin, `font-display: swap`, caminho relativo) servidas pelo app sem CDN, com os avisos `OFL-*.txt` ao lado (licenças OFL 1.1 lidas na fonte, que permitem redistribuir). Os componentes base em React — `Button` (primary/secondary/text), `Panel`, `Eyebrow`, `Notice`, `Steps`, `SegmentedControl` e a gaveta `DrawerToggle` + `DrawerPanel` com o hook `useDrawer` — usam só os tokens e são exportados por `index.ts`; `design.css` traz os estilos deles.
- **Herança no menu e nas cartas**: `apps/web/src/styles.css` importa `tokens.css`, `fonts.css` e `design.css` e redireciona as variáveis antigas (`--cor-fundo`→`--ink`, `--cor-superficie`→`--surface`, `--cor-texto`→`--paper`, `--cor-texto-suave`→`--muted`, `--cor-acento`→`--gold-bright`, `--cor-acento-texto`→`--ink`, `--cor-erro`→`--danger`, `--cor-ativo`→`--success`, `--raio`→0). O menu inicial (`src/home`) e o jogo de cartas (`src/round`, `card`, `cards.html`) herdam só paleta e fontes, sem mudança de layout nem de comportamento (CQ-002).
- **Tela das bolinhas refeita** (`src/marbles`): cabeçalho com o título, campo grande à esquerda (largura limitada pela altura da janela, 4:3), coluna lateral estreita com a câmera pequena (compactada só por CSS dentro de `.marbles-side`, sem alterar o `CameraPanel` compartilhado), contador, status de uma linha e "Nova rodada", o guia "Como jogar" (`ShotGuide`, pelo `Steps`, com as etapas de cada modo e dicas curtas), o aviso de privacidade único (`PrivacyNotice`), o seletor de modo como `SegmentedControl` e a depuração recolhida por padrão, aberta pelo botão "Depuração" na barra do campo; abaixo de 960px vira uma coluna sem rolagem horizontal. Nenhuma regra de jogo mudou.
- **Verificação**: teste em Node `apps/web/scripts/design-tokens.test.mjs` (variáveis, ausência de `http`/`https` em `url()`, `@font-face` apontando para arquivo existente e contrastes WCAG) e testes de componente em `apps/web/src/design`. A verificação visual em Chromium headless (1440/900/390) está registrada como texto na spec; a aparência ao vivo no desktop do maintainer segue como risco aceito.

## Arranha-Teia (passeio em primeira pessoa com balanço de teia)

Terceiro jogo, isolado dos anteriores (spec `2026-10-28-game-arranha-teia-build-first-person-web-swing`, issue #76). Separa com nitidez a lógica pura da apresentação:

- **`packages/swing`** (`@guess-my-move/swing`): lógica determinística, sem DOM, câmera, rede nem Three.js, e sem depender dos outros pacotes. Módulos: `city.ts` (tipos do formato de cidade v1 `City`/`CityBuilding`/`CityRoad`), `vec.ts` (vetores 3D), `cityIndex.ts` (grade espacial com `createCityIndex`: raycast a partir de ponto e direção, colisão do jogador como ponto de raio 1,0 m contra parede, telhado, chão em y = 1,7 e limite do mapa, e altura de apoio), `web.ts` (`pickAnchor`: mira assistida de cinco raios a partir do olho com pitch + 50°, + 38°, + 26°, + 15° e + 6°, alcance 160 m, ponto válido com y >= y do jogador + 12 m e distância horizontal >= 15 m — CQ-008), `physics.ts` (`stepPlayer`/`createSwingState`: gravidade 20, arrasto `exp(-0,1 dt)`, velocidade máxima 60, passo fixo 1/120 s, corda inextensível que remove a velocidade radial e encurta a 4 m/s até 10 m, **corda que puxa** `assist` 12 / punho `pullAssist` 40 / `pullReel` 16 / `pullImpulse` 9, a teia **não solta ao bater** e o jogador desliza pela parede `wallFriction` 2 / restituição 0,1, pouso no telhado, chão com corrida automática 8 m/s que não atua com a teia presa, parede invisível no limite, salto ao lançar do chão `launchBoost` 14 / `launchLift` 6; desvio de 28° por lado, teia no céu `skyWeb` 60 m à frente/70 m acima/até 220 m quando nenhum prédio é alcançável — CQ-008), `trigger.ts` (`createWebTrigger`: funções puras; a pose `ILoveYou` lança, a pose ou o punho `Closed_Fist` seguram, o punho com a teia presa puxa, `Open_Palm` por 2 quadros solta, 600 ms sem pose/punho solta sozinho; devolve `{ held, pull }` — CQ-008), `pose.ts` (`isWebPose`: pose de teia por geometria entre landmarks em 3D — indicador e mindinho >= 1,5, médio e anelar <= 1,3, polegar >= 0,6 da palma — válida em qualquer orientação e mão; `isFist` e `isOpenPalm` por geometria, `handMetrics`, `handSide` pelo lado na tela espelhada — CQ-007/CQ-008), `cue.ts` (`swingCue`: o próximo gesto a partir do estado — start, swing, release, throw, low, ground — CQ-007), `spawn.ts` (`findSpawn`: busca em espiral por um ponto livre dentro da área jogável `playBounds` — caixa dos prédios + 120 m —, y = 90 m; prefere um prédio de subida 30 m a pelo menos 50 m à frente para a primeira teia ter arco — CQ-006/CQ-008) e `world.ts` (`createSwingWorld`: sessão com `step`, `advance` por passo fixo com acumulador e dt máximo 0,05 s, e `reset`; escolhe o lado por `handSide`, prende no céu quando nenhum prédio é alcançável — `ActiveWeb.virtual` —, move a **câmera automaticamente** seguindo o movimento, e o jogo começa no primeiro gesto de teia — CQ-008). A direção por joystick da mão (`steering.ts`) foi **removida** na CQ-008. Em contato com uma parede, abrir as mãos **agarra** a fachada: `climb.ts` (CQ / issue #81; CQ-010) tem o estado `WallGrip` em `SwingState.grip`, o sinal puro `climbSignal` (deslocamento vertical dos pulsos: `climb = clamp(up − down)`, com `up = max(0,dyEsq)+max(0,dyDir)` e `down = min(max(0,-dyEsq),max(0,-dyDir))`, zona morta e saturação — descer uma mão por vez sobe, as duas subindo juntas descem), e `stepGrip` (entra só com contato de parede + `grab`, cola sem gravidade, sobe/desce por `climb * climbSpeed`, solta por punho fechado segurado `fistReleaseMs`, tolera a perda curta da mão `grabGraceMs`, e **sempre sai em tempo finito** — por punho/perder o agarre, lançar uma teia, chegar ao topo ou ficar parado além de `gripIdleMs`); o `SwingInput` ganhou `grab`/`climb`/`releaseFist`. O sinal de profundidade `z` foi removido (CQ-010) por ser estruturalmente ~0 no MediaPipe. Convenção de mundo: metros, Y para cima, frente é -Z, yaw 0 olha para -Z, pitch limitado a ±60°. Valores de física **de jogo, não realistas** (CQ-005).
- **`apps/web/swing.html`** e **`apps/web/src/swing/`**: terceira entrada do Vite (`swing` no `vite.config.ts`). `cityRenderer.ts` desenha a cena com **Three.js 0.186.0 empacotado (sem CDN, licença MIT, única dependência nova — CQ-001)**: cena sem luzes com cor por vértice, névoa, céu em degradê, janelas e ruas por textura procedural em canvas, teia como cilindro fino, tudo com geometria e texturas próprias (sem ativo de terceiros). `speedLines.ts` abre o campo de visão de 70° (parado) a 100° (60 m/s) e desenha linhas radiais com a velocidade (**não é desfoque de movimento real**). `swingController.ts`, `useSwingGame.ts` e `SwingScreen.tsx` ligam o reconhecedor de gestos (o mesmo `gesture_recognizer.task` do bete) e o teclado à sessão `world`. O reconhecedor agora usa as **duas mãos** (`realTwoHandGestureLoader`, `apps/web/src/tracker/mediapipeTracker.ts` com `detectAll` e `numHands` 2; `swingController` usa `detectAll(...).slice(0, 2)`) e a pose de teia é reconhecida por geometria (`isWebPose`) em qualquer orientação, além do rótulo `ILoveYou`; o lado vem da tela espelhada (esquerda lança à esquerda, direita à direita, as duas ao centro) e o teclado espelha (Espaço centro, Z esquerda, X direita, `C` puxa, setas ajustam o olhar — alternativa completa à mão). A direção por joystick da mão foi **removida** na CQ-008: a câmera é automática, seguindo o movimento. O punho fechado puxa e a palma aberta solta — e, **em contato com uma parede**, a palma aberta **agarra** em vez de soltar (o controlador aplica a precedência pelo `touchingWall` do estado): descer uma mão por vez escala a fachada e o punho fechado solta; o teclado tem `V` (agarrar) e as setas para cima/baixo (subir/descer), com `hud.gripped` mostrando "Agarrado" e o painel de depuração indicando a palma aberta e o punho por mão, além do contato com a parede, do agarre e do sinal de escalada. `reticle.ts` desenha a prévia da mira na tela para cada mão (anel dourado quando o alvo está à vista, seta na borda quando está fora do quadro, rótulos "esq." e "dir."); a corda sai do pulso do lado que lançou. `guide.ts` (alimentado por `swingCue`) traz a linha de status de uma frase e o guia "Como jogar" de 4 etapas com a etapa atual destacada; o HUD mostra velocidade (km/h), altura (m), teias lançadas, distância (m), o medidor "Teia: esquerda/direita/centro/solta" e um contorno dourado (soltar)/vermelho (perto do chão), a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" e o botão "Voltar ao início". `loadCity.ts` lê o JSON versionado da própria origem; `cityGeometry.ts` completa a tela.
- **Pipeline de dados** (`apps/web/scripts/`, fora do tempo de jogo): `city-from-osm.mjs` é um conversor **puro** (testado por `node:test`, sem rede) de uma entrada OSM para o formato `City` v1 em metros, plano local rotacionado 29°, com atribuição ODbL; `build-city.mjs` consulta a Overpass e grava `apps/web/public/swing/midtown.json`, rodado uma vez. Nenhum dado de cidade é buscado de terceiros em tempo de jogo.
- **Menu:** o `HomePage` ganha um card novo que leva ao jogo, sem mudar o layout nem o comportamento das telas existentes. Os núcleos e as telas do jogo de cartas e do bete não foram alterados.
- **Privacidade e limitações:** processamento da câmera local, sem gravar nem enviar imagem; Three.js e cidade servidos pela própria origem (sem requisição a terceiros). Limitações declaradas (NFR-005): anel externo simples nos multipolígonos OSM, pátios internos preenchidos, alturas ausentes estimadas, **sem validação com a mão real, fps não medido numa GPU real** (o headless usa WebGL por software), gesto ILoveYou não medido na câmera do usuário, da CQ-007 os limiares da pose geométrica, o desvio por lado e a teia no céu **não testados com mão real** (só com landmarks sintéticos girados — 0, 45, 90, 180, 270 graus, espelhados — e teclado em headless), e da CQ-008 a corda que puxa (`assist`/punho e impulso), a teia persistente com deslize, o salto do chão, a pose em 3D e o punho/palma por geometria e a câmera automática **não medidos com mão real** (a jogabilidade da PR #77 foi reprovada no teste do maintainer e esta emenda a refaz), e da issue #81 o **agarre/escalada da parede** — o sinal de escalada pelo deslocamento vertical das mãos e a velocidade de escalada — **não medido com mão real** (só por testes puros, incluindo um teste de propriedade de que o jogador nunca fica preso, e teclado em headless; o sinal de profundidade `z` foi abandonado na CQ-010 por ser estruturalmente ~0). Nenhuma afirmação de desempenho, suavidade ou precisão sem medição.

## Stack decidida

Decisão do maintainer; as versões exatas são fixadas no `package.json` de cada workspace.

- **Linguagem:** TypeScript no núcleo e no web.
- **Frontend:** React + Vite.
- **Detector:** `@mediapipe/tasks-vision` 1.1.1 (Apache-2.0), `HandLandmarker` em modo de vídeo, uma mão.
- **Núcleo:** TypeScript puro, sem dependência de runtime além do Zod para os schemas.
- **Banco de dados:** não há (cartas em TypeScript versionado; nenhuma persistência de quadros).

### Versões fixadas e toolchain (TypeScript 7 com Oxlint)

As versões exatas estão nos manifestos: `react`/`react-dom` 19.3.1, `vite` 8.3.4, `@vitejs/plugin-react` 6.1.2, `@mediapipe/tasks-vision` 1.1.1, `zod` 4, `vitest` 5.0.5, `typescript` 7.0.2, `oxlint` 1.89.0 com `oxlint-tsgolint` 7.0.2004.

**TypeScript 7 (compilador nativo).** O 7.0 não expõe a API programática do compilador, então o `typescript-eslint` não funciona com ele. O projeto resolve assim:

- **Lint:** `oxlint` com `oxlint-tsgolint` (type-aware, sobre o `typescript-go`) no lugar do ESLint; a configuração fica em `.oxlintrc.json`. A versão do `oxlint-tsgolint` acompanha a do TypeScript (`7.0.2004` é o patch 2004 para o TypeScript 7.0.2).
- **Build:** `tsc --build` mais `vite build` em `apps/web`; `tsc` no `packages/core`.
- **Testes:** Vitest nos dois workspaces, resolvendo pelo código-fonte.

## Núcleo: contratos e funções puras

```ts
// Ângulo da mão a partir dos 21 landmarks do MediaPipe.
function handAngleDeg(
    landmarks: readonly HandLandmark[],
    aspect: number,
): number | null

// Amostra de ângulo no instante t (ms do relógio da rodada).
type HandSample = { t: number; angleDeg: number }

// Avaliador puro da oscilação, por janela de tempo.
function evaluateOscillation(
    criterion: HandAngleOscillationCriterion,
    samples: readonly HandSample[],
    nowMs: number,
): { recognized: boolean; reversals: number; windowSamples: number }

// Máquina de estados da rodada, com relógio injetável.
function createRound(config: {
    card: Card
    maxDurationMs?: number
    clock?: () => number
}): Round
```

- `handAngleDeg` usa o vetor do pulso (ponto 0) ao início do dedo médio (ponto 9), com o deslocamento horizontal corrigido por `aspect` (largura/altura). Devolve `null` em vetor degenerado.
- `evaluateOscillation` considera só as amostras da janela `(nowMs - windowMs, nowMs]`, conta inversões com histerese de `amplitudeDeg` e reconhece quando há `>= minSamples` amostras e `>= minReversals` inversões.
- `createRound` expõe `revealCard`, `cameraReady`, `denyCamera`, `trackerFailed`, `start`, `observe(angleDeg)`, `tick`, `cancel`; o limite padrão de `detecting` é `DEFAULT_MAX_DURATION_MS` (10 000 ms).

## Aplicação web: detector atrás da interface

```ts
type TrackerDelegate = 'CPU' | 'GPU'
type TrackedHand = { landmarks: readonly { x: number; y: number }[] }

interface HandTracker {
    readonly delegate: TrackerDelegate
    detect(video: HTMLVideoElement, timestampMs: number): TrackedHand | null
    close(): void
}
```

A implementação do MediaPipe (`src/tracker/mediapipeTracker.ts`) tenta o delegate GPU e recua para CPU; `?delegate=cpu|gpu` força um delegate sem recuo, para comparação. O duplo de teste devolve landmarks roteirizados, o que permite testar a tela sem MediaPipe. O laço por quadro (`src/round/gestureController.ts`, `useGestureRound.ts`) mede a latência de cada inferência e alimenta `observe`.

## Regras

- O critério de avaliação da carta é privado: `toPublicCard` devolve só `public`, e o schema estrito recusa campos desconhecidos. O jogador e uma IA jogadora futura nunca recebem `evaluation`.
- O núcleo é puro: sem DOM, câmera, rede ou MediaPipe; o relógio da rodada é injetado.
- Quadros, vídeo e landmarks são transitórios: não são persistidos, logados nem enviados.
- Os arquivos do detector (`.wasm` e os modelos `.task` `hand_landmarker.task` e `gesture_recognizer.task`) são servidos pelo próprio app, sem CDN, e preparados por `prepare:assets`; os modelos não são versionados.

## Validação e contratos de dados

- **Fonte única:** os schemas da carta vivem em `packages/core/src/schemas/` e usam Zod Mini (`zod/mini`), a API funcional e tree-shakable do Zod, por causa do bundle do navegador. Os tipos TypeScript são derivados dos schemas (`z.infer`); não duplique tipos à mão.
- **Objetos estritos:** um campo não declarado invalida a carta, o que reforça a fronteira de informação entre `public` e `evaluation`.
- **Critério do Acenar:** `hand-angle-oscillation` com `amplitudeDeg`, `minReversals`, `windowMs` e `minSamples` positivos; o schema rejeita valores não positivos.
