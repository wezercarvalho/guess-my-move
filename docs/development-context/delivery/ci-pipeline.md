# Pipeline de CI

O CI executa os mesmos scripts do `package.json` que existem localmente. Nenhuma regra de qualidade é definida dentro dos workflows; a composição dos gates está em [checks de qualidade](../quality/quality-gates.md).

**Estado atual:** o monorepo tem código de aplicação (`apps/web`, `apps/server`, `packages/core`). O pipeline cobre a governança (SDD, documentação e os próprios gates), o escopo de código (`typecheck`, `lint`, `test`, `build` via `yarn check:all`) e a auditoria de dependências.

## Workflows

| Workflow           | Gatilho                                                                                       | Roda                                                                                     | Papel                            |
| ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| `pr-gate`          | `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`), sem filtro de paths | detecção de paths, governança (job `sdd`), código (job `code`), auditoria e o job `gate` | único required status check      |
| `dependency-audit` | `schedule` nos dias 1 e 15, 08:23 UTC, e `workflow_dispatch`; só na `main`                    | `yarn security:dependencies`                                                             | rotina quinzenal de dependências |

**Nenhum workflow roda por `push` em branch de trabalho.** Um push em branch sem PR não gasta minutos de Actions; a verificação rápida é local, no hook de pré-push (ver [Desenvolvimento local](../operations/local-development.md#verificações-locais-antes-do-push)). Não existe workflow de CI para a `main`: ela recebe apenas PRs, que já passaram pelo gate antes do merge.

## O que roda onde

- **Push em branch:** nada no GitHub. Localmente, o hook `.githooks/pre-push` roda as verificações dos escopos afetados, se estiver instalado, e a auditoria de dependências quando o push toca o que o gate audita. O hook é opcional, mas o `AGENTS.md` manda instalá-lo antes do primeiro push.
- **PR em rascunho:** nada. O `pr-gate` não roda nem o job `gate` enquanto a PR é rascunho, então abrir rascunho e empurrar várias vezes não gasta minutos.
- **PR pronta:** o `pr-gate` roda automaticamente ao marcar como pronta (evento `ready_for_review`, sem label nem disparo manual) e a cada push seguinte, inteiro. Uso recomendado: abrir como rascunho, empurrar quantas vezes for preciso e marcar como pronta uma vez.
- **Rotina:** a auditoria de dependências roda quinzenalmente (dias 1 e 15) e sob disparo manual, só na branch padrão (`main`).

O `pr-gate` valida o **resultado do merge** (evento `pull_request`), que pode diferir do head da branch; por isso o gate de merge é autocontido e repete o que o hook local já pode ter rodado.

## Gate de PR (`pr-gate`)

`pr-gate.yml` dispara em `pull_request` sem filtro de paths, mas não roda nada enquanto a PR é rascunho. Detecta com `git diff` quais paths o PR tocou e liga os jobs aplicáveis:

| Seleção     | Padrão (resumo)                                                                                          | Job     |
| ----------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `sdd`       | `specs/`, `scripts/sdd/`, `test/sdd/`, método SDD, `AGENTS.md`, manifesto e lockfile, `pr-gate.yml`      | `sdd`   |
| `root-docs` | `AGENTS.md`, `CLAUDE.md`, `README.md`, `.prettierrc`, `docs/`, `specs/`, `pr-gate.yml`                   | `sdd`   |
| `tooling`   | hook, auditor, `test/gates/`, `test/security/`, todos os workflows, manifesto, lockfile, `.node-version` | `sdd`   |
| `code`      | `apps/`, `packages/`, manifesto, lockfile, `tsconfig*.json`, `.oxlintrc.json`, `.env.example`            | `code`  |
| `audit`     | manifesto, lockfile, auditor, exceções e os workflows `pr-gate` e `dependency-audit`                     | `audit` |

Os padrões exatos ficam no passo "Detectar paths alterados" de `pr-gate.yml` e são espelhados em `scripts/git-hooks/scopes.mjs`; um teste (`test/gates/hook-and-gate.node-test.mjs`) compara os dois.

Um job final (`gate`) sempre roda. Ele usa `scripts/sdd/check-job-results.mjs` para verificar a seleção e o resultado: falha ou cancelamento da detecção, seleção ausente e job aplicável ignorado bloqueiam; job não selecionado e pulado conta como ok. `pr-gate / gate` é o único required status check da proteção de branch: rodar sempre evita a armadilha do GitHub em que um required check com `paths:` que nunca dispara trava o PR em "Expected — Waiting for status to be reported".

**Proteção de branch.** O check só impõe o merge depois de ser marcado como _Required_ na `main` (Settings → Branches ou Rulesets). Enquanto isso não for feito, o gate vale por convenção: só se faz merge de PR com `pr-gate / gate` verde; um gate vermelho se corrige na PR, não se contorna com merge. A `main` só existe depois do commit inicial; configure a regra logo em seguida.

### Job de governança

As seleções `sdd`, `root-docs` e `tooling` alimentam **um único job**, de id `sdd` e nome "governança: SDD, docs da raiz e gates". Ele roda quando qualquer das três é verdadeira, instala as dependências uma só vez e executa passos com condição própria:

| Passo                                   | Condição            | Comando                  |
| --------------------------------------- | ------------------- | ------------------------ |
| `Testar checker e consolidação`         | seleção `sdd`       | `yarn test:sdd`          |
| `Verificar catálogo e links`            | seleção `sdd`       | `yarn sdd:check --file…` |
| `Verificar formatação dos docs da raiz` | seleção `root-docs` | `yarn docs:format:check` |
| `Testar hook, auditor e workflows`      | seleção `tooling`   | `yarn test:gates`        |

O checker estrutural (`yarn sdd:check`) verifica o catálogo e os guias SDD; o workflow passa os documentos Markdown alterados existentes por `--file`, e os templates ficam de fora por terem placeholders intencionais. A ferramenta é somente leitura, sem rede ou Git, e não comprova autorização humana nem integração do código em `main`. O Prettier valida só formatação; links e conteúdo continuam dependendo de revisão.

### Job de código

A seleção `code` liga o job `code`, que instala as dependências e roda `yarn check:all` (um só comando que executa `typecheck`, `lint`, `test` e `build` em todos os workspaces). O padrão de path cobre `apps/`, `packages/`, o manifesto e o lockfile, `tsconfig*.json`, `.oxlintrc.json` e `.env.example`, e é espelhado EXATAMENTE em `scripts/git-hooks/scopes.mjs` (um teste em `test/gates/` compara os dois). No hook local o escopo `code` roda `yarn check:static` (typecheck + lint) por padrão e `yarn check:all` com `--mode full`; o gate remoto sempre roda `check:all`.

### Auditoria de dependências

Job condicional `audit` no PR e rotina quinzenal na `main`. A política (severidade, alcance, exceções e diagnósticos) está em [auditoria de dependências](../security/dependency-audit.md).

## Regras

- O pipeline executa os mesmos comandos que existem localmente. Regras novas devem nascer reproduzíveis com `yarn <script>` antes de entrar aqui.
- Os gates são somente leitura. Comandos que escrevem artefatos versionados (`yarn docs:format:fix`, por exemplo) nunca rodam no CI.
- Os workflows de CI não recebem credencial de nuvem nem segredo (`permissions: contents: read`). Segredos e chaves de provedor de IA nunca entram no CI de PR; o benchmark com provedor real é um comando manual e explícito, fora do gate.
- Não adicione rota, job, wrapper ou scaffold futuro ao pipeline sem uso real ou pedido explícito.
- Nunca altere `package.json` ou `yarn.lock` numa mudança só de pipeline, para não acionar a auditoria de dependências por esse motivo.

## Como adicionar um quality gate

1. Criar o gate atômico no `package.json` seguindo `<domínio>:<ação>`, de forma que rode isolado.
2. Compor no agregado a que pertence ou criar um agregado novo se for dimensão nova.
3. Só criar job novo no workflow se a dimensão for independente e valer paralelizar. Nunca definir a regra dentro do YAML.
4. Atualizar [checks de qualidade](../quality/quality-gates.md) na mesma mudança.

## Como adicionar um escopo

Trade-off aceito: um PR que não toca nenhum dos paths mapeados passa sem gate. Quem criar um diretório relevante é responsável por mapeá-lo na mesma mudança:

1. `pr-gate.yml`: padrão novo no passo "Detectar paths alterados", output no `detect-changes` e job novo (ou chamada de workflow reutilizável) condicionado à seleção.
2. `scripts/sdd/check-job-results.mjs`: incluir o job em `SELECTED_JOBS` e dar `needs` ao job `gate`.
3. `scripts/git-hooks/scopes.mjs`: escopo com o mesmo padrão e o mesmo comando que o gate remoto roda; o modo `static` roda a verificação rápida e o `full` a completa.
4. Testes em `test/gates/` e `test/sdd/check-gate.node-test.mjs`, documentação nesta página e em [checks de qualidade](../quality/quality-gates.md).

O escopo `code` (issue #3) seguiu exatamente esses passos: padrão `CODE_PATTERN` + output `code` no `pr-gate.yml`, job `code` rodando `yarn check:all`, `code` em `SELECTED_JOBS` com `needs` no `gate`, escopo `code` no hook (`check:static`/`check:all`) e testes nos dois arquivos de gate.
