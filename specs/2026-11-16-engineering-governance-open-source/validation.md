# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** aprovado
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** GitHub Actions; agente assistente (reconciliação); wezercarvalho (merge e aceite).
- **Commit:** `fce3976954cb717df6d2de6c5f38900f87ad1433` (main); head `0a7765eff87497b26181fe71c654cbf6038d1533`; árvore integrada idêntica à testada em `b9bde2e0e90ef57e40e3e153b9594a193be2910d`.

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                          | Resultado |
| --------- | ---------- | ---------------------------------------------------------------------------------- | --------- |
| FR-001    | T001, T003 | CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, links e templates integrados.             | PASS      |
| FR-002    | T001, T003 | Políticas e canal privado condicionado à disponibilidade documentados.             | PASS      |
| FR-003    | T002, T003 | CI e testes de novos documentos, paridade e formatação aprovados.                  | PASS      |
| FR-004    | T003       | Aceite pelo merge e evidências na PR #176; reconciliação versionada nesta entrega. | PASS      |

## Comandos, evidências e limitações

[CI 43811508093](https://github.com/wezercarvalho/guess-my-move/actions/runs/43811508093), 16/11/2026: cinco jobs PASS, install immutable, test:sdd, sdd:check, docs:format:check, test:gates, check:all (contratos incluídos), security:dependencies, security:runtime e gate. O [comentário de evidências na PR #176](https://github.com/wezercarvalho/guess-my-move/pull/176#issuecomment-6908404712) registra jobs/commits e limitações. A issue #175 foi encerrada manualmente após conferir integração e aceite, com status:done. O hook local não foi executado, e habilitação do reporte privado e licença dos modelos não foram confirmadas. Não houve mudança administrativa ou deploy.

## Constitution Check final

O escopo técnico aprovado foi entregue na main, sem mudança de licença, jogos ou acesso. O merge aconteceu antes da consolidação versionada; documenta-se a exceção no mesmo fluxo de licenciamento sem abrir PR exclusiva de aceite. Checks do diff documental atual ainda devem passar.

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** 2026-11-16
- **Escopo aprovado:** FR-001 a FR-004, PR #176 e CI aprovado.
- **Riscos aceitos:** verificações administrativas fora do escopo, hook local indisponível e sincronização dos artefatos após merge, conforme decisão de usar merge como aceite e evitar PR exclusiva. Sem presumir canal privado funcional.
- **Observações:** merge do mantenedor às 05:40:42 UTC; confirmação “Merge feito” e decisão expressa de aceite pelo merge. Evidências publicadas na própria PR. Registro versionado sincronizado junto à #177.
