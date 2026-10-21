# Plano — 2026-10-21-game-engine-round-referee-build-core-loop

## Resumo técnico

Implementar o núcleo puro do jogo em `packages/core` (TypeScript estrito, ESM, sem framework e sem I/O): o contrato da carta com fronteira entre `public` e `evaluation`, a máquina de estados da rodada com limites de tentativas, o árbitro semântico determinístico com interface injetável de fallback por LLM e o histórico de palpites rejeitados exposto como `rejectedGuesses`. Nenhum componente faz rede, disco ou persistência; a captura e o adivinhador são fornecidos de fora.

## Contexto técnico

- **Runtime/versões:** Node >= 24.18, TypeScript 7.0.2 estrito, ESM. Testes com Vitest 5.0.5. Versões exatas, reconfirmadas na implementação.
- **Dependências:** nenhuma nova de runtime no `packages/core` (TypeScript puro). Fallback por LLM é uma interface injetável, sem acoplar um provedor.
- **Provedores externos:** nenhum no núcleo; o fallback real é trabalho futuro.
- **Persistência:** nenhuma. Histórico de rodada e `rejectedGuesses` só em memória.
- **Testes:** Vitest no pacote; determinismo verificável com o fallback desligado; teste de fronteira que falha se `evaluation` cruzar o adivinhador.
- **Restrições:** constituição VI (fronteira de informação), V (falha segura do árbitro), I e II (intenção e fonte única), NFR-001 (sem I/O).

## Constitution Check — pré-design

| Princípio/gate                       | Resultado | Evidência ou exceção                                                                     |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação   | PASS      | `spec.md` em `clarified` com Gate 1 aprovado antes deste plano.                          |
| II. Uma fonte vigente                | PASS      | Comportamento em `spec.md`; `clarification.md` como log auditável.                       |
| III. Rastreabilidade                 | PASS      | FR/NFR/SC com IDs estáveis; mapeamento requisito → abordagem → evidência abaixo.         |
| IV. Test-first e incremental         | PASS      | Árbitro, máquina de estados e carta começam por teste falhando.                          |
| V. Evidência honesta                 | PASS      | Árbitro determinístico; fallback falha para `undetermined`, nunca acerto inventado.      |
| VI. Fronteira de informação/segredos | PASS      | `evaluation` confinado; teste de fronteira; `rejectedGuesses` só com palpites do modelo. |
| VII. Neutralidade e contexto         | PASS      | Fallback por LLM é interface injetável, independente de provedor.                        |
| VIII. Clareza e operação segura      | PASS      | UTF-8/português; sem operação destrutiva; núcleo sem I/O.                                |

## Pesquisa e decisões

- `research.md` — não necessária: os requisitos vêm dos critérios das issues #11–#15 e do `PROJECT_SPEC.md` (seções 4–6); decisões em `clarification.md`.

## Estrutura afetada

```text
packages/core/src/
  card/            # Card, CardPublic, CardEvaluation, validação de schema, carta Acenar
  round/           # Máquina de estados da rodada, limites de tentativas, histórico em memória
  referee/         # Árbitro semântico determinístico + interface injetável de fallback por LLM
  guesser/         # Tipos de fronteira reexportados (GuesserInput/Result) e montagem de rejectedGuesses
```

## Design

### Componentes e responsabilidades

- **card:** define `Card = { id, locale, public: CardPublic, evaluation: CardEvaluation }`; valida por schema; expõe `public` e `evaluation` por acessos separados; impede `evaluation` de entrar em qualquer entrada do adivinhador.
- **round:** máquina de estados `idle → card_revealed → camera_ready → capturing → guessing → judging → (correct | retry | finished)` com exceções (`camera_denied`, `request_timeout`, `provider_error`, `invalid_model_response`, `user_cancelled`); limites de tentativas e tempo configuráveis; histórico de rejeitados em memória.
- **referee:** normaliza o texto e compara com canônico/aliases por equivalência de expressão (sem substring), devolvendo `{ isCorrect, method, matchedAnswer? }`; rejeita insuficientes; `undetermined` em dúvida; interface injetável de fallback por LLM desligada por padrão, com registro de método e motivo.
- **guesser:** monta `rejectedGuesses` apenas com palpites do próprio modelo, nunca com dados da carta.

### Contratos e dados

