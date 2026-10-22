---
id: 2026-10-21-backend-api-validation-centralize-zod-nestjs12
title: Validação centralizada da API com Zod e recursos nativos do NestJS 12
slug: backend-api-validation-centralize-zod-nestjs12
strategy: sdd
domain: backend
capability: api-validation
objective: centralize-zod-nestjs12
summary: Centralizar a validação do contrato da API em schemas Zod compartilhados entre servidor e front, aplicados via StandardSchemaValidationPipe e validationSchema do NestJS 12, removendo class-validator e os parsers manuais.
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - zod
    - standard schema
    - validação
    - class-validator
    - StandardSchemaValidationPipe
    - schemas compartilhados
    - contrato da API
code_paths:
    - packages/core/src/schemas/
    - packages/core/src/card/
    - apps/server/src/
    - apps/web/src/guess/
    - packages/benchmark/src/
related_specs:
    - 2026-10-20-vision-gesture-recognition-validate-waving-poc
    - 2026-10-21-game-engine-round-referee-build-core-loop
    - 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26
supersedes: []
branch: chore/44-zod-validation
constitution_version: 1.0.0
created_at: 2026-10-21
updated_at: 2026-10-21
---

# Validação centralizada da API com Zod e recursos nativos do NestJS 12

## Resumo

Unificar a validação do contrato da API em schemas Zod que vivem no núcleo e são compartilhados pelo servidor e pelo front, com os tipos TypeScript derivados deles. O servidor aplica os schemas pelo `StandardSchemaValidationPipe` do NestJS 12 na rota e pelo `validationSchema` do `@nestjs/config` no boot; o cliente web valida resposta e erro pelos mesmos schemas. A mudança remove `class-validator`, `class-transformer` e os parsers manuais, preservando a API pública da rota e das cartas.

## Problema

A validação está espalhada em três mecanismos sem fonte única: um parser manual do corpo em `apps/server/src/guess/payload.ts`, a validação manual da carta em `packages/core/src/card/schema.ts` e `class-validator` com `class-transformer` apenas para as variáveis de ambiente. Os tipos do contrato estão duplicados entre servidor e front, de modo que uma mudança precisa ser replicada e pode divergir. O NestJS 12 oferece o `StandardSchemaValidationPipe` e o `validationSchema` (ambos Standard Schema), mas não traz biblioteca de schema, então falta escolher e centralizar uma.

## Objetivos

- Tornar os schemas do núcleo a fonte única do contrato (requisição, resposta, erro e carta), com os tipos derivados por `z.infer`.
- Validar a rota `POST /api/guess` com um pipe que estende o `StandardSchemaValidationPipe`, separando falha estrutural de falha de limite configurável.
- Validar as variáveis de ambiente por schema no boot, falhando cedo com mensagem clara e preservando os padrões atuais.
- Validar no cliente web a resposta e o corpo de erro pelos mesmos schemas do núcleo.
- Remover `class-validator`, `class-transformer` e o parser manual, mantendo a API pública de cartas.

## Fora de escopo

- Autenticação do endpoint e limite por cliente.
- Geração de OpenAPI/Swagger a partir dos schemas.
- Persistência, TypeORM e migração de cartas para banco.
- Mudança nos provedores de adivinhação.

## Atores

- **Mantenedor:** altera o contrato em um único lugar e mantém servidor e front em sincronia.
- **Jogador (cliente web):** envia frames reais e recebe erros estáveis e previsíveis.
- **Operador:** sobe o servidor e precisa de falha clara de configuração no boot.

## Histórias de usuário

### US-001 — Alterar o contrato em um só lugar (P1)

Como mantenedor, quero definir o contrato da API uma única vez em schemas compartilhados para que servidor e front derivem os mesmos tipos sem duplicação.

**Teste independente:** alterar um schema do núcleo e confirmar que os tipos derivados no servidor e no front refletem a mudança sem edição manual de tipos.

**Critérios de aceitação:**

1. **Dado** um schema do núcleo, **quando** o tipo é consumido no servidor ou no front, **então** ele vem de `z.infer` do mesmo schema.
2. **Dado** um corpo com um campo não declarado, **quando** chega à rota, **então** é recusado como `invalid_payload`.

### US-002 — Receber erro estável e aceitar frames reais (P1)

Como jogador, quero que frames reais dentro do limite configurado sejam aceitos e que qualquer falha retorne um erro estável para que a UI reaja de forma previsível.

**Teste independente:** enviar um corpo de ~200 kB com um frame real e um corpo com campo extra, e conferir os códigos de resposta.

**Critérios de aceitação:**

1. **Dado** um corpo de ~200 kB com frame válido, **quando** chega à rota, **então** retorna 200.
2. **Dado** frames ou bytes acima do limite, **quando** chegam à rota, **então** retorna `payload_too_large` 413 sem eco do conteúdo dos frames.

### US-003 — Ver falha clara de configuração no boot (P1)

Como operador, quero que uma variável de ambiente inválida derrube o boot com mensagem clara para corrigir a configuração antes de servir tráfego.

**Teste independente:** subir o servidor com `PORT=abc` e verificar a mensagem de erro de validação de configuração.

**Critérios de aceitação:**

