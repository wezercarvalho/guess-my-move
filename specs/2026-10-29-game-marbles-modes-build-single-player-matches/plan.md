# Plano — 2026-10-29-game-marbles-modes-build-single-player-matches

## Resumo técnico

A iniciativa é entregue em **uma PR única** (CQ-004), em duas camadas. A **lógica** vai para módulos novos do pacote puro `@guess-my-move/marbles` (TypeScript, Vitest, sem DOM nem MediaPipe): `aim/` (controlador de mira extraído de `round.ts`), `match/` (motor de partida, contrato de modo, fonte do tiro, resultado de rodada e de partida), `bot/` (planejador de pontaria por simulação com `stepBodies` e erro por semente) e `modes/{bete,triangulo,cova}/` (cada modo implementando o contrato e declarando o texto de ajuda). O Bete atual passa a usar o controlador de mira sem mudar o comportamento observável e migra para o motor; o bete solo antigo sem uso é removido. A física atual (`stepBodies`, `isAtRest`, `moveBody`, `computeShot`) é reaproveitada intacta; a geometria de cada modo (alvo, círculo, covas) e a remoção de bolinhas (captura, entrada na cova) vivem no modo. A **apresentação** vai para `apps/web/src/marbles`: `marblesController` e `useMarblesGame` passam a conduzir uma partida do motor, a `MarblesScreen` ganha a tela de escolha de modo e adversário e a condução das rodadas com placar, vez e resultado, e o painel "Como jogar" (`ShotGuide`/`guideSteps`) passa a ser alimentado pelo texto de ajuda de cada modo.

A verificação é test-first por módulo, na ordem de implementação das issues #86 → #87 → #88 → #89 → #92 (com o Bete) → #90 → #91 → #93. Nenhuma dependência nova é introduzida. Os valores de jogo são de calibração e nenhuma afirmação de equilíbrio, diversão ou desempenho é feita sem uso real; a faixa de acerto do bot é proteção de regressão. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29; a implementação é test-first e o Gate 3 fica para o fim, com o risco aceito de não haver teste ao vivo com a mão real.

## Contexto técnico

