# Plano — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Resumo técnico

No pacote puro `@guess-my-move/marbles`, o detector de estalo (`flick.ts`) mantém a medição da direção pela orientação da mão (`handDirection`, pulso → base do dedo médio, espelhada) e a medição da velocidade de abertura de pico, e troca a conversão de força de linear para logarítmica em `flickShot`: `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)` e `velocidade = minShotSpeed + power × (maxShotSpeed − minShotSpeed)`; o parâmetro linear `maxOpenSpeed` sai e entram `powerLowSpeed` (10) e `powerHighSpeed` (200), mantendo `minShotSpeed` (300) e `maxShotSpeed` (1100); `slowMs` cai de 300 para 80 ms e `minOpenSpeed` segue 2. A rodada (`round.ts`) no modo estalo arma ao fechar depois de vista aberta, publica a direção de prévia, e `observeFlick` dispara o tiro no gatilho rápido com direção medida convertendo a velocidade de abertura em força logarítmica; cancela no lento, no fraco e no sem direção, e zera o armado na perda da mão. No app web, o laço de quadros do `MarblesController` passa a processar o detector só em quadros novos da câmera (`requestVideoFrameCallback` quando disponível, recuo para `video.currentTime` quando não) e a contar os quadros novos por segundo; o painel mostra "Quadros novos da câmera/s" nos dois modos e, no estalo, Armado, a velocidade e a duração da abertura, a FORÇA do último estalo (0 a 100%) e o resultado (`disparado`, `lento demais`, `fraco demais`, `sem direção`); a tela mantém a seta de direção a partir da bolinha e atualiza o texto de orientação. O modo pinça só muda por não reprocessar quadros repetidos; a física, o campo, o alvo e o jogo de cartas não mudam. A spec de criação do estalo passa a `superseded` e esta é a fonte vigente completa do modo estalo.

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente (o `engines` do repositório pede >=26.12.1; os scripts de documentação e SDD rodam no Node 24), Yarn 4.18.1 via Corepack, TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5.
- **Dependências:** nenhuma nova. A escala logarítmica usa `Math.log`; `requestVideoFrameCallback` é API nativa do navegador, com recuo para `currentTime`.
- **Provedores externos:** nenhum. Nenhuma imagem sai do navegador.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagens), pureza da lógica em Node, isolamento do modo pinça e do jogo de cartas, Chrome desktop, honestidade de evidência (sem afirmar desempenho, correspondência da direção ao estalo real ou viabilidade do estalo sem medição).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                  |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; a correção de rumo (CQ-001) atualizou `spec.md` antes dos artefatos downstream.                |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente e a completa do modo estalo; a spec de criação passa a `superseded`.                                |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de requisitos.                                                              |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando; o detector de estalo compõe o de pinça sem alterá-lo.                           |
| V. Evidência honesta                        | PASS      | NFR-002 e H-01 a H-05 limitam afirmações; os limiares e a faixa da escala são palpites de uma sessão e a viabilidade é do maintainer. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem (FR-008); sem chaves; o refino não introduz novo dado sensível.                                                  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/`.                                                    |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o modo pinça (salvo quadros repetidos), seus testes e arquivos fora do escopo são preservados.                    |

## Pesquisa e decisões

- `research.md` — distinção entre as mecânicas (pinça regula força pela mão, estalo pelo polegar); direção pela orientação da mão; força pela velocidade de abertura numa escala logarítmica (`powerLowSpeed` 10, `powerHighSpeed` 200), removendo o teto linear `maxOpenSpeed`; `slowMs` de 300 para 80 ms; processamento só de quadros novos (`requestVideoFrameCallback` com recuo para `currentTime`); e a decisão de marcar a spec de criação do estalo como `superseded`.

## Estrutura afetada

```text
packages/marbles/
  src/
    flick.ts                              trocar a conversão de força de linear para log em flickShot; remover maxOpenSpeed; adicionar powerLowSpeed/powerHighSpeed; slowMs 300->80; manter handDirection, direção e velocidade de abertura
    round.ts                              observeFlick dispara no gatilho rápido com direção medida e força log; cancela lento/fraco/sem direção; snapshot com direção de prévia
    index.ts                              ajustar a API exportada (sem maxOpenSpeed; com powerLowSpeed/powerHighSpeed)
    pinch.ts, shot.ts, physics.ts         reusados, NÃO alterados em comportamento
  test/
    flick.test.ts                         testar escala log (extremos e meio), gatilho 80 ms/2 razão/s, velocidade de pico, direção, sem-direção; remover o teste do teto linear
    round.test.ts                         casos de observeFlick com força log e cancelamento por lento/fraco/sem direção; casos do modo pinça inalterados
