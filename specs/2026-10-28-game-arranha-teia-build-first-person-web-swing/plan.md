# Plano — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Resumo técnico

Arranha-Teia é entregue em duas camadas. A **lógica** vai para o pacote puro `@guess-my-move/swing` (TypeScript, Vitest, sem navegador): `city.ts` (tipos do formato v1, já definido), `index.ts` (API pública), `vec.ts` (vetores), `cityIndex.ts` (grade espacial, raycast, colisão do jogador, altura de apoio), `web.ts` (mira assistida da teia, cinco raios e teia no céu), `physics.ts` (passo fixo do jogador, corda que puxa e deslize na parede), `trigger.ts` (gatilho do gesto com histerese, punho que puxa e palma que solta, devolve `{ held, pull }`), `pose.ts` (pose de teia por geometria em 3D, punho `isFist`, palma `isOpenPalm`, lado da mão e `handMetrics`), `cue.ts` (dica do próximo gesto), `spawn.ts` (ponto inicial em espiral com corda longa) e `world.ts` (sessão: estado, `step`, `reset`, incluindo a teia no céu e a **câmera automática** que segue o movimento). A direção por joystick da mão da CQ-007 (`steering.ts`) foi **removida** na CQ-008. A **apresentação** vai para `apps/web`: `swing.html`, `apps/web/src/swing/` (`main.tsx`, `SwingScreen.tsx`, `swingController.ts`, `useSwingGame.ts`, `cityRenderer.ts` em Three.js 0.186.0, `speedLines.ts`, `reticle.ts` (mira projetada na tela), `guide.ts` (dicas e guia, mais o painel de depuração recolhido), `swing.css`), um card novo no `HomePage` e a entrada `swing` no `vite.config.ts`; o reconhecedor (`apps/web/src/tracker/mediapipeTracker.ts`) usa as duas mãos (CQ-007). O **pipeline de dados** é `apps/web/scripts/city-from-osm.mjs` (conversor puro) e `build-city.mjs` (busca na Overpass e grava `apps/web/public/swing/midtown.json`), com testes `node:test`. A documentação (README da raiz, guia de arquitetura, PROJECT_SPEC) e o catálogo de specs são atualizados.

A verificação é test-first: cada módulo do pacote tem teste antes da implementação; o conversor tem teste sem rede; a tela tem teste de páginas; e a verificação visual em Chromium headless (WebGL por software, câmera simulada) é registrada como texto em `validation.md`. A única dependência nova é o Three.js 0.186.0 (MIT) empacotado sem CDN. Os valores de física são de jogo e nenhuma afirmação de desempenho (fps) é feita sem medição numa GPU real. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-28; o código ainda será implementado e o Gate 3 fica para depois, com risco aceito de não haver teste ao vivo com a mão.

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente para os scripts de documentação e SDD (o `engines` do repositório pede >=26.12.1 <27); Yarn 4.18.1 via Corepack; TypeScript 7.0.2; React 19 e Vite no `apps/web`; Vitest nos testes do pacote e de componente; Node `--test` nos testes do conversor.
- **Dependências:** uma nova, o Three.js 0.186.0 (MIT), empacotado pelo Vite sem CDN (CQ-001, H-03). O pacote `@guess-my-move/swing` é TypeScript puro sem dependências de runtime.
- **Provedores externos:** nenhum em tempo de jogo. A Overpass API e o OpenStreetMap (ODbL) são usados só no pipeline de dados, fora do jogo.
- **Persistência:** nenhuma. Não há salvamento de progresso nem estado entre partidas (fora de escopo).
- **Testes:** Vitest em `packages/swing` e `apps/web`; os testes do conversor rodam em Node (`node:test`); scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (processamento local, sem gravar nem enviar imagem, nenhuma requisição a terceiros, inclusive para a cidade e o Three.js); jogador sempre em movimento (sem travamento); teclado como alternativa completa; honestidade de evidência (sem afirmar fps, suavidade ou realismo sem medição); atribuição ODbL obrigatória na tela; nenhum ativo de terceiros no repositório.

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                                        |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; CQ-001 a CQ-005 resolvidas em `clarification.md` antes de `plan.md` e `tasks.md`.                                    |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente deste jogo; o plano referencia IDs e não duplica comportamento de outras specs.                                           |
| III. Rastreabilidade                        | PASS      | Cada FR tem linha na matriz de requisitos abaixo e tarefa formal em `tasks.md`.                                                                             |
| IV. Test-first e incremental                | PASS      | Estratégia test-first por módulo; testes do pacote e do conversor antes da implementação; mudanças pequenas e reversíveis por fase.                         |
| V. Evidência honesta                        | PASS      | NFR-003 e NFR-005 limitam afirmações; valores de física declarados como de jogo; fps não medido numa GPU e validação com mão real ausente ficam declarados. |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; nenhuma requisição a terceiros (FR-009, NFR-004); sem chaves nem dados sensíveis novos.                  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; nenhum ativo, marca ou personagem de terceiros no repositório (D-04).                                            |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o jogo de cartas, o bete de bolinhas, o reconhecedor e o design system são preservados; só se acrescenta o jogo novo e um card no menu. |

