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
- **Observações:** Aprovação antecipada; o Gate 3 (convergência validada) fica pendente do teste ao vivo do maintainer. Não se afirma desempenho (fps) nem precisão da pose da cabeça sem medição registrada.

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

Incorporadas em FR-011..FR-014. Gate 3 segue **pendente** do teste ao vivo do dono.