apps/web/
  src/marbles/
    marblesController.ts                  laço por quadro novo (rVFC com recuo para currentTime); contagem de quadros novos/s; força e resultado do último estalo
    fieldView.ts                          manter a seta de direção a partir da bolinha enquanto armado
    MarblesScreen.tsx                     texto de orientação do estalo; rótulo alpha mantido; aria-live
    DebugPanel.tsx                        linha "Quadros novos da câmera/s"; FORÇA do último estalo (0 a 100%); resultado (disparado/lento demais/fraco demais/sem direção)
  src/card/, src/round/ do jogo de cartas  NÃO alterados
README.md, docs/development-context/architecture/architecture-guide.md, docs/product/PROJECT_SPEC.md   atualizar
specs/2026-10-27-game-marbles-bete-build-flick-beta/spec.md                                 status superseded + related_specs + seção Substituição
specs/2026-10-27-game-marbles-bete-refine-flick-thumb-release/                               esta spec
specs/README.md                                                                             nova linha e estado da antiga
```

## Design

### Componentes e responsabilidades

- **`flick.ts`** (pacote): o detector de estalo mantém a histerese e a razão da pinça, mede a subida (duração e velocidade de pico) e a direção pela orientação da mão no início da abertura; `flickShot` converte a soltura em `{ velocity, power } | null` pela escala logarítmica (não linear), devolvendo `null` quando lento, fraco ou sem direção.
- **`round.ts`** (pacote): `observeFlick(reading, nowMs)` arma ao fechar depois de vista aberta; enquanto armado, publica a direção de prévia no snapshot; ao abrir, dispara o tiro no gatilho rápido com direção medida, passando ao `fire` a velocidade da força log; cancela no lento, no fraco, no sem direção e na perda > 300 ms; qualquer perda zera o armado.
- **`marblesController.ts`** (web): o laço agenda com `requestVideoFrameCallback` quando existe e recua para `requestAnimationFrame` + comparação de `currentTime` quando não; processa o detector só por quadro novo; conta os quadros novos por segundo (janela de 1 s) e expõe no snapshot; mapeia a força (0 a 100%) e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem direção`).
- **tela** (web): `fieldView` desenha a seta de direção a partir da bolinha enquanto armado; `MarblesScreen` atualiza a orientação e mantém o rótulo alpha e o `aria-live`; `DebugPanel` ganha a taxa da câmera e a força do último estalo.

### Contratos e dados

- A soltura do estalo mantém a direção, a classificação do gatilho (`fast`), a velocidade de abertura e a duração da subida.
- `flickShot` passa a aplicar a escala logarítmica; `maxOpenSpeed` sai de `FlickConfig`, `powerLowSpeed` e `powerHighSpeed` entram; `minShotSpeed` e `maxShotSpeed` ficam.
- O tiro do modo estalo tem a direção da orientação da mão e a velocidade da força log; é passado ao `fire` da rodada.
- `snapshot()` do controlador passa a expor os quadros novos da câmera por segundo, a FORÇA do último estalo (0 a 100%) e o resultado (`disparado`, `lento demais`, `fraco demais`, `sem direção`).
- `DEFAULT_FLICK`: histerese herdada (0,35/0,55), `slowMs` 80 ms, `minOpenSpeed` 2 razão/s, `powerLowSpeed` 10, `powerHighSpeed` 200, `minShotSpeed` 300, `maxShotSpeed` 1100, perda 300 ms; sem `maxOpenSpeed`.

### Fluxo