## Pesquisa e decisões

- `research.md` — fatos verificáveis (categoria `ILoveYou` no modelo já versionado com hash em `prepare-assets.mjs`; resposta 200 da Overpass com 569 prédios e 177 vias, 481 com `height` e 93 com `building:levels`; licença ODbL dos dados; Three.js 0.186.0 MIT), a arquitetura da lógica pura separada da apresentação, a tabela de valores de física de jogo, o gatilho e a direção, o render e o efeito de velocidade, o pipeline de dados e as limitações declaradas (anel externo simples, pátios preenchidos, alturas estimadas, sem validação com mão real, fps não medido).

## Estrutura afetada

```text
packages/swing/                         pacote puro @guess-my-move/swing (Vitest)
  src/city.ts                           tipos City, CityBuilding, CityRoad (pronto)
  src/index.ts                          API pública do pacote
  src/vec.ts / test/vec.test.ts         vetores 3D puros
  src/cityIndex.ts / test/              grade espacial, raycast, colisão do jogador, altura de apoio
  src/web.ts / test/                    mira assistida (cinco raios +50°/+38°/+26°/+15°/+6°, alcance 160 m, ponto válido >= 12 m / >= 15 m) — CQ-008
  src/physics.ts / test/                passo fixo, gravidade 20, arrasto, velocidade máx 60, corda inextensível que encurta, corda que puxa (assist/punho), deslize na parede, salto do chão, colisões
  src/trigger.ts / test/                gatilho puro (ILoveYou lança; punho segura/puxa; palma solta; 600 ms solta) — devolve { held, pull } — CQ-008
  src/pose.ts / test/                   pose de teia por geometria em 3D (isWebPose), punho (isFist), palma (isOpenPalm), lado da mão (handSide), handMetrics — CQ-007/CQ-008
  src/cue.ts / test/                    dica do próximo gesto (swingCue) — CQ-007
  src/spawn.ts / test/                  busca em espiral por ponto com prédio de subida 30 m a >= 50 m, y = 90 m, velocidade 10 m/s à frente — CQ-008
  src/world.ts / test/                  sessão: estado + step (acumulador) + reset + câmera automática que segue o movimento — CQ-008
apps/web/
  public/swing/midtown.json             cidade versionada (gerada pelo pipeline, não buscada em jogo)
  scripts/city-from-osm.mjs             conversor OSM puro para o formato City (metros, rotação 29°, atribuição ODbL)
  scripts/city-from-osm.test.mjs        node:test do conversor, sem rede
  scripts/build-city.mjs                busca na Overpass e grava o JSON (pipeline, fora do jogo)
  swing.html                            página do jogo
  src/swing/main.tsx                    bootstrap da tela
  src/swing/SwingScreen.tsx             tela: cena, HUD, atribuição ODbL, botão "Voltar ao início"
  src/swing/swingController.ts          liga câmera/teclado à sessão do mundo
  src/swing/useSwingGame.ts             hook do laço de jogo
  src/swing/cityRenderer.ts             render Three.js 0.186.0 (sem luzes, névoa, céu, janelas e ruas procedurais, teia)
  src/swing/speedLines.ts               linhas radiais e campo de visão com a velocidade
  src/swing/reticle.ts                  prévia da mira projetada na tela (anel/seta, rótulo do lado) — CQ-007
  src/swing/guide.ts                    dicas e guia "Como jogar" de 4 etapas (swingCue) — CQ-007
  src/tracker/mediapipeTracker.ts       reconhecedor com as duas mãos (detectAll, numHands 2) — CQ-007
  src/swing/swing.css                   estilos da tela (herda tokens)
  src/home/                             card novo no HomePage levando ao jogo (sem mudar o layout existente)
  vite.config.ts                        entrada swing
  package.json                          dependência three 0.186.0; script test inclui os testes do conversor
README.md, docs/development-context/architecture/architecture-guide.md, docs/product/PROJECT_SPEC.md, specs/README.md   atualizados
specs/2026-10-28-game-arranha-teia-build-first-person-web-swing/   esta spec (spec.md, clarification.md, research.md, plan.md, tasks.md, checklists/, validation.md ao fim)
```

