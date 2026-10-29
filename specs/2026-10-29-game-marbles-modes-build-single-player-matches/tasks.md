# Tarefas — 2026-10-29-game-marbles-modes-build-single-player-matches

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão (teste direcionado verde e gates aplicáveis).
- Ordem de implementação das issues: **#86 → #87 → #88 → #89 → #92 (com o Bete) → #90 → #91 → #93**, mais a documentação ao fim. A spec está em `implementing`; os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29 e o Gate 3 fica para o fim (risco aceito: sem teste ao vivo com a mão real; valores a calibrar; faixa de acerto do bot como proteção de regressão).

## Fase 1 — Controlador de mira (issue #86)

- [x] T001 [US-001] [FR-001] Escrever o teste falhando de `packages/marbles/test/aim.test.ts` para o controlador de mira (pinça e estalo): a partir da posição da bolinha de tiro, das leituras da mão e do relógio, devolve a mira em andamento e o tiro disparado; âncora relativa, escala, mão perdida e cancelamento; confirmar a falha esperada com `yarn test`
- [x] T002 [US-001] [FR-001] Implementar `packages/marbles/src/aim/` (controlador de mira puro) extraindo de `round.ts` a leitura por pinça e por estalo, sem importar `physics.ts` nem `round.ts`, e confirmar `aim.test.ts` verde, incluindo um teste de que o módulo não importa `physics.ts` nem `round.ts`
- [x] T003 [US-001] [FR-002] Fazer `round.ts` passar a usar o controlador de mira e confirmar `packages/marbles/test/round.test.ts` e `packages/marbles/test/flick-replay.test.ts` **verdes sem nenhuma alteração** (prova de paridade do comportamento do bete)

## Fase 2 — Motor de partida e contrato de modo (issue #87)

- [x] T004 [US-002] [FR-003] Escrever o teste falhando de `packages/marbles/test/match.test.ts` para o motor: 3 rodadas, competidor do tiro corrente, resultado da partida (2 vitórias e 1 derrota = vitória; 1-1-1 = empate; 3 empates = empate; 1 vitória e 2 derrotas = derrota), sem importar DOM, MediaPipe nem relógio; confirmar a falha esperada
- [x] T005 [US-002] [FR-004] Escrever o teste falhando do contrato de modo em `match.test.ts` (dois modos de teste: um que alterna a vez a cada tiro e um que mantém a vez após captura; limite de tiros por competidor e por adversário; avaliação do campo em repouso com o que o tiro rendeu, se terminou e o resultado; esgotamento de tiros não prende a rodada; vitória decidida encerra sem gastar os tiros restantes) e implementar o contrato até verde
- [x] T006 [US-002] [FR-005] Escrever o teste falhando dos adversários meta e bot em `match.test.ts` (contra a meta não há vez; contra o bot o jogador começa a rodada 1, a ordem alterna por rodada, tiro fora da vez não tem efeito) e implementar até verde
- [x] T007 [US-002] [FR-006] Escrever o teste falhando da interface de **fonte do tiro** em `match.test.ts` (o motor recebe o tiro por `ShotSource`; a cadeia — bolinha empurrada por outra que sai do campo — é atribuída ao competidor do tiro corrente; a mesma sequência e a mesma semente produzem o mesmo resultado) e implementar o motor (`packages/marbles/src/match/`) até verde
- [x] T008 [US-002] [SC-002] [NFR-001] Confirmar o determinismo do motor (mesmas leituras e semente → mesmo resultado) com teste direcionado e integrar o contrato e a fonte do tiro na API pública em `packages/marbles/src/index.ts`

## Fase 3 — Bot adversário por simulação (issue #88)

- [x] T009 [US-003] [FR-007] Escrever o teste falhando de `packages/marbles/test/bot.test.ts` (erro zero: a bolinha para a <= 1 unidade do ponto na física real `stepBodies` para pontos entre 50 e 700 unidades numa trajetória livre) e confirmar a falha esperada
- [x] T010 [US-003] [FR-007] Implementar `packages/marbles/src/bot/` (direção até um ponto; velocidade para parar no ponto por **busca com `stepBodies`**, não pela fórmula contínua) e confirmar o teste de parada verde
- [x] T011 [US-003] [FR-007] [SC-003] Escrever e passar os testes de erro controlado por semente (mesma semente e campo → tiro idêntico; sementes diferentes → tiros diferentes), do nível `DEFAULT_BOT` (1000 tiros com sementes distintas contra um alvo a 400 unidades, raio 14, taxa de acerto entre 30% e 60%) e do teto de velocidade (nenhum tiro excede `gain · maxPull`), com o planejador atendendo à interface de fonte do tiro
- [x] T012 [US-003] [NFR-002] [NFR-004] Fixar `DEFAULT_BOT` em configuração e declarar no código e no teste que os valores são palpites a calibrar e que a faixa de acerto é proteção de regressão, não equilíbrio medido

