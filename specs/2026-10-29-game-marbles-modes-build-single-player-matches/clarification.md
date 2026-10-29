# Clarificação — 2026-10-29-game-marbles-modes-build-single-player-matches

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Status após o Gate 1:** `implementing`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-29`

Esta clarificação registra as decisões do maintainer na conversa de planejamento de 2026-10-29 (como fatos) e o resultado das questões de clarificação. Os Gates 1 e 2 foram **aprovados antecipadamente** pelo maintainer wezercarvalho em 2026-10-29 ("considere os gates 1 e 2 aprovados"), que fixou as quatro decisões de produto abaixo. As questões CQ-001 a CQ-006 estão **RESOLVIDAS**. A spec avança para o planejamento técnico (`plan.md` e `tasks.md`) e para a implementação test-first; a validação (`validation.md`) e o Gate 3 seguem ao fim, depois do código e da verificação, com o risco aceito de não haver teste ao vivo com a mão real.

As issues #86 a #93 do repositório são a fonte de verdade das regras e dos números e já foram revisadas; a spec as espelha exatamente, sem inventar números novos. Nenhuma contradição entre as issues foi encontrada na revisão desta clarificação; se uma surgir na implementação, ela é registrada aqui como questão aberta e a leitura mais conservadora é adotada.

### Decisões já tomadas pelo maintainer (2026-10-29, usadas como fatos)

- **D-01 — Adversário:** o jogo é **singleplayer** com dois adversários possíveis por partida: **contra a meta** (solo, um competidor, sem vez) e **contra o bot** (dois competidores com vez alternada). Incorporada no Resumo, em US-002, US-003, FR-005, FR-006.
- **D-02 — Modos:** os três modos desta entrega são **Bete, Triângulo e Cova**. Incorporada em Objetivos, US-004, US-005, US-006, FR-008, FR-009, FR-010.
- **D-03 — Gates antecipados:** os **Gates 1 e 2 estão aprovados antecipadamente**; a implementação test-first está autorizada e o Gate 3 fica para o fim. Incorporada neste documento (Gate 1) e em `tasks.md` (Gate 2).
- **D-04 — Entrega única:** tudo é entregue em **uma PR única** (controlador de mira, motor, bot, os três modos, a tela e a ajuda), na ordem de implementação das issues #86 a #93. Incorporada em `plan.md` (rollout) e `tasks.md` (sequência).
- **D-05 — Foco singleplayer:** o foco é o **jogador único**; **multiplayer, rede e câmeras separadas ficam para depois**. Incorporada em Fora de escopo e em US-007/US-008.

## Log de decisões

### CQ-001 — Adversário: solo contra a meta e contra o bot

- **Data:** `2026-10-29`
- **Impacto:** crítico
- **Pergunta:** O oponente é o jogador contra uma meta de desempenho, contra um bot, ou ambos?
- **Decisão:** **RESOLVIDA** (D-01) — aprovada pelo maintainer em 2026-10-29. Ambos: cada modo é jogável **contra a meta** (solo, sem vez) e **contra o bot** (dois competidores com vez), escolhido por partida.
- **Razão:** a issue #87 define "adversário = a meta (solo) ou o bot" e os critérios de aceite de #89, #90 e #91 cobrem os dois casos; entregar só um deixaria metade das regras das issues sem cumprir.
- **Alternativas rejeitadas:** só contra a meta (não cumpre o bot das issues e deixa o #88 sem uso); só contra o bot (não cumpre o treino solo e a derrota por meta).
- **Seções atualizadas em `spec.md`:** US-002, US-003, FR-005, FR-006, FR-008, FR-009, FR-010.

### CQ-002 — Quais modos entram nesta entrega

- **Data:** `2026-10-29`
- **Impacto:** crítico
- **Pergunta:** Quais modos de jogo das bolinhas esta iniciativa entrega?
- **Decisão:** **RESOLVIDA** (D-02) — aprovada pelo maintainer em 2026-10-29. **Bete** (migração do atual, #89), **Triângulo** (#90) e **Cova** (#91).
- **Razão:** são os três modos cujas issues já estão revisadas, com regras e números fechados; cada um exercita uma parte distinta do contrato de modo (vez alternada, vez mantida por captura, geometria de cova).
- **Alternativas rejeitadas:** outras formações (círculo cheio, quadrado) ou um quarto modo (fora de escopo, sem issue revisada).
- **Seções atualizadas em `spec.md`:** Objetivos, US-004, US-005, US-006, FR-008, FR-009, FR-010, Fora de escopo.

### CQ-003 — Gates 1 e 2 aprovados antecipadamente

- **Data:** `2026-10-29`
- **Impacto:** alto
- **Pergunta:** A implementação pode começar antes da aprovação formal fase a fase?
- **Decisão:** **RESOLVIDA** (D-03) — aprovada pelo maintainer em 2026-10-29. Os **Gates 1 e 2 estão aprovados antecipadamente**; a spec vai para `implementing` e a implementação test-first está autorizada. O Gate 3 fica para o fim.
- **Razão:** as regras e os números vêm das issues já revisadas; o maintainer conduziu o planejamento e autorizou os dois gates de uma vez para não serializar a entrega única (D-04).
- **Alternativas rejeitadas:** aprovar fase a fase (atrasa a entrega única sem reduzir risco, já que as regras estão fixadas nas issues).
- **Seções atualizadas em `spec.md`:** status `implementing`; registro no Gate 1 abaixo e no Gate 2 de `tasks.md`.

### CQ-004 — Uma PR única com tudo

- **Data:** `2026-10-29`
- **Impacto:** médio
- **Pergunta:** A iniciativa vira várias PRs (uma por issue) ou uma PR única?
- **Decisão:** **RESOLVIDA** (D-04) — aprovada pelo maintainer em 2026-10-29. **Uma PR única** com o controlador de mira, o motor, o bot, os três modos, a tela e a ajuda, na ordem #86 → #87 → #88 → #89 → #92 (com o Bete) → #90 → #91 → #93.
- **Razão:** as issues são fortemente acopladas pelo contrato de modo (#87) e pela fonte do tiro; dividir a entrega multiplicaria a reconciliação do contrato a cada PR. A ordem mantém cada incremento test-first e demonstrável.
- **Alternativas rejeitadas:** uma PR por issue (muito acoplamento no contrato; retrabalho de integração a cada corte).
- **Seções atualizadas em `spec.md`:** não altera comportamento; reflete em `plan.md` (rollout) e `tasks.md` (sequência).

### CQ-005 — Foco singleplayer; multiplayer e câmeras separadas depois

- **Data:** `2026-10-29`
- **Impacto:** alto
- **Pergunta:** Multiplayer e câmeras separadas entram agora ou ficam para depois?
- **Decisão:** **RESOLVIDA** (D-05) — aprovada pelo maintainer em 2026-10-29. O foco é **singleplayer**; **multiplayer, rede e câmeras separadas ficam para uma discussão posterior**. A interface de **fonte do tiro** (#87) nasce aberta a um segundo jogador no futuro, sem implementá-lo.
- **Razão:** as issues #87 e #92 marcam multiplayer e câmeras separadas como decisões pendentes que não bloqueiam; a fonte do tiro deixa a extensão possível sem custo agora.
- **Alternativas rejeitadas:** já desenhar o multiplayer (escopo e risco grandes, decisão não tomada); amarrar o motor a um único humano (fecharia a porta ao segundo jogador).
- **Seções atualizadas em `spec.md`:** Fora de escopo, FR-006, US-007, US-008, nota de extensibilidade em Hipóteses.

### CQ-006 — Simulação do bot em vez de fórmula contínua

- **Data:** `2026-10-29`
- **Impacto:** alto
- **Pergunta:** O bot calcula a velocidade do tiro pela fórmula contínua ou por simulação?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-29, conforme a issue #88. A velocidade para parar num ponto é encontrada por **busca com `stepBodies`** (simulação), não pela fórmula contínua.
- **Razão:** `moveBody` desacelera linearmente e **zera a velocidade abaixo de `stopSpeed` (8 unid/s)** no passo de 1/120 s; a fórmula contínua `v = √(2·atrito·distância)` ignora esse degrau e não é exata, o que faria o bot errar sistematicamente perto do alvo.
- **Alternativas rejeitadas:** fórmula contínua (imprecisa por causa do `stopSpeed`); tabela pré-calculada (frágil a mudanças de física e ao raio dos corpos).
- **Seções atualizadas em `spec.md`:** FR-007, H-01, SC-003.

## Hipóteses remanescentes

- **H-02 (faixa de acerto do bot):** os parâmetros de `DEFAULT_BOT` são palpites; a faixa de 30% a 60% é proteção de regressão, não equilíbrio medido. Validação: teste de 1000 tiros com sementes; calibração real com uso.
- **H-03 (velocidade de entrada da cova):** 120 unid/s é palpite de jogo, maior que `stopSpeed`; pode ser difícil para a mão. Validação: uso real e ajuste em configuração.
- **H-04 (solver de colisão com seis bolinhas):** uma passada de colisão por passo pode estressar a formação do triângulo. Validação: folga inicial e teste de estabilidade sem tiro.
- Nenhuma hipótese remanescente é crítica a ponto de bloquear o planejamento; todas têm forma de validação e valores em configuração.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-29`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** conversa de planejamento com o maintainer na sessão de 2026-10-29 ("considere os gates 1 e 2 aprovados"), fixando as decisões D-01 a D-05; issues #86 a #93 do repositório como fonte das regras e dos números.
- **Observações:** aprovação antecipada no chat, junto com o Gate 2 (registrado em `tasks.md`). Riscos aceitos: valores de jogo a calibrar com uso real, faixa de acerto do bot como proteção de regressão (não equilíbrio), e ausência de teste ao vivo com a mão real nesta entrega. Nenhuma contradição entre as issues foi encontrada.
