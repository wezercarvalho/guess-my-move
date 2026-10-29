# Plano — 2026-10-29-game-arranha-teia-add-wall-climb

## Resumo técnico

O agarre à parede é acrescentado em duas camadas, com o máximo da lógica nova em **arquivos novos** e mudanças pequenas e localizadas nos arquivos que a tarefa #80 também toca. A **lógica** vai para o pacote puro `@guess-my-move/swing`: um módulo novo `climb.ts` (estado de agarre `WallGrip`, a função pura `stepGrip` que entra/colar/subir/descer/sair, e os sinais de gesto `climbSignal` e `pullBackSignal`), com o `physics.ts` ganhando o campo `grip` no `SwingState`, a exposição de `touchingWall` e a chamada ao agarre dentro de `stepPlayer`; o `world.ts` ganha os campos `grab`, `climb` e `release` no `SwingInput` e repassa o contato. A **apresentação** integra no `apps/web/src/swing`: o `swingController.ts` lê o sinal de escalada e o de soltar das mãos (via `climb.ts`), aplica a precedência da palma aberta (com `touchingWall` agarra, senão solta a teia) e as teclas `V` (agarrar) e setas (subir/descer); o `guide.ts` e o `SwingScreen.tsx` mostram "Agarrado", a dica e o estado; o `SwingDebugPanel.tsx` mostra o sinal de escalada e o de soltar por mão.

A verificação é test-first: o teste de cada parte nova (estado de agarre, prova de saída em tempo finito, `climb.ts`) é escrito e visto falhar antes da implementação; o controlador é testado com mãos simuladas; a tela com React Testing Library; e dois pilotos automáticos descartáveis mais uma inspeção em Chromium headless (teclado no lugar da mão) são registrados como texto em `validation.md`. Nenhuma dependência nova é adicionada. Os valores do agarre são de jogo e nenhuma afirmação de precisão, fps ou latência é feita. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29; o Gate 3 fica **pendente** do teste ao vivo, e a spec permanece em `implementing`.

## Contexto técnico

