# Tarefas — <ID e título>

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.

## Fase 1 — Setup e fundações

- [ ] T001 [FR-001] <ação objetiva e caminho>

## Fase 2 — Incremento test-first <história>

- [ ] T002 [US-001] [FR-002] Escrever teste falhando para <comportamento> em <teste>
- [ ] T003 [US-001] [FR-002] Confirmar falha esperada com `<comando oficial>`
- [ ] T004 [US-001] [FR-002] Implementar mínimo em <caminho>
- [ ] T005 [US-001] [FR-002] Confirmar teste direcionado passando
- [ ] T006 [US-001] [FR-002] Integrar <contrato/comando/componente>
- [ ] T007 [US-001] [SC-001] Demonstrar <critério observável>
- [ ] T008 [US-001] [FR-002] Refatorar mantendo testes verdes

## Fase final — Convergência

- [ ] T009 [FR-001] Atualizar documentação, contratos e catálogo afetados
- [ ] T010 [SC-001] Executar gates aplicáveis e registrar `validation.md`
- [ ] T011 [SC-001] Reconciliar spec, plano, tarefas, implementação e evidências

## Cobertura

| Requisito | Tarefas    | Evidência esperada |
| --------- | ---------- | ------------------ |
| FR-001    | T001, T009 | <evidência>        |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- <ordem, bloqueios e grupos `[P]`>.

## Análise de consistência

- **Status:** pendente | aprovada | bloqueada
- **Revisor:** <pessoa ou função>
- **Data:** `AAAA-MM-DD`
- **Lacunas:** <nenhuma ou lista>

## Gate 2 — Plano e tarefas aprovados

- **Status:** pendente | aprovado | rejeitado
- **Aprovador:** <pessoa ou função>
- **Data:** `AAAA-MM-DD`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** <link, commit ou registro explícito da sessão>
- **Exceções:** <nenhuma ou lista aprovada>
