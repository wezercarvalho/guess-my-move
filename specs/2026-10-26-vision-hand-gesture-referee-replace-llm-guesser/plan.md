# Plano — 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser

## Resumo técnico

O avaliador do gesto e a máquina de estados da rodada ficam em `packages/core` como funções puras sem DOM. O `apps/web` carrega o `HandLandmarker` do MediaPipe atrás de uma interface `HandTracker` (com um duplo de teste), calcula o ângulo da mão por quadro, alimenta a rodada do núcleo e desenha o esqueleto e os números de depuração. O `.wasm` vem do pacote npm e o modelo `.task` é baixado por script com hash fixado; ambos são servidos pelo próprio app. Servidor, provedores, benchmark, árbitro semântico e adivinhador são removidos.

## Contexto técnico

- **Runtime/versões:** Node 26.12.1 (o ambiente do agente usa Node 24 com Yarn 4.18.1 via Corepack), TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5, Zod 4 (`zod/mini`).
- **Dependências:** nova `@mediapipe/tasks-vision` 1.1.1 (Apache-2.0) em `apps/web`; saem as dependências exclusivas do servidor e dos provedores. A auditoria de dependências (`yarn security:dependencies`) roda no gate.
- **Provedores externos:** nenhum no fluxo principal. O download do modelo usa `storage.googleapis.com/mediapipe-models` apenas em desenvolvimento e build.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/core` e `apps/web`; `node --test` para o script de ativos; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn docs:format:check`, `yarn test:gates`.
- **Restrições:** privacidade (sem rede para imagens), sem chave de provedor, sem modelo versionado no repositório, Chrome desktop.

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                         |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 registrados antes do código; descobertas futuras atualizam `spec.md` primeiro.                                                   |
| II. Uma fonte vigente                       | PASS      | As três specs anteriores passam a `superseded`; a nova é a única fonte vigente.                                                              |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de `validation.md`.                                                                |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando. Não há provedor de IA no fluxo; o detector fica atrás de interface com duplo de teste. |
| V. Evidência honesta                        | PASS      | NFR-001 e H-01 a H-05 limitam as afirmações; amostra e condições declaradas em `research.md`.                                                |
| VI. Fronteira, privacidade e segredos       | PASS      | `toPublicCard` com teste; sem rede para imagens (SC-004); modelo não versionado; sem chaves.                                                 |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/development-context/`.                                       |
| VIII. Clareza, preservação, operação segura | PASS      | Remoção de código restrita ao escopo autorizado (CQ-007); alterações preexistentes (`.kiro/settings/`) preservadas.                          |

## Pesquisa e decisões

- `research.md` — spike com 14 vídeos; decisão por Hand Landmarker e sinal de ângulo da mão; alternativas (Pose, posição do pulso, conjuntos públicos) rejeitadas com evidência.

## Estrutura afetada

```text
apps/server/                      remover
packages/providers/               remover
packages/benchmark/               remover
packages/core/src/
  card/ (acenar.ts, deck.ts, public.ts, schema.ts)   critério tipado no lugar dos campos de texto
  schemas/ (card.ts, builders.ts, index.ts)          remover guess.ts
  gesture/ (angle.ts, oscillation.ts, index.ts)      novo
  round/ (types.ts, round.ts, index.ts)              reescrito
  referee/, guesser/                                 remover
  contracts.ts, index.ts                             reduzidos
packages/core/test/
  fixtures/clip-angles.json                          novo, apenas números
  gesture-angle.test.ts, gesture-oscillation.test.ts, gesture-clips.test.ts, round.test.ts   novos ou reescritos
apps/web/
  scripts/prepare-assets.mjs, prepare-assets.test.mjs   novo
  public/mediapipe/                                  gerado, ignorado pelo Git
  src/card/CardView.tsx                              movido de guess/
  src/tracker/ (handTracker.ts, mediapipeTracker.ts) novo
  src/round/ (useGestureRound.ts, GestureScreen.tsx, HandOverlay.tsx, DebugPanel.tsx)   novo
  src/camera/                                        mantido
  src/guess/, src/capture/                           remover