- **Runtime/versões:** Yarn 4.18.1; TypeScript 7; React 19 e Vite no `apps/web`; Vitest nos testes do pacote e de componente. Sem scripts `node:test` novos.
- **Dependências:** **nenhuma nova.** O pacote `@guess-my-move/swing` continua TypeScript puro; a tela usa o que já existe.
- **Provedores externos:** nenhum. O agarre não faz rede; a câmera é local, sem gravar nem enviar imagem.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/swing` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** o jogador nunca fica preso (prova de saída em tempo finito); sem afirmar precisão nem desempenho sem medição; privacidade preservada (processamento local, sem imagem); o fluxo de teia por mão (CQ-009) não regride; mudanças pequenas nos arquivos compartilhados com a tarefa #80 (`swingController.ts`, `world.ts`, `SwingScreen.tsx`, `guide.ts`).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                          |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; CQ-001 a CQ-006 resolvidas em `clarification.md` antes de `plan.md` e `tasks.md`.                      |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a fonte vigente desta mudança; cita a spec do Arranha-Teia como contexto, sem reescrevê-la.                                       |
| III. Rastreabilidade                        | PASS      | Cada FR tem linha na matriz de requisitos e tarefa formal em `tasks.md`.                                                                      |
| IV. Test-first e incremental                | PASS      | Estratégia test-first por parte nova; teste de propriedade para a saída em tempo finito; mudanças pequenas e reversíveis.                     |
| V. Evidência honesta                        | PASS      | NFR-003/NFR-004 limitam afirmações; valores do agarre declarados como de jogo; `z` aproximado e ausência de teste com mão real declarados.    |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; nenhuma requisição a terceiros; sem chaves nem dados sensíveis novos.                      |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; a referência ao Homem-Aranha é só inspiração e não aparece em arquivo nenhum (D-04).               |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o balanço, a mira, a pose de teia e os outros jogos são preservados; o agarre só age quando pedido com contato de parede. |

## Estrutura afetada

```text
packages/swing/
  src/climb.ts  (novo)           estado WallGrip, stepGrip (entrar/colar/subir/descer/sair), sinais climbSignal e pullBackSignal
  test/climb.test.ts  (novo)     testes puros do agarre e do teste de propriedade de saída em tempo finito
  test/climbSignal.test.ts (novo) testes puros dos sinais de gesto com dados sintéticos
  src/physics.ts                 SwingState.grip, touchingWall, chamada ao agarre em stepPlayer (mudança localizada)
  src/world.ts                   SwingInput { grab?, climb?, release? }; repasse do contato (mudança pequena, compartilhado com #80)
  src/index.ts                   exportar os tipos e funções novos de climb.ts
  test/world.test.ts             casos novos do agarre pelo world (sem regredir os existentes)
apps/web/src/swing/
  swingController.ts             lê climbSignal/pullBackSignal das mãos; precedência da palma (grab vs soltar teia); teclas V e setas (mudança localizada, compartilhado com #80)
  swingController.test.ts        casos novos do agarre (sem regredir)
  guide.ts                       dica e etapa do agarre (mudança pequena, compartilhado com #80)
  guide.test.ts                  caso novo da dica do agarre
  SwingScreen.tsx                medidor "Agarrado" (mudança pequena, compartilhado com #80)
  SwingScreen.test.tsx           caso novo do medidor "Agarrado"
  SwingDebugPanel.tsx            sinal de escalada e de soltar por mão
README.md                        seção do Arranha-Teia: linha do agarre à parede
docs/development-context/architecture/architecture-guide.md  linha do agarre (se o jogo for citado)
specs/README.md                  linha nova desta spec
specs/2026-10-29-game-arranha-teia-add-wall-climb/            esta spec (spec, clarification, research, plan, tasks, checklists, validation ao fim)
```

## Design

### Componentes e responsabilidades

- **climb.ts (novo)** — concentra a lógica nova e pura:
    - `WallGrip = { normal: Vec3, idleMs: number }` e `SwingState.grip: WallGrip | null`.
    - `GripConfig` com `climbSpeed`, `climbDeadzone`, `gripIdleMs`.
    - `stepGrip(index, state, input, dt, contact, config)`: decide entrar (contato de parede + `grab`), colar e mover (subir/descer por `climb`), e sair (as quatro saídas de FR-003). Chamada de dentro de `stepPlayer`.
    - `climbSignal(dyLeft, dyRight, config)`: o movimento alternado reduzido a -1..1 com zona morta e saturação.
    - `pullBackSignal(dzLeft, dzRight, config)`: verdadeiro quando uma mão se afasta da câmera além do limite.
    - Todas puras, sem estado global.
- **physics.ts** — mudança localizada: acrescenta `grip` ao `SwingState` e `createSwingState`; expõe `touchingWall` (derivado do `Contact` de parede); no `stepPlayer`, quando agarrado, pula a gravidade, o deslize e a corda e delega ao `stepGrip`; `StepEvents` pode ganhar o estado do agarre se útil à tela.
- **world.ts** — mudança pequena (arquivo compartilhado com #80): `SwingInput` ganha `grab?: SlotFlags`, `climb?: number`, `release?: boolean`; o `step` repassa esses campos ao `stepPlayer`/`stepGrip`. O comportamento sem esses campos é idêntico ao de hoje.
- **swingController.ts** — mudança localizada (compartilhado com #80): guarda o pulso anterior de cada mão para calcular `dy`/`dz`, chama `climbSignal`/`pullBackSignal`, aplica a precedência (`touchingWall` + palma aberta → `grab`; senão a palma segue soltando a teia), e as teclas `V` (agarrar) e setas (reaproveitadas como `climb` quando agarrado); alimenta o `SwingInput`.
- **guide.ts / SwingScreen.tsx / SwingDebugPanel.tsx** — a tela: um valor de cue/estado "Agarrado", a dica ("Na parede: mãos abertas, alterne para subir. Puxe a mão para soltar."), o medidor mostrando "Agarrado" quando `grip` não é nulo, e o painel de depuração com o sinal de escalada e o de soltar por mão.

### Contratos e dados

- A fronteira continua sendo a sessão `world`: a tela passa o `SwingInput` (agora com `grab`/`climb`/`release`) e lê o estado (agora com `grip` e `touchingWall`); toda a regra do agarre fica no pacote puro.
- Os sinais de gesto são puros: o controlador passa deltas de `y` e `z` dos pulsos e recebe o escalar de escalada e o booleano de soltar; nada da câmera é gravado.
- O agarre só começa com contato de parede: a física é a autoridade do contato, a tela não o reimplementa.

### Fluxo

1. A cada quadro, o controlador calcula, por mão, o `dy` e o `dz` do pulso contra o quadro anterior; `climbSignal`/`pullBackSignal` reduzem a `climb` e `release`.
2. A precedência da palma: se `touchingWall` e a palma aberta, pede `grab`; senão a palma aberta solta a teia como hoje. `V` segurada também pede `grab`; as setas viram `climb` quando agarrado.
3. `world.step` chama `stepPlayer`; se `grab` com contato de parede, entra no agarre (zera a velocidade, solta as teias); agarrado, `stepGrip` cola e move por `climb`; as quatro saídas encerram o agarre.
4. A tela lê `grip` e mostra "Agarrado", a dica e os sinais no painel de depuração.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                                             | Evidência planejada                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| FR-001    | `SwingState.grip`, entrar só com contato de parede + `grab`; zera a velocidade e solta as teias; sem contato não agarra               | `climb`/`physics` tests (Vitest)                   |
| FR-002    | `SwingInput` ganha `grab`/`climb`/`release`; agarrado sobe/desce por `climb * climbSpeed`, limitado, colado à parede                  | `climb`/`world` tests (Vitest)                     |
| FR-003    | Quatro saídas (`grab` vazio/`release`, teia, topo→telhado, inatividade) e o teste de propriedade de saída em tempo finito             | `climb` tests + teste de propriedade (Vitest)      |
| FR-004    | `climb.ts`: `climbSignal` (movimento alternado, zona morta, saturação) e `pullBackSignal` (profundidade `z`), puros, dados sintéticos | `climbSignal` tests (Vitest)                       |
| FR-005    | Precedência no `SwingController`: `touchingWall` + palma aberta → `grab`; senão palma solta a teia                                    | `swingController` test (Vitest)                    |
| FR-006    | `SwingController` integra agarre; teclas `V` e setas; mudanças pequenas e localizadas nos arquivos compartilhados                     | `swingController`/`guide` tests (Vitest)           |
| FR-007    | Medidor "Agarrado", dica e etapa curtas; painel de depuração com os sinais por mão                                                    | `SwingScreen`/`guide`/debug tests; inspeção visual |
| FR-008    | O agarre só age com `grab` e contato de parede; os testes de `twoWebs`, `moves`, `sides`, `swingHands` continuam passando             | suíte completa verde (Vitest)                      |

## Estratégia test-first

1. Escrever o teste de `climbSignal`/`pullBackSignal` (dados sintéticos) falhando e implementar os sinais;
2. escrever o teste do estado de agarre (entrar só com contato; colar; subir/descer; cada saída) e o teste de propriedade de saída em tempo finito falhando, e implementar `stepGrip` + o campo `grip` e `touchingWall` até verde;
3. ligar o `world.ts` (entradas novas) com casos novos sem regredir os existentes;
4. integrar no `swingController` (precedência da palma, teclas) e na tela (medidor, dica, painel de depuração) com testes novos;
5. rodar os pilotos automáticos descartáveis e a inspeção em Chromium headless, registrando como texto em `validation.md`;
6. atualizar a documentação e o catálogo e rodar os gates oficiais.

## Riscos, rollout e rollback

| Risco                                                           | Mitigação                                                                                          | Rollback/contingência                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| O agarre prender o jogador sem saída                            | Quatro saídas independentes e teste de propriedade provando saída em tempo finito em qualquer caso | Baixar `gripIdleMs`; forçar saída por tecla      |
| O `z` do MediaPipe (soltar) ser ruidoso                         | Nunca é a única saída; limite com margem; declarado como hipótese não medida                       | Trocar o sinal de soltar sem mudar a arquitetura |
| Conflito de edição com a tarefa #80 nos arquivos compartilhados | Mudanças pequenas e localizadas; o grosso em `climb.ts` (novo)                                     | Resolver conflito preservando as duas mudanças   |
| O fluxo de teia por mão (CQ-009) regredir                       | Campos novos opcionais; o agarre só age com contato + `grab`; suíte existente roda sem mudança     | Reverter o repasse no `world` se algo regredir   |
| Afirmar precisão/desempenho sem medição                         | Não afirmar; valores de jogo; headless só prova fluxo, não fps (NFR-003/NFR-004)                   | Medir com mão real/GPU numa sessão futura        |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                       |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`; segue os FRs e as CQs resolvidas.                                   |
| II. Uma fonte vigente                       | PASS      | Referencia IDs; cita a spec do Arranha-Teia como contexto, sem duplicar seu comportamento.                                 |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura por tarefa formal em `tasks.md`.                                                    |
| IV. Test-first e incremental                | PASS      | Testes das partes novas antes da implementação; teste de propriedade para a saída; módulo novo pequeno e puro.             |
| V. Evidência honesta                        | PASS      | Valores do agarre declarados como de jogo; `z` aproximado e ausência de teste com mão real declarados.                     |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; nenhuma requisição a terceiros; sem segredos novos.                     |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor; nenhum ativo, marca ou personagem de terceiros; contexto técnico em `research.md`.       |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; balanço, mira, pose de teia e outros jogos preservados; mudanças pequenas nos arquivos compartilhados. |

## Complexidade e desvios

| Necessidade                | Impacto | Alternativa mais simples rejeitada                                              | Aprovação       |
| -------------------------- | ------- | ------------------------------------------------------------------------------- | --------------- |
| Novo módulo `climb.ts`     | baixo   | Pôr o agarre dentro de `physics.ts` (misturaria regimes e dificultaria o teste) | CQ-001 (Gate 1) |
| Campos novos no SwingInput | baixo   | Reusar `pull`/`held` para o agarre (sobrecarregaria o significado por lado)     | CQ-004 (Gate 1) |