## Design

### Componentes e responsabilidades

- **city.ts** — tipos do formato v1 (`City`, `CityBuilding`, `CityRoad`): anéis e linhas planas `[x0, z0, ...]` em metros; é o contrato de dados entre o pipeline e o jogo. Já existe.
- **vec.ts** — operações de vetor 3D puras usadas pela física e pela mira; sem estado.
- **cityIndex.ts** — constrói uma grade espacial sobre os prédios para raycast e colisão em tempo bom; expõe raycast (ponto, direção, alcance), teste de colisão do jogador (ponto de raio 1,0 m contra parede, telhado, chão e limite) e altura de apoio.
- **web.ts** — mira assistida: a partir do olho, lança **cinco** raios com o pitch da câmera + 50°, + 38°, + 26°, + 15° e + 6°, do mais inclinado ao mais raso (a câmera abaixo de 0° conta como 0°); retorna o primeiro acerto com y >= y do jogador + 12 m e distância horizontal >= 15 m dentro de 160 m (CQ-008; antes três raios +35°/+20°/+8°, 140 m, 25 m, 30 m). Quando nenhum prédio é alcançável, o `world.ts` prende num ponto no céu à frente e acima do jogador (60 m à frente, 70 m acima, até 220 m de altura), marcado como virtual e usado como reserva; o prédio tem preferência.
- **pose.ts** — pose de teia por geometria (`isWebPose`): mede por distâncias entre landmarks (indicador e mindinho >= 1,5; médio e anelar <= 1,3; polegar >= 0,6 da palma), válida em qualquer orientação e em qualquer das duas mãos; `handSide` dá o lado pela posição na tela espelhada; `webSignal` combina a pose (vale como `ILoveYou` score 1) com o rótulo do reconhecedor (CQ-007). A partir da CQ-008, as distâncias são em **3D** (usam o `z` do MediaPipe quando existe — hipótese não medida ao vivo) e a pose expõe também o **punho fechado** (`isFist`), a **palma aberta** (`isOpenPalm`) e `handMetrics` (alcance dos 4 dedos e abertura do polegar) para o painel de depuração.
- **cue.ts** — `swingCue` lê o estado e devolve o próximo gesto (start, swing, release, throw, low, ground); alimenta as dicas e o guia na tela (CQ-007).
- **trigger.ts** — funções puras de gatilho: a pose `ILoveYou` (2 quadros) lança; a pose ou o punho `Closed_Fist` seguram; o punho com a teia presa **puxa**; `Open_Palm` por 2 quadros **solta**; sem pose nem punho por 600 ms solta sozinho; devolve `{ held, pull }` (CQ-008; a histerese de 250 ms da versão anterior é substituída por este gatilho explícito).
- **physics.ts** — passo do jogador: integra gravidade e arrasto, limita a velocidade a 60 m/s; com a teia presa, projeta a posição na esfera da corda, remove a velocidade radial para fora e encurta a corda a 4 m/s até 10 m. A partir da CQ-008, a corda **puxa**: assistência `assist` 12 m/s² em direção ao ponto; com o punho fechado, `pullAssist` 40 m/s², recolhimento `pullReel` 16 m/s e impulso único `pullImpulse` 9 m/s por fechada. A colisão com prédio **não solta** a teia: o jogador desliza pela parede (`wallFriction` 2 por s, restituição 0,1) e a teia continua presa; pouso no telhado; chão com atrito forte e corrida automática (que não atua com a teia presa); parede invisível no limite; lançar do chão dá salto (`launchBoost` 14 m/s mais `launchLift` 6 m/s). A área jogável (`playBounds`) é a caixa dos prédios + 120 m, nunca além do mapa (CQ-007/CQ-008).
- **câmera automática (`world.ts`, CQ-008)** — a direção por joystick da mão (`steering.ts`) foi **removida** (o módulo e seu teste apagados). A câmera é automática: guinada e inclinação seguem o movimento (inclinação = 12° + metade da inclinação da velocidade, entre -20° e 35°), para a outra mão não precisar girar a câmera. As setas do teclado ainda ajustam o olhar e a tecla `C` puxa.
- **spawn.ts** — busca em espiral a partir da origem por um ponto livre, fixa y = 90 m e velocidade inicial 10 m/s para a frente; a partir da CQ-008, prefere um ponto com prédio de subida 30 m a pelo menos 50 m à frente, para a primeira teia ter arco.
- **world.ts** — a sessão: guarda o estado (posição, velocidade, orientação, teia, HUD), aplica `step(dt, input)` com passo fixo de 1/120 s por acumulador (dt máximo 0,05 s) e `reset()`; prende no céu quando nenhum prédio é alcançável e move a câmera automaticamente seguindo o movimento (CQ-008).
- **cityRenderer.ts / speedLines.ts / SwingScreen.tsx / swingController.ts / useSwingGame.ts** — a camada visível: desenham a cidade e a teia em Three.js, o HUD e o efeito de velocidade, e ligam a câmera (reconhecedor) ou o teclado à sessão; não contêm regra de jogo.
- **city-from-osm.mjs / build-city.mjs** — o pipeline: o conversor é puro (OSM para `City`), o `build-city` busca na Overpass e grava o JSON; ambos fora do tempo de jogo.

