# Validação — 2026-10-29-game-arranha-teia-add-head-tracking-camera

Spec em `implementing`; o Gate 3 (convergência validada) fica **pendente do teste ao vivo do maintainer**. Este documento registra os comandos rodados, o que foi verificado e o que **não** foi, de forma honesta. Nenhum número de desempenho é afirmado sem medição.

## Comandos e resultados (worktree `wt-80`, 2026-10-29)

| Gate / comando                              | Resultado                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `yarn typecheck`                            | PASSOU — todos os workspaces.                                                                                                |
| `yarn lint`                                 | PASSOU — 0 avisos, 0 erros (oxlint).                                                                                         |
| `yarn test` (pacote `@guess-my-move/swing`) | PASSOU — inclui `headLook.test.ts` (15) e `world.test.ts` (17, com os novos `lookDelta`/`lookActive`).                       |
| `yarn test` (app `@guess-my-move/web`)      | PASSOU — inclui `faceTracker.test.ts` (8), `swingHeadLook.test.ts` (9), `guide.test.ts` (15), `prepare-assets.test.mjs` (7). |
| `yarn sdd:check`                            | PASSOU — catálogo, estados, gates, cobertura e links válidos; esta spec em `implementing`.                                   |
| `yarn docs:format:check`                    | PASSOU após `yarn docs:format:fix` (reformatou a tabela de `specs/README.md` e `research.md`).                               |
| `yarn security:dependencies`                | (rodado no gate completo final — ver resumo do PR)                                                                           |
| `yarn build` (app web)                      | PASSOU — `prepare:assets` baixou e conferiu o SHA-256 dos três modelos, `tsc --build` + `vite build` ok.                     |

## Evidência por requisito

| Req    | Tarefa        | Evidência                                                                                                              | Veredito |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-001 | T01, T02      | `headLook.test.ts`: identidade, guinada, inclinação e matriz inválida → `null`.                                        | PASS     |
| FR-002 | T03, T08      | `headLook.test.ts` (espelhamento: direita→olhar cresce, esquerda→decresce; cima/baixo) e `swingHeadLook.test.ts`.      | PASS     |
| FR-003 | T04, T08      | `headLook.test.ts`: calibração automática, `recenter`, não reage antes de calibrar.                                    | PASS     |
| FR-004 | T05, T08      | `headLook.test.ts`: zona morta, ganho, limites de guinada/inclinação.                                                  | PASS     |
| FR-005 | T06, T08      | `headLook.test.ts`: suavização exponencial (não salta de uma vez).                                                     | PASS     |
| FR-006 | T07, T08      | `headLook.test.ts` (decai a zero, marca ausente) e `swingHeadLook.test.ts` (sem salto no 1º quadro sem rosto).         | PASS     |
| FR-007 | T09, T10      | `world.test.ts`: `lookDelta` soma direto, respeita limite de inclinação, `lookActive` segura o olhar.                  | PASS     |
| FR-008 | T11, T12, T13 | `faceTracker.test.ts` (GPU→CPU, matriz→orientação, null) e `prepare-assets.test.mjs` (FACE_MODEL com SHA-256).         | PASS     |
| FR-009 | T14, T15      | `swingHeadLook.test.ts`: detector de rosto carrega com a câmera, mesmo quadro, falha não derruba o jogo.               | PASS     |
| FR-010 | T16, T17      | `guide.test.ts` (headStatusLine) e `SwingScreen.test.tsx` (tela carrega, fallback) + painel de depuração com a cabeça. | PASS     |

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

## Veredito

- **Processo:** todos os gates locais aplicáveis passaram (ver tabela); a lógica nova é test-first e coberta.
- **Convergência (Gate 3):** **pendente** do teste ao vivo do maintainer (câmera e rosto reais, sensação do giro, fps). Não se declara `validated`.
