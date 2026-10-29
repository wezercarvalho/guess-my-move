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

- **Estado:** `SwingState.grip: WallGrip | null`, com `WallGrip = { normal: Vec3, idleMs: number }` — a normal da parede agarrada (para a tela e para manter o jogador encostado) e o tempo acumulado sem movimento de escalada (para a saída por inatividade). `null` fora do agarre.
- **Entrada:** `SwingInput` ganha `grab?: SlotFlags` (pedido de agarrar por mão), `climb?: number` (sinal de escalada -1..1, já reduzido do movimento alternado) e `release?: boolean` (puxar a mão para trás). Campos opcionais: os testes e o controlador existentes que não os passam seguem sem agarre.

## Máquina de estados do agarre e a prova de saída em tempo finito

Três situações: **solto** (regime normal), **entrando** e **agarrado**.

- **Entrar (solto → agarrado):** só quando, no passo, há contato com uma parede (`contact.kind !== 'roof'`) **e** `grab` é pedido em alguma mão. Ao entrar: `velocity` zera, as teias presas são soltas (CQ-002), `grip` guarda a normal da parede e `idleMs = 0`.
- **Agarrado:** a gravidade e o deslize não agem. A posição ao longo da vertical muda por `climb * climbSpeed * dt` (sobe/desce), limitada. A colisão da parede (`index.resolve`) continua resolvendo a posição horizontal, mantendo o jogador colado. Quando `|climb|` está na zona morta, `idleMs += dt*1000`; senão `idleMs = 0`.
- **Sair (agarrado → solto):** em QUALQUER uma destas, com `grip = null` e a física normal voltando:
    1. `grab` vazio (nenhuma mão pede o agarre) ou `release` verdadeiro;
    2. há teia presa no passo (o jogador lançou uma teia);
    3. a altura do agarre passa da altura do prédio em contato (topo) → sai para o telhado, `grounded = true`;
    4. `idleMs > gripIdleMs` (sem movimento de escalada por tempo acima da tolerância).

**Prova de saída em tempo finito (informal, provada por teste de propriedade):** seja qual for a sequência de entradas a partir do estado agarrado, em cada passo uma de três coisas vale:

- se em algum passo `grab` ficar vazio ou `release` for verdadeiro, sai (regra 1) — fim;
- se `grab` continuar pedido e `|climb|` ficar na zona morta, `idleMs` cresce monotonicamente por `dt` a cada passo e, em no máximo `ceil(gripIdleMs / (dt*1000))` passos, ultrapassa `gripIdleMs` e sai (regra 4) — fim;
- se `grab` continuar pedido e `|climb|` sair da zona morta, a altura muda por pelo menos `climbDeadzone*climbSpeed*dt` por passo no sentido do sinal; subindo, a altura é limitada pela altura do prédio em contato (finita) e, ao passar dela, sai para o telhado (regra 3) — fim; descendo, chega ao chão (y = eyeHeight), onde não há mais contato de parede acima do chão e a saída por topo/colisão e a inatividade (ao parar) encerram.

Como cada ramo leva a uma saída em um número finito de passos, **nenhuma sequência de entradas prende o jogador para sempre**. O teste de propriedade (`SC-002`) roda muitas sequências aleatórias de `grab`/`climb`/`release` e exige que `grip` volte a `null` (ou o jogador fique `grounded`) dentro de um limite de passos.

## Sinais de gesto (módulo puro `climb.ts`)

- **Sinal de escalada (`climbSignal`)**: recebe, por mão, o deslocamento vertical do pulso entre dois quadros (`dyLeft`, `dyRight`, em coordenadas normalizadas de imagem, y para baixo). O movimento alternado é `s = (dyLeft) * (-dyRight)` com sinais opostos; de forma robusta, usa-se a média do "puxar para cima" de cada mão: a mão que desce na imagem (dy positivo, y cresce para baixo) empurra o corpo para cima. O resultado é a soma dos componentes de subida de cada mão menos os de descida, com zona morta (`climbDeadzone`) e saturação em 1, devolvendo -1..1. Puro, sem estado: o controlador guarda o quadro anterior e passa os deltas.
- **Sinal de soltar (`pullBackSignal`)**: recebe a variação de profundidade do pulso (`dz`) de cada mão entre quadros; devolve verdadeiro quando a mão se afasta da câmera além de `pullBackThreshold` (o `z` do MediaPipe cresce para longe). Aproximado (H-01).
- Ambos são funções puras, testadas com **dados sintéticos** (números de deslocamento), sem afirmar precisão. Os testes declaram que os dados são sintéticos e que o `z` é aproximado.

## Precedência do gesto da palma aberta (camada web)

A regra (CQ-001) vive no `SwingController`, que conhece o contato pelo estado do mundo. O `SwingState` passa a expor se o jogador está em contato com uma parede no último passo (`touchingWall: boolean`, derivado do `Contact` de parede no `stepPlayer`). No controlador:

- se `touchingWall` e a mão está com a palma aberta (`isOpenPalm`): pede `grab` daquele lado (não solta a teia);
- senão a palma aberta segue o caminho de hoje (o gatilho da teia solta).

Assim a palma aberta não precisa de um gesto novo e o significado é desambiguado pelo contato.

## Valores de jogo (não realistas, ajustáveis)

| Constante           | Valor inicial | Papel                                                               |
| ------------------- | ------------- | ------------------------------------------------------------------- |
| `climbSpeed`        | 6 m/s         | velocidade máxima de subida/descida na parede                       |
| `climbDeadzone`     | 0,06          | abaixo disto o `climb` conta como zero (zona morta do movimento)    |
| `gripIdleMs`        | 1500 ms       | tempo sem movimento de escalada que solta o agarre sozinho          |
| `pullBackThreshold` | 0,08          | aumento de profundidade do pulso (z) que conta como "puxar p/ trás" |

Os valores são palpites de jogo, declarados como tais; serão ajustados pelo teste do maintainer. Nenhuma afirmação de precisão, fps ou latência é feita.

## Verificação planejada

- **Testes puros (Vitest):** estado de agarre (entrar só com contato de parede; colar; subir/descer com `climb`; sair por `grab` vazio, `release`, teia, topo e inatividade) e o teste de propriedade de saída em tempo finito; o módulo `climb.ts` (sinal positivo/negativo/zona morta/saturação e o `pullBackSignal`), com dados sintéticos.
- **Controlador (Vitest, mãos simuladas):** agarrar com contato de parede, subir, descer, soltar; a precedência da palma aberta (sem contato solta a teia); os testes de teia por mão não regridem.
- **Pilotos automáticos descartáveis (cidade real `midtown.json`):** um sobe até o topo e sai no telhado; outro tenta sequências aleatórias e prova que o agarre nunca prende. Registrados como texto.
- **Chromium headless (teclado no lugar da mão):** agarrar (`V`) com contato de parede, subir (setas), soltar; só requisições à própria origem; sem erros no console. Registrado como texto, sem imagens.

## Limitações declaradas (sem medição)

- O `z` do MediaPipe ("puxar a mão para trás") é aproximado e não foi medido ao vivo; o sinal de soltar nunca é a única saída.
- A distinção do movimento alternado foi validada só com dados sintéticos; nada com a mão real.
- A sensação da escalada, a velocidade (`climbSpeed`), a zona morta e a tolerância de inatividade são valores de jogo, não medidos.
- Nenhum teste ao vivo com a mão real nem medição de fps numa GPU real antes do Gate 3.
