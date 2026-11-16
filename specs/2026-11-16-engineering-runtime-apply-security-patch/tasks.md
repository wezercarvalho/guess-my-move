# Tarefas

## Implementação

- [x] T001 [US-001] [FR-001] [SC-001] Registrar a falha RED do runtime na main e a versão corretiva indicada pelo monitor.
- [x] T002 [US-001] [FR-001] [NFR-002] Preparar pin e engines e reconciliar referências vigentes, preservando histórico, lockfile e workflows.
- [ ] T003 [US-001] [FR-001] [SC-001] Instalar no runtime atualizado e executar `yarn security:runtime` para demonstrar GREEN e registrar evidência.
- [ ] T004 [US-002] [FR-002] [NFR-001] Executar `yarn check:all`, conferir servidor compilado e entrada, retomada e revanche nos dois jogos online.
- [ ] T005 [US-002] [FR-003] [NFR-002] Executar `yarn contracts:check`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`.
- [ ] T006 [US-002] [FR-004] [NFR-003] Registrar resultados reais, diff, limitações e rastreabilidade em validation.md.
- [ ] T007 [FR-004] [SC-003] Conferir critérios da issue, publicar e verificar PR em draft; reconciliar evidências antes do aceite final.

## Cobertura

FR-001: T001–T003; FR-002: T004; FR-003: T005; FR-004: T006–T007.

## Dependências e paralelismo

T003–T005 dependem da instalação no ambiente atualizado. T006–T007 consolidam evidências, sem presumir a conclusão dos testes.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** agente assistente, análise manual
- **Data:** 2026-11-16
- **Lacunas:** nenhuma no mapeamento de requisitos; execução de testes e aceite final ainda pendentes.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** 2026-11-16
- **Artefatos aprovados:** plan.md, tasks.md, conforme abordagem e limites apresentados na sessão.
- **Referência:** sessão de 16/11/2026: “Pode considerar tudo aprovado”; após o resumo técnico e a análise de segurança, “Pode seguir, então [...] pode deixar o pull request em draft daí”.
- **Exceções:** nenhuma autorização de merge, deploy ou aceite final; autorização de execução no escopo apresentado, sem revisão linha a linha dos artefatos.
