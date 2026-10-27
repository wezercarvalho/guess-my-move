# Checks de qualidade

**Estado atual:** o monorepo tem código de aplicação (`apps/web`, `packages/core`). Além dos gates de governança (abaixo), o escopo de código roda `yarn check:all` (typecheck, lint, test e build) no [`pr-gate`](../delivery/ci-pipeline.md) e no [hook local de pré-push](../operations/local-development.md#verificações-locais-antes-do-push).

## Gates de código (vigentes)

| Script              | Propósito                                                           | Onde roda                             |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| `yarn typecheck`    | Tipos explícitos em todos os workspaces (`tsc --noEmit`).           | `pr-gate` (seleção `code`) e hook.    |
| `yarn lint`         | Oxlint type-aware (`.oxlintrc.json`) em `apps/` e `packages/`.      | `pr-gate` (seleção `code`) e hook.    |
| `yarn test`         | Vitest em todos os workspaces (um teste de fumaça real em cada um). | `pr-gate` (seleção `code`).           |
| `yarn build`        | Compila o frontend (Vite) e o pacote `core` (`tsc --build`).        | `pr-gate` (seleção `code`).           |
| `yarn check:static` | Agregado leve: `typecheck` + `lint`.                                | hook local no modo `static` (padrão). |
| `yarn check:all`    | Agregado completo: `check:static` + `test` + `build`.               | `pr-gate` (job `code`) e hook `full`. |

O hook local roda `check:static` por padrão e `check:all` com `--mode full`; o gate remoto sempre roda `check:all`.

## Gates de governança (vigentes)

| Script                       | Propósito                                                                                            | Onde roda                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `yarn sdd:check`             | Estrutura, estados, gates, cobertura e links do catálogo de specs e dos guias SDD (somente leitura). | `pr-gate` (seleção `sdd`) e hook.                               |
| `yarn test:sdd`              | Testes do checker do SDD e da consolidação de resultados do gate.                                    | `pr-gate` (seleção `sdd`) e hook.                               |
| `yarn docs:format:check`     | Prettier `--check` em `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` e `specs/`.                     | `pr-gate` (seleção `root-docs`) e hook.                         |
| `yarn test:gates`            | Testes do hook local, do auditor de dependências e da estrutura dos workflows.                       | `pr-gate` (seleção `tooling`) e hook.                           |
| `yarn security:dependencies` | Auditoria de dependências; High e Critical bloqueiam ([política](../security/dependency-audit.md)).  | `pr-gate` (seleção `audit`), hook e rotina quinzenal na `main`. |

Esses gates são somente leitura. `yarn docs:format:fix` escreve arquivos e nunca roda no CI.

## Teste de fronteira (vigente)

| Gate               | Propósito                                                                                                    | Onde roda                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Teste de fronteira | Prova que `toPublicCard` devolve só a parte pública da carta e nunca o critério de avaliação (`evaluation`). | `packages/core/test/card.test.ts`, no `yarn test` do escopo `code`. |

O teste de fronteira roda dentro do agregado `yarn test` do escopo `code`; qualquer mudança no schema da carta ou na projeção pública o exercita.

## Regras

- Use somente scripts oficiais de `package.json`; a promoção de um gate para o `pr-gate` segue [Como adicionar um quality gate](../delivery/ci-pipeline.md#como-adicionar-um-quality-gate); registre comando, data e resultado reais em `validation.md`.
- Os testes do núcleo são puros e rodam sem câmera: o avaliador é exercitado sobre as séries de ângulo dos 12 clipes de referência (fixtures só com números), e a tela usa um duplo de teste de `HandTracker`. Nenhum gate acessa câmera, rede ou MediaPipe real.
- O spike é evidência exploratória de amostra pequena: registre o tamanho da amostra e as limitações; não publique taxa de acerto, de quadros ou latência geral.
- Não declare sucesso de gate não executado; registre `BLOCKED` ou `NOT_APPLICABLE` com justificativa.
- Documentação puramente normativa pode usar revisão estrutural e verificação de links em vez de teste unitário.
