# Pesquisa — 2026-10-29-game-arranha-teia-add-wall-climb

Esta pesquisa registra as decisões de projeto do agarre à parede, a máquina de estados e a prova de saída em tempo finito, o modelo dos sinais de gesto e as limitações declaradas. É referência do `plan.md`; a fonte do comportamento é `spec.md`.

## Contexto do código existente (fatos lidos)

- `packages/swing/src/physics.ts` (`stepPlayer`): a colisão com prédios vem de `index.resolve(position, radius)`, que devolve um `Contact { position, normal, kind }` com `kind` `roof` ou `wall`. Hoje, num contato de parede, o jogador desliza com atrito (`wallFriction`) e as teias continuam presas (CQ-008). O estado `SwingState` tem `position`, `velocity`, `yaw`, `pitch`, `webs: ActiveWeb[]`, `grounded`, `started`, `stats`.
- `packages/swing/src/world.ts`: `SwingInput` é `{ held: SlotFlags, pull?: SlotFlags, yawRate, pitchRate }`, por lado (esquerda/centro/direita). O `step` lança/segura/solta/puxa as teias e chama `stepPlayer`. Devolve `StepEvents { wallHit }`.
- `packages/swing/src/pose.ts`: `handMetrics`, `isWebPose`, `isOpenPalm`, `isFist`, `handSide`, `webSignal`. Os pontos têm `x`, `y` e `z?` (profundidade relativa do MediaPipe). A geometria decide o gesto; o rótulo `Open_Palm` do reconhecedor sozinho é ignorado.
- `apps/web/src/swing/swingController.ts`: lê as duas mãos por quadro (`detectAll`), um gatilho de teia por lado; o `frame()` monta o `SwingInput` a partir das mãos e do teclado (Z esquerda, X direita, Espaço centro, C puxa, setas olham) e chama `world.advance`.
- Os testes de `twoWebs`, `moves`, `sides`, `physics`, `world` e, no web, `swingHands` fixam o fluxo de teia por mão (CQ-009) e **não podem regredir**.

## Decisão de arquitetura: o agarre é um regime da física pura

O agarre é um estado novo do jogador na física pura (`packages/swing`), não uma lógica da tela. A tela só traduz os gestos/teclas em três entradas novas e lê o estado; toda a regra de colar, subir, descer e sair fica testável sem navegador. Isso segue a separação já usada no jogo (lógica pura vs apresentação) e torna a prova de "nunca prender" um teste puro.

- **Estado:** `SwingState.grip: WallGrip | null`, com `WallGrip = { normal: Vec3, wallTop: number, graceMs: number, fistMs: number }` — a normal da parede agarrada, o topo do prédio, e os relógios de tolerância à perda curta da mão (`graceMs`) e de punho segurado (`fistMs`). `null` fora do agarre. _(CQ-010: `graceMs`/`fistMs` acrescentados.)_
- **Entrada:** `SwingInput` ganha `grab?: SlotFlags` (pedido de agarrar por mão), `climb?: number` (sinal de escalada -1..1) e `releaseFist?: boolean` (punho fechado de alguma mão pedindo soltar). _(CQ-010: era `release?: boolean` do "puxar para trás".)_ Campos opcionais: os testes e o controlador existentes que não os passam seguem sem agarre.

## Máquina de estados do agarre e a prova de saída em tempo finito

Três situações: **solto** (regime normal), **entrando** e **agarrado**.

- **Entrar (solto → agarrado):** só quando, no passo, há contato com uma parede (`contact.kind !== 'roof'`) **e** `grab` é pedido em alguma mão. Ao entrar: `velocity` zera, as teias presas são soltas (CQ-002), `grip` guarda a normal da parede e `idleMs = 0`.
- **Agarrado:** a gravidade e o deslize não agem. A posição ao longo da vertical muda por `climb * climbSpeed * dt` (sobe/desce), limitada. A colisão da parede (`index.resolve`) continua resolvendo a posição horizontal, mantendo o jogador colado. Quando `|climb|` está na zona morta, `idleMs += dt*1000`; senão `idleMs = 0`.
- **Sair (agarrado → solto):** em QUALQUER uma destas, com `grip = null` e a física normal voltando:
    1. `grab` vazio (nenhuma mão pede o agarre) por mais que `grabGraceMs`, OU `releaseFist` (punho fechado) segurado por `fistReleaseMs`; _(CQ-010)_
    2. há teia presa no passo (o jogador lançou uma teia);
    3. a altura do agarre passa da altura do prédio em contato (topo) → sai para o telhado, `grounded = true`;
       _(CQ-011: a saída por inatividade foi removida; segurar o pedido de agarre é um pedido deliberado de ficar, para poder admirar a paisagem e esperar o olhar de escalada.)_

**Prova de saída em tempo finito (informal, provada por teste de propriedade):** seja qual for a sequência de entradas a partir do estado agarrado, em cada passo uma de três coisas vale:

- se em algum passo `grab` ficar vazio por mais que `grabGraceMs`, ou o punho for fechado e segurado por `fistReleaseMs`, sai (regra 1) — fim;
- se `grab` continuar pedido e `|climb|` ficar na zona morta, o jogador segue agarrado de propósito (CQ-011); a saída permanece a um pedido de distância (soltar o pedido, punho ou teia);
- se `grab` continuar pedido e `|climb|` sair da zona morta, a altura muda por pelo menos `climbDeadzone*climbSpeed*dt` por passo no sentido do sinal; subindo, a altura é limitada pela altura do prédio em contato (finita) e, ao passar dela, sai para o telhado (regra 3) — fim; descendo, chega ao chão (y = eyeHeight), onde não há mais contato de parede acima do chão e a saída por topo/colisão e a inatividade (ao parar) encerram.

