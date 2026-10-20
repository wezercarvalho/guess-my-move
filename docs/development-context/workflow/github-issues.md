# Padrão de issues e PRs: INVEST e critérios de aceite BDD

Este guia define como registrar trabalho acionável no GitHub. O núcleo obrigatório é **Contexto → Objetivo → Escopo → Aceite**. INVEST filtra a qualidade da issue; BDD ajuda a descrever comportamentos observáveis quando apropriado. A issue não substitui a spec nem duplica o ciclo SDD.

## Título e corpo

Use o título do GitHub para um resultado específico, com verbo e objeto ("Capturar frames ordenados da webcam", "Bloquear vazamento da carta ao adivinhador"). Não repita o título no corpo nem coloque tipo, prioridade ou status nele.

O [template](../../../.github/ISSUE_TEMPLATE/work-item.md) serve a feature, bug, dívida técnica, refactor e investigação. Preencha as quatro seções obrigatórias:

| Seção | Conteúdo esperado |
| --- | --- |
| Contexto / Problema | Situação atual, evidência e consequência. Diferencie fato observado de hipótese. |
| Objetivo / Resultado esperado | Resultado que torna a issue concluída. |
| Escopo | Limites concretos e itens incluídos. |
| Critérios de aceite | Condições independentes, observáveis e verificáveis. |

Acrescente **Dependências / Riscos**, **Referências**, **Decisões pendentes** ou **Tarefas técnicas** somente quando houver informação útil. Remova seções vazias, instruções do template e placeholders. Em bugs, registre reprodução, comportamento atual e esperado. Investigações formulam a pergunta, a evidência a coletar e a decisão entregue. Refactors indicam o comportamento preservado e a prova de não regressão.

## INVEST como filtro

| Princípio | Pergunta de revisão |
| --- | --- |
| Independent | O resultado pode ser revisado como unidade? Dependências reais estão explícitas? |
| Negotiable | A intenção está clara sem fixar uma solução não decidida? |
| Valuable | O benefício para produto, operação, segurança ou manutenção está explicado? |
| Estimable | Há contexto suficiente para estimar? Se não, é uma investigação delimitada? |
| Small | Cabe em um incremento revisável? |
| Testable | Os critérios permitem demonstrar a conclusão sem termos vagos? |

Para iniciativas maiores, use uma issue pai com resultados filhos próprios. Não transforme cada tarefa técnica da spec em outra issue por padrão.

## BDD para aceitação

Use **Dado / Quando / Então** quando o aceite depender de comportamento sob uma condição, na linguagem do domínio e sem exigir Gherkin executável:

- **Dado** que a câmera foi negada, **quando** o jogador iniciar a rodada, **então** nenhuma requisição ao modelo é feita e a interface explica como reabilitar a permissão.

Para investigação, documentação ou medição, prefira critérios diretos ("Registrar acertos, falsos positivos e latência mediana por cenário"). Não force BDD em entregas que não descrevem uma interação.

## Metadados fora do corpo

Use o recurso nativo do GitHub quando ele representar o significado; labels são o fallback.

| Metadado | Convenção de labels |
| --- | --- |
| Tipo | `type:feature`, `type:bug`, `type:technical-debt`, `type:refactor`, `type:investigation` |
| Área | `area:vision`, `area:game-engine`, `area:referee`, `area:frontend`, `area:backend`, `area:privacy`, `area:cost`, `area:docs`, `area:engineering` |
| Prioridade | `priority:p0` (comprova viabilidade), `priority:p1` (torna jogável), `priority:p2` (evolução orientada por resultados) |
| Status | Uma única label: `status:triage`, `status:ready`, `status:in-progress`, `status:review` ou `status:done` |
| Estratégia | `strategy:sdd` quando aplicável pelo [roteador](../../development-strategies/README.md) |

A prioridade acompanha o backlog do [`PROJECT_SPEC.md`](../../product/PROJECT_SPEC.md) (P0/P1/P2). Uma issue tem um tipo, uma prioridade quando decidida e uma área principal. Não crie todas as labels antecipadamente nem renomeie labels alheias. A label `strategy:sdd` não autoriza implementação.

## Fluxo de trabalho

**Triagem → Ready → In Progress → Review → Done.**

| Estado | Condição |
| --- | --- |
| Triagem | Problema registrado, sujeito a confirmação, prioridade ou divisão. |
| Ready | Contexto, objetivo, limites e aceite claros; dependências e riscos conhecidos; pequeno o bastante. Ready não substitui os gates SDD. |
| In Progress | Há responsável identificável e branch/spec vinculada. |
| Review | Resultado e evidências disponíveis; limitações materiais explícitas. |
| Done | Aceite comprovado e revisão concluída; para código, integrado à `main`. |

Issues novas começam em Triagem. Substitua a label de status a cada transição. Um bloqueio mantém o estágio real e registra a dependência. Duplicadas, substituídas ou "not planned" fecham com justificativa, sem fingir entrega.

## Branches e PRs

- Use branches de curta duração por entrega: `feat/<tema>`, `fix/<tema>`, `docs/<tema>`, `chore/<tema>`. Reaproveite o branch existente da iniciativa; não crie branches paralelos sem necessidade.
- Depois do commit inicial de bootstrap, não faça push direto na `main`: abra PR.
- Commits seguem Conventional Commits em português (`docs(specs): …`, `feat(capture): …`), pequenos e rastreáveis.

### Responsável pelas PRs

Ao criar ou atualizar uma PR cuja entrega seja de responsabilidade do maintainer, atribua **`@wezercarvalho`** em **Assignees** e confirme no GitHub que a atribuição persistiu. Preserve outros responsáveis. Assignees identifica quem acompanha a entrega; Reviewers e autorização de merge têm significados próprios.

### Fechamento de issues

Declare na descrição da PR se ela conclui a issue ou entrega só uma parte. Nome do branch, título e menção à issue não bastam.

| Situação | Vínculo na descrição | Resultado |
| --- | --- | --- |
| A PR conclui todos os critérios de aceite | `Closes #123` | A issue fecha ao integrar na `main`. |
| A PR entrega parte ou há trabalho obrigatório após o merge | `Refs #123` + pendências explícitas | A issue permanece aberta. |

Quando usar `Refs`, registre quais critérios ainda impedem o encerramento, quem acompanha e onde as evidências serão publicadas. `Closes` configura o efeito de um merge futuro e não autoriza o agente a executá-lo. Criar ou atribuir uma PR não autoriza merge. Após o merge, confirme a integração e o aceite antes de encerrar a issue e sincronizar o status.

## Relação com o SDD e validação

Selecione a estratégia no [roteador](../../development-strategies/README.md). Para SDD, a spec é a fonte do comportamento e a issue registra demanda e acompanhamento. Valide com os [scripts oficiais](../quality/quality-gates.md) e registre resultados e limitações reais.

## Fontes

- [INVEST — Agile Alliance](https://agilealliance.org/glossary/invest/)
- [Referência Gherkin — Cucumber](https://cucumber.io/docs/gherkin/reference/)
- [Templates de issues — GitHub](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [Vínculo entre PR e issue — GitHub](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
