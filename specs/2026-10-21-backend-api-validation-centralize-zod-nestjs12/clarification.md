# Clarificação — 2026-10-21-backend-api-validation-centralize-zod-nestjs12

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-21`

As decisões abaixo foram **definidas em 2026-10-21 pelo mantenedor e são revisáveis**, com base nos critérios da issue #44 (tirar `class-validator`, extrair o NestJS 12 com Zod e centralizar a validação).

## Log de decisões

### CQ-001 — Biblioteca de schema

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Qual biblioteca de schema adotar como fonte única do contrato?
- **Decisão:** Zod, por ser Standard Schema e ter o ecossistema mais maduro.
- **Razão:** O NestJS 12 integra Standard Schema no pipe e no `@nestjs/config`, mas não traz schema; o Zod cobre o contrato e, por ser Standard Schema, permite trocar a biblioteca a baixo custo.
- **Alternativas rejeitadas:** Valibot e ArkType — também Standard Schema, ecossistema menor; trocar depois é barato.
- **Seções atualizadas em `spec.md`:** FR-001, US-001.

### CQ-002 — Zod Mini no núcleo, Zod clássico no ambiente

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Qual API do Zod usar em cada camada, dado o peso no bundle?
- **Decisão:** `zod/mini` no núcleo (API funcional e tree-shakable) e Zod clássico apenas no servidor para o schema de ambiente (coerção, `default` e `preprocess`), registrando que são duas APIs do mesmo pacote.
- **Razão:** O núcleo vai ao bundle do navegador e precisa ser leve; o schema de ambiente roda só no servidor e se beneficia das conveniências do Zod clássico.
- **Alternativas rejeitadas:** Zod clássico no núcleo — mediu +24 kB no bundle e foi rejeitado por peso.
- **Seções atualizadas em `spec.md`:** FR-002, FR-005, NFR-001.

### CQ-003 — Pipe estendendo o nativo

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Como aplicar o schema e os limites configuráveis na rota?
- **Decisão:** Um `GuessRequestPipe` que estende o `StandardSchemaValidationPipe`: a validação estrutural usa o schema do núcleo e os limites usam `checkGuessLimits`.
- **Razão:** Os limites dependem de configuração, e `@Body({ schema })` recebe schema estático na decoração; estender o pipe permite ler a configuração e separar as duas etapas.
- **Alternativas rejeitadas:** `@Body({ schema })` com schema estático — não acessa limites configuráveis.
- **Seções atualizadas em `spec.md`:** FR-003.

### CQ-004 — Limites configuráveis fora do schema

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Onde aplicar os limites de quantidade e tamanho?
- **Decisão:** Em uma função pura (`checkGuessLimits`), separada do schema, para distinguir 413 de 400.
- **Razão:** O Standard Schema não preserva `params`, então manter os limites fora do schema é o que permite mapear bytes/frames para `payload_too_large` 413 e manter a estrutura em `invalid_payload` 400.
- **Alternativas rejeitadas:** Limites dentro do schema — não distingue 413 de 400 sem `params`.
- **Seções atualizadas em `spec.md`:** FR-003, FR-004.

### CQ-005 — Objetos estritos

- **Data:** `2026-10-21`
- **Impacto:** médio
- **Pergunta:** Como tratar campos não declarados no corpo e na carta?
- **Decisão:** Objetos estritos: qualquer campo extra é recusado.
- **Razão:** Defesa da fronteira de informação — recusar campos inesperados impede que dado da carta atravesse o corpo da requisição.
- **Alternativas rejeitadas:** Objetos permissivos (ignorar extras) — deixaria passar dado inesperado.
- **Seções atualizadas em `spec.md`:** FR-002, edge cases.

### CQ-006 — Opcionais exatos

- **Data:** `2026-10-21`
- **Impacto:** baixo
- **Pergunta:** Como declarar campos opcionais compatíveis com o TypeScript estrito?
- **Decisão:** Usar `exactOptional` nos campos opcionais dos schemas.
- **Razão:** Compatibiliza com `exactOptionalPropertyTypes`, evitando `undefined` explícito indesejado nos tipos derivados.
- **Alternativas rejeitadas:** `optional` padrão — gera `| undefined` incompatível com o modo estrito.
- **Seções atualizadas em `spec.md`:** FR-001, FR-002.

## Questões abertas

- Autenticação e limite por cliente do endpoint.
- Geração de Swagger/OpenAPI a partir dos schemas.
- Uso futuro de `errorCode` do NestJS 12 e de `routeConflictPolicy` — avaliados, não adotados nesta PoC.

## Hipóteses remanescentes

- **Não crítica:** as duas APIs do Zod (`zod/mini` e clássico) convivem no mesmo pacote sem conflito de versão.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** instrução explícita do mantenedor na sessão de 2026-10-21, com base nos critérios da issue #44.
- **Observações:** o Gate 3 (registrar `validation.md`) permanece com o mantenedor e não é registrado aqui.
