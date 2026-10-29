# Tarefas — 2026-10-29-game-arranha-teia-add-head-tracking-camera

Sequência executável test-first. Cada tarefa liga-se a requisitos por ID entre colchetes. As tarefas foram concluídas nesta entrega (test-first: teste vermelho → implementação → verde).

## Tarefas

- [x] T01 — Testes puros de `headOrientationFromMatrix`: identidade, guinada, inclinação e matriz de tamanho inválido (vermelho primeiro). [FR-001]
- [x] T02 — Implementar `headOrientationFromMatrix` extraindo guinada/inclinação da matriz de transformação facial. [FR-001]
- [x] T03 — Testes puros da correção do espelhamento: cabeça à direita → olhar cresce; à esquerda → decresce; cima/baixo na inclinação. [FR-002]
- [x] T04 — Testes puros de calibração automática do neutro e `recenter`, e de "não reage antes de calibrar". [FR-003]
- [x] T05 — Testes puros de zona morta, ganho e limites de guinada/inclinação. [FR-004]
- [x] T06 — Testes puros de suavização exponencial (não salta de uma vez). [FR-005]
- [x] T07 — Testes puros de perda do rosto: desvio decai a zero e marca o rosto ausente. [FR-006]
- [x] T08 — Implementar `createHeadLook` (neutro, zona morta, ganho, limites, suavização, decaimento, `recenter`, `reset`) e exportar do pacote. [FR-002, FR-003, FR-004, FR-005, FR-006]
- [x] T09 — Testes de `world.ts`: `lookDelta` soma direto ao olhar, respeita o limite de inclinação, e `lookActive` segura o olhar contra o acompanhamento automático. [FR-007]
- [x] T10 — Implementar `SwingInput.lookDelta`/`lookActive` em `world.ts` (mudança pequena e localizada). [FR-007, NFR-005]
- [x] T11 — Testes do `faceTracker` (duplo do MediaPipe): recuo GPU→CPU, falha legível, matriz→orientação, sem rosto → null, matriz inválida → null, `close`. [FR-008]
- [x] T12 — Implementar `faceTracker.ts` com `FaceLandmarker` (modelo local, `numFaces 1`, `outputFacialTransformationMatrixes`, lê só a matriz). [FR-008, NFR-001]
- [x] T13 — Acrescentar `FACE_MODEL` (arquivo, URL, SHA-256) ao `prepare-assets.mjs` e ao seu teste. [FR-008, NFR-002]
- [x] T14 — Testes do controlador com rastreador de rosto simulado: cabeça gira a câmera, neutro estável, perda do rosto sem salto, depuração, centralizar, estado do detector. [FR-009, FR-010]
- [x] T15 — Integrar o detector de rosto no `SwingController` (mesmo quadro das mãos, `lookDelta`/`lookActive`, `headDebug`, `faceVisible`, `faceTrackerStatus`, `recenterHead`); falha do rosto não derruba o jogo. [FR-009]
- [x] T16 — `headStatusLine` em `guide.ts` com testes (carregando, rosto fora do quadro/centralize, erro, ok). [FR-010]
- [x] T17 — Tela: status de uma linha do rosto, botão "Centralizar", leitura da cabeça no painel de depuração; fallback sem rosto e teclado preservados. [FR-006, FR-010]
- [x] T18 — Wiring de produção em `useSwingGame.ts` (detector de rosto real, `recenterHead`). [FR-008, FR-009]
- [x] T19 — Medição de fps (mãos + rosto) e verificação visual headless registradas em `validation.md`; privacidade e origem/licença do modelo declaradas. [NFR-001, NFR-002, NFR-003, NFR-004]
- [x] T20 — Atualizar `README.md` (seção do Arranha-Teia) e o guia de arquitetura, citando o rastreador de rosto. [FR-010]

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente)
- **Data:** 2026-10-29
- **Lacunas:** nenhuma. Todos os FR (FR-001..FR-010) têm tarefa formal; os NFR têm tarefa de evidência (T19) ou são atendidos no design (T10/T12/T15). As mudanças em arquivos compartilhados com a issue #81 (`world.ts`, `swingController.ts`, `SwingScreen.tsx`, `guide.ts`) são aditivas e pequenas (NFR-005). O Gate 3 segue pendente do teste ao vivo do maintainer.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Data:** 2026-10-29
- **Aprovador:** Wezer (@wezercarvalho)
- **Referência:** mensagem do maintainer na sessão de 2026-10-29 — "Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."
- **Artefatos aprovados:** `plan.md`, `tasks.md`.
- **Exceções:** nenhuma. O Constitution Check (pré e pós) não registrou desvios. Pendências declaradas (fps e precisão não medidos, licença do `.task` não confirmada) são evidência honesta, não exceções constitucionais; o Gate 3 fica para o teste ao vivo.
