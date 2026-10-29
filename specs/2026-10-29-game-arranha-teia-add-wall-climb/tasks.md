# Tarefas — 2026-10-29-game-arranha-teia-add-wall-climb

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `implementing`. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29; o **Gate 3 fica pendente** do teste ao vivo do maintainer. A implementação é test-first; `validation.md` e o Gate 3 seguem ao fim.

## Fase 1 — Sinais de gesto puros (packages/swing/climb.ts)

- [x] T001 [US-002] [US-003] [FR-004] Escrever `packages/swing/test/climbSignal.test.ts` falhando e implementar, em `packages/swing/src/climb.ts`, as funções puras `climbSignal(dyLeft, dyRight, config)` (movimento alternado reduzido a -1..1, com zona morta `climbDeadzone` e saturação; positivo quando uma mão desce e a outra sobe, negativo no oposto, zero na zona morta) e `pullBackSignal(dzLeft, dzRight, config)` (verdadeiro quando uma mão se afasta da câmera além de `pullBackThreshold`). Dados sintéticos, sem afirmar precisão. Critério: testes verdes vistos vermelhos antes

## Fase 2 — Estado de agarre na física pura (packages/swing)

- [x] T002 [US-001] [US-002] [FR-001] [FR-002] Escrever `packages/swing/test/climb.test.ts` falhando para o estado de agarre e implementar `WallGrip`, `SwingState.grip`, `touchingWall` e `stepGrip` em `packages/swing/src/climb.ts` com a chamada em `packages/swing/src/physics.ts`: entra só com contato de parede (`Contact.kind !== 'roof'`) mais `grab` em alguma mão (zera a velocidade, solta as teias presas, guarda a normal); agarrado, sem gravidade e sem deslize, sobe/desce por `climb * climbSpeed` limitado, colado à parede; sem contato não agarra. Critério: testes verdes vistos vermelhos antes
- [x] T003 [US-004] [FR-003] Escrever os testes falhando das quatro saídas do agarre e o **teste de propriedade** (`SC-002`) em `climb.test.ts` e implementar as saídas em `stepGrip`: (a) `grab` vazio ou `release`; (b) teia presa no passo; (c) topo do prédio → telhado (`grounded`); (d) inatividade acima de `gripIdleMs`. O teste de propriedade roda muitas sequências aleatórias de `grab`/`climb`/`release` e exige que o jogador saia do agarre em um número finito de passos. Critério: testes verdes vistos vermelhos antes

## Fase 3 — Entrada por passo no mundo (packages/swing/world.ts)

- [x] T004 [US-001] [US-002] [US-003] [FR-002] Acrescentar ao `SwingInput` de `packages/swing/src/world.ts` os campos `grab?: SlotFlags`, `climb?: number` e `release?: boolean`, repassá-los ao `stepPlayer`/`stepGrip`, exportar os tipos/funções novos em `packages/swing/src/index.ts`, e escrever casos novos em `packages/swing/test/world.test.ts` (agarrar com contato, subir/descer, soltar) sem regredir os existentes. Critério: casos novos verdes e suíte do pacote sem regressão

## Fase 4 — Camada web: controlador, precedência e teclas (apps/web/src/swing)

- [x] T005 [US-001] [FR-005] [FR-006] Escrever os casos novos falhando em `apps/web/src/swing/swingController.test.ts` e implementar no `swingController.ts`: guardar o pulso anterior por mão e calcular `dy`/`dz`, chamar `climbSignal`/`pullBackSignal`, aplicar a precedência da palma (`touchingWall` + palma aberta → `grab` do lado; senão a palma segue soltando a teia), e as teclas `V` (agarrar enquanto segurada) e setas para cima/baixo (reaproveitadas como `climb` quando agarrado), alimentando o `SwingInput`. Mudanças pequenas e localizadas. Critério: casos novos verdes, testes de teia por mão sem regressão

## Fase 5 — Camada web: guia, HUD e depuração (apps/web/src/swing)

- [x] T006 [US-005] [FR-007] Escrever os casos novos falhando e implementar: o medidor de estado mostra "Agarrado" quando `grip` não é nulo (`SwingScreen.tsx`); o guia e a linha de status ganham a dica curta do agarre ("Na parede: mãos abertas, alterne para subir. Puxe a mão para soltar.") (`guide.ts`); o `SwingDebugPanel.tsx` mostra, por mão, o sinal de escalada e o de soltar. Textos curtos. Critério: casos novos verdes em `SwingScreen.test.tsx` e `guide.test.ts`

## Fase 6 — Não regressão do fluxo de teia por mão

- [x] T007 [FR-008] [NFR-002] Rodar a suíte completa do pacote e da web e confirmar que `twoWebs`, `moves`, `sides`, `physics`, `world` (swing) e `swingHands`, `SwingScreen` (web) continuam passando; o agarre só age com `grab` + contato de parede e não altera lançar/segurar/puxar/soltar teias fora do agarre. Critério: `yarn check:all` verde sem regressão

