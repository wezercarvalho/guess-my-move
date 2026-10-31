# Clarificação — 2026-10-29-game-arranha-teia-add-head-tracking-camera

Registro das perguntas, respostas e da primeira aprovação. As decisões comportamentais estão incorporadas em `spec.md`; aqui fica o raciocínio.

## Perguntas e respostas

### Q-01 — Como a cabeça combina com o acompanhamento automático atual?

**Pergunta:** a cabeça substitui o acompanhamento automático, soma a ele, ou tem prioridade?

**Resposta (decisão):** a cabeça soma um desvio ao olhar enquanto está fora da zona morta (prioridade da cabeça); sem rosto, o desvio volta suave a zero e o acompanhamento automático retoma. É o comportamento pedido na issue e o menos surpreendente. Incorporado em FR-007.

### Q-02 — O desvio da cabeça vale também para a mira da teia?

**Pergunta:** a mira da teia deve seguir o olhar da cabeça?

**Resposta (decisão):** sim. A mira já sai de `state.yaw`/`state.pitch`; aplicar o desvio ao olhar faz a mira segui-lo, por construção, sem código extra. Coerente (a teia vai para onde se olha). Incorporado em FR-007.

### Q-03 — Como calibrar o neutro?

**Pergunta:** calibração automática, botão, ou os dois?

**Resposta (decisão):** automática nos primeiros quadros estáveis, mais um botão "Centralizar" para recalibrar sob demanda. É a opção mais simples e testável. Incorporado em FR-003 e FR-010.

### Q-04 — O rastreio de rosto é opcional (botão) ou sempre ligado com a câmera?

**Pergunta:** o jogador precisa ligar o rosto à parte?

**Resposta (decisão):** sempre ligado junto com a câmera, alimentado pelo mesmo quadro das mãos; sem rosto, o jogo segue como hoje. Evita um controle a mais e mantém o fluxo simples. Incorporado em FR-009. A medição de custo de dois modelos por quadro fica em `validation.md` (R-01).

### Q-05 — Ganho e limites do giro?

**Pergunta:** a cabeça virada 20° vira a câmera quanto?

**Resposta (decisão):** ganho maior que 1:1 (padrão 1,8) para compensar que o jogador olha o monitor, com zona morta (~5°) e limites (guinada 70°, inclinação 45°); valores de jogo, ajustáveis, não realistas. Incorporado em FR-004. A sensação ao vivo fica para o teste do maintainer (Gate 3).

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Data:** 2026-10-29
- **Aprovador:** Wezer (@wezercarvalho)
- **Referência:** mensagem do maintainer na sessão de 2026-10-29 — "Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar." Aprova antecipadamente os Gates 1 e 2 das issues #80 e #81.
- **Artefatos aprovados:** `spec.md`, `clarification.md`.
- **Observações:** Aprovação antecipada; o Gate 3 (convergência validada) foi aprovado pelo maintainer em 2026-10-30, sem medições. Não se afirma desempenho (fps) nem precisão da pose da cabeça sem medição registrada.

## CQ-010 — Correção da inversão e ajustes após o primeiro teste do dono

Emenda registrada depois que o dono testou a câmera pela cabeça (sessão de 2026-10-30). O que ele observou e as decisões:

### O que o dono viu

1. **Câmera invertida nos dois eixos:** olhar para a direita girava para a esquerda; olhar para cima abaixava a câmera (e vice-versa).
2. **O rosto não mostrava pontos na tela**, enquanto a mão mostra o esqueleto ao ser lida.
3. **Faltava escolher** se a direção do olhar vem do rosto ou do modo automático.
4. **Não havia instruções de teclado na tela** — ele nem sabia que havia atalhos.

### Causa da inversão (derivada, não medida com instrumento)

`headOrientationFromMatrix` usava `yaw = atan2(-R[2][0], R[2][2])` e `pitch = atan2(-R[1][2], R[1][1])`. A matriz de transformação facial do MediaPipe leva o modelo canônico (olha para +Z, X à direita da imagem, Y para cima) ao espaço da câmera **sem espelhar**. Em `Ry(θ)`, +Z vai a `(sin θ, 0, cos θ)`; quando o jogador vira a cabeça para a **sua direita**, o rosto aponta para a esquerda da imagem não espelhada, logo `θ < 0`. O código devolvia o sinal errado, resultando em **yaw negativo ao olhar para a direita** e **pitch negativo ao olhar para cima** — exatamente a inversão relatada. A correção remove a negação: `yaw = atan2(R[2][0], R[2][2])` e `pitch = atan2(R[1][2], R[1][1])`, fixando a convenção **`yaw > 0` = olha para a sua direita** e **`pitch > 0` = olha para cima**, que casa com o olhar do jogo (`state.yaw` cresce para a direita, `state.pitch` positivo olha para cima) sem inversão extra. A convenção foi **derivada da matriz + relato do dono**, não medida com instrumento (ver `research.md`).

### Decisões

