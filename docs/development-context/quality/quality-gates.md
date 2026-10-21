# Checks de qualidade

**Estado atual:** o repositório ainda não tem código de aplicação. Hoje existem gates de governança (abaixo), executados pelo [`pr-gate`](../delivery/ci-pipeline.md) e pelo [hook local de pré-push](../operations/local-development.md#verificações-locais-antes-do-push). Os gates de código passam a ser scripts de `package.json` assim que a Fase 0 for implementada, como escopo novo do pipeline, e este documento DEVE ser atualizado na mesma mudança.

## Gates de governança (vigentes)

| Script                       | Propósito                                                                                            | Onde roda                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `yarn sdd:check`             | Estrutura, estados, gates, cobertura e links do catálogo de specs e dos guias SDD (somente leitura). | `pr-gate` (seleção `sdd`) e hook.                               |
| `yarn test:sdd`              | Testes do checker do SDD e da consolidação de resultados do gate.                                    | `pr-gate` (seleção `sdd`) e hook.                               |
| `yarn docs:format:check`     | Prettier `--check` em `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` e `specs/`.                     | `pr-gate` (seleção `root-docs`) e hook.                         |
| `yarn test:gates`            | Testes do hook local, do auditor de dependências e da estrutura dos workflows.                       | `pr-gate` (seleção `tooling`) e hook.                           |
| `yarn security:dependencies` | Auditoria de dependências; High e Critical bloqueiam ([política](../security/dependency-audit.md)).  | `pr-gate` (seleção `audit`), hook e rotina quinzenal na `main`. |

Esses gates são somente leitura. `yarn docs:format:fix` escreve arquivos e nunca roda no CI.

## Gates previstos (stack: React + Vite + TypeScript + NestJS)

| Gate               | Propósito                                                                                              | Quando                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `typecheck`        | Tipos explícitos em frontend e backend.                                                                | Todo PR com código.                              |
| `lint`             | Estilo e erros estáticos.                                                                              | Todo PR com código.                              |
| `test`             | Testes unitários e de contrato (motor, árbitro, adaptadores com provedor simulado).                    | Todo PR com código.                              |
| `build`            | Compilação do frontend e do servidor.                                                                  | Todo PR com código.                              |
| Teste de fronteira | Prova que o payload ao adivinhador não contém palavra, dica, sugestão, aliases nem critérios da carta. | Qualquer mudança em motor, adaptador ou prompts. |

## Regras

- Use somente scripts oficiais de `package.json`; a promoção de um gate previsto para o `pr-gate` segue [Como adicionar um quality gate](../delivery/ci-pipeline.md#como-adicionar-um-quality-gate); registre comando, data e resultado reais em `validation.md`.
- Testes automatizados usam o provedor simulado (`MockGuesserProvider`). Chamadas reais a provedores pagos ficam em um comando separado e explícito (benchmark), nunca no gate padrão.
- Um benchmark com amostra pequena é evidência exploratória: registre o tamanho da amostra e as limitações; não publique taxa de acerto geral.
- Não declare sucesso de gate não executado; registre `BLOCKED` ou `NOT_APPLICABLE` com justificativa.
- Documentação puramente normativa pode usar revisão estrutural e verificação de links em vez de teste unitário.