- `CardPublic = { word, hint, suggestion, difficulty? }`; `CardEvaluation = { canonicalAnswer, acceptedAliases, insufficientGuesses, visualCriteria }`.
- `RefereeResult = { isCorrect: boolean; method: 'canonical' | 'alias' | 'llm' | 'insufficient' | 'undetermined'; matchedAnswer?: string; reason?: string }`.
- `LlmRefereeFallback` (interface injetável, opcional).
- `rejectedGuesses: string[]` derivado só dos palpites do modelo na rodada corrente.

### Fluxo

Carta revelada → câmera/captura (externas) → palpite recebido → árbitro julga → correto encerra; incorreto com tentativas restantes volta a `retry` acumulando o palpite em `rejectedGuesses`; erro de provedor mantém o estado íntegro; limite atingido encerra sem acerto.

## Mapeamento de requisitos

| Requisito | Abordagem                                                | Evidência planejada              |
| --------- | -------------------------------------------------------- | -------------------------------- |
| FR-001    | `Card` com `public`/`evaluation` versionada              | Teste de schema + carta Acenar   |
| FR-002    | Validação de schema; adicionar carta sem alterar o motor | Teste de validação               |
| FR-003    | Impedir `evaluation` no caminho do adivinhador           | Teste de fronteira (SC-002)      |
| FR-004    | Máquina de estados explícita                             | Teste de transições (SC-003)     |
| FR-005    | Limites configuráveis de tentativas e tempo              | Teste de limites                 |
| FR-006    | Estados de exceção sem acerto indevido                   | Teste de erro de provedor        |
| FR-007    | Normalização do texto                                    | Teste de normalização            |
| FR-008    | Comparação por equivalência sem substring                | Teste de alias/canônico (SC-001) |
| FR-009    | Rejeição de insuficientes e `undetermined`               | Teste de insuficiente/dúvida     |
| FR-010    | Interface injetável de fallback desligada por padrão     | Teste de fallback off/on         |
| FR-011    | Registro de método e motivo                              | Teste de registro                |
| FR-012    | `rejectedGuesses` só com palpites do modelo              | Teste de histórico (SC-002)      |
| FR-013    | README de execução (mock/real, testes, privacidade)      | Revisão estrutural + SC-004      |

## Estratégia test-first

1. Teste falhando (fronteira da carta, árbitro, transições) e confirmação da falha com o comando oficial;
2. Implementação mínima no módulo alvo;
3. Teste direcionado passando;
4. Integração entre carta, árbitro e motor;
5. Demonstração dos critérios (SC-00x);
6. Refatoração mantendo os testes verdes. A documentação (FR-013) usa revisão estrutural, exceção prevista no guia de tarefas para documentação normativa.

## Riscos, rollout e rollback

| Risco                                            | Mitigação                                                | Rollback/contingência                     |
| ------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| Falso positivo por normalização agressiva        | Começar conservador; sem substring; casos de teste fixos | Reverter regra de normalização específica |
| Vazamento de `evaluation` em `rejectedGuesses`   | Teste de fronteira obrigatório                           | Falha segura: gate bloqueia               |
| Acerto inventado pelo fallback em erro do modelo | Política conservadora: erro vira `undetermined`          | Fallback desligado por padrão             |

## Constitution Check — pós-design

| Princípio/gate                       | Resultado | Evidência ou exceção                                                                       |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------ |
| I. Intenção antes da implementação   | PASS      | Design converge com `spec.md`; nenhuma decisão nova fora da spec.                          |
| II. Uma fonte vigente                | PASS      | Contratos referenciam FR por ID; sem spec concorrente.                                     |
| III. Rastreabilidade                 | PASS      | Todo FR tem abordagem e evidência na tabela.                                               |
| IV. Test-first e incremental         | PASS      | Sequência test-first por módulo; documentação com revisão estrutural (exceção registrada). |
| V. Evidência honesta                 | PASS      | Determinismo com fallback off; falha segura para `undetermined`.                           |
| VI. Fronteira de informação/segredos | PASS      | `evaluation` nunca no adivinhador nem em `rejectedGuesses`; teste de fronteira.            |
| VII. Neutralidade e contexto         | PASS      | Fallback injetável, provedor-independente.                                                 |
| VIII. Clareza e operação segura      | PASS      | Núcleo sem I/O; histórico descartado ao fim da rodada.                                     |

## Complexidade e desvios

| Necessidade                                  | Impacto | Alternativa mais simples rejeitada       | Aprovação                                    |
| -------------------------------------------- | ------- | ---------------------------------------- | -------------------------------------------- |
| Documentação (FR-013) via revisão estrutural | baixo   | Teste unitário de documentação normativa | Prevista no guia de tarefas; Gate 2 registra |