- **D-10.1 — Sinais corrigidos:** inverter os dois sinais e corrigir o comentário do código e os testes que fixavam o sinal antigo (com matrizes `Ry`/`Rx` conhecidas).
- **D-10.2 — Overlay do rosto:** desenhar os pontos do rosto de forma **transitória** no mesmo overlay espelhado das mãos (esboço esparso: contorno, olhos, sobrancelhas, nariz, boca) e um eixo curto do nariz na direção do olhar, em cor discreta do design. `FaceTracker` passa a devolver `FaceReading { orientation, landmarks }`. Privacidade preservada: os pontos nunca são gravados, persistidos nem logados.
- **D-10.3 — Seletor "Direção do olhar":** **Automática** (câmera segue o movimento, setas ajustam) e **Rosto** (a cabeça soma o desvio). Padrão **Rosto**; escolha só em memória de sessão (sem localStorage). Em Automática o detector de rosto não é carregado (é liberado se estava) e o olhar da cabeça é descartado sem salto; "Centralizar" só no modo Rosto. O estado vive no `SwingController` (`setLookMode`, snapshot `lookMode`).
- **D-10.4 — Legenda de teclado:** painel "Teclado" sempre visível, uma linha por grupo, com `<kbd>`; a lista é **dados exportados** (`KEYS` em `apps/web/src/swing/guide.ts`) para outro PR acrescentar linhas sem conflito de layout.

Incorporadas em FR-011..FR-014. Gate 3 **aprovado** pelo maintainer em 2026-10-30, sem medições.

## CQ-012 — Trava da direção do olhar por gesto de mão (issue #106)

Emenda registrada depois que o dono testou o modo Rosto (sessão de 2026-10-31).

### O que o dono viu

Para olhar para o lado ele vira a cabeça e deixa de ver o monitor, que é fixo. Ao voltar o rosto para a tela, o desvio some e a câmera volta. Ele não consegue manter a direção escolhida e olhar a tela.

### Alternativas consideradas

- **Joystick de taxa** (a câmera gira enquanto a cabeça está virada): rejeitada, porque exige manter a cabeça virada para continuar girando.
- **Trava por tempo parado** (dwell): rejeitada, porque pode disparar sem querer.
- **Tecla de embreagem**: rejeitada, porque as mãos já estão ocupadas com a teia.
- **Direção pela íris**: rejeitada, por precisão baixa e sem medição.
- **Gesto de mão** (a proposta do dono): adotada. A trava é sempre intencional e não depende de tecla.

### Decisões

- **D-12.1 — Gesto:** mão aberta com o dedão para baixo, qualquer mão (proposta do dono, com uma foto da pose). Reconhecido pela geometria dos landmarks (FR-015), sem depender do rótulo do reconhecedor.
- **D-12.2 — Estados:** seguindo, travada (gesto valendo) e aguardando o centro (gesto desfeito). Sem o gesto, nada trava. Com o gesto, a direção fica fixa. Ao tirar a mão, a direção continua e a cabeça só volta a girar a câmera depois do rosto centralizar (FR-017).
- **D-12.3 — Direção travada é relativa:** vira a nova frente e o desvio da cabeça soma a ela. O dono confirmou: "depois de travar e centralizar o rosto de volta, a câmera volta a ter o mesmo comportamento de permitir esquerda/direita". Não é fixa no mundo.
- **D-12.4 — Momento da trava:** usa a direção de `lookbackMs` antes do gesto ser reconhecido, porque levar a mão ao gesto mexe a cabeça (FR-017).
- **D-12.5 — Conflito com a palma aberta:** a pose do dedão para baixo não conta como palma aberta nem como pose de teia; não agarra nem derruba o agarre (FR-015). A mão que trava não segura teia (R-06).
- **D-12.6 — Saída de segurança:** o gesto só vale enquanto dura; "Centralizar" encerra a trava e zera a direção travada. Não há estado que prenda o olhar: travada acaba com o gesto, e aguardando o centro acaba ao centralizar ou em "Centralizar". A tecla Espaço NÃO é saída (é a teia do centro); a issue #106 foi corrigida.
- **D-12.7 — Estabilização:** sem rosto fora da trava, mantém o desvio por `faceLostHoldMs` antes de voltar (FR-018). Com a trava, perder o rosto não muda nada.

Incorporadas em FR-015..FR-020 e US-006.

## Gate 1 — Clarificação aprovada (emenda CQ-012)

- **Status:** aprovado
- **Data:** 2026-10-31
- **Aprovador:** Wezer (@wezercarvalho)
- **Referência:** mensagens do maintainer na sessão de 2026-10-31: a proposta do gesto ("E se toda vez que eu fizer assim com a mão... travarmos a mira") e "Não entendi tuas dúvidas, já esclareci que depois de travar e centralizar o rosto de volta, a câmera volta a ter o mesmo comportamento de permitir esquerda/direita".
- **Artefatos aprovados:** a emenda CQ-012 de `spec.md` e `clarification.md`.
- **Observações:** a aprovação é inferida dessas mensagens, que pedem a mecânica e respondem à única dúvida de comportamento. Os valores (200 ms, 150 ms, 400 ms, 300 ms, 1500 ms, 0,9 da palma) são de jogo e não foram medidos.
