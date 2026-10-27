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
- **Modos de tiro** (specs `2026-10-27-game-marbles-bete-build-flick-beta`, substituída em parte, e `2026-10-27-game-marbles-bete-refine-flick-thumb-release`, issues #68 e #72): **Pinça** (padrão) e **Estalo (alpha)**, escolhidos no seletor da tela ou por `?mode=estalo`. As duas mecânicas são distintas. Na pinça, direção e força vêm do arrasto da mão (pinça virtual, `aimScale` e `computeShot`). No estalo, a direção vem da orientação da mão e a força, da velocidade com que o polegar solta. Em `packages/marbles`, `flick.ts` expõe `handDirection` (orientação da mão: pulso à base do dedo médio, espelhada), `createFlickDetector` (a pinça fechada arma; ao abrir, mede a duração e a velocidade de pico da subida da razão e a direção no início da subida; a abertura é gatilho rápido com subida de até 80 ms e velocidade mínima de 2 razão/s) e `flickShot` (a velocidade de abertura vira força numa escala logarítmica de 10 a 200 razão/s e a força vira velocidade do tiro de 300 a 1100 unid/s; abertura lenta, fraca ou sem direção cancela). `createBeteRound` ganha `observeFlick` e `snapshot().flick` (direção de prévia). Os extremos da escala vêm da amplitude vista em uma sessão de teste (9 a 199 razão/s), não de calibração. O `MarblesController` roteia cada quadro para o detector do modo e processa o detector só quando a câmera entregou um quadro novo (`requestVideoFrameCallback`, com recuo para `currentTime`), mostrando no painel a taxa de quadros novos da câmera. Trocar de modo reinicia a rodada. Todos os números do estalo são palpites apoiados em uma única sessão de teste.
- O jogo de cartas (`src/round/`, `src/card/`, `packages/core`) não teve código alterado. A única mudança é de página: `index.html` virou o menu com um card por jogo e o jogo de cartas passou a ser servido em `cards.html`, com a mesma entrada `src/main.tsx`.

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
- Os arquivos do detector (`.wasm` e modelo `.task`) são servidos pelo próprio app, sem CDN, e preparados por `prepare:assets`; o modelo não é versionado.

## Validação e contratos de dados

- **Fonte única:** os schemas da carta vivem em `packages/core/src/schemas/` e usam Zod Mini (`zod/mini`), a API funcional e tree-shakable do Zod, por causa do bundle do navegador. Os tipos TypeScript são derivados dos schemas (`z.infer`); não duplique tipos à mão.
- **Objetos estritos:** um campo não declarado invalida a carta, o que reforça a fronteira de informação entre `public` e `evaluation`.
- **Critério do Acenar:** `hand-angle-oscillation` com `amplitudeDeg`, `minReversals`, `windowMs` e `minSamples` positivos; o schema rejeita valores não positivos.
