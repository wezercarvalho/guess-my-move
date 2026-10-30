# Validação — 2026-10-29-game-arranha-teia-add-head-tracking-camera

## Estado

- **Spec:** `spec.md`
- **Status:** aprovado com risco aceito
- **Constituição:** 1.0.0
- **Data:** `2026-10-30`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho no chat ("Está aprovado", 2026-10-30)
- **Commit:** branch `feat/80-camera-com-a-cabeca` (PR #84), contida na branch do PR #85; a registrar no merge na `main`

Spec em `validated`; o Gate 3 (convergência validada) foi **aprovado pelo maintainer em 2026-10-30** ("Está aprovado", no chat), sem medições registradas. Este documento registra os comandos rodados, o que foi verificado e o que **não** foi, de forma honesta. Nenhum número de desempenho é afirmado sem medição.

## Comandos e resultados (worktree `wt-80`, 2026-10-29)

| Gate / comando                              | Resultado                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `yarn typecheck`                            | PASSOU — todos os workspaces.                                                                                                |
| `yarn lint`                                 | PASSOU — 0 avisos, 0 erros (oxlint).                                                                                         |
| `yarn test` (pacote `@guess-my-move/swing`) | PASSOU — inclui `headLook.test.ts` (15) e `world.test.ts` (17, com os novos `lookDelta`/`lookActive`).                       |
| `yarn test` (app `@guess-my-move/web`)      | PASSOU — inclui `faceTracker.test.ts` (8), `swingHeadLook.test.ts` (9), `guide.test.ts` (15), `prepare-assets.test.mjs` (7). |
| `yarn sdd:check`                            | PASSOU — catálogo, estados, gates, cobertura e links válidos; esta spec em `validated`.                                      |
| `yarn docs:format:check`                    | PASSOU após `yarn docs:format:fix` (reformatou a tabela de `specs/README.md` e `research.md`).                               |
| `yarn security:dependencies`                | (rodado no gate completo final — ver resumo do PR)                                                                           |
| `yarn build` (app web)                      | PASSOU — `prepare:assets` baixou e conferiu o SHA-256 dos três modelos, `tsc --build` + `vite build` ok.                     |

## Evidências por requisito

| Req    | Tarefa        | Evidência                                                                                                                                                   | Veredito |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-001 | T01, T02      | `headLook.test.ts`: identidade, guinada, inclinação e matriz inválida → `null`.                                                                             | PASS     |
| FR-002 | T03, T08      | `headLook.test.ts` (espelhamento: direita→olhar cresce, esquerda→decresce; cima/baixo) e `swingHeadLook.test.ts`.                                           | PASS     |
| FR-003 | T04, T08      | `headLook.test.ts`: calibração automática, `recenter`, não reage antes de calibrar.                                                                         | PASS     |
| FR-004 | T05, T08      | `headLook.test.ts`: zona morta, ganho, limites de guinada/inclinação.                                                                                       | PASS     |
| FR-005 | T06, T08      | `headLook.test.ts`: suavização exponencial (não salta de uma vez).                                                                                          | PASS     |
| FR-006 | T07, T08      | `headLook.test.ts` (decai a zero, marca ausente) e `swingHeadLook.test.ts` (sem salto no 1º quadro sem rosto).                                              | PASS     |
| FR-007 | T09, T10      | `world.test.ts`: `lookDelta` soma direto, respeita limite de inclinação, `lookActive` segura o olhar.                                                       | PASS     |
| FR-008 | T11, T12, T13 | `faceTracker.test.ts` (GPU→CPU, matriz→orientação, null) e `prepare-assets.test.mjs` (FACE_MODEL com SHA-256).                                              | PASS     |
| FR-009 | T14, T15      | `swingHeadLook.test.ts`: detector de rosto carrega com a câmera, mesmo quadro, falha não derruba o jogo.                                                    | PASS     |
| FR-010 | T16, T17      | `guide.test.ts` (headStatusLine) e `SwingScreen.test.tsx` (tela carrega, fallback) + painel de depuração com a cabeça.                                      | PASS     |
| FR-011 | T21           | `headLook.test.ts` e `faceTracker.test.ts`: matrizes `Ry`/`Rx` conhecidas fixam a convenção (direita ⇒ yaw > 0, cima ⇒ pitch > 0); `swingHeadLook.test.ts`. | PASS     |
| FR-012 | T22           | `faceTracker.test.ts` (devolve orientação e pontos) e `faceOverlay.test.ts` (pontos esparsos, eixo espelhado, nada é guardado).                             | PASS     |
| FR-013 | T23           | `swingHeadLook.test.ts` e `SwingScreen.test.tsx`: seletor Rosto/Automática; em Automática o detector não carrega e o desvio é descartado sem salto.         | PASS     |
| FR-014 | T24           | `guide.test.ts` (`KEYS`) e `SwingScreen.test.tsx`: painel "Teclado" sempre visível com as teclas.                                                           | PASS     |

## Verificação visual headless (Chromium, câmera simulada)

- Servidor estático em `127.0.0.1:5180` (`python3 -m http.server --bind 127.0.0.1`) sobre `apps/web/dist`.
- `playwright-cli open http://127.0.0.1:5180/swing.html`: a página carrega (título "Arranha-Teia"), a cena 3D de Midtown renderiza, o HUD e o status "Faça a pose de teia para saltar." aparecem. **0 erros no console** (só avisos de desempenho do WebGL por software: "GPU stall due to ReadPixels").
- **Requisições só para a própria origem:** todas as requisições observadas foram para `http://127.0.0.1:5180` (nenhuma a CDN ou terceiros), confirmando NFR-002/privacidade.
- **Fallback sem câmera e teclado:** com a câmera desligada, a dica manda usar o teclado; pressionar **Espaço** lançou uma teia e o guia avançou para "Punho fechado puxa. Palma aberta solta." — o jogo é jogável sem câmera, como hoje.
- Nenhuma imagem de rosto foi guardada; o screenshot capturado é só da tela do jogo (cena 3D e HUD), sem vídeo de câmera.

## O que NÃO foi verificado (honesto)

- **Câmera/rosto ao vivo e fps NÃO medidos.** O Chromium headless desta máquina **não teve câmera simulada disponível** (a tela reportou "Câmera indisponível. Nenhuma câmera foi encontrada"), então o caminho do detector de rosto com vídeo real e a medição de ms por inferência de rosto e de mãos (SC-004, NFR-003) **não puderam ser obtidos aqui**. Não invento um número. A lógica rosto→câmera está coberta por testes com rastreador simulado (`swingHeadLook.test.ts`); a sensação, o ganho, a zona morta, os limites e o fps com mãos e rosto juntos ficam **pendentes do teste ao vivo do maintainer** (Gate 3).
- **Precisão da pose da cabeça NÃO medida** (óculos, pouca luz, rosto parcial) — R-02.
- **Licença do arquivo `face_landmarker.task` NÃO confirmada na fonte** — a seção de modelos do guia é renderizada por JavaScript e o card do modelo não foi extraído; declarado como não lido, na mesma situação dos `.task` de mão e de gesto (NFR-004, R-04). O pacote `@mediapipe/tasks-vision` é Apache-2.0, mas isso cobre o código, não o `.task`.

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer), no chat ("Está aprovado")
- **Data:** `2026-10-30`
- **Escopo aprovado:** FR-001 a FR-014 e os artefatos da spec (giro da câmera pela cabeça, pontos do rosto no overlay, seletor Rosto/Automática, legenda de teclado), com o código em `packages/swing/` e `apps/web/`.
- **Riscos aceitos:** o sentido do giro (derivado da matriz do MediaPipe e do relato do maintainer), o desenho dos pontos do rosto, o fps com mãos e rosto juntos, a precisão da pose e a licença do `face_landmarker.task` não têm medição registrada.
- **Observações:** o Gate 3 foi concedido pela mensagem do maintainer, sem números do teste ao vivo. Processo: todos os gates locais aplicáveis passaram (ver tabela); a lógica nova é test-first e coberta. - **Convergência (Gate 3):** **aprovada** pelo maintainer em 2026-10-30, sem medições registradas (câmera e rosto reais, sensação do giro e fps não medidos): risco aceito.