.env.example, package.json, vite.config.ts, .oxlintrc.json, README.md, docs/                 atualizar
```

## Design

### Componentes e responsabilidades

- **`handAngleDeg(landmarks)`** (core): entrada com 21 pontos normalizados; saída em graus ou `null`.
- **`evaluateOscillation(criterion, samples, nowMs)`** (core): considera as amostras com `nowMs - windowMs < t <= nowMs`, conta inversões por zigue-zague com histerese de `amplitudeDeg` e devolve `{ recognized, reversals, windowSamples }`.
- **`createRound({ card, maxDurationMs, clock })`** (core): máquina de estados com `revealCard`, `cameraReady`, `denyCamera`, `trackerFailed`, `start`, `observe(sample)`, `tick`, `cancel`; guarda só as amostras da janela e descarta tudo ao terminar.
- **`HandTracker`** (web): `{ delegate, detect(video, timestampMs) → landmarks | null, close() }`; a implementação do MediaPipe tenta GPU e cai para CPU, ou usa só o delegate forçado por `?delegate=cpu|gpu`; o duplo de teste devolve landmarks roteirizados.
- **`useGestureRound`** (web): carrega o detector quando a câmera fica ativa, executa o laço por quadro durante `detecting`, mede a latência de cada inferência, atualiza o desenho e o painel, e chama `observe`.
- **Ativos:** `prepare-assets.mjs` copia o `wasm` do pacote para `apps/web/public/mediapipe/wasm/` e baixa o modelo para `public/mediapipe/hand_landmarker.task` verificando o SHA-256 fixado; um arquivo existente com hash correto não é baixado de novo.

### Contratos e dados

- `Card.evaluation = { criterion: { kind: 'hand-angle-oscillation', amplitudeDeg, minReversals, windowMs, minSamples } }`, estrito.
- `HandSample = { t: number, angleDeg: number }` com `t` em ms do relógio injetado.
- Estados: `idle | card_revealed | camera_ready | detecting | recognized | timed_out | camera_denied | tracker_error | user_cancelled`.
- Compatibilidade: a API pública do core é reduzida de forma deliberada; não há consumidores externos.

### Fluxo

1. A câmera ativa dispara o carregamento do detector; o botão **Começar** fica desabilitado até estar pronto.
2. **Começar** chama `start()`; o laço lê um quadro por vez do vídeo, obtém os landmarks, calcula o ângulo e chama `observe`.
3. O primeiro `recognized` encerra a rodada; o limite de 10 s encerra com `timed_out`.
4. Falha de carregamento ou de inferência chama `trackerFailed` e mostra a mensagem; a câmera permanece ativa.

## Mapeamento de requisitos

| Requisito      | Abordagem                                                             | Evidência planejada                                         |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| FR-001         | Schema estrito e `toPublicCard` com teste de fronteira                | `card.test.ts`, `schemas.test.ts`                           |
| FR-002         | Critério do Acenar no schema com validação de positivos               | `schemas.test.ts`                                           |
| FR-003         | Função pura de ângulo                                                 | `gesture-angle.test.ts`                                     |
| FR-004         | Avaliador por janela com histerese                                    | `gesture-oscillation.test.ts`, `gesture-clips.test.ts`      |
| FR-005         | Máquina de estados com relógio injetável                              | `round.test.ts`                                             |
| FR-006, FR-012 | Tela com botão, cancelar, nova rodada, erro do detector               | `GestureScreen.test.tsx`                                    |
| FR-007         | Fábrica do MediaPipe com GPU e recuo para CPU; duplo de teste na tela | `mediapipeTracker.test.ts`, execução no Chromium            |
| FR-008         | Canvas sobreposto e painel                                            | `HandOverlay.test.tsx`, `DebugPanel.test.tsx`               |
| FR-009         | Script de ativos com hash                                             | `prepare-assets.test.mjs`, build                            |
| FR-010         | Sem rede e sem log de imagem; aviso na tela                           | inspeção de rede no Chromium, busca de `console.` e `fetch` |
| FR-011         | Remoção e atualização de manifestos                                   | `yarn check:all`, busca por referências                     |
| FR-013         | Reescrita documental                                                  | `yarn docs:format:check`, `yarn sdd:check`                  |
| FR-014         | Fixtures a partir dos landmarks do spike                              | `gesture-clips.test.ts`                                     |

## Estratégia test-first

1. Escrever o teste do bloco (ângulo, avaliador, rodada, cartas) e confirmar a falha esperada;
2. implementar o mínimo em `packages/core`;
3. confirmar o teste direcionado verde, depois `yarn workspace @guess-my-move/core test`;
4. repetir para `apps/web` com o duplo de `HandTracker`;
5. integrar e executar no Chromium com os clipes do maintainer, registrando o resultado;
6. refatorar mantendo os testes verdes.

## Riscos, rollout e rollback

| Risco                                                | Mitigação                                                          | Rollback/contingência                          |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| Falso positivo ou negativo em outra pessoa ou câmera | Painel de depuração com números; limiares na carta                 | Ajustar o critério da carta sem mudar o código |
| GPU indisponível ou lenta                            | Recuo automático para CPU e delegate exibido                       | Fixar CPU                                      |
| Download do modelo falha ou muda                     | Hash fixado; mensagem clara; arquivo em cache                      | Fixar outra versão do modelo com novo hash     |
| Remoção em massa quebra um gate                      | Remover antes de reescrever o core; rodar `check:all` a cada etapa | Reverter o commit da etapa                     |
| Licença do modelo incompatível com redistribuição    | Modelo não versionado                                              | Trocar de modelo ou treinar um próprio         |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                    |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                  |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; não duplica regras.                                             |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                   |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; script de ativos com teste próprio; detector atrás de interface. |
| V. Evidência honesta                        | PASS      | Nenhuma meta de taxa de quadros afirmada; latência a medir no desktop do maintainer.    |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                             |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; remoção restrita ao autorizado.                                     |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
