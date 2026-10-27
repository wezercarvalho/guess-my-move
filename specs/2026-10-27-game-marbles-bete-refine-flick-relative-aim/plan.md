# Plano — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Resumo técnico

No pacote puro `@guess-my-move/marbles`, a rodada (`round.ts`) passa a mirar o modo estalo pela mesma pinça virtual do modo pinça: enquanto a pinça está fechada (armada), a posição alvo da mira é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale`, e o tiro previsto vem de `computeShot` (direção e força do arrasto), reaproveitando a função já usada pelo modo pinça sem duplicá-la. O detector de estalo (`flick.ts`) deixa de produzir direção e força: ao abrir, só classifica a abertura como gatilho rápido (duração <= `slowMs` e velocidade >= `minOpenSpeed`) ou não; `handDirection`, o campo `direction` na leitura e na soltura, `flickShot` e os parâmetros `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed` saem, e `slowMs` cai de 300 para 80 ms. `observeFlick` dispara o tiro previsto no gatilho rápido com arrasto suficiente, cancela no lento, no fraco e no sem arrasto, e zera o armado na perda da mão. No app web, o laço de quadros do `MarblesController` passa a processar o detector só em quadros novos da câmera (`requestVideoFrameCallback` quando disponível, recuo para `video.currentTime` quando não) e a contar os quadros novos por segundo; o painel mostra "Quadros novos da câmera/s" nos dois modos e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem tiro`); a tela remove a seta de direção do estalo, mostra a previsão do tiro como na pinça e atualiza o texto de orientação. O modo pinça só muda por não reprocessar quadros repetidos; a física, o campo, o alvo e o jogo de cartas não mudam. A spec de criação do estalo passa a `superseded`.

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente (o `engines` do repositório pede >=26.12.1; os scripts de documentação e SDD rodam no Node 24), Yarn 4.18.1 via Corepack, TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5.
- **Dependências:** nenhuma nova. A mira relativa reusa `computeShot` do modo pinça; `requestVideoFrameCallback` é API nativa do navegador, com recuo para `currentTime`.
- **Provedores externos:** nenhum. Nenhuma imagem sai do navegador.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagens), pureza da lógica em Node, isolamento do modo pinça e do jogo de cartas, Chrome desktop, honestidade de evidência (sem afirmar desempenho ou viabilidade do estalo sem medição).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                       |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; descobertas futuras atualizam `spec.md` primeiro.                                   |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente; a spec de criação do estalo passa a `superseded` para não manter texto divergente.      |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de requisitos.                                                   |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando; a mira relativa reusa `computeShot` atrás da interface já existente. |
| V. Evidência honesta                        | PASS      | NFR-002 e H-01 a H-04 limitam afirmações; os limiares são palpites de uma sessão e a viabilidade é decisão do maintainer.  |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem (FR-008); sem chaves; o refino não introduz novo dado sensível.                                       |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/`.                                         |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o modo pinça (salvo quadros repetidos), seus testes e arquivos fora do escopo são preservados.         |

## Pesquisa e decisões

- `research.md` — mira pelo arrasto relativo da pinça virtual (reaproveitando `computeShot`); abertura rápida como gatilho; `slowMs` de 300 para 80 ms; remoção da orientação da mão, da seta, de `flickShot` e dos parâmetros de força; processamento só de quadros novos (`requestVideoFrameCallback` com recuo para `currentTime`); e a decisão de marcar a spec de criação do estalo como `superseded`.

## Estrutura afetada

```text
packages/marbles/
  src/
    flick.ts                              remover handDirection, direction, flickShot, maxOpenSpeed/minShotSpeed/maxShotSpeed; slowMs 300->80; classificar só o gatilho
    round.ts                              observeFlick usa a pinça virtual (computeShot) para prever o tiro e dispara no gatilho rápido; snapshot sem direção do estalo
    index.ts                              ajustar a API exportada do estalo (sem handDirection/flickShot/direction)
    pinch.ts, shot.ts, physics.ts         reusados (computeShot/aimScale), NÃO alterados em comportamento
  test/
    flick.test.ts                         remover testes de handDirection/flickShot; testar só a classificação do gatilho (rápido/lento/fraco)
    round.test.ts                         casos novos de observeFlick com mira relativa e cancelamento por sem-arrasto; casos do modo pinça inalterados