Como cada ramo leva a uma saída em um número finito de passos, **nenhuma sequência de entradas prende o jogador para sempre**. O teste de propriedade (`SC-002`) roda muitas sequências aleatórias de `grab`/`climb`/`release` e exige que `grip` volte a `null` (ou o jogador fique `grounded`) dentro de um limite de passos.

## Sinais de gesto (módulo puro `climb.ts`)

- **Sinal de escalada (`climbSignal`)**: recebe, por mão, o deslocamento vertical do pulso entre dois quadros (`dyLeft`, `dyRight`, em coordenadas normalizadas de imagem, y para baixo). _(CQ-010: a fórmula antiga `(dyLeft - dyRight)/2` invertia o sinal a cada braçada e dava líquido ~0 ao alternar.)_ A nova regra: cada mão que desce na imagem (dy > 0) puxa o corpo para cima — `up = max(0,dyLeft) + max(0,dyRight)`; as DUAS mãos subindo juntas descem — `down = min(max(0,-dyLeft), max(0,-dyRight))`, zero se uma mão não sobe; `climb = clamp(up - down)` com zona morta (`climbDeadzone`) e saturação em 1, devolvendo -1..1. Uma mão ausente conta `dy = 0`. Puro, sem estado: o controlador guarda o quadro anterior e passa os deltas.
- **Sinal de soltar (punho)**: _(CQ-010)_ a soltura passou a ser o punho fechado (`isFist`) de alguma mão, segurado por `fistReleaseMs` no passo do agarre. O `pullBackSignal` por profundidade `z` foi REMOVIDO: o `z` do MediaPipe tem origem no pulso e fica ~0, então era código morto (documentação do Hand Landmarker; não medido ao vivo).
- Ambos são funções puras, testadas com **dados sintéticos** (números de deslocamento), sem afirmar precisão. Os testes declaram que os dados são sintéticos e que o `z` é aproximado.

## Precedência do gesto da palma aberta (camada web)

A regra (CQ-001) vive no `SwingController`, que conhece o contato pelo estado do mundo. O `SwingState` passa a expor se o jogador está em contato com uma parede no último passo (`touchingWall: boolean`, derivado do `Contact` de parede no `stepPlayer`). No controlador:

- se `touchingWall` e a mão está com a palma aberta (`isOpenPalm`): pede `grab` daquele lado (não solta a teia);
- senão a palma aberta segue o caminho de hoje (o gatilho da teia solta).

Assim a palma aberta não precisa de um gesto novo e o significado é desambiguado pelo contato.

## Valores de jogo (não realistas, ajustáveis)

| Constante       | Valor inicial | Papel                                                              |
| --------------- | ------------- | ------------------------------------------------------------------ |
| `climbSpeed`    | 6 m/s         | velocidade máxima de subida/descida na parede                      |
| `climbDeadzone` | 0,06          | abaixo disto o `climb` conta como zero (zona morta do movimento)   |
| `grabGraceMs`   | 300 ms        | tolerância à perda curta da mão/palma no meio da escalada (CQ-010) |
| `fistReleaseMs` | 250 ms        | tempo com o punho fechado que solta o agarre de propósito (CQ-010) |

Os valores são palpites de jogo, declarados como tais; serão ajustados pelo teste do maintainer. Nenhuma afirmação de precisão, fps ou latência é feita.

## Verificação planejada

- **Testes puros (Vitest):** estado de agarre (entrar só com contato de parede; colar; subir/descer com `climb`; sair por perder o agarre além de `grabGraceMs`, punho segurado `fistReleaseMs`, teia, topo e inatividade) e o teste de propriedade de saída em tempo finito; o módulo `climb.ts` (`climbSignal` por `up − down`: sobe quando uma mão desce, desce só com as duas subindo, zona morta e saturação), com dados sintéticos.
- **Controlador (Vitest, mãos simuladas):** agarrar com contato de parede, subir, descer, soltar; a precedência da palma aberta (sem contato solta a teia); os testes de teia por mão não regridem.
- **Pilotos automáticos descartáveis (cidade real `midtown.json`):** um sobe até o topo e sai no telhado; outro tenta sequências aleatórias e prova que o agarre nunca prende. Registrados como texto.
- **Chromium headless (teclado no lugar da mão):** agarrar (`V`) com contato de parede, subir (setas), soltar; só requisições à própria origem; sem erros no console. Registrado como texto, sem imagens.

## Limitações declaradas (sem medição)

- O sinal de soltar é o punho fechado segurado por tempo; a tentativa original pela profundidade `z` foi removida (CQ-010) por o `z` ser estruturalmente ~0 no MediaPipe. O agarre nunca depende de uma única saída.
- A escalada (`up − down`) e os valores de jogo foram validados só com dados sintéticos; nada com a mão real.
- A sensação da escalada, a velocidade (`climbSpeed`), a zona morta, as tolerâncias e os tempos do olhar (2 s, 12°/7°/20°, velocidade 0,8) são valores de jogo, não medidos.
- Nenhum teste ao vivo com a mão real nem medição de fps numa GPU real antes do Gate 3.
