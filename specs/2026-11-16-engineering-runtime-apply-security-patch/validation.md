# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** agente assistente; revisão final do mantenedor pendente
- **Commit:** identificar no head da PR após publicação

## Evidências por requisito

- FR-001 / T001–T003: RED observado na main; alteração de pin e engines proposta; GREEN pendente.
- FR-002 / T004: regressão e multiplayer no novo runtime pendentes.
- FR-003 / T005: contratos, governança e auditorias no novo runtime pendentes.
- FR-004 / T006–T007: registro inicial presente; PR e evidências finais pendentes de conferência.

## Comandos e evidências

- Auditoria anterior do runtime: FAIL em 15/11/2026, comprovada pelo [run remoto](https://github.com/wezercarvalho/guess-my-move/actions/runs/43732104155); pin 26.12.1, última security 26.13.1, exit 1.
- `yarn install --immutable`, `yarn security:runtime`, `yarn check:all`, `yarn contracts:check`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`: BLOCKED nesta preparação remota; não executados no novo runtime.
- Hook de pré-push: não executado; publicação por integração GitHub, sem checkout local validado.
- Multiplayer: entrada, retomada e revanche nos dois jogos online ainda não demonstradas no novo runtime.

## Convergência e limitações

Nenhuma mudança intencional em dependências, regras ou contratos. A revisão estática não substitui testes. A PR deve permanecer em draft; o workflow atual pula validações completas em rascunho. Produção fora do escopo. Não marcar validating/validated com tarefas abertas.

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** mantenedor, após resultados
- **Riscos aceitos:** nenhum aceite final registrado
- **Observações:** não realizar merge, deploy nem encerrar #132 com base apenas na publicação.