### Contratos e dados

- A sessão `world.ts` é a fronteira: a tela só chama `step` e lê o estado; toda a física e a decisão de teia ficam no pacote puro.
- O gatilho e a direção são funções puras: a tela passa o score do reconhecedor (ou o estado das teclas) e os landmarks, e recebe de volta "lançar/soltar" e as taxas; nada da câmera é gravado.
- O formato `City` é o único contrato entre o pipeline e o jogo; o JSON versionado é a fonte em tempo de jogo, sem rede.
- A verificação proíbe `url()` ou fetch http/https a terceiros; a cidade e o Three.js saem da própria origem.

### Fluxo

1. O conversor e o `build-city` produzem `apps/web/public/swing/midtown.json` uma vez (fora do jogo).
2. A tela carrega o JSON da própria origem, monta a cena Three.js, o HUD e a atribuição ODbL, e cria a sessão `world`.
3. A cada quadro: o reconhecedor (ou o teclado) alimenta `trigger` e `steering`; a tela chama `world.step(dt, input)` com passo fixo; o estado atualizado move a câmera, desenha a teia e atualiza o HUD e o efeito de velocidade.
4. O gesto ILoveYou sustentado lança a teia pela mira assistida; a corda encurta e o jogador balança; desfazer o gesto (após a histerese) solta e o jogador voa; colisões mantêm o jogador em movimento.
5. A verificação roda os testes do pacote, o teste do conversor, o teste de páginas e a inspeção visual em Chromium headless, registrada como texto em `validation.md`.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                                                                                                                                                                                                                                                                           | Evidência planejada                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| FR-001    | `apps/web/public/swing/midtown.json` no formato `City` v1 (metros, rotação 29°); conversor e `build-city` geram o JSON; atribuição ODbL na tela                                                                                                                                                                                                                     | teste do conversor; teste de tela; verificação visual    |
| FR-002    | `cityIndex.ts` com grade, raycast, colisão do jogador (parede, telhado, chão, limite) e altura de apoio                                                                                                                                                                                                                                                             | `cityIndex` tests (Vitest)                               |
| FR-003    | `web.ts` com cinco raios + 50°/+ 38°/+ 26°/+ 15°/+ 6°, alcance 160 m, ponto válido (y >= +12 m, horizontal >= 15 m); teia no céu quando nenhum prédio é alcançável (60/70/220, virtual) e mira projetada na tela (`reticle.ts`) — CQ-007/CQ-008                                                                                                                     | `web` tests (Vitest); `reticle` test; verificação visual |
| FR-004    | `physics.ts` com gravidade 20, arrasto exp(-0,1 dt), velocidade máx 60, passo fixo 1/120 s, corda inextensível que encurta a 4 m/s até 10 m, corda que puxa (assist 12, pullAssist 40, pullReel 16, pullImpulse 9), deslize na parede (wallFriction 2, restituição 0,1) e salto do chão (launchBoost 14, launchLift 6); área jogável `playBounds` (+120 m) — CQ-008 | `physics` e `world` tests (Vitest)                       |
| FR-005    | `trigger.ts` puro (ILoveYou lança; punho segura/puxa; palma solta; 600 ms solta; devolve `{ held, pull }`); `pose.ts` (`isWebPose` em 3D, `isFist`, `isOpenPalm`, `handSide`, `handMetrics`) e duas mãos no reconhecedor (`detectAll`, `numHands` 2); lado desvia 28° — CQ-007/CQ-008                                                                               | `trigger` e `pose` tests (Vitest); `swingHands` test     |
| FR-006    | **Superado pela CQ-008:** a direção por joystick da mão (`steering.ts`) foi removida; a câmera é automática em `world.ts` (segue o movimento, inclinação 12° + metade da inclinação da velocidade); setas ajustam o olhar e `C` puxa                                                                                                                                | `world` tests (Vitest); teste de controlador             |
| FR-007    | `cityRenderer.ts` em Three.js 0.186.0 empacotado; HUD (km/h, m, teias, distância) e botão "Voltar ao início"; efeito de velocidade 70°→100° e linhas radiais                                                                                                                                                                                                        | teste de tela; verificação visual                        |
| FR-008    | `apps/web/swing.html`, entrada `swing` no `vite.config.ts`, card novo no `HomePage`                                                                                                                                                                                                                                                                                 | teste de páginas (entradas e card)                       |
| FR-009    | Processamento local, sem gravar nem enviar imagem; nenhuma requisição a terceiros; cidade e Three.js da própria origem                                                                                                                                                                                                                                              | busca no código; verificação visual de rede              |

