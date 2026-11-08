# Tarefas — 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `validating`; Gates 1 e 2 aprovados pelo maintainer em 2026-10-31.

## Fase 1 — Lógica pura test-first

- [x] T001 [US-002] [FR-004] Escrever `feedback.test.ts` falhando para `deriveChips` (trava, agarre, escalada com contagem e barra, parede, rosto fora, vazio fora de `playing`) e implementar em `feedback.ts`.
- [x] T002 [US-002] [FR-005] Escrever testes falhando de `feedbackEvents` (direção liberada, soltou da parede, teia presa com a mão, teia solta, rosto detectado, nada fora de `playing`) e implementar.

## Fase 2 — Componente

- [x] T003 [US-002] [US-003] [FR-006] Escrever `SwingFeedback.test.tsx` falhando (chips, avisos que somem em 1,6 s, no máximo três, região `aria-live`, sem captura de ponteiro) e implementar o componente e o CSS.

## Fase 3 — Layout

- [x] T004 [US-001] [US-004] [FR-001] [FR-002] [FR-003] [FR-007] Ajustar `SwingScreen.test.tsx` (cabeçalho compacto com Depuração, feedback dentro do palco, rótulo sem repetição) vendo falhar; reestruturar `SwingScreen`, `swing.css`, `styles.css`, `swing.html` e `SwingApp`.

## Fase 4 — Demonstração e convergência

- [x] T005 [US-001] [US-003] [FR-001] [FR-002] [FR-006] Medir no Chromium (1440×900, 1280×720, 390×844) a altura do documento contra a janela e conferir a posição dos avisos; registrar como texto.
- [x] T006 [FR-008] [NFR-004] Rodar `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check` e `security:dependencies`; confirmar que nada regride.
- [x] T007 [NFR-003] Registrar `validation.md`, atualizar README e guia de arquitetura, abrir o PR e aguardar o teste do maintainer.

## Cobertura

| Requisito | Tarefas    | Evidência esperada                             |
| --------- | ---------- | ---------------------------------------------- |
| FR-001    | T004, T005 | classe e medição em Chromium                   |
| FR-002    | T004, T005 | empilhamento em 390×844                        |
| FR-003    | T004, T005 | testes da tela e medição com a gaveta aberta   |
| FR-004    | T001       | `feedback.test.ts`                             |
| FR-005    | T002       | `feedback.test.ts`                             |
| FR-006    | T003, T005 | `SwingFeedback.test.tsx` e captura no Chromium |
| FR-007    | T004       | `SwingScreen.test.tsx`                         |
| FR-008    | T006       | suíte completa verde                           |

## Dependências e paralelismo

- T001 e T002 antecedem T003. T003 antecede a integração em T004. T005 espera T004. T006 e T007 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente)
- **Data:** `2026-10-31`
- **Lacunas:** nenhuma; FR-001 a FR-008 têm tarefa e evidência planejadas. O modo treino está explicitamente fora de escopo (issue #108).

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem do maintainer na sessão de 2026-10-31 ("Pode considerar os gates aprovados. Me avisa quando eu puder testar.")
- **Exceções:** nenhuma.
