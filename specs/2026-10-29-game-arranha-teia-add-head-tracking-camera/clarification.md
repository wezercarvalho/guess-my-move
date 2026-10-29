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
