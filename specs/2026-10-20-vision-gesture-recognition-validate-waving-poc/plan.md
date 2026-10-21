# Plano — 2026-10-20-vision-gesture-recognition-validate-waving-poc

## Resumo técnico

Entregar uma base executável localmente (monorepo Yarn 1 com workspaces) que capture uma janela curta de frames da webcam, envie-os por uma API server-side (NestJS) a um `GuesserProvider` plugável (`mock` e `codex`) e devolva um palpite curto validado por schema, sem nunca enviar dados da carta ao adivinhador. O benchmark é um CLI offline reproduzível que mede o provedor configurado contra cenários positivos e negativos, declarando amostra e limitações.

## Contexto técnico

- **Runtime/versões:** Node >= 24.18 (<25), TypeScript estrito, ESM. Versões exatas (sem `^`/`~`), reconfirmadas no scaffold: `@nestjs/core` 12.2.0, `@nestjs/platform-express` 12.2.0, `@nestjs/testing` 12.2.0, `@nestjs/cli` 12.0.10, `typescript` 7.0.2, `vite` 8.3.4, `react` 19.3.1, `vitest` 5.0.5, `eslint` 10.13.0.
- **Dependências:** NestJS e React/Vite novas no scaffold (#3). Sem banco de dados; `@nestjs/typeorm` e `typeorm` só entram em fase posterior com spec própria.
- **Provedores externos:** `codex` via Codex CLI (`gpt-6-luna`, esforço `none`/`low`/`high`), somente local; desligado por padrão. Bedrock fica para produção (issue #2, depende de AWS). Latência do CLI não representa produção.
- **Persistência:** nenhuma. Frames transitórios; clipes do benchmark só locais e fora do Git.
- **Testes:** Vitest nos pacotes de código; provedor `mock` nos testes automatizados; gates oficiais em `package.json` (`typecheck`, `lint`, `test`, `build`, mais o teste de fronteira de informação).
- **Restrições:** credencial/sessão fora do navegador e fora do repositório (NFR-001); frames não persistidos nem logados (NFR-002); payload do adivinhador sem dados da carta (FR-007); limites de frames e tamanho no cliente e no servidor.

## Constitution Check — pré-design

| Princípio/gate                       | Resultado | Evidência ou exceção                                                                                    |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação   | PASS      | `spec.md` em `clarified` com Gate 1 aprovado antes deste plano.                                         |
| II. Uma fonte vigente                | PASS      | Decisões comportamentais incorporadas a `spec.md`; `clarification.md` é log auditável.                  |
| III. Rastreabilidade                 | PASS      | FR/NFR/SC com IDs estáveis; mapeamento requisito → abordagem → evidência abaixo.                        |
| IV. Test-first e incremental         | PASS      | Estratégia test-first definida; cada FR comportamental tem teste antes do código.                       |
| V. Evidência honesta                 | PASS      | Metas exploratórias com amostra declarada; latência do CLI marcada como não representativa (SC-004).    |
| VI. Fronteira de informação/segredos | PASS      | Teste automatizado de fronteira (FR-007/SC-002); credencial fora do browser e do repo; frames efêmeros. |
| VII. Neutralidade e contexto         | PASS      | `GuesserProvider` isola o provedor; trocar modelo é configuração + adaptador.                           |
| VIII. Clareza e operação segura      | PASS      | UTF-8/português; `codex` desligado por padrão; sem operação destrutiva nesta PoC.                       |

## Pesquisa e decisões

- `research.md` — não necessária como arquivo próprio: a pesquisa de provedores vive em [`docs/research/multimodal-model-selection.md`](../../docs/research/multimodal-model-selection.md) (seções 3–12) e as decisões de clarificação estão em `clarification.md`.

## Estrutura afetada

```text
apps/web/            # React + Vite + TypeScript (carta, câmera, captura, estados)
apps/server/         # NestJS + TypeScript (API /api/guess, /api/health, validação, limites)
packages/core/       # Contratos puros (CapturedFrame, GuesserInput/Result, GuesserProvider, Card, ApiError)
packages/providers/  # Adaptadores mock e codex do GuesserProvider (issue #6 e #7)
packages/benchmark/  # CLI offline do benchmark (issue #10)
```

## Design

### Componentes e responsabilidades

- **apps/web:** solicita permissão de câmera, mostra preview, captura N frames ordenados com `timestampMs`, aplica limites locais, avisa sobre envio externo, diferencia estados `capturing`/`processing`/`success`/`error`; nunca contém credencial.
- **apps/server (NestJS):** rota `POST /api/guess` recebe `{ frames, rejectedGuesses? }` (sem dado de carta), valida payload e limites (`MAX_FRAMES`, `MAX_FRAME_BYTES`, `MAX_TOTAL_BYTES`), aplica `REQUEST_TIMEOUT_MS`, `RATE_LIMIT_PER_MINUTE` e `COST_CEILING_ATTEMPTS_PER_HOUR`, seleciona o `GuesserProvider` por `GUESSER_PROVIDER`, converte falhas em `ApiError` estável. `GET /api/health`.
- **Adaptadores:** `MockGuesserProvider` (sem credencial) e `codex` (processo externo `codex exec`, diretório temporário vazio, `-s read-only`, `--ephemeral`, uma execução por vez, timeout, limpeza dos temporários, saída validada por `--output-schema`).
- **packages/core:** contratos tipados e a carta `Card = { id, locale, public, evaluation }`; `evaluation` nunca sai do servidor/motor.
- **packages/benchmark:** CLI que lê clipes/frames de um diretório local fora do Git, roda contra o provedor configurado, gera relatório por provedor/variante com amostra e limitações.

### Contratos e dados

- `CapturedFrame = { timestampMs: number; mimeType: string; data: string }` (base64 sem prefixo).
- `GuesserInput = { frames: CapturedFrame[]; rejectedGuesses?: string[] }`; `GuesserResult = { guess: string; insufficientEvidence?: boolean }`.
- `interface GuesserProvider { readonly id: string; guess(input, signal?): Promise<GuesserResult> }`.
- `ApiError = { error: { code, message, retryable } }` com códigos `invalid_payload`, `payload_too_large`, `rate_limited`, `provider_timeout`, `provider_error`, `invalid_model_response`, `cost_limit_reached`.
- Resposta de sucesso: `200 { guess, insufficientEvidence?, durationMs, providerId }`.

### Fluxo

Câmera autorizada → captura N frames → cliente valida limites → `POST /api/guess` → servidor valida e seleciona provedor → provedor devolve palpite validado → resposta com `durationMs`; qualquer falha vira `ApiError` recuperável sem palpite inventado e sem travar a câmera.

## Mapeamento de requisitos

| Requisito | Abordagem                                                       | Evidência planejada                               |
| --------- | --------------------------------------------------------------- | ------------------------------------------------- |
| FR-001    | Câmera com consentimento, preview e parada (apps/web)           | Teste de componente + demonstração manual         |
| FR-002    | Captura de janela com timestamps e limites, descarte após uso   | Teste unitário de captura; verificação de não log |
| FR-003    | API server-side com credencial fora do browser                  | Teste de integração da rota                       |
| FR-004    | Saída validada por schema, com "evidência insuficiente"         | Teste de validação de schema                      |
| FR-005    | `MockGuesserProvider` sem credencial                            | Suíte de testes roda sem custo (SC-003)           |
| FR-006    | Interface `GuesserProvider` isolando o provedor                 | Teste de contrato; troca por configuração         |
| FR-007    | Teste de fronteira que falha se dado da carta entrar no payload | Teste de fronteira (SC-002)                       |
| FR-008    | Estados `capturing`/`processing`/`success`/`error` na UI        | Teste de UI + demonstração                        |
| FR-009    | Validação, limites, timeout e erros estáveis no servidor        | Testes de erro estável e limites                  |
| FR-010    | Métricas técnicas sem mídia                                     | Teste de logging sem conteúdo                     |
| FR-011    | Aviso de envio a provedor externo                               | Teste de UI                                       |
| FR-012    | Somente `mock` e `codex` por configuração                       | Teste de seleção por configuração                 |
| FR-013    | `codex` desligado por padrão; modelo e esforço configuráveis    | Teste de configuração do adaptador                |
| FR-014    | Timeout, execução única e limpeza de temporários no `codex`     | Teste com executável simulado                     |

## Estratégia test-first

1. Escrever teste falhando do contrato/comportamento (ex.: fronteira de informação, validação de payload) e confirmar a falha esperada com o comando oficial;
2. Implementação mínima no pacote alvo;
3. Teste direcionado passando;
4. Integração (rota, UI, adaptador);
5. Demonstração do critério observável (SC-00x);
6. Refatoração mantendo os testes verdes.

## Riscos, rollout e rollback

| Risco                                            | Mitigação                                                            | Rollback/contingência                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Codex CLI não aceitar várias imagens/esforço     | Confirmar empiricamente na primeira tarefa do adaptador (#7)         | Usar a API da OpenAI como fallback; revisar a spec    |
| Incompatibilidade NestJS x TypeScript 7 x Vitest | Validar no scaffold (#3) com transformador de decorators             | Registrar par alternativo e motivo na spec            |
| Vazamento da carta ao adivinhador                | Teste de fronteira obrigatório (FR-007) em qualquer mudança sensível | Falha segura: gate bloqueia o merge                   |
| Custo de inferência no desenvolvimento           | `codex` desligado por padrão; testes usam `mock`                     | Teto de custo por hora na rota (`cost_limit_reached`) |

## Constitution Check — pós-design

| Princípio/gate                       | Resultado | Evidência ou exceção                                                                              |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação   | PASS      | Design converge com `spec.md` aprovada; nenhuma decisão comportamental nova fora da spec.         |
| II. Uma fonte vigente                | PASS      | Contratos e fluxos referenciam FR/NFR por ID; sem especificação concorrente.                      |
| III. Rastreabilidade                 | PASS      | Todo FR tem abordagem e evidência planejada na tabela de mapeamento.                              |
| IV. Test-first e incremental         | PASS      | Sequência test-first definida por incremento; mock garante testes sem custo.                      |
| V. Evidência honesta                 | PASS      | Benchmark declara amostra/limitações; latência do CLI excluída da decisão (SC-004/SC-006).        |
| VI. Fronteira de informação/segredos | PASS      | `evaluation` confinado ao servidor/motor; teste de fronteira; `.env.example` só com placeholders. |
| VII. Neutralidade e contexto         | PASS      | Troca de provedor = adaptador + configuração, sem tocar UI/captura/núcleo.                        |
| VIII. Clareza e operação segura      | PASS      | Sem operação destrutiva; `codex` opt-in; limpeza de temporários garantida.                        |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
