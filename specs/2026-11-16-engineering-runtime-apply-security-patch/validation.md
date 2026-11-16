# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** GitHub Actions (execução); agente assistente (reconciliação dos logs); aceite final do mantenedor pendente
- **Commit:** head testado `a711f9bd9522c6d78edbfb36640f32a267f7eedc`; merge na main `2cb53b7f65d6f3a21cf8ff29df9e54c31858b8b2`

## Resumo do resultado

A [PR #169](https://github.com/wezercarvalho/guess-my-move/pull/169) foi integrada pelo mantenedor em 16/11/2026, às 04:51 UTC. O [CI](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592) aprovou os cinco jobs selecionados antes do merge. O pin na main é 26.13.1. A execução independente de contratos ainda não foi demonstrada; o Gate 3 não é automaticamente aprovado pelo merge.

## Conclusão das tarefas

T001–T004 concluídas; T005 parcialmente comprovada; T006–T007 permanecem abertas até registro completo e revisão final. Ver [tasks.md](tasks.md).

## Evidências por requisito

| Requisito | Tarefas    | Evidência | Resultado |
| --------- | ---------- | --------- | --------- |
| FR-001    | T001–T003  | Pin e engines atualizados; auditoria RED anterior e GREEN no Node 26.13.1. | PASS |
| FR-002    | T004       | check:all, smoke compilado e suites E2E de Swing e bolinhas, incluindo retomada e revanche. | PASS |
| FR-003    | T005       | Governança, auditorias e testes aprovados; contracts:check independente não demonstrado. | BLOCKED |
| FR-004    | T006–T007  | PR, issue, commit, logs e limitações vinculados; convergência final pendente. | BLOCKED |

## Histórias e critérios de aceitação

- US-001: pin 26.13.1 confirmado na main e nos logs do CI; auditoria sem release marcada security posterior ao pin.
- US-002: regressões automatizadas e smoke aprovados; contratos independentes e aceite final ainda pendentes.

## Comandos executados

Resultados de 16/11/2026 no [run 43806311592](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592), salvo indicação:

| Comando | Resultado | Evidência |
| ------- | --------- | --------- |
| `yarn security:runtime` (main anterior, 15/11) | FAIL | [RED](https://github.com/wezercarvalho/guess-my-move/actions/runs/43732104155): pin 26.12.1, última security 26.13.1. |
| `yarn install --immutable` | PASS | Instalação aprovada nos jobs de código, governança e auditoria. |
| `yarn security:runtime` | PASS | Node 26.13.1; nenhuma release marcada security posterior. |
| `yarn security:dependencies` | PASS | info=0, low=0, moderate=0, high=0, critical=0 no momento da consulta. |
| `yarn check:all` | PASS | Typecheck, lint, testes, builds e smoke compilado; DI/metadados, health 200, início 201, validação 400, cancelamento 200. |
| `yarn test:sdd` | PASS | 109 testes, zero falhas. |
| `yarn sdd:check` | PASS | Catálogo, estados, gates, cobertura e links válidos. |
| `yarn docs:format:check` | PASS | Passo de formatação dos docs aprovado no CI, conforme escopo dos arquivos alterados. |
| `yarn test:gates` | PASS | 241 testes, zero falhas. |
| `yarn contracts:check` | BLOCKED | Não consta no CI da PR; a composição de check:all não o inclui. Requer execução adicional. |

Logs: [código](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592/job/133097866141), [governança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592/job/133097866093), [segurança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592/job/133097866084).

### Multiplayer e regressões

- Swing: suite `swing.e2e.test.ts` (6 aprovações), incluindo sessão, pausa/retomada e revanche bilateral; `swing-room.test.ts` (11 aprovações).
- Bolinhas: suite `multiplayer.e2e.test.ts` (10 aprovações), incluindo retomada e rejeição de mídia; `marbles-client-server.test.ts` (4 aprovações), incluindo entrada, retomada e revanche.
- Smoke do servidor compilado passou, com ausência de logs de credenciais reportada pelo teste.
- Não houve demonstração manual com câmera física nem validação de implantação.

## Validações estruturais e documentais

- A PR #169 alterou apenas pin, engines, documentação e artefatos SDD (13 arquivos); nenhum arquivo de código dos jogos, lockfile ou workflow foi alterado.
- A auditoria SDD e os testes executados dão evidência automatizada para o escopo original. Nenhum pentest, revisão de segredos em histórico ou validação manual de produção foi realizado.
- O hook local não foi executado nesta preparação pela integração GitHub; o gate remoto passou.
- Alertas não bloqueantes nos logs: chunk Swing acima de 500 kB, mensagens React act e depreciações de APIs/actions. Não alterados neste escopo.

## Constitution Check final

- PASS: escopo de implementação preservado; merge efetuado pelo mantenedor, não pelo agente.
- PASS: segurança e governança remotas aprovadas no head testado.
- PENDENTE: execução independente de contratos e aceite final humano.

## Convergência e limitações

Os registros de preparação foram reconciliados com os logs reais. A PR #169 já está integrada; o novo registro não implica execução adicional dos testes. A produção está fora do escopo. Não afirmar ausência de vulnerabilidades nem promover a spec a validated sem concluir os critérios ou obter uma decisão explícita e fundamentada sobre eventuais riscos residuais. O acompanhamento está na [issue #132](https://github.com/wezercarvalho/guess-my-move/issues/132).

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** mantenedor, após resultados
- **Riscos aceitos:** nenhum aceite final registrado
- **Observações:** manter a issue #132 aberta até confirmar o check de contratos e a convergência. A adoção em eventual implantação é separada.
