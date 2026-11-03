# Tarefas

- [x] T001 [FR-001] Testes de seleção e URLs antes da seleção de modo.
- [x] T002 [FR-002] [NFR-001] Testes de cenário, âncoras e colisão antes do gerador Aurora.
- [x] T003 [FR-003] [FR-004] Testes de exercícios antes da função cumulativa, controlador e painel.
- [x] T004 [NFR-002] Passe visual procedural simples e descarte de recursos.
- [ ] T005 [NFR-003] Gates, demonstração e PR em rascunho, documentando limites.

- [ ] T006 [SC-002] Maintainer testa visual e câmera real e registra aceite final; reservado ao usuário nesta conversa.

## Revisão independente por outro agente

Codex principal revisou código e capturas. Achados corrigidos: spawn entre torres próximas fechava a vista; a posição inicial agora é livre e tem âncora frontal visível. A entrada em agarre retirava teias e podia completar indevidamente o exercício de soltar; agora exige liberação intencional, ausência de teias e não estar agarrado, com regressão automatizada. Capturas desktop e mobile finais revisadas sem novo achado material. Essa revisão por agente não substitui câmera real nem o julgamento estético do maintainer.

## Cobertura

FR-001 → T001; FR-002 → T002; FR-003 e FR-004 → T003; NFR-001 → T002; NFR-002 → T004; NFR-003 → T005.

## Análise de consistência

- Status: aprovada
- Revisor: agente implementador
- Data: 2026-11-03
- Lacunas: nenhuma de escopo; revisão visual e câmera real pendentes.

Plano, issue #108 e requisitos convergem; dependência de feedback #109 já integrada na main a614920. Gates humanos finais de câmera e visual seguem pendentes.

## Gate 2 — Plano e tarefas aprovados

- Status: aprovado
- Aprovador: wezercarvalho (maintainer)
- Data: 2026-11-03
- Artefatos aprovados: plan.md, tasks.md
- Referência: autorização de execução nesta conversa: “Entendi, pode fazer então. Ao final eu faço os testes com câmera real. Pode abrir em paralelo arranha-teia.”
- Exceções: nenhuma; autorização de executar a issue existente, detalhes técnicos reversíveis definidos pelo agente e disponibilizados para revisão.