apps/web/
  src/marbles/
    marblesController.ts                  laço por quadro novo (rVFC com recuo para currentTime); contagem de quadros novos/s; resultado do último estalo sem "sem direção"
    fieldView.ts                          remover a seta de direção do estalo; previsão do tiro como na pinça
    MarblesScreen.tsx                     texto de orientação do estalo; rótulo alpha mantido; aria-live
    DebugPanel.tsx                        linha "Quadros novos da câmera/s"; resultado do último estalo (disparado/lento demais/fraco demais/sem tiro)
  src/card/, src/round/ do jogo de cartas  NÃO alterados
README.md, docs/development-context/architecture/architecture-guide.md, docs/product/PROJECT_SPEC.md   atualizar
specs/2026-10-27-game-marbles-bete-build-flick-beta/spec.md                                 status superseded + related_specs + seção Substituição
specs/2026-10-27-game-marbles-bete-refine-flick-relative-aim/                                esta spec
specs/README.md                                                                             nova linha e estado da antiga
```

## Design

### Componentes e responsabilidades

- **`flick.ts`** (pacote): o detector de estalo mantém a histerese e a razão da pinça e mede a subida (duração e velocidade de abertura), devolvendo uma classificação de gatilho (`fast` = subida <= `slowMs` e velocidade >= `minOpenSpeed`) sem direção nem força; sai tudo que produzia direção/força.
- **`round.ts`** (pacote): `observeFlick(reading, nowMs)` arma ao fechar depois de vista aberta; enquanto armado, calcula a mira relativa pela pinça virtual (bolinha + deslocamento da mão × `aimScale`) e o tiro previsto por `computeShot`, publicando-o no snapshot como a pinça faz; ao abrir, dispara o tiro previsto se o gatilho é rápido e há arrasto suficiente, senão cancela (lento/fraco/sem tiro); perda > 300 ms cancela e qualquer perda zera o armado.
- **`marblesController.ts`** (web): o laço agenda com `requestVideoFrameCallback` quando existe e recua para `requestAnimationFrame` + comparação de `currentTime` quando não; processa o detector só por quadro novo; conta os quadros novos por segundo (janela de 1 s) e expõe no snapshot; mapeia o resultado do último estalo sem `sem direção` e com `sem tiro`.
- **tela** (web): `fieldView` desenha a previsão do tiro (linha e seta) como na pinça e não desenha mais a seta de orientação da mão; `MarblesScreen` atualiza a orientação e mantém o rótulo alpha e o `aria-live`; `DebugPanel` ganha a taxa da câmera e o resultado do último estalo.

### Contratos e dados

- A soltura do estalo deixa de carregar `direction`; passa a carregar só a classificação do gatilho (`fast`), a velocidade de abertura e a duração da subida (dados de painel).
- `FlickShot`, `flickShot`, `handDirection` e os parâmetros `maxOpenSpeed`, `minShotSpeed`, `maxShotSpeed` saem da API do pacote.
- O tiro do modo estalo passa a ser o `Shot` previsto por `computeShot` (mesmo tipo do modo pinça), com direção e velocidade do arrasto.
- `snapshot()` do controlador passa a expor os quadros novos da câmera por segundo e, no modo estalo, a previsão do tiro (como a pinça) e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem tiro`).
- `DEFAULT_FLICK`: histerese herdada (0,35/0,55), `slowMs` 80 ms, `minOpenSpeed` 2 razão/s, perda 300 ms; sem parâmetros de força.

### Fluxo