1. **Dado** `PORT=abc`, **quando** o servidor inicia, **então** o boot falha com "Config validation error".
2. **Dado** uma variável vazia, **quando** o servidor inicia, **então** ela é tratada como ausente e o padrão é aplicado.

## Requisitos funcionais

- **FR-001:** Os schemas do contrato (`CapturedFrame`, `GuesserInput`/requisição, `GuessResponse`, `ApiError`/`ApiErrorCode` e a carta com `public`/`evaluation`) DEVEM viver em `packages/core/src/schemas/` como fonte única; os tipos TypeScript DEVEM ser derivados deles por `z.infer`.
- **FR-002:** Os schemas DEVEM usar Zod Mini (`zod/mini`, API funcional e tree-shakable) com objetos estritos; um campo não declarado DEVE invalidar a requisição e a carta, reforçando a fronteira de informação (dado de carta no corpo é recusado).
- **FR-003:** A rota `POST /api/guess` DEVE validar o corpo com um pipe (`GuessRequestPipe`) que estende o `StandardSchemaValidationPipe` do NestJS 12 usando `guessRequestSchema` e, em seguida, `checkGuessLimits` (frames, bytes por frame, total e palpites rejeitados vindos da configuração). Estrutura/MIME/base64/ordem de timestamps/campos extras/`rejectedGuesses` acima do limite DEVEM virar `invalid_payload` 400; frames/bytes acima do limite DEVEM virar `payload_too_large` 413; as mensagens NÃO DEVEM ecoar o conteúdo dos frames.
- **FR-004:** O parser JSON do servidor DEVE usar limite derivado de `MAX_TOTAL_BYTES` (4/3 do base64 mais 64 KiB de folga) em vez do padrão de 100 kB do Express; corpo acima do limite DEVE virar `payload_too_large` 413. A configuração HTTP (filtro de erro e parser) DEVE ser compartilhada entre `main.ts` e os testes por `configureHttp`.
- **FR-005:** As variáveis de ambiente DEVEM ser validadas por um schema Zod passado ao `validationSchema` do `@nestjs/config`; valor inválido DEVE derrubar o boot com mensagem clara; os padrões DEVEM ser preservados (PORT 3000, GUESSER_PROVIDER mock, MAX_FRAMES 6, MAX_FRAME_BYTES 262144, MAX_TOTAL_BYTES 1572864, REQUEST_TIMEOUT_MS 15000, RATE_LIMIT_PER_MINUTE 20, COST_CEILING_ATTEMPTS_PER_HOUR 60); variável vazia DEVE ser tratada como ausente.
- **FR-006:** O cliente web DEVE validar a resposta 200 com `guessResponseSchema` e o corpo de erro com `apiErrorSchema`; resposta fora do contrato DEVE virar `invalid_model_response` (reexecutável).
- **FR-007:** `class-validator`, `class-transformer` e o parser manual (`payload.ts`) DEVEM ser removidos; `validateCard`/`isCard`/`parseCard` DEVEM manter a API pública, agora sobre o schema, com mensagens em português.

## Requisitos não funcionais

- **NFR-001:** O bundle do navegador DEVE crescer pouco: medido 74,14 → 80,29 kB gzip (+6,15 kB) com Zod Mini; a alternativa Zod clássico mediu 98,16 kB (+24 kB) e foi rejeitada.
- **NFR-002:** `packages/core` DEVE permanecer sem I/O, com `zod` como única dependência de runtime.
- **NFR-003:** A API pública da rota NÃO DEVE mudar para clientes válidos (mesmo corpo, 200 com `guess`/`durationMs`/`providerId`).

## Edge cases

- Corpo com campo `card`: recusado como `invalid_payload` 400, protegendo a fronteira de informação.
- Frames com timestamps fora de ordem crescente: `invalid_payload` 400.
- `data` do frame que não é base64 válido ou com MIME fora da lista permitida: `invalid_payload` 400.
- Corpo de ~200 kB com frame real dentro do limite: aceito com 200, acima do padrão de 100 kB do Express.
- `rejectedGuesses` acima do limite configurado: `invalid_payload` 400 (distinto de bytes, que é 413).
- Variável de ambiente vazia: tratada como ausente, com o padrão aplicado; valor não inteiro positivo derruba o boot.

## Hipóteses e dependências

- O `StandardSchemaValidationPipe` do NestJS 12 aceita schemas Standard Schema e recebe o schema por metadados na transformação.
- O `validationSchema` do `@nestjs/config` aceita um schema Standard Schema para validar o ambiente no boot.
- O Zod expõe duas APIs do mesmo pacote: `zod/mini` no núcleo e o Zod clássico no servidor para o schema de ambiente (coerção, default e preprocess).
- A frente de validação Zod é a PR empilhada após o Yarn 4 e antes do Oxlint/TypeScript 7.

## Critérios mensuráveis de sucesso

- **SC-001:** Os testes de schema, pipe, ambiente e HTTP ficam verdes (núcleo ~68, servidor ~44, web ~50; confirmar o número real com `yarn check:all` quando a memória permitir, senão citar sem número).
- **SC-002:** Um corpo HTTP de ~200 kB com frame real retorna 200.
- **SC-003:** Um corpo com o campo `card` retorna 400 `invalid_payload`.
- **SC-004:** `PORT=abc` derruba o boot com "Config validation error".
- **SC-005:** `class-validator` e `class-transformer` estão ausentes do lockfile.
