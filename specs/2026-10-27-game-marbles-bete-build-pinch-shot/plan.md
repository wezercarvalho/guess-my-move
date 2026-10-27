# Plano — 2026-10-27-game-marbles-bete-build-pinch-shot

## Resumo técnico

A física, o detector de pinça, o cálculo do tiro e a máquina de estados da rodada ficam em um pacote novo `@guess-my-move/marbles`, puro, sem DOM e sem MediaPipe, com tipos de ponto próprios. O app web ganha uma segunda entrada `marbles.html` com um controlador sem React, um hook, uma tela com canvas 2D e um painel de depuração, reaproveitando `useCamera`, `CameraPanel`, `HandTracker`/`createMediaPipeHandTracker` e `drawHand` da spec do árbitro por visão, sem alterar o jogo de cartas. O quadro inteiro da câmera é mapeado ao campo com x espelhado; a pinça comanda o estilingue.

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente (o `engines` do repositório exige >=26.12.1; os scripts de documentação e SDD rodam no Node 24), Yarn 4.18.1 via Corepack, TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5.
- **Dependências:** nenhuma nova no pacote `packages/marbles` (lógica pura). O app web reusa `@mediapipe/tasks-vision` já presente; nenhuma dependência de IA é adicionada.
- **Provedores externos:** nenhum. Nenhuma imagem sai do navegador.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagens), pureza da lógica em Node, isolamento do jogo de cartas, Chrome desktop.

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                              |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 registrados antes do código; descobertas futuras atualizam `spec.md` primeiro.                        |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte comportamental; esta spec não substitui nenhuma outra, apenas reaproveita a do árbitro. |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de requisitos.                                          |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando; o rastreador fica atrás da interface existente com duplo.   |
| V. Evidência honesta                        | PASS      | NFR-002 e H-01 a H-03 limitam afirmações; limiares são placeholders até calibrar.                                 |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem (FR-009); sem chaves; o bete não recebe dado de carta (não há carta).                        |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/`.                                |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o jogo de cartas e arquivos fora do escopo são preservados.                                   |

## Pesquisa e decisões

- `research.md` — reaproveitamento da câmera e do rastreador; sinal de pinça por razão com histerese; física arcade determinística; página extra em vez de app novo; pacote puro independente do core.

## Estrutura afetada

```text
packages/marbles/                         novo pacote @guess-my-move/marbles
  package.json, tsconfig.json             manifesto e TS
  vitest.config.ts                        testes
  src/
    physics.ts                            mundo, passo fixo, atrito, paredes, colisão
    pinch.ts                              detector de pinça (razão, histerese, ponto)
    shot.ts                               direção, velocidade limitada, cancelamento
    round.ts                              createBeteRound, máquina de estados
    index.ts                              API pública e tipos de ponto
  test/
    physics.test.ts, pinch.test.ts, shot.test.ts, round.test.ts   novos
apps/web/
  marbles.html                            segunda entrada do Vite
  vite.config.ts                          build.rollupOptions.input com marbles.html
  src/marbles/
    controller.ts                         controlador sem React (relógio, quadros, rastreador)
    useMarblesGame.ts                     hook que liga câmera, rastreador e controlador
    MarblesScreen.tsx                     tela com canvas 2D
    DebugPanel.tsx                         painel de depuração
  src/camera/, src/tracker/, drawHand     reusados sem alteração
  index.html, src/App.tsx, src/round/     jogo de cartas, NÃO alterado