- **Runtime/versões:** Yarn 4.18.1 via Corepack; TypeScript 7.0.2; React 19 e Vite no `apps/web`; Vitest 5 nos testes do pacote e de componente. O pacote `@guess-my-move/marbles` é TypeScript puro, `type: module`, sem dependências de runtime.
- **Dependências:** **nenhuma nova**. Reaproveita `physics.ts`, `shot.ts`, `pinch.ts` e `flick.ts` do próprio pacote.
- **Provedores externos:** nenhum. O jogo processa a câmera localmente e não chama terceiros.
- **Persistência:** nenhuma. Não há salvamento de progresso entre partidas (fora de escopo).
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn check:static` (typecheck + lint), `yarn test`, `yarn build`, `yarn sdd:check`, `yarn docs:format:check` e `yarn docs:format:fix`.
- **Restrições:** pureza e determinismo (tempo pelos argumentos, acaso por semente); privacidade (processamento local, sem gravar nem enviar imagem, sem requisição a terceiros); honestidade de evidência (sem afirmar equilíbrio, diversão ou fps sem medição); sem código morto.

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                        |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; CQ-001 a CQ-006 resolvidas em `clarification.md` antes de `plan.md` e `tasks.md`; regras das issues. |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente desta mudança; o plano referencia IDs e não duplica comportamento das specs anteriores do bete.           |
| III. Rastreabilidade                        | PASS      | Cada FR tem linha na matriz de requisitos abaixo e tarefa formal em `tasks.md`.                                                             |
| IV. Test-first e incremental                | PASS      | Estratégia test-first por módulo, na ordem das issues; mudanças pequenas e reversíveis; bot atrás de interface com nível padrão testável.   |
| V. Evidência honesta                        | PASS      | NFR-002 e NFR-004 declaram valores de calibração; faixa de acerto do bot como proteção de regressão; sem teste com mão real declarado.      |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; sem requisição a terceiros; o jogo das bolinhas não tem carta, sem fronteira a vazar.    |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de IA; nenhuma dependência nova; contexto técnico em `docs/`.                                               |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; jogo de cartas, reconhecedor e design system preservados; só se acrescentam os modos e a tela de partida.               |

## Pesquisa e decisões

- `research.md` — fatos do código atual (a mira vive dentro do bete; `moveBody` zera abaixo de `stopSpeed`; teto `gain · maxPull` = 1100; a física não tem alvo, cova nem remoção de corpo), e as decisões de arquitetura: camadas (mira, motor, bot, modos) separadas da apresentação; contrato de modo mínimo; vez decidida pelo modo; bot por simulação com `stepBodies`; cova e triângulo como geometria do modo; fonte do tiro como interface aberta ao segundo jogador. Limitações declaradas sem medição.

## Estrutura afetada

```text
packages/marbles/
  src/physics.ts, shot.ts, pinch.ts, flick.ts    reaproveitados (física, tiro, leituras) — inalterados no comportamento
  src/aim/                                        controlador de mira puro (pinça e estalo), extraído de round.ts (#86)
  src/match/                                      motor de partida, contrato de modo, fonte do tiro, resultado (#87)
  src/bot/                                        planejador: direção, velocidade por busca com stepBodies, erro por semente, DEFAULT_BOT (#88)
  src/modes/bete/                                 Bete como modo (campo, 3 posições, limites, avaliação, ajuda) (#89)
  src/modes/triangulo/                            Triângulo (círculo, 6 bolinhas, captura, vez mantida, ajuda) (#90)
  src/modes/cova/                                 Cova (3 covas, entrada por velocidade, bolinha que fica, ajuda) (#91)
  src/round.ts                                    passa a usar o controlador de mira; bete solo antigo sem uso removido (#86, #89)
  src/index.ts                                    exporta a API nova (mira, motor, contrato, fonte do tiro, bot, modos)
  test/round.test.ts, test/flick-replay.test.ts  INALTERADOS (prova de paridade do #86)
  test/aim.*, match.*, bot.*, bete.*, triangulo.*, cova.*  testes novos por módulo
apps/web/src/marbles/
  marblesController.ts, useMarblesGame.ts         passam a conduzir uma partida do motor (#92) — parte maior
  MarblesScreen.tsx, marbles.css                  tela de escolha de modo/adversário, placar, vez, resultado, status de uma linha (#92)
  fieldView.ts                                    desenho do campo por modo (alvo, círculo e bolinhas, covas) (#92)
  ShotGuide.tsx, guideSteps.ts                    painel "Como jogar" alimentado pelo texto de ajuda do modo (#93)
  MarblesDebugPanel.tsx                           depuração recolhida, como está (NFR-003)
docs/product/PROJECT_SPEC.md, docs/development-context/architecture/architecture-guide.md, specs/README.md   atualizados
specs/2026-10-29-game-marbles-modes-build-single-player-matches/   esta spec (spec, clarification, research, plan, tasks, checklists/; validation.md ao fim)
```

## Design

### Componentes e responsabilidades

- **aim/ (controlador de mira)** — recebe a posição da bolinha de tiro, as leituras da mão (pinça por `PinchReading`, estalo por `FlickReading`) e o relógio; mantém a âncora relativa, a escala (`aimScale`), a mão perdida (`lostHandMs`) e o cancelamento; devolve a mira em andamento (pinça virtual e prévia do tiro, ou a direção do estalo) e o tiro disparado (vetor de velocidade via `computeShot`). Não importa `physics.ts` nem `round.ts`. É a extração literal da leitura que hoje está em `round.ts`.
- **match/ (motor de partida)** — guarda o estado da partida (rodada atual, competidor da vez, tiros gastos por competidor, placar das rodadas) e aplica cada tiro: registra o competidor do tiro corrente, avança a física até o repouso, pede ao modo a avaliação do campo (o que rendeu, se terminou, o resultado), atribui o que o campo rendeu ao competidor do tiro (inclusive em cadeia), decide a próxima vez pela resposta do modo (padrão alterna) e, ao fim das 3 rodadas, computa o resultado da partida (mais vencidas que perdidas é vitória; menos é derrota; igual é empate). Contra a meta não há vez; contra o bot quem começa alterna por rodada (jogador na 1ª).
- **contrato de modo (match/)** — a interface que cada modo implementa: `buildRound(n, adversário)` → campo inicial; `shotLimit(competidor, adversário)`; `evaluate(campoEmRepouso, competidor)` → `{ yield, finished, outcome }`; `nextTurn(padrãoAlterna, yield)` → competidor (padrão alterna; o modo pode manter). O motor só conhece o contrato, nunca a geometria de um modo.
- **fonte do tiro (match/)** — interface `ShotSource` que entrega o próximo tiro ao motor: a mão do jogador (alimentada pelo controlador de mira na camada web) e o bot são duas implementações; um segundo jogador futuro é uma terceira, não implementada.
- **bot/ (planejador)** — `directionTo(origem, ponto)`; `speedToStop(origem, ponto, física)` por **busca com `stepBodies`** (bissecção/varredura até a bolinha parar a <= 1 unidade do ponto numa trajetória livre); `planShot(ponto, semente, nível)` aplica desvio angular e fator de força de um PRNG com semente e limita a velocidade a `gain · maxPull`. `DEFAULT_BOT` é o nível único. O planejador não importa o motor; implementa a fonte do tiro.
- **modes/bete/** — campo do bete (bolinha de tiro à esquerda, alvo à direita em 3 posições fixas, uma por rodada, igual para os dois competidores); limite 5 tiros; avaliação: acerto encerra; contra a meta vitória em até 3, empate no 4º/5º, derrota sem acertar; contra o bot quem acerta primeiro vence, 10 tiros sem acerto é empate; ponto de chegada do bot = o alvo; após erro a bolinha de tiro volta e o alvo volta à posição da rodada. Texto de ajuda do modo.
- **modes/triangulo/** — campo: círculo no centro-direita, 6 bolinhas em triângulo (fileiras 1/2/3) com folga (centros a mais que a soma dos raios), bolinha de tiro de ponto fixo fora do círculo; captura quando uma bolinha para totalmente fora (centro a >= raio do círculo + raio da bolinha), atribuída ao competidor do tiro (inclusive em cadeia), bolinha capturada sai e as demais ficam; contra a meta até 8 tiros (6 é vitória e encerra na 6ª, 4-5 empate, <=3 derrota); contra o bot mantém a vez ao capturar, até 5 tiros por competidor, mais capturas vence (iguais, inclusive 0 a 0, empate); ponto de chegada do bot = a bolinha dentro do círculo mais próxima da borda, mirando para fora. As 3 rodadas usam a mesma formação. Texto de ajuda do modo.
- **modes/cova/** — campo: 3 covas numeradas (raio 22, bolinha raio 14) em ordem, em 3 layouts fixos (um por rodada, iguais para os dois), só a cova da vez ativa, bolinha de tiro de ponto fixo que fica onde parou; entrada na cova ativa quando o centro está dentro do raio e a velocidade < 120 unid/s (configurável, > `stopSpeed`), avaliada a cada passo e na parada; ao entrar, fixa no centro, sai da simulação e a próxima cova fica ativa; covas que não são a ativa não capturam; contra a meta até 9 tiros (3 covas em até 6 vitória e encerra, 7-9 empate, sem completar derrota); contra o bot cada um com a sua bolinha, vez alternada, até 9 tiros cada, resultado por completar > menos tiros > mais covas (empates definidos); ponto de chegada do bot = o centro da cova ativa, com a velocidade que para nele. Texto de ajuda do modo.
- **camada web** — `marblesController`/`useMarblesGame` conduzem uma partida do motor: liga a câmera (controlador de mira) ou o teclado à fonte do tiro do jogador e o bot à fonte do bot, anima o tiro do bot, e expõe o estado para a tela. `MarblesScreen` desenha a tela inicial (modo, adversário, pinça/estalo, "Começar partida") e a partida (campo do modo, rodada, placar, tiros restantes, vez, status de uma linha, fim de rodada e de partida com "Jogar de novo" e "Trocar de modo"). `ShotGuide`/`guideSteps` mostram a ajuda do modo e as etapas do gesto.

### Contratos e dados

- O **motor** é a fronteira: a camada web cria a partida com um modo e um adversário, entrega tiros pela fonte do tiro e lê o estado; toda a regra fica no pacote puro.
- O **contrato de modo** é o único acoplamento entre o motor e cada jogo; o motor nunca conhece a geometria de um modo.
- A **fonte do tiro** desacopla quem produz o tiro (mão, bot, segundo jogador futuro) de quem o consome (o motor).
- A **física** (`stepBodies`, `isAtRest`, `computeShot`) é reaproveitada sem alteração; a remoção de corpos (captura, cova) é feita pelo modo filtrando a lista.

### Fluxo

1. A tela escolhe modo e adversário e cria a partida no motor.
2. A cada vez: se é a vez do jogador, o controlador de mira transforma as leituras da câmera num tiro; se é a vez do bot, o planejador produz o tiro pela semente. O motor registra o competidor do tiro, avança a física até o repouso, pede ao modo a avaliação, atribui o que rendeu e decide a próxima vez.
3. A rodada termina pelo resultado do modo (vitória decidida encerra sem gastar os tiros restantes) ou pelo esgotamento dos tiros; o placar da rodada é atualizado.
4. Ao fim das 3 rodadas, o motor computa o resultado da partida; a tela mostra Vitória, Derrota ou Empate e as ações.
5. A verificação roda os testes do pacote (mira, motor, bot, três modos), os testes da tela com câmera e rastreador simulados e os testes do painel, e registra os resultados em `validation.md` ao fim.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                                                | Evidência planejada                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| FR-001    | `aim/` controlador de mira puro extraído de `round.ts`; não importa `physics.ts` nem `round.ts`                                          | testes de `aim` (Vitest); teste de importação            |
| FR-002    | `round.ts` passa a usar o controlador; `round.test.ts` e `flick-replay.test.ts` inalterados                                              | `round.test.ts` e `flick-replay.test.ts` verdes sem diff |
| FR-003    | `match/` motor puro: 3 rodadas, competidor do tiro, atribuição em cadeia, resultado de rodada e de partida; sem DOM/MediaPipe/relógio    | testes de `match` (Vitest)                               |
| FR-004    | contrato de modo em `match/`: montar campo, limite de tiros, avaliação em repouso, próxima vez (padrão alterna, modo pode manter)        | testes de `match` com modos de teste                     |
| FR-005    | `match/` com adversários meta e bot: sem vez na meta, alternância por rodada no bot, tiro fora da vez sem efeito, resultado da partida   | testes de `match` (meta e bot)                           |
| FR-006    | interface `ShotSource` em `match/`; mão e bot como implementações; segundo jogador não implementado                                      | testes de `match` com fontes de tiro simuladas           |
| FR-007    | `bot/` planejador: direção, velocidade por busca com `stepBodies`, erro por semente, `DEFAULT_BOT`, teto `gain · maxPull`                | testes de `bot` (parada a 1 unidade, semente, faixa)     |
| FR-008    | `modes/bete/`: 3 posições de alvo, 5 tiros, avaliação meta/bot, bot mira o alvo, retorno após erro; remoção do bete solo antigo          | testes de `bete`; `round.test.ts`/`flick-replay` verdes  |
| FR-009    | `modes/triangulo/`: círculo, 6 bolinhas com folga, captura por sair, vez mantida, 8/5 tiros, bot mira a mais próxima da borda            | testes de `triangulo` (captura, cadeia, estabilidade)    |
| FR-010    | `modes/cova/`: 3 covas, entrada < 120 por passo e na parada, bolinha que fica, 9 tiros, bot mira o centro da cova ativa                  | testes de `cova` (entrada, permanência, meta/bot)        |
| FR-011    | cada modo declara `helpText` não vazio que cita vitória, derrota e empate                                                                | testes de cada modo (ajuda não vazia)                    |
| FR-012    | `marblesController`/`useMarblesGame` conduzem a partida; `MarblesScreen` escolhe modo/adversário e mostra placar, vez, tiros e resultado | testes de controlador e de tela (câmera/rastreador sim.) |
| FR-013    | vez do bot ignora o gesto, status de uma linha por estado, tiro do bot animado; pinça/estalo continuam                                   | teste de tela: gesto ignorado na vez do bot; status      |
| FR-014    | `ShotGuide`/`guideSteps` alimentados pelo texto do modo; `aria-current` na etapa; dicas curtas; muda com modo e adversário               | testes de componente do painel (3 modos × 2 adversários) |

## Estratégia test-first

1. Escrever os testes falhando do controlador de mira (`aim`) e confirmar a falha; extrair a mira de `round.ts`; confirmar `round.test.ts` e `flick-replay.test.ts` **verdes sem alteração** (#86).
2. Escrever os testes falhando do motor (`match`) com modos de teste (um que alterna, um que mantém a vez; resultado de partida; esgotamento; vitória antes do limite; cadeia; determinismo) e implementar; definir a fonte do tiro (#87).
3. Escrever os testes falhando do bot (`bot`) — parada a 1 unidade entre 50 e 700, igualdade por semente, faixa 30–60% em 1000 tiros, teto `gain · maxPull` — e implementar por busca com `stepBodies` (#88).
4. Escrever os testes falhando do Bete como modo e implementar; migrar os testes do bete atual que ainda fazem sentido e remover os obsoletos e o bete solo antigo (#89).
5. Conduzir a partida na tela: escrever os testes de controlador e de tela (fluxo completo por modo, meta e bot, câmera e rastreador simulados, vez do bot, pinça/estalo) e implementar `marblesController`/`useMarblesGame`/`MarblesScreen`/`fieldView` com o Bete (#92).
6. Escrever os testes falhando do Triângulo e implementar (captura, cadeia, estabilidade sem tiro, meta/bot) (#90).
7. Escrever os testes falhando da Cova e implementar (entrada por velocidade, permanência, meta/bot, layouts) (#91).
8. Alimentar o painel "Como jogar" com o texto de ajuda de cada modo e escrever os testes de componente (3 modos × 2 adversários, `aria-current`, dica de força) (#93).
9. Atualizar a documentação (PROJECT_SPEC, guia de arquitetura, catálogo), rodar os gates oficiais e registrar `validation.md` no fim; fechar o Gate 3 com risco aceito.

## Riscos, rollout e rollback

| Risco                                                    | Mitigação                                                                                                         | Rollback/contingência                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Regressão sutil no bete ao extrair a mira                | `round.test.ts` e `flick-replay.test.ts` ficam inalterados como prova de paridade (#86)                           | Reverter a extração e manter a mira em `round.ts`       |
| Contrato de modo grande demais                           | Nasce com o que Bete, Triângulo e Cova precisam e nada além; três modos de teste exercitam vez e limites          | Enxugar o contrato para o mínimo que os três modos usam |
| Busca da velocidade do bot não convergir                 | Busca com `stepBodies` validada pelo teste de parada a 1 unidade entre 50 e 700 numa trajetória livre             | Ajustar a faixa de busca ou o critério de parada        |
| Seis bolinhas encostadas estressarem o solver de colisão | Folga na formação (centros a mais que a soma dos raios) e teste de estabilidade sem tiro                          | Aumentar a folga inicial da formação                    |
| Acoplar a tela às regras de um modo                      | A tela só consome o contrato do modo (campo, placar, textos); a regra fica no pacote puro                         | Mover qualquer regra vazada de volta ao modo            |
| Afirmar equilíbrio ou diversão sem uso real              | Faixa de acerto do bot como proteção de regressão; valores declarados como palpites a calibrar (NFR-002, NFR-004) | Calibrar com uso real numa sessão futura e registrar    |
| Código morto do bete solo antigo                         | Remover o que ficar sem uso ao migrar o Bete (#89); gates verdes                                                  | Restaurar do histórico do Git se algo for necessário    |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                         |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`; segue as regras e os números das issues #86 a #93.                    |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs e não duplica o comportamento das specs anteriores do bete, que seguem como `superseded`/`validated`. |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura por tarefa formal em `tasks.md`.                                                      |
| IV. Test-first e incremental                | PASS      | Testes por módulo antes da implementação; o bot fica atrás de interface com nível padrão testável; mudanças pequenas.        |
| V. Evidência honesta                        | PASS      | Valores declarados como de calibração; faixa do bot como proteção de regressão; sem teste com mão real declarado.            |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; sem requisição a terceiros; sem carta a vazar neste jogo.                 |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de IA; nenhuma dependência nova; contexto técnico em `docs/`.                                |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; cartas, reconhecedor e design system preservados; só se acrescentam os modos e a tela de partida.        |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
