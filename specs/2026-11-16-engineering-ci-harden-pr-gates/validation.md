# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** aprovado
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** GitHub Actions (execução), agente assistente (reconciliação) e wezercarvalho (maintainer, autorização).
- **Commit:** `ab9c484cdf0971507cc9bab8e7ea82635ff2286d` (main); head `bafe437c2bb3a8806603eeb2109dd7edce63e960`; merge sintético testado `b287d072e58c960a69f7a6ebb02df6349cd51e28`.

## Resumo do resultado

A [PR #173](https://github.com/wezercarvalho/guess-my-move/pull/173) foi integrada pelo mantenedor em 16/11/2026. O [CI](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343) aprovou os cinco jobs. A árvore testada e a árvore integrada são idênticas (`f29d8931bc8350b831ad321071aee250b8788c1d`). Os controles versionados foram aprovados; os parâmetros administrativos não acessíveis ficam para conferência do mantenedor, conforme escopo da issue.

## Conclusão das tarefas

- **Concluídas:** 6 (T001–T006).
- **Pendentes na entrega:** 0.
- **Evidência:** [tasks.md](tasks.md).
- **Conferência administrativa residual:** checklist do [guia de CI](../../docs/development-context/delivery/ci-pipeline.md), responsabilidade do mantenedor.

## Evidências por requisito

| Requisito | Tarefas         | Evidência                                                                                | Resultado |
| --------- | --------------- | ---------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001–T002, T006 | Pins oficiais, sete checkouts sem persistência; teste estrutural e CI aprovados.         | PASS      |
| FR-002    | T001–T002, T006 | Permissões, runners, tempos e condição main das rotinas conferidos por teste estrutural. | PASS      |
| FR-003    | T003, T006      | Cinco padrões equivalentes e amostras de novos caminhos aprovadas.                       | PASS      |
| FR-004    | T004, T006      | Testes de paths e checkout da base aprovados; log confirma SHA da base no consolidador.  | PASS      |
| FR-005    | T005–T006       | CODEOWNERS, processo de revisão, limites e checklist administrativo registrados.         | PASS      |

## Histórias e critérios de aceitação

- US-001: as Actions fixadas foram efetivamente utilizadas pelo CI e o log registra persist-credentials desabilitado. Os testes confirmam a política dos três workflows e a condição main das auditorias. Não houve execução independente das rotinas periódicas nesta entrega.
- US-002: os testes dos cinco padrões, caminhos e renomeações passaram. A detecção e os checks executaram na árvore de merge; o log do consolidador confirma checkout da base `77000bc1bbf4d74e94608a0e8855165be6cbc6a9`. CODEOWNERS identifica o responsável; não equivale a aprovação obrigatória ou proteção independente do YAML.

## Comandos executados

Resultados de 16/11/2026 no [run 43809865343](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343).

| Comando                                  | Data       | Resultado | Evidência                                                  |
| ---------------------------------------- | ---------- | --------- | ---------------------------------------------------------- |
| `yarn install --immutable`               | 2026-11-16 | PASS      | Instalações dos três jobs aprovadas.                       |
| `yarn test:gates`                        | 2026-11-16 | PASS      | Novos testes de segurança e paridade aprovados.            |
| `yarn test:sdd`                          | 2026-11-16 | PASS      | Checker e consolidação aprovados.                          |
| `yarn sdd:check`                         | 2026-11-16 | PASS      | Catálogo e links aprovados.                                |
| `yarn docs:format:check`                 | 2026-11-16 | PASS      | Formatação aprovada.                                       |
| `yarn check:all`                         | 2026-11-16 | PASS      | Tipos, lint, testes, build, smoke compilado e contratos.   |
| `yarn security:dependencies`             | 2026-11-16 | PASS      | info=0, low=0, moderate=0, high=0, critical=0 na consulta. |
| `yarn security:runtime`                  | 2026-11-16 | PASS      | Pin e última release security 26.13.1.                     |
| `node scripts/sdd/check-job-results.mjs` | 2026-11-16 | PASS      | Checkout da base e gate obrigatório aprovado.              |

Logs: [detecção](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343/job/133108892700), [governança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343/job/133108942653), [código](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343/job/133108942648), [segurança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343/job/133108942673) e [gate](https://github.com/wezercarvalho/guess-my-move/actions/runs/43809865343/job/133109442949).

## Validações estruturais e documentais

- RED inicial: os três workflows usavam tags móveis sem opt-out de credenciais, .yarnrc.yml não selecionava nenhum escopo e o consolidador usava checkout da proposta. Asserções isoladas na base; não se alega execução oficial da suíte RED.
- GREEN: Actions checkout e setup-node v4.4.0 fixadas nos commits oficiais, 13 referências; sete checkouts com opt-out. Logs do CI confirmam pins e os cinco novos testes de política, paths, checkout da base, auditorias restritas à main e CODEOWNERS.
- Os cinco padrões locais/remotos têm equivalência literal e testes de amostras aprovados. O gate consolidou com sucesso a base e os resultados. O teste dos três contratos passou: http.openapi.json, swing.socketio.json e multiplayer.socketio.json.
- O diff não modifica dependências, lockfile, código do produto ou contratos. Os gates existentes de privacidade e fronteira foram executados no agregado; não houve nova auditoria manual de mídia, segredo ou bundle, nem teste com fork externo em ambiente real.
- O novo diff de reconciliação documental ainda requer seu próprio CI antes de integração.

## Constitution Check final

- PASS: escopo, nome do check obrigatório, dependências e comportamento preservados.
- PASS: evidências remotas reais e árvore integrada conferidas.
- PASS: limites de autoridade, revisão humana e riscos residuais explicitados.

## Convergência e limitações

O hook local não foi executado nesta sessão; testes do hook passaram no CI. As duas rotinas agendadas não foram disparadas separadamente; sua estrutura e os comandos de auditoria foram verificados no CI de PR. A configuração administrativa permanece inalterada. A consulta pós-merge confirmou o acesso admin do mantenedor, ruleset ativo, sem bypass, PR obrigatória, bloqueio de exclusão/force push e check obrigatório vinculado ao GitHub Actions. Não exige segundo aprovador, revisão de code owner, atualização estrita da branch ou resolução de conversas.

A listagem completa de acessos, parâmetros de Actions e scanning não está disponível à integração; proteção clássica retornou 403. A responsabilidade e a conferência manual estão explicitadas no guia de CI, antes de ampliar a colaboração. Um CI verde não garante independência do YAML nem ausência de vulnerabilidades. Não executar código externo privilegiado; revisar contribuições e arquivos sensíveis. Sem Codex, Work, merge pelo agente ou deploy.

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** 2026-11-16
- **Escopo aprovado:** FR-001 a FR-005, SC-001 a SC-004; endurecimento versionado dos gates, testes, documentação e integração da PR #173.
- **Riscos aceitos:** execução local indisponível, compensada pelos testes remotos aprovados; rotinas periódicas não disparadas separadamente, com verificações estruturais e auditorias no CI. Conferência administrativa permanece responsabilidade do mantenedor, fora de alteração de código; revisão humana continua necessária.
- **Observações:** autorização anterior “Pode considerar os gates aprovados”, retomada após esclarecimento de autoridade de merge e autorização “Pode fazer” após apresentação dos cinco jobs aprovados, limitações e pendências de registro do Gate 3/encerramento. O aceite da entrega técnica é registrado com base nessas manifestações, não inferido apenas do merge. Os controles administrativos não consultados não recebem veredito positivo.