docs/product/PROJECT_SPEC.md, README.md, docs/development-context/   atualizar
specs/2026-10-27-game-marbles-bete-build-pinch-shot/                 esta spec
specs/README.md                                                       nova linha no catálogo
```

## Design

### Componentes e responsabilidades

- **`physics`** (pacote): `stepWorld(world, dt)` com passo fixo de 1/120 s; aplica atrito 700, para abaixo de 8 unid/s, ricocheteia nas paredes do campo 800 x 600 com restituição 0,8 e resolve colisão elástica (restituição 1,0, massas iguais) entre a bolinha de tiro e o alvo; saída determinística.
- **`pinch`** (pacote): `readPinch(landmarks, aspect)` devolve `{ ratio, closed, point } | ausente`; usa landmarks 4, 8, 0, 9, corrige x pela proporção, aplica histerese (0,35/0,55) e espelha o ponto em x; mão ausente é pinça aberta sem ponto.
- **`shot`** (pacote): `computeShot(pinchPoint, ballPos)` devolve `{ fired, direction, speed }`; direção da pinça para a bolinha, velocidade 5x o arrasto limitada a 220 unidades (máximo 1100 unid/s), cancelada abaixo de 30 unidades.
- **`round`** (pacote): `createBeteRound()` com estados `idle | ready | aiming | rolling | hit | camera_denied | tracker_error`; eventos `cameraReady`, `denyCamera`, `trackerFailed`, `observePinch`, `advance`, `newRound`; guarda tiros, mira e resultado; `snapshot()` expõe o estado.
- **`controller`/`useMarblesGame`** (web): liga a câmera, carrega o rastreador, roda o laço por quadro, mede latência, lê a pinça, chama `observePinch`/`advance` e atualiza o desenho e o painel.
- **`MarblesScreen`/`DebugPanel`** (web): canvas 2D com campo, bolinhas, elástico e seta de previsão, contador de tiros, mensagens `aria-live`, botão **Nova rodada**, e o painel de depuração.

### Contratos e dados

- `Point = { x: number; y: number }` próprio do pacote, estrutural, compatível com landmarks do MediaPipe.
- `PinchReading = { ratio: number; closed: boolean; point: Point | null }`.
- `Ball = { pos: Point; vel: Point; radius: number }`; `World = { shooter: Ball; target: Ball; width: 800; height: 600 }`.
- Estados da rodada: `idle | ready | aiming | rolling | hit | camera_denied | tracker_error`.
- `snapshot()` devolve `{ state, shooter, target, shots, aim, result }`.

### Fluxo

1. Câmera ativa dispara o carregamento do rastreador; o estado vai a `ready`.
2. A pinça fechada a até 70 unidades da bolinha de tiro parada inicia `aiming`; o arrasto define direção e força.
3. Abrir a pinça com arrasto >= 30 unidades dispara (`rolling`); abaixo disso cancela e volta a `ready`.
4. A física avança por passo fixo; o primeiro contato leva a `hit` e mostra os tiros; tudo parado sem contato volta a bolinha de tiro e o alvo às posições iniciais em `ready`.
5. Perda da mão por mais de 300 ms em `aiming` cancela o tiro. Câmera negada ou falha do rastreador leva a `camera_denied`/`tracker_error`.

## Mapeamento de requisitos

| Requisito | Abordagem                                                        | Evidência planejada                               |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| FR-001    | Mundo com passo fixo, atrito, paredes e colisão elástica         | `physics.test.ts`                                 |
| FR-002    | Detecção do primeiro contato entre bolinha de tiro e alvo        | `physics.test.ts`                                 |
| FR-003    | Detector de pinça por razão com histerese e ponto espelhado      | `pinch.test.ts`                                   |
| FR-004    | Tiro por arrasto com direção, velocidade limitada e cancelamento | `shot.test.ts`                                    |
| FR-005    | Máquina de estados `createBeteRound` com eventos e `snapshot`    | `round.test.ts`                                   |
| FR-006    | Canvas 2D, elástico, seta, contador, mensagens e `aria-live`     | `MarblesScreen.test.tsx`                          |
| FR-007    | Reuso de câmera, rastreador e `drawHand`; espelhamento; delegate | `controller` com rastreador simulado, Chromium    |
| FR-008    | Painel de depuração com razão, estado e latências                | `DebugPanel.test.tsx`                             |
| FR-009    | Sem rede para imagem; aviso de privacidade                       | busca no código e inspeção de rede no Chromium    |
| FR-010    | Pacote puro independente; segunda entrada; cartas intacto        | `yarn check:all`, testes do jogo de cartas verdes |
| FR-011    | Atualização de PROJECT_SPEC, README e guia de arquitetura        | `yarn docs:format:check`, `yarn sdd:check`        |

## Estratégia test-first

1. Escrever o teste do bloco (física, contato, pinça, tiro, rodada) e confirmar a falha esperada;
2. implementar o mínimo em `packages/marbles`;
3. confirmar o teste direcionado verde, depois `yarn workspace @guess-my-move/marbles test`;
4. repetir no `apps/web` com o duplo de `HandTracker` e o relógio injetado;
5. integrar e executar no Chromium, inspecionando a rede e registrando o resultado;
6. refatorar mantendo os testes verdes.

## Riscos, rollout e rollback

| Risco                                                 | Mitigação                                                             | Rollback/contingência                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| Perda da mão durante o arrasto cancela tiro legítimo  | Arrasto lento por desenho; limite de 300 ms exposto e ajustável       | Aumentar o limite de perda de mão      |
| Pinça vista de lado reduz a razão                     | Histerese e correção de proporção; número no painel                   | Ajustar os limiares da pinça           |
| Tremor da mão desestabiliza a mira                    | Sem suavização na primeira entrega; registrado como evolução possível | Adicionar suavização em spec futura    |
| Espelhamento confunde a direção do tiro               | Vídeo, esqueleto e ponto da pinça espelhados de forma consistente     | Revisar o mapeamento câmera–campo      |
| Nova entrada do Vite quebra o build do jogo de cartas | Adicionar `marbles.html` sem tocar `index.html`; rodar `yarn build`   | Reverter a mudança de `vite.config.ts` |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                  |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; não duplica regras da spec.                                   |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                 |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; lógica pura testável; rastreador atrás de interface com duplo. |
| V. Evidência honesta                        | PASS      | Nenhuma taxa de quadros ou latência afirmada; medição a registrar no desktop.         |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                           |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; jogo de cartas e arquivos fora do escopo preservados.             |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
