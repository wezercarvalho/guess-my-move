# Plano — 2026-10-21-backend-api-validation-centralize-zod-nestjs12

## Resumo técnico

Centralizar a validação em schemas Zod no núcleo e propagá-los para fora: os schemas de requisição, resposta, erro e carta viram fonte única com tipos derivados; o servidor aplica o schema de requisição por um pipe que estende o `StandardSchemaValidationPipe` mais os limites configuráveis por função pura, usa um parser JSON dimensionado por `MAX_TOTAL_BYTES` e valida o ambiente por schema no `@nestjs/config`; o cliente web valida resposta e erro pelos mesmos schemas. `class-validator`, `class-transformer` e o parser manual saem. A API pública da rota e das cartas é preservada.

## Contexto técnico

- **Runtime/versões:** NestJS 12 (`StandardSchemaValidationPipe`, `validationSchema`), Zod (`zod/mini` no núcleo e Zod clássico no servidor para o ambiente). Versões exatas reconfirmadas na implementação.
- **Dependências:** adiciona `zod` como dependência única de runtime do núcleo; remove `class-validator` e `class-transformer`.
- **Provedores externos:** nenhum.
- **Persistência:** nenhuma; `packages/core` permanece sem I/O.
- **Testes:** gates oficiais `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`; testes de schema, pipe, ambiente e HTTP e2e.
- **Restrições:** fronteira de informação (dado da carta fora do corpo da requisição); API pública inalterada (NFR-003); bundle enxuto (NFR-001); núcleo sem I/O (NFR-002).

## Constitution Check — pré-design

| Princípio/gate                     | Resultado | Evidência ou exceção                                                       |
| ---------------------------------- | --------- | -------------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | `spec.md` em `clarified` com Gate 1 aprovado antes deste plano.            |
| II. Uma fonte vigente              | PASS      | Comportamento em `spec.md`; `clarification.md` como log auditável.         |
| III. Rastreabilidade               | PASS      | FR/NFR/SC com IDs estáveis; mapeamento requisito → abordagem → evidência.  |
| IV. Test-first e incremental       | PASS      | Schemas, pipe, ambiente e HTTP validados por testes antes de concluir.     |
| V. Evidência honesta               | PASS      | Medição real do bundle registrada; sem acerto otimista.                    |
| VIII. Clareza e operação segura    | PASS      | UTF-8/português; sem operação destrutiva; fronteira de informação mantida. |

A seção contém `PASS` em todas as linhas e nenhum `FAIL`.

## Pesquisa e decisões

- `research.md` — não necessária: os requisitos vêm dos critérios da issue #44 e as decisões estão em `clarification.md` (biblioteca de schema, duas APIs do Zod, pipe estendido, limites fora do schema, objetos estritos, opcionais exatos).

## Estrutura afetada

```text
packages/core/src/schemas/        # builders.ts, card.ts, guess.ts, index.ts (fonte única)
packages/core/src/card/schema.ts  # validateCard/isCard/parseCard sobre o schema
apps/server/src/guess/            # guess-request.pipe.ts, limits.ts, guess.controller.ts
apps/server/src/app.setup.ts      # configureHttp compartilhado (parser + filtro)
apps/server/src/main.ts           # bodyParser:false + configureHttp
apps/server/src/config/environment.ts  # schema de ambiente (Zod) para validationSchema
apps/web/src/guess/guessClient.ts # valida resposta/erro pelos schemas do core
packages/benchmark/src/           # chamadores ajustados a tipos mais estritos
```

## Design

### Componentes e responsabilidades

- **Schemas do núcleo:** `capturedFrameSchema`, `guessRequestSchema`, `guessResponseSchema`, `apiErrorSchema`/`apiErrorCodeSchema` e `cardSchema` (com `public`/`evaluation`), em `zod/mini` e estritos; tipos por `z.infer`.
- **`GuessRequestPipe`:** estende o `StandardSchemaValidationPipe`, valida estrutura com `guessRequestSchema` e aplica `checkGuessLimits` com os limites da configuração; falhas viram `ApiException` estável.
- **`checkGuessLimits` + `guessLimitsFromConfig`:** função pura que mapeia frames/bytes para 413 e `rejectedGuesses` para 400, lendo limites da configuração.
- **`configureHttp`:** registra o filtro de erro e o parser JSON com `jsonBodyLimitBytes(MAX_TOTAL_BYTES)`, compartilhado por `main.ts` e pelos testes.
- **Schema de ambiente:** Zod clássico (coerção/`default`/`preprocess`) passado ao `validationSchema`; variável vazia = ausente; inválido derruba o boot.
- **Cliente web:** valida 200 com `guessResponseSchema` e erro com `apiErrorSchema`; fora do contrato vira `invalid_model_response`.