## Fase 4 — Bete como modo (issue #89)

- [x] T013 [US-004] [FR-008] Escrever o teste falhando de `packages/marbles/test/bete.test.ts` (contra a meta: acerto no 3º tiro = vitória e encerra; 4º ou 5º = empate; 5 sem acertar = derrota) e confirmar a falha esperada
- [x] T014 [US-004] [FR-008] Implementar `packages/marbles/src/modes/bete/` como modo (campo atual; alvo em 3 posições fixas, uma por rodada, igual para os dois; após erro a bolinha de tiro volta ao ponto de partida e o alvo à posição da rodada; ponto de chegada do bot = o alvo) e passar o teste contra a meta
- [x] T015 [US-004] [FR-008] Escrever e passar o teste do Bete contra o bot (vez alternada a cada tiro, até 5 tiros por competidor; quem acerta primeiro vence e encerra; 10 tiros sem acerto = empate; na rodada 2 o bot atira primeiro e na 3 o jogador; alvo na mesma posição para os dois dentro da rodada)
- [x] T016 [US-004] [FR-002] [FR-011] [NFR-005] `helpText` do Bete declarado (cita vitória, derrota e empate). **Concluído na etapa 3 (#92):** depois de migrar `apps/web` para o motor, o bete solo antigo (`createBeteRound`/`round.ts` e `round.test.ts`) foi removido e os exports de `index.ts` atualizados; os casos ainda relevantes do bete solo já estavam migrados (mira em `aim.test.ts`, resultado em `bete.test.ts`, estalo em `flick-replay.test.ts`). `flick-replay.test.ts` e os detectores de pinça/estalo seguem verdes.

## Fase 5 — Conduzir a partida na tela, com o Bete (issue #92)

- [x] T017 [US-007] [FR-012] Escrever o teste falhando de `apps/web/src/marbles/marblesController.test.ts` (o controlador conduz uma partida do motor em vez da rodada do bete: escolha de modo, adversário e controle de tiro; placar, rodada, tiros restantes e vez) e confirmar a falha esperada
- [x] T018 [US-007] [FR-012] Implementar `marblesController.ts`, `useMarblesGame.ts` e o desenho por modo em `fieldView.ts`, ligando a câmera (controlador de mira) e o bot à fonte do tiro, e passar o teste
- [x] T019 [US-007] [FR-012] Escrever o teste falhando e implementar a `MarblesScreen.tsx`: tela inicial (modo, adversário, pinça/estalo alpha, "Começar partida"); durante a partida (campo do modo, número da rodada, placar das rodadas, tiros restantes, vez); fim de rodada com o resultado e fim de partida com Vitória/Derrota/Empate e "Jogar de novo"/"Trocar de modo"; modo e adversário só mudam entre partidas
- [x] T020 [US-007] [FR-013] [NFR-003] Escrever e passar o teste do fluxo completo com câmera e rastreador simulados, para cada modo disponível, contra a meta e contra o bot: na vez do bot o gesto é ignorado, o status de uma linha diz que é a vez do bot e o tiro do bot é animado; a troca entre pinça e estalo continua; existe status de uma linha para cada estado (sem câmera, mão não vista, sua vez, vez do bot, rodada vencida/empatada/perdida, partida encerrada); aviso de privacidade e depuração recolhida como estão

## Fase 6 — Modo Triângulo (issue #90)

- [x] T021 [US-005] [FR-009] Escrever o teste falhando de `packages/marbles/test/triangle.test.ts` (formação inicial: 6 bolinhas dentro do círculo, nenhum par de centros a menos que a soma dos raios, nenhuma bolinha se move sozinha sem tiro) e confirmar a falha esperada
- [x] T022 [US-005] [FR-009] Implementar `packages/marbles/src/modes/triangle/` (círculo, 6 bolinhas em fileiras 1/2/3 com folga, bolinha de tiro de ponto fixo; captura quando uma bolinha para totalmente fora do círculo, atribuída ao competidor do tiro inclusive em cadeia; bolinha capturada sai e as demais ficam; 3 rodadas com a mesma formação) e passar o teste de captura e de cadeia
- [x] T023 [US-005] [FR-009] [FR-011] Escrever e passar os testes do Triângulo contra a meta (até 8 tiros; 6 capturas = vitória e encerra na 6ª; 4 ou 5 = empate; <= 3 = derrota) e contra o bot (captura mantém a vez; sem captura a vez passa; até 5 tiros por competidor; mais capturas vence; iguais, inclusive 0 a 0, empatam; ponto de chegada do bot = bolinha mais próxima da borda, mirando para fora — `triangleBotAimPoint`), e declarar o `helpText` do Triângulo

## Fase 7 — Modo Cova (issue #91)

- [x] T024 [US-006] [FR-010] Escrever o teste falhando de `packages/marbles/test/hole.test.ts` (entrada na cova ativa com centro dentro do raio e velocidade < 120 unid/s, inclusive parada; acima passa sem entrar; covas que não são a ativa não capturam; a bolinha de tiro permanece onde parou) e confirmar a falha esperada
- [x] T025 [US-006] [FR-010] Implementar `packages/marbles/src/modes/hole/` (3 covas numeradas raio 22, bolinha raio 14, em ordem, só a ativa captura; ao entrar fixa no centro, sai da simulação e a próxima cova fica ativa; a condição é avaliada a cada passo e na parada; 3 layouts fixos, um por rodada, iguais para os dois) e passar o teste de entrada e permanência
- [x] T026 [US-006] [FR-010] [FR-011] Escrever e passar os testes do Cova contra a meta (até 9 tiros; 3 covas em até 6 = vitória e encerra; 7 a 9 = empate; sem completar = derrota) e contra o bot (cada um com a sua bolinha, vez alternada, até 9 tiros cada; resultado por completar > menos tiros > mais covas, com os empates definidos — `resolveBotRound`; ponto de chegada do bot = centro da cova ativa com a velocidade que para nele — `botAimPoint` + `speedToStop`), e declarar o `helpText` do Cova

## Fase 8 — Ajuda de cada modo na tela (issue #93)

- [x] T027 [US-008] [FR-014] Escrever o teste falhando de componente do painel "Como jogar" (`apps/web/src/marbles/guideSteps.test.tsx` e o teste da `ShotGuide`) cobrindo os 3 modos e os 2 adversários (regras de vitória, derrota e empate; no máximo 2 frases por mensagem) e confirmar a falha esperada
- [x] T028 [US-008] [FR-014] Implementar `ShotGuide.tsx`/`guideSteps.ts` alimentados pelo `helpText` de cada modo: etapas do gesto com a atual destacada por `aria-current`, dicas curtas (inclusive a dica de força do estalo "fraco demais" como hoje), conteúdo que muda com o modo e o adversário e, antes de começar, mostra a ajuda do modo selecionado; passar os testes dos 3 modos × 2 adversários

## Fase final — Documentação e convergência

- [x] T029 [FR-008] [FR-009] [FR-010] [NFR-005] Atualizar a documentação: `docs/product/PROJECT_SPEC.md`, `docs/development-context/architecture/architecture-guide.md` e `specs/README.md` (nova linha no catálogo) para descrever os modos de jogo das bolinhas (controlador de mira, motor, contrato de modo, fonte do tiro, bot por simulação e os três modos), declarando as limitações sem medição (valores a calibrar, faixa de acerto como proteção de regressão, sem teste com mão real)
- [x] T030 [SC-001] [SC-004] [SC-005] [SC-006] Executar `yarn check:static`, `yarn test`, `yarn build`, `yarn sdd:check` e `yarn docs:format:check`, corrigir até verde e registrar `validation.md` (comandos, resultados, evidência por requisito e limitações); reconciliar spec, plano, tarefas, implementação e evidências
- [ ] T031 [SC-006] [NFR-004] Fechar o Gate 3 em `validation.md` com veredito e risco aceito (sem teste ao vivo com a mão real; valores a calibrar; faixa de acerto do bot como proteção de regressão) e atualizar o estado da spec para `validated` ao fim, sem afirmar equilíbrio nem diversão sem uso real

## Cobertura

| Requisito | Tarefas                | Evidência esperada                                                                   |
| --------- | ---------------------- | ------------------------------------------------------------------------------------ |
| FR-001    | T001, T002             | testes de `aim`; teste de que não importa `physics.ts` nem `round.ts`                |
| FR-002    | T003, T016             | `round.test.ts` e `flick-replay.test.ts` verdes sem alteração                        |
| FR-003    | T004                   | testes de `match` (resultado de partida, competidor do tiro)                         |
| FR-004    | T005                   | testes de `match` com modos de teste (vez, limites, avaliação, esgotamento, vitória) |
| FR-005    | T006                   | testes de `match` (meta sem vez; bot com alternância; tiro fora da vez)              |
| FR-006    | T007                   | testes de `match` com fonte do tiro e cadeia; determinismo                           |
| FR-007    | T009, T010, T011, T012 | testes de `bot` (parada a 1 unidade; semente; faixa 30–60%; teto `gain · maxPull`)   |
| FR-008    | T013, T014, T015, T016 | testes de `bete` (meta e bot); remoção do bete solo antigo                           |
| FR-009    | T021, T022, T023       | testes de `triangulo` (formação, captura, cadeia, meta e bot)                        |
| FR-010    | T024, T025, T026       | testes de `cova` (entrada por velocidade, permanência, meta e bot)                   |
| FR-011    | T016, T023, T026       | testes de ajuda não vazia que cita vitória, derrota e empate em cada modo            |
| FR-012    | T017, T018, T019       | testes de controlador e de tela (modo, adversário, placar, rodada, vez)              |
| FR-013    | T020                   | teste de tela (vez do bot ignora o gesto; status de uma linha por estado)            |
| FR-014    | T027, T028             | testes de componente do painel (3 modos × 2 adversários; `aria-current`; dica)       |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- Fase 1 (#86) antes de tudo: o controlador de mira é a base; T003 prova a paridade do bete.
- Fase 2 (#87) depende da Fase 1; é o gargalo de risco (o contrato de modo e a fonte do tiro). Fase 3 (#88) depende da Fase 2 só pela interface de fonte do tiro; o planejador puro não importa o motor.
- Fase 4 (#89, Bete) depende das Fases 1, 2 e 3; Fase 5 (#92, tela) depende das Fases 2 e 4 e entra com o Bete no seletor.
- Fase 6 (#90, Triângulo) e Fase 7 (#91, Cova) dependem das Fases 1, 2 e 3; entram no seletor da tela conforme ficam prontas.
- Fase 8 (#93, ajuda) depende da Fase 5 e dos textos de ajuda dos modos (T016, T023, T026).
- Fase final (documentação, gates e Gate 3) fecha a entrega. Dentro de uma fase, as tarefas de teste precedem a implementação; nenhuma tarefa está marcada `[P]` porque todas compartilham o pacote `@guess-my-move/marbles` ou a tela e disputam os mesmos arquivos.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação antecipada do maintainer wezercarvalho
- **Data:** `2026-10-29`
- **Lacunas:** nenhuma. Todos os catorze FR têm tarefa formal (FR-001 em T001/T002; FR-002 em T003/T016; FR-003 em T004; FR-004 em T005; FR-005 em T006; FR-006 em T007; FR-007 em T009/T010/T011/T012; FR-008 em T013/T014/T015/T016; FR-009 em T021/T022/T023; FR-010 em T024/T025/T026; FR-011 em T016/T023/T026; FR-012 em T017/T018/T019; FR-013 em T020; FR-014 em T027/T028). SC-001 pelos testes do pacote (T001–T016, T021–T026) e gates (T030); SC-002 pelo determinismo (T008); SC-003 pelos testes do bot (T011); SC-004 pelos testes da tela e do painel (T020, T027/T028); SC-005 pelos gates (T030); SC-006 pelas limitações declaradas (T012, T029, T031). NFR-001 pela pureza e determinismo (T001–T012); NFR-002 e NFR-004 pelos valores de configuração e pela faixa como proteção de regressão (T012, T031); NFR-003 pela privacidade preservada na tela (T020); NFR-005 pela ordem test-first e pela remoção do código morto (T016, T029). Todos os testes precedem as implementações. A spec espelha as issues #86 a #93 sem inventar números; nenhuma contradição entre as issues foi encontrada.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-29`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** conversa de planejamento com o maintainer na sessão de 2026-10-29 ("considere os gates 1 e 2 aprovados"), aprovando antecipadamente os Gates 1 e 2 e fixando as decisões D-01 a D-05 de `clarification.md`; issues #86 a #93 do repositório.
- **Exceções:** nenhuma. Aprovação antecipada no chat. O Gate 3 segue para o fim, após o código e a validação registrada em `validation.md`, e será concedido com risco aceito (sem teste ao vivo com a mão real; valores de jogo a calibrar com uso real; faixa de acerto do bot como proteção de regressão, não equilíbrio medido).
