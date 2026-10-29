# Plano — 2026-10-29-game-arranha-teia-add-head-tracking-camera

Design e abordagem técnica da câmera pela cabeça. Requisitos referenciados por ID (FR-001..FR-010, NFR-001..NFR-005). Pesquisa e fontes em `research.md`.

## Abordagem

Separar a conversão determinística (orientação da cabeça → desvio do olhar) da leitura do MediaPipe e da tela:

1. **Puro (`packages/swing/src/headLook.ts`)** — `headOrientationFromMatrix(matrix)` extrai guinada/inclinação da matriz de transformação facial (FR-001). `createHeadLook(config)` guarda o neutro, calibra automaticamente nos primeiros quadros estáveis e por `recenter()` (FR-003), aplica zona morta, ganho e limites (FR-004), suaviza de forma exponencial (FR-005) e, sem rosto, decai o desvio a zero marcando o rosto ausente (FR-006). O sinal da guinada casa com o olhar do jogo, corrigindo o espelhamento (FR-002).
2. **World puro (`packages/swing/src/world.ts`)** — `SwingInput` ganha `lookDelta` (ângulo somado direto ao olhar) e `lookActive` (segura o olhar contra o acompanhamento automático). Mudança pequena e localizada (NFR-005); a mira da teia segue o olhar por construção (FR-007).
3. **Rastreador web (`apps/web/src/tracker/faceTracker.ts`)** — cria o `FaceLandmarker` com modelo local do app, `numFaces: 1`, `outputFacialTransformationMatrixes: true`, recuo GPU → CPU (FR-008); devolve a orientação por quadro, lendo só a matriz (NFR-001).
4. **Assets (`apps/web/scripts/prepare-assets.mjs`)** — acrescenta `FACE_MODEL` (arquivo, URL do Google, SHA-256) ao download conferido (FR-008, NFR-002).
5. **Controlador (`apps/web/src/swing/swingController.ts`)** — carrega o detector de rosto junto com a câmera (opcional no `SwingEnv`: ausente = recurso desligado, fallback = hoje), lê o rosto no mesmo quadro novo das mãos, avança o `headLook` por quadro de tela, calcula a variação do desvio e a passa em `lookDelta`/`lookActive`, expõe `headDebug`/`faceVisible`/`faceTrackerStatus` e `recenterHead` (FR-009, FR-010). A falha do rosto o desliga sem derrubar o jogo nem as mãos.
6. **Tela (`guide.ts`, `SwingScreen.tsx`, `SwingDebugPanel.tsx`)** — `headStatusLine` (status de uma linha), botão "Centralizar", leitura da cabeça no painel de depuração (FR-010).

## Constitution Check (pré-design)

- **I. Intenção antes da implementação:** spec, clarificação (Gate 1) e plano/tarefas (Gate 2) aprovados antes do código. OK.
- **II. Uma fonte vigente:** `spec.md` é a fonte; IDs estáveis FR/NFR/SC usados aqui e nas tarefas. OK.
- **III. Rastreabilidade:** cada FR tem tarefa e evidência previstas; decisões e alternativas em `clarification.md`/`research.md`. OK.
- **IV. Test-first e incremental:** cada tarefa comportamental escreve o teste primeiro (vermelho), implementa e vê passar; mudanças pequenas e reversíveis. OK.
- **V. Evidência honesta:** sem afirmar fps nem precisão sem medição; a licença do `.task` declarada como não confirmada (NFR-003, NFR-004). OK.
- **VI. Privacidade e segredos:** só a matriz é lida, nada gravado/enviado; modelo servido pelo app, sem chave (NFR-001, NFR-002). OK.
- **VII. Neutralidade:** a lógica pura não depende de provedor; o MediaPipe fica atrás do rastreador, com duplo de teste. OK.
- **VIII. Clareza e operação segura:** UTF-8 com acentuação; mudanças fora do escopo preservadas; sem operação destrutiva. OK.

## Design detalhado

### `headLook.ts`

- `HeadOrientation { yaw, pitch }` em radianos.
- `DEFAULT_HEAD_LOOK`: `calibrationFrames 12`, `deadzone 5°`, `gain 1.8`, `maxYaw 70°`, `maxPitch 45°`, `smoothing 8/s`. Valores de jogo, ajustáveis; a sensação ao vivo fica para o Gate 3.
- `createHeadLook` guarda `neutral`, `calibrated`, o offset atual e o último `orientation`; `update(orientation|null, dt)` devolve `{ yawOffset, pitchOffset, calibrated, faceVisible }`.
- `recenter()` adota a última orientação como neutro; `reset()` volta ao início sem calibração.

### Combinação no `world.ts`

- `step` soma `lookDelta` direto ao `yaw`/`pitch` (já é ângulo) e, com `lookActive`, pula o `followHeading`. O `pitch` final é limitado pelo `pitchLimit` existente. Sem `lookDelta`/`lookActive`, o comportamento é idêntico ao de hoje (fallback).
- O controlador passa a VARIAÇÃO do offset por quadro (offset atual − offset já aplicado), para não acumular.

### Fallback e privacidade

- `SwingEnv.createFaceTracker` é opcional: ausência desliga o recurso (todos os testes atuais que não o fornecem seguem como hoje).
- O rastreador lê só `facialTransformationMatrixes[0].data`; nenhuma imagem, landmark ou blendshape é guardado (NFR-001). Nenhum overlay novo de rosto é desenhado.

## Constitution Check (pós-design)

- **I–III:** o design mantém a rastreabilidade: FR-001..FR-006 no puro (`headLook.ts`, `world.ts`), FR-007 na combinação, FR-008 no rastreador/assets, FR-009..FR-010 no controlador/tela. Nenhum requisito ficou sem tarefa. OK.
- **IV:** a sequência de tarefas é test-first e incremental; a lógica pura é testada antes da camada web. OK.
- **V:** medição de fps e licença do modelo ficam em `validation.md`/`research.md` sem afirmação sem evidência. OK.
- **VI:** o design não introduz persistência nem envio de imagem; só a matriz por quadro. OK.
- **VII:** o MediaPipe fica atrás de `FaceTracker`, com duplo nos testes; o núcleo segue puro. OK.
- **VIII:** mudanças nos arquivos compartilhados com a #81 são pequenas e localizadas (NFR-005); nada destrutivo. OK.
- **Desvios:** nenhum. Não há exceção constitucional a registrar.

## Riscos e mitigação

- **Custo de dois modelos/quadro (R-01):** medir e registrar em `validation.md` sem generalizar; se pesar, a issue pode no futuro tornar o rosto opcional (fora do escopo agora).
- **Precisão da pose (R-02):** declarada como não medida; ganho + calibração mitigam o uso prático.
- **Licença do `.task` (R-04):** declarada como não confirmada na fonte (NFR-004).
