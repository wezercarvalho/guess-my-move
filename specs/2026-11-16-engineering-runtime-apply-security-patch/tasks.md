# Tarefas

## Implementação

- [x] T001 [US-001] [FR-001] [SC-001] Registrar a falha RED do runtime na main e a versão corretiva indicada pelo monitor.
- [x] T002 [US-001] [FR-001] [NFR-002] Preparar pin e engines e reconciliar referências vigentes, preservando histórico, lockfile e workflows.
- [x] T003 [US-001] [FR-001] [SC-001] Instalar no runtime atualizado e executar `yarn security:runtime` para demonstrar GREEN e registrar evidência.
- [x] T004 [US-002] [FR-002] [NFR-001] Executar `yarn check:all`, conferir servidor compilado e entrada, retomada e revanche nos dois jogos online.
- [ ] T005 [US-002] [FR-003] [NFR-002] Executar `yarn contracts:check`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`.
- [ ] T006 [US-002] [FR-004] [NFR-003] Registrar resultados reais, diff, limitações e rastreabilidade em validation.md.
- [ ] T007 [FR-004] [SC-003] Conferir critérios da issue, publicar e verificar PR em draft; reconciliar evidências antes do aceite final.

## Reconciliação pós-merge — 16/11/2026

T003 e T004 concluídas com evidências do [CI da PR #169](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592) no Node 26.13.1. T005 possui evidências de testes de gates e SDD, catálogo, formatação e auditoria de dependências; falta executar `yarn contracts:check`. T006 e T007 permanecem abertas para convergência final, embora a PR original tenha sido publicada em draft e posteriormente integrada pelo mantenedor. Ver [validation.md](validation.md).

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

## Emenda CQ-003 — Gate permanente de contratos

- [x] T008 [FR-005] [SC-004] Registrar a asserção de regressão estrutural, sua falha no manifesto anterior e acrescentar o comando oficial ao agregado completo.
- [x] T009 [FR-005] [NFR-002] [SC-004] Preservar os scripts e filtros vigentes, o modo static e atualizar documentação de CI, qualidade e desenvolvimento.
- [ ] T010 [FR-003] [FR-005] [SC-002] [SC-004] Executar CI da PR #170, verificar logs dos três contratos e do teste estrutural, registrar resultados e bloqueios sem antecipar Gate 3.

### Análise de consistência da emenda

FR-005 e SC-004 cobertos por T008–T010; nenhuma alteração nos contratos públicos, dependências ou regras dos jogos. A asserção falha no script anterior; execução da suíte oficial depende de CI.

### Registro de autorização de implementação

- **Status:** implementação autorizada pelo mantenedor.
- **Aprovador:** wezercarvalho, 2026-11-16.
- **Referência:** “Pode fazer”, em resposta à proposta explícita de incorporar a verificação de contratos permanentemente ao CI, seguindo SDD.
- **Limites:** aprovação de escopo e execução da melhoria; desenho mínimo escolhido pelo agente e registrado no plano, sem revisão linha a linha; resultados e Gate 3 pendentes.