## Estratégia test-first

1. Escrever os testes de cada módulo do pacote falhando (vec, cityIndex, web, physics, trigger, steering, spawn, world), confirmando a falha esperada;
2. implementar os módulos puros um a um, confirmando cada teste verde, começando por `vec` e `cityIndex` (base para `web` e `physics`), depois `trigger`, `steering`, `spawn` e `world`;
3. escrever o teste do conversor de OSM (sem rede) falhando e implementar `city-from-osm.mjs`; rodar `build-city.mjs` uma vez para gerar o JSON versionado;
4. implementar a camada de render e controlador (`cityRenderer`, `speedLines`, `SwingScreen`, `swingController`, `useSwingGame`) e o teste de páginas (entrada `swing`, `swing.html`, card no menu);
5. rodar a inspeção visual em Chromium headless (1 ou mais larguras, câmera simulada, WebGL por software) e registrar como texto em `validation.md`;
6. atualizar a documentação e o catálogo, executar os gates oficiais e fechar o Gate 3 com risco aceito.

## Riscos, rollout e rollback

| Risco                                                         | Mitigação                                                                                                         | Rollback/contingência                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| O reconhecedor perder o gesto por um quadro e a teia piscar   | Histerese de 250 ms no `trigger.ts`; teste cobre a falha momentânea                                               | Aumentar a janela de histerese                     |
| O jogador travar contra um prédio ou ficar parado no chão     | Colisão com restituição e empurrão para fora; corrida automática no chão; teste de cada caso em `physics`/`world` | Ajustar a restituição e a velocidade de corrida    |
| A mira assistida não achar ponto válido e a teia errar sempre | Três raios em ângulos crescentes e regra de ponto válido testada; spawn alto para dar margem                      | Ajustar os ângulos ou a regra de distância mínima  |
| Alturas ausentes no OSM deixarem prédios baixos demais        | Estimar por andares × 3,3 m, padrão 15 m; limitação registrada                                                    | Rever a estimativa no conversor                    |
| Multipolígono OSM complexo gerar geometria errada             | Usar só o anel externo simples e preencher pátios; limitação registrada                                           | Melhorar o conversor numa entrega futura           |
| Afirmar desempenho sem medição                                | Não afirmar fps nem suavidade sem medição numa GPU real; headless usa WebGL por software (NFR-003)                | Medir numa GPU real numa sessão futura e registrar |
| Three.js elevar o tamanho do bundle                           | Dependência única, fixada em 0.186.0, empacotada; auditoria de dependências verde                                 | Avaliar tree-shaking ou uma alternativa menor      |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                     |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`; a lógica segue os FRs e os valores fixados.                       |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; não duplica o comportamento de outros jogos, que seguem nas suas specs.                          |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura por tarefa formal em `tasks.md`.                                                  |
| IV. Test-first e incremental                | PASS      | Testes do pacote e do conversor antes da implementação; módulos pequenos e puros implementados um a um.                  |
| V. Evidência honesta                        | PASS      | Valores de física declarados como de jogo; fps não medido numa GPU e validação com mão real ausente ficam declarados.    |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local, sem gravar nem enviar imagem; nenhuma requisição a terceiros; cidade e Three.js da própria origem.  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente; nenhum ativo, marca ou personagem de terceiros; contexto técnico em `docs/`. |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; cartas, bolinhas, reconhecedor e design system preservados; só se acrescenta o jogo novo e o card.   |

## Complexidade e desvios

| Necessidade             | Impacto | Alternativa mais simples rejeitada                | Aprovação       |
| ----------------------- | ------- | ------------------------------------------------- | --------------- |
| Three.js 0.186.0 (nova) | baixo   | WebGL cru (muito esforço para o escopo do render) | CQ-001 (Gate 1) |