1. O laço processa o detector só quando a câmera entrega um quadro novo (rVFC, recuo para `currentTime`); o painel conta os quadros novos por segundo.
2. No modo estalo, a pinça que fecha depois de vista aberta arma; enquanto armado, a direção pela orientação da mão é publicada e a tela mostra a seta a partir da bolinha.
3. Ao abrir, o detector mede a duração e a velocidade de pico da subida e classifica o gatilho (rápido ou não).
4. Gatilho rápido com direção medida dispara o tiro: direção da orientação da mão, velocidade pela força log da velocidade de abertura; a física avança; o primeiro contato leva a `hit`.
5. Gatilho lento, fraco, sem direção ou perda da mão > 300 ms cancela; qualquer perda zera o armado. O painel registra a força e o resultado do último estalo.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                               | Evidência planejada                           |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| FR-001    | `handDirection` (pulso → base do médio, espelhada) mantido; seta de direção a partir da bolinha         | `flick.test.ts`, `fieldView.test.ts`          |
| FR-002    | `flickShot` com escala log (`powerLowSpeed`/`powerHighSpeed`); remover `maxOpenSpeed`                   | `flick.test.ts`                               |
| FR-003    | Gatilho rápido (`slowMs` 80, `minOpenSpeed` 2) com direção dispara; cancela lento/fraco/sem direção     | `flick.test.ts`, `round.test.ts`              |
| FR-004    | Perda > 300 ms cancela; qualquer perda zera o armado                                                    | `round.test.ts`                               |
| FR-005    | Laço por quadro novo: rVFC quando disponível, recuo para `currentTime`                                  | testes do controlador em jsdom                |
| FR-006    | Painel com "Quadros novos da câmera/s", força (0 a 100%) e resultado do último estalo                   | testes do controlador e do painel             |
| FR-007    | Texto de orientação; rótulo alpha; seletor de modo; seta de direção a partir da bolinha                 | `MarblesScreen.test.tsx`, `fieldView.test.ts` |
| FR-008    | Sem rede para imagem; aviso de privacidade                                                              | busca no código e inspeção de rede            |
| FR-009    | Modo pinça (salvo quadros repetidos) e jogo de cartas sem mudança; pinça não usa velocidade de abertura | testes existentes verdes                      |
| FR-010    | Atualizar README, guia de arquitetura, PROJECT_SPEC e catálogo; marcar a antiga superseded              | `yarn docs:format:check`, `yarn sdd:check`    |

## Estratégia test-first

1. Escrever os testes do detector de estalo para a escala logarítmica (extremos `v<=10`→0, `v>=200`→1, e um ponto no meio), o gatilho (80 ms, 2 razão/s), a velocidade de pico, a direção e o cancelamento por sem-direção, e o teste que prova a remoção de `maxOpenSpeed`, confirmando a falha esperada;
2. implementar em `flick.ts` (escala log em `flickShot`, `powerLowSpeed`/`powerHighSpeed`, remover `maxOpenSpeed`, `slowMs` 80), e confirmar verde;
3. escrever os testes de `observeFlick` (disparo no gatilho rápido com direção e força log, cancelamento por lento/fraco/sem direção, perda da mão) sem alterar os casos do modo pinça, implementar na rodada, e confirmar verde;
4. no `apps/web`, escrever os testes do controlador (laço por quadro novo com rVFC e recuo para `currentTime`, contagem de quadros novos/s, força e resultado) e da tela (orientação, seta de direção, linhas do painel), e implementar;
5. verificar privacidade por busca no código e inspeção de rede no Chromium; confirmar os testes do modo pinça e do jogo de cartas sem mudança de comportamento;
6. marcar a spec de criação do estalo como `superseded` e atualizar a documentação e o catálogo;
7. executar os gates oficiais e registrar a validação.

## Riscos, rollout e rollback

| Risco                                                            | Mitigação                                                                | Rollback/contingência                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| `slowMs` de 80 ms cancela estalos legítimos numa webcam lenta    | Limiar exposto no painel; resultado "lento demais"; é palpite (H-01)     | Elevar `slowMs`                             |
| A faixa 10 a 200 da escala log não corresponder à força real     | Força mostrada em % no painel; é palpite da amplitude observada (H-02)   | Recalibrar `powerLowSpeed`/`powerHighSpeed` |
| A direção pela orientação da mão não corresponder ao estalo real | Seta de prévia deixa ajustar a mão; declarado como incerteza (H-04)      | Avaliar alternativas de direção (futuro)    |
| `requestVideoFrameCallback` ausente ou instável no navegador     | Recuo para a comparação de `currentTime`; testes em jsdom cobrem o recuo | Manter só o recuo por `currentTime`         |
| A taxa real da câmera revelar poucas amostras por estalo         | Painel mostra a taxa real; lacuna declarada (H-03, H-05)                 | Registrar a lacuna na validação             |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                  |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                                |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; a spec antiga vira `superseded` para não duplicar o comportamento vigente.    |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                                 |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; o detector de estalo compõe o de pinça; mudanças pequenas e reversíveis.       |
| V. Evidência honesta                        | PASS      | Nenhum desempenho, correspondência de direção ou viabilidade afirmado; limiares e faixa são palpites. |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                                |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                                           |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; modo pinça (salvo quadros repetidos) e arquivos fora do escopo preservados.       |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