### Contratos e dados

- Corpo de `POST /api/guess`: `{ frames, rejectedGuesses? }`, estrito, sem nenhum dado da carta.
- Erros estáveis: `invalid_payload` 400 (estrutura/MIME/base64/ordem/campo extra/`rejectedGuesses`) e `payload_too_large` 413 (frames/bytes); mensagens sem eco do conteúdo.
- Resposta 200: `{ guess, insufficientEvidence?, durationMs, providerId }` — inalterada para clientes válidos.

### Fluxo

Requisição → parser JSON dimensionado (413 se grande demais) → `GuessRequestPipe` (schema → limites) → handler → `GuessResponse`. Erro em qualquer etapa → `ApiExceptionFilter` → corpo `ApiError` estável. No boot, o `validationSchema` valida o ambiente antes de servir.

## Mapeamento de requisitos

| Requisito | Abordagem                                               | Evidência planejada                      |
| --------- | ------------------------------------------------------- | ---------------------------------------- |
| FR-001    | Schemas no núcleo como fonte única, tipos por `z.infer` | Testes de schema (SC-001)                |
| FR-002    | `zod/mini` + objetos estritos                           | Campo extra = `invalid_payload` (SC-003) |
| FR-003    | `GuessRequestPipe` + `checkGuessLimits`                 | Testes de pipe (SC-001)                  |
| FR-004    | Parser por `MAX_TOTAL_BYTES` via `configureHttp`        | Corpo ~200 kB = 200 (SC-002)             |
| FR-005    | Schema de ambiente no `validationSchema`                | `PORT=abc` derruba o boot (SC-004)       |
| FR-006    | Cliente valida resposta/erro pelos schemas              | Teste do cliente web (SC-001)            |
| FR-007    | Remover class-validator/transformer e `payload.ts`      | Lockfile sem as libs (SC-005)            |

## Estratégia test-first

1. Escrever os testes de schema (frame/requisição/resposta/erro/carta) esperando aceitação do válido e recusa do inválido e confirmar a falha inicial;
2. Implementar os schemas no núcleo e derivar os tipos;
3. Confirmar os testes de schema passando;
4. Integrar o pipe, o parser e o schema de ambiente no servidor e validar por testes de pipe, ambiente e HTTP e2e;
5. Demonstrar os critérios (SC-002..SC-005) e medir o bundle (NFR-001);
6. Remover `class-validator`/`class-transformer`/`payload.ts` e refatorar mantendo os gates verdes.

## Riscos, rollout e rollback

| Risco                                                 | Mitigação                                          | Rollback/contingência                      |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Tipos mais estritos quebram chamadores (benchmark)    | Ajustar os chamadores junto com a mudança de tipos | Reverter a derivação de tipos no pacote    |
| Crescimento do bundle do navegador                    | Zod Mini e medição registrada (+6,15 kB)           | Rejeitar Zod clássico no núcleo            |
| Duas APIs do Zod no mesmo pacote confundem manutenção | Registrar em `clarification.md` o uso por camada   | Padronizar uma API caso o conflito apareça |

## Constitution Check — pós-design

| Princípio/gate                     | Resultado | Evidência ou exceção                                              |
| ---------------------------------- | --------- | ----------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | Design converge com `spec.md`; nenhuma decisão nova fora da spec. |
| II. Uma fonte vigente              | PASS      | Abordagem referencia FR por ID; sem spec concorrente.             |
| III. Rastreabilidade               | PASS      | Todo FR tem abordagem e evidência na tabela.                      |
| IV. Test-first e incremental       | PASS      | Testes de schema/pipe/ambiente/HTTP antes da conclusão.           |
| V. Evidência honesta               | PASS      | Medição real do bundle; sem promessa sem evidência.               |
| VIII. Clareza e operação segura    | PASS      | Fronteira de informação preservada; sem operação destrutiva.      |

## Complexidade e desvios

| Necessidade                        | Impacto | Alternativa mais simples rejeitada  | Aprovação                    |
| ---------------------------------- | ------- | ----------------------------------- | ---------------------------- |
| Duas APIs do Zod (mini + clássico) | baixo   | Uma única API para todas as camadas | Registrada em CQ-002; Gate 2 |
