# Tarefas — 2026-10-20-vision-gesture-recognition-validate-waving-poc

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- A coluna "Issue" liga cada incremento ao item de trabalho no GitHub.

## Fase 1 — Setup e fundações (issue #3)

- [ ] T001 [FR-006] Criar o monorepo Yarn 1 com workspaces `apps/web`, `apps/server`, `packages/core`, `packages/providers`, `packages/benchmark` e scripts oficiais (issue #3)
- [x] T002 [FR-003] Scaffold do servidor NestJS mínimo com `GET /api/health` e `.env.example` só com placeholders (issue #3)
- [x] T003 [NFR-001] Ligar os gates `typecheck`, `lint`, `test`, `build` ao `pr-gate` e ao hook, com `yarn security:dependencies` verde e versões exatas (issue #3)

## Fase 2 — Contrato da carta (issue #11, pré-requisito vindo da Parte B)

- [x] T004 [US-002] [FR-007] Escrever teste falhando que separa `public` de `evaluation` e impede `evaluation` de cruzar a fronteira do adivinhador em `packages/core` (issue #11)
- [x] T005 [US-002] [FR-007] Implementar `Card = { id, locale, public, evaluation }` com validação de schema e a carta Acenar (issue #11)
- [x] T006 [US-002] [FR-007] Confirmar teste direcionado passando e adicionar nova carta sem alterar o motor (issue #11)

## Fase 3 — API e provedor simulado (issue #6)

- [ ] T007 [US-001] [FR-009] Escrever teste falhando de validação de payload, limites e erro estável em `apps/server` (issue #6)
- [ ] T008 [US-001] [FR-003] Implementar a rota `POST /api/guess` que mantém a credencial fora do navegador (issue #6)
- [ ] T009 [US-001] [FR-005] Implementar o `MockGuesserProvider` que roda sem credencial (issue #6)
- [ ] T010 [US-001] [FR-004] Validar a saída por schema permitindo "evidência insuficiente" (issue #6)
- [ ] T011 [US-001] [FR-006] Isolar o provedor atrás de `GuesserProvider`, selecionável por configuração (issue #6)
- [ ] T012 [US-001] [FR-010] Registrar métricas técnicas sem mídia (duração, sucesso/erro, nº de frames, provedor) (issue #6)

## Fase 4 — Fronteira de informação (issue #8)

- [ ] T013 [US-002] [FR-007] Escrever teste de fronteira que falha se palavra, dica, sugestão, resposta canônica, aliases ou critérios entrarem no payload/prompt (issue #8)
- [ ] T014 [US-002] [SC-002] Demonstrar que o teste passa e falha ao adicionar um campo da carta ao payload (issue #8)

## Fase 5 — Câmera (issue #4)

- [ ] T015 [US-001] [FR-001] Escrever teste falhando de consentimento, preview, indicador e parada da câmera em `apps/web` (issue #4)
- [ ] T016 [US-001] [FR-001] Implementar a câmera com tratamento de permissão negada e nenhuma requisição ao modelo quando negada (issue #4)

## Fase 6 — Captura de frames (issue #5)

- [ ] T017 [US-001] [FR-002] Escrever teste falhando de captura de janela ordenada com `timestampMs` e limites (issue #5)
- [ ] T018 [US-001] [FR-002] Implementar captura com limites de quantidade/resolução/tamanho e descarte após o uso, sem persistir nem logar (issue #5)
- [ ] T019 [US-001] [FR-011] Avisar o jogador de que os frames são enviados a um provedor externo (issue #5)

## Fase 7 — Interface de estados (issue #9)

- [ ] T020 [US-001] [FR-008] Escrever teste falhando dos estados `capturing`/`processing`/`success`/`error` (issue #9)
- [ ] T021 [US-001] [FR-008] Implementar a interface com a carta Acenar (dica/sugestão), ações e exibição da duração, câmera utilizável após erro (issue #9)

## Fase 8 — Adaptador codex (issue #7)

- [ ] T022 [US-001] [FR-013] Confirmar empiricamente múltiplas imagens, modelo e esforço no Codex CLI e registrar a decisão sobre fallback pela API da OpenAI (issue #7)
- [ ] T023 [US-001] [FR-012] Escrever teste falhando (executável simulado) para o adaptador `codex` selecionável por configuração (issue #7)
- [ ] T024 [US-001] [FR-012] Implementar o adaptador `codex` desligado por padrão, com saída validada por schema (issue #7)
- [ ] T025 [US-002] [FR-014] Garantir diretório temporário vazio somente leitura, uma execução por vez, timeout e limpeza dos temporários (issue #7)

## Fase 9 — Benchmark (issue #10)

- [ ] T026 [US-003] [SC-001] Implementar o CLI offline de benchmark que lê clipes locais fora do Git e roda contra o provedor configurado (issue #10)
- [ ] T027 [US-003] [SC-001] Produzir o modelo de relatório com métricas por provedor/variante, amostra declarada e limitações, sem taxa de acerto geral (issue #10)
- [ ] T028 [US-003] [SC-004] Registrar a latência via `codex` como não representativa e separar visão de semântica (aliases determinísticos) (issue #10)

## Fase final — Convergência

- [x] T029 [FR-003] Atualizar README, `quality-gates.md` (comandos reais) e o catálogo de specs afetados (issue #3)
- [ ] T030 [SC-003] Executar os gates oficiais e registrar `validation.md` com comandos e resultados reais (issue #10)
- [ ] T031 [SC-005] Reconciliar spec, plano, tarefas, implementação e evidências e aferir as metas exploratórias (issue #10)

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                |
| --------- | ---------------------- | ------------------------------------------------- |
| FR-001    | T015, T016             | Teste de câmera + demonstração                    |
| FR-002    | T017, T018             | Teste de captura; verificação de não persistência |
| FR-003    | T002, T008, T029       | Teste de integração da rota                       |
| FR-004    | T010                   | Teste de validação de schema                      |
| FR-005    | T009                   | Suíte sem custo (SC-003)                          |
| FR-006    | T001, T011             | Teste de contrato; troca por configuração         |
| FR-007    | T004, T005, T006, T013 | Teste de fronteira (SC-002)                       |
| FR-008    | T020, T021             | Teste de UI + demonstração                        |
| FR-009    | T007                   | Testes de erro estável e limites                  |
| FR-010    | T012                   | Teste de logging sem conteúdo                     |
| FR-011    | T019                   | Teste de UI                                       |
| FR-012    | T023, T024             | Teste de seleção por configuração                 |
| FR-013    | T022                   | Teste de configuração do adaptador                |
| FR-014    | T025                   | Teste com executável simulado                     |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Ordem sugerida: #3 → #11 → #6 → #8 → #4 → #5 → #9 → #7 → #10.
- #7 (adaptador `codex`) depende de #6 e #8; #10 (benchmark) depende de #6, #7 e das metas da clarificação (#1).
- Testes automatizados usam o `MockGuesserProvider`; chamadas pagas ficam no comando de benchmark, nunca no gate padrão.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** wezercarvalho
- **Data:** `2026-10-21`
- **Lacunas:** nenhuma — cada FR tem ao menos uma tarefa formal; objetivos, fora de escopo, histórias, requisitos e critérios de sucesso convergem entre `spec.md`, `clarification.md`, `plan.md` e este arquivo.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `plan.md`, `tasks.md`
- **Referência:** instrução explícita do maintainer na sessão de 2026-10-21 ("considere todos os gates aprovados" para as issues existentes).
- **Exceções:** nenhuma.