## Fase 7 — Documentação

- [x] T008 [FR-007] [NFR-004] Atualizar o `README.md` da raiz (seção do Arranha-Teia) e, se o jogo for citado, o guia de arquitetura, com uma linha sobre o agarre à parede (mãos abertas em contato agarram, alternar sobe/desce, puxar a mão solta; teclas `V` e setas), declarando que o sinal de profundidade é aproximado e não medido ao vivo; acrescentar a linha desta spec em `specs/README.md`. Critério: `yarn docs:format:check` verde

## Fase 8 — Gates e verificação (validation.md ao fim)

- [x] T009 [SC-001] [SC-002] [SC-003] [SC-004] [SC-005] [SC-006] [NFR-001] [NFR-002] [NFR-003] [NFR-004] [NFR-005] Rodar `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`; executar os dois pilotos automáticos descartáveis na cidade real (`midtown.json`): um sobe até o topo e sai no telhado, outro tenta sequências aleatórias e prova que o agarre nunca prende; rodar a inspeção em Chromium headless (teclado `V` + setas no lugar da mão): agarrar com contato de parede, subir, soltar, só requisições à própria origem, sem erros no console. Registrar tudo como TEXTO em `validation.md`, sem salvar imagens. Critério: gates verdes e evidência registrada

## Fase final — Convergência (Gate 3, pendente)

- [ ] T010 [SC-006] [NFR-003] Preencher `validation.md` (estado, evidências por requisito com uma linha PASS própria por FR, histórias, comandos, medições como texto, limitações) e deixar o **Gate 3 pendente** do teste ao vivo do maintainer; manter a spec em `implementing` (não marcar `validated` por conta própria). Critério: `validation.md` completo com o Gate 3 explicitamente pendente

## Cobertura

| Requisito | Tarefas    | Evidência esperada                                                                    |
| --------- | ---------- | ------------------------------------------------------------------------------------- |
| FR-001    | T002       | `climb`/`physics` tests: entra só com contato; zera velocidade; solta teias           |
| FR-002    | T002, T004 | `climb`/`world` tests: sobe/desce por `climb`, limitado, colado à parede              |
| FR-003    | T003       | `climb` tests + teste de propriedade: as quatro saídas e a saída em tempo finito      |
| FR-004    | T001       | `climbSignal` tests: movimento alternado, zona morta, saturação, `pullBackSignal`     |
| FR-005    | T005       | `swingController` test: precedência da palma (contato agarra, sem contato solta teia) |
| FR-006    | T005       | `swingController`/`guide` tests: teclas `V` e setas, integração do agarre             |
| FR-007    | T006       | `SwingScreen`/`guide`/debug tests: medidor "Agarrado", dica, sinais por mão           |
| FR-008    | T007       | suíte completa verde: `twoWebs`, `moves`, `sides`, `swingHands` sem regressão         |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (`climb.ts` sinais) e a Fase 2 (estado de agarre) são a base; a Fase 2 depende de `physics.ts`/`cityIndex.ts` existentes.
- A Fase 3 (`world`) depois da Fase 2. A Fase 4 (controlador) depois das Fases 1 a 3. A Fase 5 (tela) depois da Fase 4.
- A Fase 6 (não regressão) depois das Fases 2 a 5. A Fase 7 (docs) depois da Fase 5. A Fase 8 e o Gate 3 fecham, com o Gate 3 pendente do teste do maintainer.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação antecipada do maintainer wezercarvalho
- **Data:** `2026-10-29`
- **Lacunas:** nenhuma. Todos os oito FR têm tarefa formal (FR-001 em T002, FR-002 em T002/T004, FR-003 em T003, FR-004 em T001, FR-005 em T005, FR-006 em T005, FR-007 em T006, FR-008 em T007). Os critérios de sucesso têm cobertura: SC-001 pelos testes do estado de agarre (T002/T003), SC-002 pelo teste de propriedade (T003), SC-003 pelos testes de `climbSignal`/`pullBackSignal` (T001), SC-004 pelo teste do controlador (T005), SC-005 pelos pilotos automáticos e pela inspeção headless (T009), SC-006 pelos gates (T009). Os NFR: NFR-001 pela estratégia test-first de cada parte (T001 a T006), NFR-002 pelos gates (T007/T009), NFR-003 pela ausência de afirmação de precisão/fps (T008/T009/T010), NFR-004 pela verificação de rede e privacidade (T008/T009), NFR-005 pelos pilotos automáticos registrados como texto (T009). O Gate 3 fica pendente do teste ao vivo (T010), e a spec permanece em `implementing`.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-29`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem do maintainer na sessão de 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."), aprovando antecipadamente os Gates 1 e 2; issue 81 do repositório (ver `spec.md`).
- **Exceções:** nenhuma. Aprovação antecipada no chat. O **Gate 3 NÃO** está aprovado: fica pendente do teste ao vivo do maintainer, e a spec permanece em `implementing` com o Gate 3 pendente, sem afirmar precisão nem desempenho sem medição.
