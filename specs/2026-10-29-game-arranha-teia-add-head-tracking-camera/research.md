# Pesquisa — 2026-10-29-game-arranha-teia-add-head-tracking-camera

## Pergunta

Como girar a câmera do Arranha-Teia pela cabeça usando o MediaPipe Face Landmarker no navegador, concentrando a conversão orientação → olhar num pacote puro e testável, servindo o modelo pelo próprio app (sem CDN) com verificação por SHA-256, e sem afirmar desempenho nem precisão sem medição?

## Fatos verificáveis

### MediaPipe Face Landmarker para Web (guia oficial, consultado em 2026-10-29)

Fontes:

- Guia da tarefa: [Face landmark detection guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (ai.google.dev; "Last updated 2026-10-09 UTC" na página).
- Guia para Web: [Face landmark detection guide for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) (ai.google.dev).

O que foi confirmado:

- O código do Face Landmarker vem do pacote **`@mediapipe/tasks-vision`** (NPM), o MESMO pacote já usado nas mãos (fixado em `apps/web/package.json` na versão **1.1.1**). Fecha a H-01: não é preciso dependência nova.
- A tarefa devolve, por quadro, landmarks 3D do rosto, blendshapes (opcional) e **matrizes de transformação facial** ("transformation matrices to perform the transformations required for effects rendering"). A matriz é o que este jogo usa; blendshapes e landmarks individuais não são lidos nem guardados.
- A API Web cria a tarefa com `FaceLandmarker.createFromOptions(fileset, options)` e processa vídeo com `detectForVideo(video, timestampMs)` no `runningMode: 'VIDEO'`, no mesmo molde do `HandLandmarker`/`GestureRecognizer`.
- Opções de configuração relevantes (da tabela oficial): `numFaces` (padrão 1; a suavização só se aplica com `num_faces = 1`), `runningMode` (`IMAGE`/`VIDEO`), `outputFaceBlendshapes` (padrão `false` — mantido `false` aqui) e **`outputFacialTransformationMatrixes`** (padrão `false` — ligado aqui para obter a matriz). A matriz é exposta no resultado como `facialTransformationMatrixes` (lista, uma por rosto), com uma matriz 4×4 de 16 números.
- O exemplo de saída oficial mostra a `facial_transformation_matrixes` como linhas de uma matriz 4×4; guinada e inclinação são extraídas da parte de rotação dessa matriz por `headOrientationFromMatrix` (pura, em `packages/swing/src/headLook.ts`). A convenção exata de linhas/colunas é tratada e coberta por teste; a orientação absoluta da pose não é afirmada sem medição (H-02).

### Modelo `face_landmarker.task` (baixado e conferido em 2026-10-29)

- **Arquivo:** `face_landmarker.task` (bundle recomendado do Face Landmarker, inclui detecção de rosto, malha e blendshapes).
- **URL oficial:** `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` — mesma origem `storage.googleapis.com/mediapipe-models/` dos modelos de mão e de gesto já usados.
- **Download de teste:** respondeu HTTP 200; tamanho **3.758.596 bytes** (~3,76 MB).
- **SHA-256:** `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` — fixado em `apps/web/scripts/prepare-assets.mjs` (`FACE_MODEL`). O modelo não é versionado no Git; `public/mediapipe/` fica fora do repositório e o `prepare:assets` baixa e confere o hash, abortando sem gravar se não conferir.

### Licença do modelo (NÃO confirmada na fonte)

- O **texto das páginas** de documentação é Creative Commons Attribution 4.0 e os **trechos de código** são Apache 2.0 (rodapé oficial das páginas acima). Isso cobre a documentação, **não** o arquivo `.task`.
- A licença de redistribuição do **arquivo `face_landmarker.task`** em si **não foi confirmada na fonte** nesta pesquisa: a seção "Models" do guia é renderizada por JavaScript e o extrator de página não trouxe o texto do card do modelo. Fica como pendência (NFR-004, R-04), na mesma situação já declarada no repositório para os `.task` de mão e de gesto (`docs/development-context/security/privacy-and-secrets.md`: "a licença dos arquivos `.task` ainda não foi confirmada na fonte"). Declaro explicitamente: **não li a licença do arquivo na fonte**; a verificação fica pendente antes de qualquer redistribuição.

## Decisões de arquitetura

### Lógica pura separada da apresentação

| Módulo                                        | Responsabilidade                                                                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/swing/src/headLook.ts` (novo)       | `headOrientationFromMatrix` (matriz → guinada/inclinação) e `createHeadLook` (calibração do neutro, zona morta, ganho, limites, suavização exponencial, volta a zero sem rosto, `recenter`, `reset`). Puro, testável sem navegador. |
| `apps/web/src/tracker/faceTracker.ts` (novo)  | Cria o `FaceLandmarker` (modelo local do app, `numFaces: 1`, `outputFacialTransformationMatrixes: true`, recuo GPU → CPU) e devolve a orientação da cabeça por quadro. Lê só a matriz.                                              |
| `apps/web/src/swing/swingController.ts`       | Alimenta mãos e rosto com o mesmo quadro; avança o `headLook` por quadro de tela; soma o desvio ao olhar via `SwingInput.lookDelta`/`lookActive`; expõe a leitura da cabeça e `recenterHead`.                                       |
| `packages/swing/src/world.ts`                 | `SwingInput` ganha `lookDelta` (ângulo direto) e `lookActive` (segura o olhar contra o acompanhamento automático). Mudança pequena e localizada (compartilhado com a issue #81).                                                    |
| `apps/web/src/swing/guide.ts`                 | `headStatusLine` (status de uma linha do rosto).                                                                                                                                                                                    |
| UI (`SwingScreen.tsx`, `SwingDebugPanel.tsx`) | Status de uma linha, botão "Centralizar", leitura da cabeça no painel de depuração.                                                                                                                                                 |

### Por que a matriz e não os landmarks

A matriz de transformação facial dá guinada e inclinação diretamente e é estável para "olhar em volta"; usar landmarks individuais seria mais ruidoso e exigiria guardar pontos do rosto, o que a privacidade desaconselha. Lemos só a matriz, descartada após o uso (NFR-001).

## Alternativas rejeitadas

- **Dependência nova de rastreamento de cabeça:** rejeitada — o `@mediapipe/tasks-vision` já no app cobre o caso (CQ de dependência única mantido).
- **Usar blendshapes para a pose:** rejeitado — desnecessário para guinada/inclinação e aumenta a superfície de dados do rosto.
- **Fluxo de calibração dedicado (assistente):** rejeitado — calibração automática nos primeiros quadros + botão "Centralizar" é mais simples e testável.
