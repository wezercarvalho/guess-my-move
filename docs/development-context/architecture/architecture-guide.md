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
