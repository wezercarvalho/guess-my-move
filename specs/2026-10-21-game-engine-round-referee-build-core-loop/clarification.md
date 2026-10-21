# Clarificação — 2026-10-21-game-engine-round-referee-build-core-loop

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-21`

As decisões abaixo foram **definidas em 2026-10-21 pelo orquestrador sob aprovação geral do maintainer e são revisáveis**, com base nos critérios das issues #11, #12, #13, #14 e #15.

## Log de decisões

### CQ-001 — Fronteira de informação da carta

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Como separar o que o jogador vê do que o árbitro/motor usa?
- **Decisão:** `Card = { id, locale, public, evaluation }`; `public` (palavra, dica, sugestão, dificuldade) é visível, `evaluation` (canônico, aliases, insuficientes, critérios visuais futuros) nunca sai do servidor/motor nem entra em `rejectedGuesses`.
- **Razão:** Constituição VI (fronteira de informação) e a seção 5 do `PROJECT_SPEC.md`.
- **Alternativas rejeitadas:** Carta única sem separação (vaza a resposta); mover `evaluation` para banco agora (fora de escopo, sem persistência na PoC).
- **Seções atualizadas em `spec.md`:** FR-001, FR-003, US-001.

### CQ-002 — Máquina de estados e exceções da rodada

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Quais estados e exceções a rodada precisa?
- **Decisão:** `idle → card_revealed → camera_ready → capturing → guessing → judging → (correct | retry | finished)` com exceções `camera_denied`, `request_timeout`, `provider_error`, `invalid_model_response`, `user_cancelled`; limites configuráveis de tentativas e tempo; histórico só em memória.
- **Razão:** Critérios da issue #12 e a seção 6 do `PROJECT_SPEC.md`; um erro de provedor não pode marcar acerto.
- **Alternativas rejeitadas:** Estados implícitos por flags (difícil de testar); persistir histórico (fora de escopo).
- **Seções atualizadas em `spec.md`:** FR-004, FR-005, FR-006, US-002.

### CQ-003 — Política do árbitro semântico determinístico

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Como o árbitro decide sem confirmação manual e sem analisar a webcam?
- **Decisão:** Normalização (minúsculas, acentos, pontuação, variantes triviais) e comparação por equivalência de expressão com canônico e aliases, **sem substring**; devolve `{ isCorrect, method, matchedAnswer? }`; palpites insuficientes rejeitados; dúvida material vira `undetermined`.
- **Razão:** Critérios da issue #13; a acurácia visual é medida sem o árbitro de LLM (separar visão de semântica).
- **Alternativas rejeitadas:** Correspondência por substring (aceita falsos positivos como "levantar a mão"); confirmação manual como fonte de verdade (proibida pelo produto).
- **Seções atualizadas em `spec.md`:** FR-007, FR-008, FR-009, US-003.

### CQ-004 — Fallback opcional por LLM

- **Data:** `2026-10-21`
- **Impacto:** médio
- **Pergunta:** Como prever o fallback por LLM sem torná-lo obrigatório?
- **Decisão:** Interface **injetável**, desligada por padrão; retorna resposta estruturada; falha ou dúvida material resulta em `undetermined`; registra método e motivo resumido. A execução com provedor real é trabalho futuro.
- **Razão:** Critérios da issue #14 e constituição V (evidência honesta, falha segura).
- **Alternativas rejeitadas:** Fallback ligado por padrão (custo e não determinismo na primeira execução); acerto otimista em caso de erro do modelo (viola falha segura).
- **Seções atualizadas em `spec.md`:** FR-010, FR-011, NFR-004, US-003.

### CQ-005 — Histórico de palpites rejeitados e documentação de execução

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** O que vai em `rejectedGuesses` e como o projeto fica executável por terceiros?
- **Decisão:** `rejectedGuesses` contém **apenas palpites do próprio modelo**, nunca dados da carta; é mantido em memória e descartado ao fim da rodada. O README documenta instalação, modos mock e real, testes e privacidade.
- **Razão:** Critérios da issue #15; constituição VI e II (sem vazamento, sem persistência indevida).
- **Alternativas rejeitadas:** Incluir aliases rejeitados da carta em `rejectedGuesses` (vaza avaliação); persistir histórico entre rodadas (fora de escopo).
- **Seções atualizadas em `spec.md`:** FR-012, FR-013, NFR-003, US-004.

## Hipóteses remanescentes

- **Não crítica:** o conjunto de "variantes triviais" de normalização é refinado com os testes do árbitro; começa conservador para evitar falsos positivos.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** instrução explícita do maintainer na sessão de 2026-10-21 ("considere todos os gates aprovados" para as issues existentes); critérios das issues #11–#15 como fonte dos requisitos.
- **Observações:** a execução real do fallback por LLM e qualquer persistência ficam fora desta spec (trabalho futuro).