## CQ-010 — Correção da inversão e ajustes (worktree `wt-80`, 2026-10-30)

Comandos rodados um a um (memória limitada; nunca em paralelo). Resultados REAIS:

| Comando                              | Resultado                                                                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn check:static`                  | PASS — typecheck de todos os workspaces + oxlint 0 avisos, 0 erros (136 regras, 147 arquivos).                                                                                                        |
| `yarn test` (`@guess-my-move/swing`) | PASS — 13 arquivos, 148 testes (inclui `headLook.test.ts` com 17: a convenção direita⇒`yaw>0`, cima⇒`pitch>0` com matrizes `Ry`/`Rx`).                                                                |
| `yarn test` (`@guess-my-move/web`)   | PASS — Vitest 31 arquivos, 280 testes (inclui `faceTracker.test.ts` 9, `faceOverlay.test.ts` 6, `swingHeadLook.test.ts` 15, `guide.test.ts` 16, `SwingScreen.test.tsx` 14) + `node --test` 50 testes. |
| `yarn build`                         | PASS — `prepare:assets` conferiu o SHA-256 dos três modelos, `tsc --build` + `vite build` ok (aviso pré-existente de tamanho de chunk do `swing`).                                                    |
| `yarn test:gates`                    | PASS — 231 testes (hook/gate + auditoria de dependências).                                                                                                                                            |
| `yarn test:sdd`                      | PASS — 109 testes.                                                                                                                                                                                    |
| `yarn sdd:check`                     | PASS — catálogo, estados, gates, cobertura e links válidos; esta spec em `validated`.                                                                                                                 |
| `yarn docs:format:check`             | PASS (ver nota abaixo; `yarn docs:format:fix` aplicado onde necessário).                                                                                                                              |
| `yarn security:dependencies`         | PASS — `info=0 low=0 moderate=0 high=0 critical=0`.                                                                                                                                                   |

### Verificação visual headless (Chromium, SEM câmera)

- `dist` servido em `127.0.0.1:5190` (`python3 -m http.server 5190 --bind 127.0.0.1`); `playwright-cli open http://127.0.0.1:5190/swing.html`.
- A página carrega (título "Arranha-Teia"), **0 erros de console** (1 aviso, de desempenho do WebGL por software).
- O painel **"Teclado"** aparece sempre visível, com `Espaço` lança (centro), `Z` / `X` lançam esquerda / direita, `C` puxa, setas olham.
- O **seletor "Direção do olhar"** é gated pela câmera ativa; sem câmera (headless aqui) ele não aparece, como esperado. A troca Automática/Rosto e o não-carregamento do rosto em Automática estão cobertos por teste do controlador e da tela (`swingHeadLook.test.ts`, `SwingScreen.test.tsx`).
- Nenhuma imagem de rosto foi guardada; o screenshot ficou fora do repositório (apenas tela do jogo).

### O que NÃO foi verificado (honesto)

- **Com rosto real:** o headless desta máquina não tem câmera simulada, então **o desenho dos pontos do rosto e o sentido do giro com a cabeça NÃO foram validados ao vivo**. A correção do sinal é **derivada** (matriz + relato do dono, ver `research.md`) e fixada por testes com matrizes conhecidas, não medida com instrumento. O desenho (`drawFace`) é coberto por teste com contexto 2D simulado, mas sem rosto real não há como confirmar o traçado na tela.
- **fps com mãos + rosto, precisão da pose e a sensação do giro** seguem **não medidos** (Gate 3 aprovado pelo maintainer sem medições). Nenhum número de desempenho é afirmado.
- **Licença do `face_landmarker.task`** segue não confirmada na fonte (NFR-004, R-04).
