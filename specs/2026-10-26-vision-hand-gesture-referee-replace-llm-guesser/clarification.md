# Clarificação — 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-26`

As decisões CQ-001 a CQ-008 foram dadas pelo maintainer na sessão do dashboard em 2026-10-26, em resposta às oito perguntas do agente. CQ-009 e CQ-010 são decisões técnicas do agente, tomadas a partir do spike e revisáveis.

## Log de decisões

### CQ-001 — Mecânica do jogo

- **Data:** `2026-10-26`
- **Impacto:** crítico
- **Pergunta:** O app passa a verificar o gesto da carta em vez de a IA adivinhá-lo?
- **Decisão:** Sim. O árbitro é a visão computacional, apenas como auxílio de verificação. Uma IA jogadora futura não conhecerá a carta.
- **Razão:** O adivinhador por LLM não escala e tem custo alto por tentativa; a verificação local é determinística e gratuita por tentativa.
- **Alternativas rejeitadas:** Manter o LLM como árbitro principal (custo e latência); híbrido LLM mais visão (complexidade sem ganho comprovado).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, Fora de escopo, FR-001, FR-005.

### CQ-002 — Feedback na tela durante os testes

- **Data:** `2026-10-26`
- **Impacto:** médio
- **Pergunta:** Mostrar o que o detector lê ou só o veredito?
- **Decisão:** Mostrar o esqueleto da mão e os números do avaliador, para facilitar o ajuste.
- **Razão:** O ajuste dos limiares depende de ver o que o modelo enxerga.
- **Alternativas rejeitadas:** Só o veredito (sem como diagnosticar falhas).
- **Seções atualizadas em `spec.md`:** US-003, FR-008.

### CQ-003 — Início da rodada

- **Data:** `2026-10-26`
- **Impacto:** médio
- **Pergunta:** A rodada começa por botão ou por detecção automática?
- **Decisão:** Botão **Começar**; a detecção automática do início fica para depois.
- **Razão:** Simplifica a primeira versão e evita falsos inícios.
- **Alternativas rejeitadas:** Detecção contínua sem botão (mais falsos positivos e sem janela clara de teste).
- **Seções atualizadas em `spec.md`:** US-001, FR-005, FR-006, Fora de escopo.

### CQ-004 — Metas de aceite

- **Data:** `2026-10-26`
- **Impacto:** médio
- **Pergunta:** Quais metas valem?
- **Decisão:** O maintainer respondeu "vamos manter essas e ajustamos conforme necessário". O agente registrou as metas vigentes do projeto (recall >= 80%, falsos positivos <= 10%, mediana até o veredito <= 8 s, p95 <= 15 s) como referência ajustável; o custo por tentativa deixa de ser métrica.
- **Razão:** Mantém a comparabilidade com as specs anteriores e evita metas novas sem medição.
- **Alternativas rejeitadas:** Metas mais rígidas propostas pelo agente (90%, 5%, 3 s), sem base de medição.
- **Seções atualizadas em `spec.md`:** SC-002, SC-003.

### CQ-005 — Alvo de navegador

- **Data:** `2026-10-26`
- **Impacto:** médio
- **Pergunta:** Quais dispositivos e navegadores entram no escopo?
- **Decisão:** Chrome desktop apenas.
- **Razão:** Reduz a matriz de teste; celular e outros navegadores ficam para depois.
- **Alternativas rejeitadas:** Incluir celular na primeira entrega.
- **Seções atualizadas em `spec.md`:** Fora de escopo, NFR-004.

### CQ-006 — Formato do critério da carta

- **Data:** `2026-10-26`
- **Impacto:** alto
- **Pergunta:** O critério da carta é um catálogo de gestos ou um schema mínimo?
- **Decisão:** Schema mínimo, com o único critério necessário ao Acenar.
- **Razão:** YAGNI; novas cartas ampliam o schema quando existirem.
- **Alternativas rejeitadas:** Catálogo de regras genéricas; texto livre.
- **Seções atualizadas em `spec.md`:** FR-001, FR-002.

### CQ-007 — Destino do código do LLM

- **Data:** `2026-10-26`
- **Impacto:** alto
- **Pergunta:** Mantém o código do LLM para um modo futuro ou remove?
- **Decisão:** Remover. As specs substituídas e o histórico do Git servem de referência para uma futura IA jogadora.
- **Razão:** O repositório não mantém código sem uso.
- **Alternativas rejeitadas:** Manter servidor, provedores e árbitro semântico "por precaução".
- **Seções atualizadas em `spec.md`:** FR-011, SC-005, US-004.

### CQ-008 — PR do prompt do Codex

- **Data:** `2026-10-26`
- **Impacto:** baixo
- **Pergunta:** A PR do prompt e aliases do Codex segue?
- **Decisão:** Fechada sem merge, junto com a issue correspondente.
- **Razão:** O código que ela alteraria é removido por esta spec.
- **Alternativas rejeitadas:** Mesclar para depois remover.
- **Seções atualizadas em `spec.md`:** Resumo.

### CQ-009 — Detector e sinal do gesto

- **Data:** `2026-10-26`
- **Impacto:** alto
- **Pergunta:** Qual detector e qual sinal reconhecem o aceno?
- **Decisão:** Hand Landmarker (uma mão) e o ângulo do vetor pulso até o início do dedo médio; critério por inversões de direção com histerese em uma janela de 2,5 s.
- **Razão:** No spike, a posição do pulso quase não oscila no aceno e o modelo de corpo inventa pulsos fora do quadro; o ângulo da mão separou os acenos dos confusores nos 12 clipes.
- **Alternativas rejeitadas:** Pose Landmarker com posição do pulso (falso positivo e não reconheceu o aceno); Holistic (peso sem ganho comprovado); modelo temporal treinado (fora de escopo).
- **Seções atualizadas em `spec.md`:** FR-002, FR-003, FR-004, FR-007, H-01 a H-04.

### CQ-010 — Limite de tempo da rodada

- **Data:** `2026-10-26`
- **Impacto:** baixo
- **Pergunta:** Qual o limite da rodada?
- **Decisão:** 10 s como valor inicial, exposto como configuração do motor e ajustável conforme o teste.
- **Razão:** No spike, os acenos foram reconhecidos de 0,9 a 1,7 s após a mão aparecer, exceto o aceno lento, que levou cerca de 6 s.
- **Alternativas rejeitadas:** Sem limite (a rodada nunca termina); 5 s (corta o aceno lento).
- **Seções atualizadas em `spec.md`:** FR-005, Edge cases.

## Hipóteses remanescentes

- Generalização para outras pessoas, câmeras e iluminação é desconhecida (H-01); mitigada pelo teste do maintainer e pelo painel de depuração.
- Licença do arquivo do modelo ainda não verificada na fonte (H-05); mitigada por não versioná-lo.
- A leitura do item 4 do maintainer ("manter essas") como as metas vigentes é uma interpretação; se a intenção era outra, SC-002 e SC-003 são ajustados.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-26`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-26 ("os gates podem ser considerados já aprovados") e issue 63 do repositório.
- **Observações:** Aprovação antecipada dos Gates 1 e 2 para esta spec, dada antes da redação dos documentos. O Gate 3 continua dependendo do teste manual do maintainer.