1. O laço processa o detector só quando a câmera entrega um quadro novo (rVFC, recuo para `currentTime`); o painel conta os quadros novos por segundo.
2. No modo estalo, a pinça que fecha depois de vista aberta arma; enquanto armado, a mira relativa (pinça virtual) prevê o tiro pelo arrasto e a tela mostra a linha e a seta da previsão, como na pinça.
3. Ao abrir, o detector classifica o gatilho (rápido ou não) pela duração e pela velocidade da subida.
4. Gatilho rápido com arrasto suficiente dispara o tiro previsto (`computeShot`); a física avança como no modo pinça; o primeiro contato leva a `hit`.
5. Gatilho lento, fraco, sem arrasto suficiente ou perda da mão > 300 ms cancela; qualquer perda zera o armado. O painel registra o resultado do último estalo.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                  | Evidência planejada                           |
| --------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| FR-001    | `observeFlick` usa a pinça virtual (bolinha + deslocamento × `aimScale`) e `computeShot`                   | `round.test.ts`                               |
| FR-002    | Remover `handDirection`, `direction`, `flickShot` e os parâmetros de força do pacote e da tela             | `flick.test.ts`, busca no código              |
| FR-003    | Gatilho rápido (`slowMs` 80 ms, `minOpenSpeed` 2) dispara o tiro previsto; cancela lento/fraco/sem arrasto | `round.test.ts`                               |
| FR-004    | Perda > 300 ms cancela; qualquer perda zera o armado; abertura só medida como dado                         | `round.test.ts`                               |
| FR-005    | Laço por quadro novo: rVFC quando disponível, recuo para `currentTime`                                     | testes do controlador em jsdom                |
| FR-006    | Painel com "Quadros novos da câmera/s" e resultado do último estalo sem "sem direção"                      | testes do controlador e do painel             |
| FR-007    | Texto de orientação; rótulo alpha; previsão do tiro como na pinça; sem seta de orientação                  | `MarblesScreen.test.tsx`, `fieldView.test.ts` |
| FR-008    | Sem rede para imagem; aviso de privacidade                                                                 | busca no código e inspeção de rede            |
| FR-009    | Modo pinça (salvo quadros repetidos) e jogo de cartas sem mudança de comportamento                         | testes existentes verdes                      |
| FR-010    | Atualizar README, guia de arquitetura, PROJECT_SPEC e catálogo; marcar a antiga superseded                 | `yarn docs:format:check`, `yarn sdd:check`    |

## Estratégia test-first

1. Escrever os testes do detector de estalo só como classificador de gatilho (rápido/lento/fraco) e os testes que provam a remoção de `handDirection`/`flickShot`/`direction`, e confirmar a falha esperada;
2. implementar em `flick.ts` (remoções, `slowMs` 80, classificação), e confirmar verde;
3. escrever os testes de `observeFlick` com mira relativa (previsão por `computeShot`, disparo no gatilho rápido, cancelamento por lento/fraco/sem arrasto, perda da mão) sem alterar os casos do modo pinça, implementar na rodada, e confirmar verde;
4. no `apps/web`, escrever os testes do controlador (laço por quadro novo com rVFC e recuo para `currentTime`, contagem de quadros novos/s, resultado sem "sem direção") e da tela (orientação, previsão como na pinça, sem seta de orientação, linhas do painel), e implementar;
5. verificar privacidade por busca no código e inspeção de rede no Chromium; confirmar os testes do modo pinça e do jogo de cartas sem mudança de comportamento;
6. marcar a spec de criação do estalo como `superseded` e atualizar a documentação e o catálogo;
7. executar os gates oficiais e registrar a validação.

## Riscos, rollout e rollback

| Risco                                                         | Mitigação                                                                | Rollback/contingência                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `slowMs` de 80 ms cancela estalos legítimos numa webcam lenta | Limiar exposto no painel; resultado "lento demais"; é palpite (H-01)     | Elevar `slowMs`                           |
| Gatilho rápido sem arrasto gasta a intenção                   | Exige tiro previsto; resultado "sem tiro"; não conta tiro                | Ajustar o arrasto mínimo herdado da pinça |
| `requestVideoFrameCallback` ausente ou instável no navegador  | Recuo para a comparação de `currentTime`; testes em jsdom cobrem o recuo | Manter só o recuo por `currentTime`       |
| A taxa real da câmera revelar poucas amostras por estalo      | Painel mostra a taxa real; lacuna declarada (H-02, H-03)                 | Registrar a lacuna na validação           |
| Remoção de `handDirection`/`flickShot` quebrar imports        | Ajustar `index.ts` e os testes na mesma mudança; `yarn check:all`        | Reverter a remoção e isolar o gatilho     |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                              |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; a spec antiga vira `superseded` para não duplicar o comportamento vigente.  |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                               |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; mira relativa reusa `computeShot`; mudanças pequenas e reversíveis.          |
| V. Evidência honesta                        | PASS      | Nenhum desempenho ou viabilidade afirmado; limiares são palpites e a taxa da câmera é dado a medir. |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                              |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                                         |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; modo pinça (salvo quadros repetidos) e arquivos fora do escopo preservados.     |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
