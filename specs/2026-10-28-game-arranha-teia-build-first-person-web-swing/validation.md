# Validação — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Estado

- **Spec:** `spec.md`
- **Status:** aprovado com risco aceito
- **Constituição:** 1.0.0
- **Data:** `2026-10-28`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho pelo merge do PR da issue #76
- **Commit:** merge do PR da issue #76 na `main`

## Resumo do resultado

A entrega adiciona o jogo **Arranha-Teia**, um passeio em primeira pessoa por um trecho real de Midtown Manhattan (dados do OpenStreetMap sob ODbL), em que o gesto ILoveYou lança uma teia que faz o jogador balançar como pêndulo e, ao desfazer o gesto, solta e voa. A lógica fica num pacote puro de TypeScript `@guess-my-move/swing` (em `packages/swing/src`): `vec` (vetores 3D), `cityIndex` (grade espacial com raycast, colisão contra parede/telhado/chão/limite e altura de apoio), `web` (mira assistida de três raios do olho com pitch + 35°, + 20° e + 8°, alcance 140 m, ponto válido >= 8 m acima e >= 12 m na horizontal), `physics` (passo fixo 1/120 s, gravidade 20, arrasto `exp(-0,1 dt)`, velocidade máxima 60, corda inextensível que encurta a 4 m/s até 10 m, restituição 0,3 na parede, pouso no telhado, chão com corrida automática 8 m/s, parede invisível no limite), `trigger` (lança com `ILoveYou` >= 0,7 em 2 quadros, solta após 250 ms de histerese), `steering` (centro da palma pela média dos landmarks 0, 5, 9, 13, 17 espelhado em x, zona morta 0,10, saturação 0,35, guinada 90°/s e inclinação 60°/s), `spawn` (busca em espiral, y = 90 m) e `world` (sessão: estado, `step` com acumulador e dt máximo 0,05 s, `reset`). O `apps/web/src/swing` acrescenta a camada visível: `cityRenderer` (Three.js 0.186.0 empacotado, sem CDN, cena sem luzes com cor por vértice, névoa, céu em degradê, janelas e ruas por textura procedural), `speedLines` (campo de visão 70°→100° e linhas radiais com a velocidade), `swingController`, `useSwingGame` e `SwingScreen` (ligam o reconhecedor de gestos e o teclado à sessão, com HUD de velocidade/altura/teias/distância, atribuição ODbL e botão "Voltar ao início"), `loadCity` e `guide`. O pipeline de dados (`apps/web/scripts/city-from-osm.mjs` e `build-city.mjs`) gerou uma vez o JSON versionado `apps/web/public/swing/midtown.json`, fora do tempo de jogo. A página própria `apps/web/swing.html`, a entrada `swing` do Vite e um card novo no `HomePage` completam a entrega. Os núcleos e as telas dos outros jogos não foram alterados.

A verificação foi por testes puros (Vitest e `node:test`), pelos gates oficiais e por uma inspeção visual em Chromium headless com WebGL por software e câmera simulada, registrada como TEXTO (sem salvar imagens no repositório). **A aparência e o desempenho ao vivo numa GPU real, e o comportamento com a mão real na câmera do usuário, NÃO foram verificados antes do merge:** o maintainer aprovou os Gates 1 e 2 antecipadamente e o Gate 3 foi concedido pelo merge, com o risco aceito. Nenhuma afirmação de fps, latência ou precisão é feita.

## Conclusão das tarefas

- **Concluídas:** 18 (T001 a T014, mais T015 a T020 da CQ-007, T021 a T022 da CQ-008 e T023 a T024 da CQ-009)
- **Pendentes:** 0 (T014 fechada pelo Gate 3 concedido no merge, sem teste ao vivo com a mão real nem medição de fps em GPU real)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                                                                                                                        | Resultado |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T008, T012       | teste `node:test` de `city-from-osm.mjs` (entrada OSM → `City` v1 em metros, plano rotacionado 29°, atribuição ODbL, sem rede); `midtown.json` versionado; atribuição visível na inspeção visual | PASS      |
| FR-002    | T001, T002, T007 | testes Vitest de `vec`, `cityIndex` (raycast, colisão parede/telhado/chão/limite, altura de apoio), `spawn` (y = 90 m, preferência pelo ponto de onde a teia alcança — CQ-006) e `world`         | PASS      |
| FR-003    | T003             | testes Vitest de `web` (três raios + 35°/+ 20°/+ 8°, alcance 140 m, ponto válido >= 8 m acima e >= 12 m na horizontal, "errou" sem acerto)                                                       | PASS      |
| FR-004    | T004, T007       | testes Vitest de `physics` (gravidade, arrasto, velocidade máxima, corda inextensível que encurta, restituição 0,3, telhado, chão, limite) e `world` (passo fixo com acumulador)                 | PASS      |
| FR-005    | T005             | testes Vitest de `trigger` (lança com `ILoveYou` >= 0,7 em 2 quadros; solta após 250 ms de histerese)                                                                                            | PASS      |
| FR-006    | T006, T010       | testes Vitest de `steering` (palma pela média dos landmarks, zona morta, saturação, guinada e inclinação, sem mão taxa zero, teclado igual) e teste do `swingController`                         | PASS      |
| FR-007    | T009, T010, T012 | testes de `speedLines`, `cityGeometry` e `SwingScreen` (HUD, atribuição, botão "Voltar ao início"); inspeção visual: cidade, HUD e linhas de velocidade                                          | PASS      |
| FR-008    | T011             | teste de páginas/tela: `apps/web/swing.html`, entrada `swing` no `vite.config.ts` e card no `HomePage` sem regressão nas telas existentes                                                        | PASS      |
| FR-009    | T012             | busca no código sem requisição a terceiros; inspeção de rede: 10 requisições, todas à própria origem; processamento local, sem gravar nem enviar imagem                                          | PASS      |

## Histórias e critérios de aceitação

| História/cenário                         | Demonstração                                                                                                       | Resultado |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| US-001 / lançar a teia e balançar        | testes de `web`, `physics` e `world`; inspeção visual: ao segurar Espaço o jogo começa e a teia prende (Teias: 1)  | PASS      |
| US-002 / soltar a teia e voar            | testes de `trigger` (histerese 250 ms) e `physics` (voo livre sob gravidade e arrasto, velocidade máxima)          | PASS      |
| US-003 / cidade real com atribuição      | `midtown.json` versionado; inspeção visual: cidade de Midtown com prédios, janelas e ruas, atribuição ODbL visível | PASS      |
| US-004 / nunca ficar preso               | testes de `physics` (restituição na parede e solta a teia, pouso no telhado, corrida no chão, parede no limite)    | PASS      |
| US-005 / dirigir com a mão como joystick | testes de `steering` (deslocamento → guinada/inclinação com zona morta e saturação; sem mão mantém a direção)      | PASS      |
| US-006 / jogar sem câmera pelo teclado   | testes do `swingController` e inspeção visual: Espaço começa e segura a teia; alternativa completa à mão           | PASS      |
| US-007 / privacidade preservada          | inspeção de rede (10 requisições, todas à própria origem); sem gravar nem enviar imagem                            | PASS      |

Os critérios que dependem da mão real na câmera do usuário e da aparência/desempenho ao vivo numa GPU real ficam no risco aceito do Gate 3.

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                             |
| ---------------------------- | ---------- | --------- | -------------------------------------------------------------------------------- |
| `yarn lint`                  | 2026-10-28 | PASS      | Oxlint type-aware, 0 avisos e 0 erros                                            |
| `yarn typecheck`             | 2026-10-28 | PASS      | `tsc --build` sem erro em todos os workspaces                                    |
| `yarn test`                  | 2026-10-29 | PASS      | Vitest: core 68, marbles 111, swing 117, web 237; `node:test` do web 24 (CQ-008) |
| `yarn test:gates`            | 2026-10-28 | PASS      | 231 testes                                                                       |
| `yarn security:dependencies` | 2026-10-28 | PASS      | nenhum achado em nenhum nível                                                    |
| `yarn build`                 | 2026-10-29 | PASS      | `prepare:assets` + `tsc --build` + `vite build`, saída em `apps/web/dist`        |

## Medições e evidência visual (registradas como texto)

- **Testes do pacote `@guess-my-move/swing`:** 117 testes em Vitest cobrindo `vec`, `cityIndex`, `web`, `physics`, `trigger`, `pose`, `cue`, `spawn` e `world`, escritos test-first (os módulos `pose` e `cue` e a teia no céu entraram com a CQ-007; a corda que puxa, a teia persistente, o salto do chão, a mira de cinco raios, a pose em 3D e a câmera automática entraram com a CQ-008, que também **removeu** `steering.ts` e seu teste).
- **Inspeção visual (Chromium headless, WebGL por software, câmera simulada, build de produção por `http.server` em `127.0.0.1`, 1440x900, teclado Espaço no lugar do gesto, sem mão real):** a cidade de Midtown renderiza com prédios, janelas e ruas; o HUD mostra velocidade e altura; a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" aparece legível; sem rolagem horizontal; as linhas de velocidade aparecem com a velocidade (148 km/h observados); ao segurar Espaço o jogo começa e a teia prende (Teias: 1).
- **Rede:** 10 requisições na tela do jogo, todas à própria origem (`127.0.0.1`); zero erros no console; nenhuma requisição a domínio de terceiros (o JSON da cidade e o Three.js saem da própria origem).
- **Dados da cidade (`midtown.json`):** distribuição de alturas dos prédios baixa — mediana 17,6 m, p90 61,9 m, máximo 366 m, 556 prédios.
- **Achados corrigidos nesta etapa (CQ-006):** o ponto de partida nascia no chão e foi corrigido para y = 90 m, como a spec manda. A 90 m, a mira assistida (ponto válido >= 8 m acima do jogador) só prenderia em prédios acima de ~98 m, que são poucos na distribuição acima; `findSpawn` passou a preferir o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente, caindo no primeiro ponto livre quando nenhum alcança. Os valores de jogo e a regra do ponto válido (FR-003) não mudaram; os Gates 1 e 2 seguem aprovados.
- **Não medido:** fps, latência e suavidade do balanço numa GPU real (o headless usa WebGL por software, que não representa uma GPU); comportamento com a mão real e com o gesto ILoveYou na câmera do usuário; jogabilidade, dificuldade da mira da teia e do alcance (a mira assistida só prende em prédios >= 8 m acima do jogador); licença do modelo `gesture_recognizer.task`, não lida na fonte.

## Emenda CQ-007 — duas mãos, pose em qualquer orientação, imersão e dicas

Depois de testar a versão anterior, o maintainer pediu que o jogo reconheça as **duas mãos** e a pose de teia em **qualquer orientação** (a mão de lado: polegar, indicador e mindinho abertos, médio e anelar dobrados) e que a mecânica de balançar como o Homem-Aranha fique mais imersiva, com dicas na tela. A emenda foi implementada e documentada mantendo os Gates 1 e 2 aprovados, o estado `validated` e o Gate 3 aprovado com risco aceito pelo merge.

**O que mudou (confirmado no código):**

- **Duas mãos:** o reconhecedor passou a `numHands` 2 (`realTwoHandGestureLoader`, `apps/web/src/tracker/mediapipeTracker.ts` com `detectAll`; `swingController` usa `detectAll(...).slice(0, 2)`). O lado vem da posição na tela espelhada (`handSide`): a mão esquerda lança com desvio de 18° à esquerda (`sideYaw: degrees(18)`), a direita à direita, as duas ao centro; passar a usar a outra mão lança uma teia nova do outro lado e encadeia balanços. Teclado: Espaço centro, Z esquerda, X direita, setas olham. O lado é uma preferência (desvio inteiro, metade e o centro).
- **Pose geométrica (`isWebPose` em `packages/swing/src/pose.ts`):** medida só por distâncias entre landmarks, independente da orientação e da mão — indicador e mindinho esticados (ponta/base do pulso >= 1,5), médio e anelar dobrados (<= 1,3), polegar aberto (ponta a >= 0,6 da palma). Vale também o rótulo `ILoveYou` do reconhecedor com score >= 0,7 (`webSignal`). Os limiares são palpites, validados só com landmarks sintéticos girados (0, 45, 90, 180, 270 graus, espelhados), **não com mão real**.
- **Câmera mais imersiva:** a mão que faz a pose não gira a câmera; a outra mão gira (`steerFromHand`). Sem giro manual, a câmera acompanha o movimento (`headingFollow: 1,2` por s, `headingMinSpeed: 8` m/s).
- **Mira e teia no céu:** `minRise` 8 -> 25 m e `minHorizontal` 12 -> 30 m (`DEFAULT_WEB`); teia no céu quando nenhum prédio é alcançável (`skyWeb: { distance: 60, rise: 70, maxAltitude: 220 }`, `ActiveWeb.virtual` em `world.ts`), com preferência pelo prédio. A prévia da mira é projetada na tela para cada mão (`reticle.ts`: anel dourado à vista, seta na borda fora do quadro, rótulos "esq." e "dir."). A corda sai do pulso do lado que lançou e ficou mais fina.
- **Área jogável (`playBounds`):** caixa dos prédios + 120 m (`PLAY_MARGIN = 120` em `cityIndex.ts`), nunca além dos limites do mapa (antes a caixa do mapa ia a -1112 m em x).
- **Dicas e guia:** `swingCue` (start, swing, release, throw, low, ground) alimenta a linha de status de uma frase, o guia "Como jogar" de 4 etapas com a etapa atual destacada (`guide.ts`), o medidor "Teia: esquerda/direita/centro/solta" no HUD e o contorno dourado (soltar)/vermelho (perto do chão) no palco. Soltar na subida do arco (velocidade horizontal >= 12 m/s e subindo) é o que lança o jogador para longe.

**Evidência real:**

- `yarn lint` 0 avisos/erros; `yarn typecheck` ok; testes core 68, marbles 111, swing 101, web 232 mais 50 de `node:test`; `yarn build` ok.
- Chromium headless (WebGL por software, câmera simulada, teclado) a 1440x900: Z lançou à esquerda e X à direita (medidor "esquerda"/"direita"); o status mudou para "Balançando. Segure a pose."; a etapa 3 do guia ficou destacada; a mira dourada (anel e seta) aparece antes de lançar; 10 requisições, todas à própria origem; zero erros no console.
- Disponibilidade da teia na cidade real (posições, alturas e direções aleatórias, só com prédios, sem céu): em alturas 5/20/40/70/100 m a teia ao centro existia em 18/15/11/7/6% dos casos e por algum dos lados em 28/23/18/12/10%. Antes de reduzir a área jogável eram 14/10/9/8/4% e 23/16/13/10/9%. Por isso a teia no céu.
- Jogador automático ideal (segue as dicas da tela: lança, segura, solta na subida, sem girar a câmera) em 90 s simulados, depois da teia no céu: alternando esquerda/direita percorreu 600 m com pico de 147 km/h; só ao centro, 448 m com pico de 124 km/h. É uma simulação idealizada sem direção, **não** representa um jogador humano.

**Não verificado (risco aceito):** nenhuma mão real nem as duas mãos ao vivo; os limiares da pose, o desvio de 18°, a teia no céu, a sensação de balanço e a dificuldade; fps numa GPU real.

## Emenda CQ-008 — jogabilidade reprovada: teia que puxa, teia persistente, soltar pela palma e câmera automática

O maintainer testou a PR #77 (vídeo de 53 s) e **reprovou a jogabilidade**. Os fatos do teste: a pose de teia de lado não foi reconhecida no começo (mão detectada em 6 de 108 quadros, com a outra mão girando a câmera enquanto ele tentava a pose); a teia sumia a cada batida em prédio (`state.web = null`) e, do chão, a teia presa não tirava o jogador do chão (1,7 m por 3 s); do segundo 18 ao fim, o jogador ficou a 2 m de altura e 28 km/h sem conseguir subir. (O vídeo é privado: não é citado como evidência nem copiado.) Esta emenda **refaz a jogabilidade** mantendo os Gates 1 e 2 aprovados, o estado `validated` e o Gate 3 **aprovado com risco aceito pelo merge**; não abre um novo Gate 3.

**O que mudou (decisões do maintainer de 2026-10-29: ponto da teia automático no prédio mais próximo à frente; soltar abrindo a mão; câmera automática seguindo o movimento; teia no céu como reserva; punho fechado puxa):**

- **Corda que puxa (`physics.ts`):** com a teia presa, `assist` 12 m/s² em direção ao ponto; com o punho fechado, `pullAssist` 40 m/s², recolhimento `pullReel` 16 m/s (contra `reelSpeed` 4 m/s) e impulso único `pullImpulse` 9 m/s a cada fechada do punho.
- **Teia persistente com deslize:** a teia **não some ao bater** no prédio; o jogador desliza pela parede (`wallFriction` 2 por s, restituição 0,1) e a teia continua presa; só solta por palma aberta ou pose perdida por mais de 600 ms.
- **Salto ao lançar do chão:** `launchBoost` 14 m/s em direção ao ponto mais `launchLift` 6 m/s para cima; a corrida automática não atua com a teia presa.
- **Mira (`web.ts`) e ponto de partida (`spawn.ts`):** cinco raios (50°, 38°, 26°, 15°, 6° acima da câmera; abaixo de 0° conta como 0°), alcance 160 m, subida mínima 12 m, horizontal mínima 15 m (antes 25 m / 30 m, três raios, 140 m); desvio lateral 28° (antes 18°); a primeira teia exige um prédio de subida 30 m a pelo menos 50 m, para haver arco.
- **Gatilho (`trigger.ts`):** a pose `ILoveYou` lança (2 quadros); pose e punho `Closed_Fist` seguram; punho com a teia presa puxa; `Open_Palm` por 2 quadros solta; sem pose nem punho por 600 ms solta sozinho; devolve `{ held, pull }`.
- **Pose (`pose.ts`):** distâncias em 3D (usa o `z` do MediaPipe quando existe — hipótese, não medida ao vivo), mais `isOpenPalm` e `isFist` por geometria e `handMetrics`; a geometria decide primeiro e o rótulo `Open_Palm` do reconhecedor, sem a geometria, é ignorado.
- **Câmera automática (`world.ts`):** guinada e inclinação seguem o movimento (inclinação = 12° + metade da inclinação da velocidade, entre -20° e 35°); a direção por joystick da mão foi **removida** — `steering.ts` e seu teste foram apagados. As setas do teclado ainda ajustam o olhar e a tecla `C` puxa.
- **Tela (`SwingScreen.tsx`/`guide.ts`):** etapas do guia, status e dicas novos ("Punho fechado puxa. Palma aberta solta."); painel de depuração recolhido por padrão (botão "Depuração") com, por mão, o gesto entendido, o rótulo do reconhecedor e as medidas (alcance dos 4 dedos e abertura do polegar).

**Evidência real:**

- `yarn check:all`: core 68, marbles 111, swing 117, web 237 testes passando (mais 24 de `node:test` na web); lint sem erros.
- Chromium headless (WebGL por software, câmera simulada, teclado no lugar da mão): lançar, puxar (`C`), soltar e lançar de novo funcionaram; 10 requisições, todas GET à própria origem; sem erros no console; sem rolagem horizontal; a velocidade subiu de 38 para 111 km/h em ~7 s e a altura ficou entre 82 e 90 m; o botão "Depuração" abre e fecha.
- Os testes foram escritos antes da implementação, mas **não** rodados cada um em vermelho antes (só o do ponto de partida foi rodado vermelho).
- Piloto automático (teste descartável, removido) na cidade real, 60 s, sem mão: ~1200 a 1370 m percorridos, velocidade média 72 a 83 km/h, topo ~130-145 km/h, em várias combinações de parâmetros — foi o que escolheu o desvio de 28° e o `assist` 12. O piloto solta a cada 3 s ou na subida e alterna esquerda/direita: **não representa um jogador humano**, e o mapa acaba (a distância satura nas bordas).

**Não verificado (risco aceito):** nenhuma mão real; a pose de lado com o `z` (hipótese); o punho e a palma por geometria ao vivo; o ganho de `assist`/`pullAssist`/impulsos (valores de jogo); fps numa GPU real; a sensação de balanço; a licença do `gesture_recognizer.task` (segue sem leitura).

## Emenda CQ-009 — uma teia por mão, as duas ao mesmo tempo

O maintainer pediu poder lançar a teia com as **duas mãos**: lançar com a esquerda e depois com a direita deixa as duas presas, uma de cada lado, e, segurando as duas, o jogador fica suspenso entre elas. A emenda foi implementada e documentada mantendo os Gates 1 e 2 aprovados, o estado `validated` e o Gate 3 **aprovado com risco aceito pelo merge**; não abre um novo Gate 3.

**O que mudou (confirmado no código):**

- **Uma teia por mão (`physics.ts`):** `SwingState.web` virou `webs: ActiveWeb[]` (no máximo uma por lado — esquerda -1, centro 0 só pelo teclado, direita 1); `ActiveWeb.side` passou a obrigatório e ganhou `pulling?`; o `SwingState.pulling` global foi removido (o puxão é por teia). Cada teia tem a própria corda (comprimento e recolhimento `reelSpeed` 4 m/s, ou `pullReel` 16 m/s com o punho daquela mão). A restrição de distância é aplicada a cada corda, com 3 passadas quando há mais de uma. A assistência de cada corda é **dividida pelo número de teias presas** (`assist`/n e `pullAssist`/n): duas teias no mesmo ponto puxam como uma só. O impulso do punho (`pullImpulse` 9 m/s) é por teia (dois punhos = dois impulsos); o impulso de lançar do chão (`launchBoost`, `launchLift`) acontece uma vez só, mesmo com as duas mãos no mesmo passo; a corrida automática do chão só atua sem nenhuma teia.
- **Entrada por lado (`world.ts`):** `SwingInput` virou `{ held, pull?, yawRate, pitchRate }`, com `held` e `pull` do tipo `SlotFlags` = `Partial<Record<'left'|'center'|'right', boolean>>` (substitui `webHeld`/`webSide`/`pull: boolean`). Cada lado lança na subida do seu sinal (borda) e solta só a própria teia ao largar; a mira e o desvio 28° valem por mão; a reserva no céu vale por teia. A regra de troca de mão da CQ-007 foi **superada**: a segunda teia não recria a primeira. O HUD expõe `hud.webSides: WebSide[]`.
- **Tela (`swingController.ts`, `cityRenderer.ts`, `SwingScreen.tsx`, `guide.ts`):** cada mão (esquerda/direita da tela espelhada) alimenta o seu gatilho; as miras douradas aparecem só para o lado sem teia (somem quando as duas estão presas); uma corda é desenhada por lado, saindo do pulso daquela mão. O medidor "Teia" mostra "solta", "esquerda", "direita", "centro", "as duas" (esquerda e direita) ou combinações com " e ". Teclado: Z esquerda, X direita, Espaço centro, `C` puxa todas as teias presas. A etapa 2 do guia virou "Uma teia por mão: segure uma ou as duas." e a dica sem câmera, "Z e X lançam cada lado (juntos, as duas)". `cue.ts` usa `webs.length > 0`.

**Evidência real (sem mão real):**

- Testes test-first: novo `packages/swing/test/twoWebs.test.ts` (13 testes — lançar esquerda e depois direita deixa as duas presas; a segunda não recria a primeira; as duas no mesmo passo; soltar uma mão solta só a dela; soltar e lançar de novo; centro convive; erro conta uma vez por mão; punho puxa só a teia da mão; impulso uma vez por fechada; suspenso 8 s entre as duas teias sem cair e com as duas cordas respeitadas; assistência dividida; recolhimento por teia) e ajustes em `moves`, `physics`, `sides`, `sky`, `world`, `cue` (swing) e `swingHands.test.ts`, `SwingScreen.test.tsx` (web: Z e X juntos mostram "as duas" e "Teias: 2"; punho e palma de uma mão afetam só a teia dela; miras só do lado sem teia). Resultado local: **swing 127 testes, web swing 74 testes verdes; lint e typecheck verdes**.
- **Medição descartável (simulação na cidade real — Midtown — a partir do ponto de partida, 40 s, sem jogador humano; registrada como texto, não commitada):** com as **duas teias** seguradas o tempo todo, o jogador fica suspenso e a corda recolhendo (4 m/s) o leva para cima até o telhado do prédio ancorado (y de 90 m para 157 m em 20 s), onde fica de pé com as duas teias presas, mínimo de altura 81 m; **alternando** esquerda/direita com sobreposição (ciclos de 3 s), 14 teias lançadas, 444 m percorridos, altura mínima 76 m, até 89 km/h; **uma teia só** em ciclos de 3 s (referência), 14 lançadas, 364 m, altura mínima 11 m. Isto **não representa um jogador humano** e não mede sensação.
- **Chromium (WebGL por software, sem câmera, teclado no lugar das mãos), 1280x720:** com Z e X pressionados juntos, a tela mostrou duas cordas, uma em cada lado, o medidor "Teia: as duas", "Teias: 2", 69 km/h e 85 m, sem erros no console (só avisos de desempenho do WebGL por software). Registrado como texto; nenhuma imagem foi guardada no repositório. Não exercita mão real.

**Não verificado (risco aceito):** nenhuma mão real nem as duas mãos ao vivo; dividir a assistência por n, o impulso do punho somando por teia e o recolhimento que sobe o jogador até o telhado são decisões de projeto não testadas na mão; o reconhecimento das duas mãos ao mesmo tempo (ordem esquerda/direita pela posição na tela) só foi testado com mãos simuladas; fps numa GPU real e a licença do `gesture_recognizer.task` continuam sem medição/leitura.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` e `yarn test:sdd` passam; `specs/README.md` lista esta spec como `validated`.
- **Cobertura:** os nove FR têm tarefa formal e uma linha de evidência PASS própria (matriz acima); `sdd:check` valida cobertura e links.
- **Privacidade e fronteira:** nenhuma requisição a terceiros (Three.js e cidade servidos pela própria origem); a câmera é local, sem gravar nem enviar imagem; o jogo não expõe critério secreto (não há carta).
- **UTF-8 e acentuação:** conferidos; sem mojibake.
- **Limitações declaradas (NFR-005):** anel externo simples nos multipolígonos OSM; pátios internos preenchidos; alturas ausentes estimadas (andares × 3,3 m, padrão 15 m); sem validação com mão real; fps não medido numa GPU real; gesto ILoveYou não medido na câmera do usuário.

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                                                                 |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antecipadamente; clarificação (CQ-001 a CQ-006) e plano registrados antes do código.                   |
| II. Uma fonte vigente                       | PASS      | Esta spec é a fonte vigente da entrega; catálogo atualizado para `validated`.                                                |
| III. Rastreabilidade                        | PASS      | Matriz cobre os nove FR; `sdd:check` valida cobertura e links.                                                               |
| IV. Test-first e incremental                | PASS      | Cada módulo do pacote e as telas têm teste escrito antes da implementação; 117 testes do pacote, 237 + 24 no web (CQ-008).   |
| V. Evidência honesta                        | PASS      | Nada afirma fps, latência, precisão nem aparência final; a falta de teste ao vivo com a mão e a GPU real é declarada.        |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para terceiros; Three.js e cidade servidos pelo app; sem persistência de imagem; dados OSM sob ODbL com atribuição. |
| VII. Neutralidade e contexto sob demanda    | PASS      | README, guia de arquitetura e PROJECT_SPEC atualizados; nenhuma marca, personagem ou ativo de terceiros nos arquivos.        |
| VIII. Clareza, preservação, operação segura | PASS      | Núcleos e telas dos outros jogos preservados (só se acrescentou o card no menu); sem push direto na `main`.                  |

## Convergência

- **Divergências encontradas:** o ponto de partida nascia no chão e a primeira teia não tinha onde prender aos 90 m; corrigido em `physics.ts`/`spawn.ts` (y = 90 m e preferência pelo ponto de onde a teia alcança um prédio à frente), registrado como CQ-006.
- **Artefatos reabertos:** `spec.md` (status, FR-002), `clarification.md` (CQ-006 e lista de resolvidas), `research.md` (distribuição de alturas e regra do spawn), `tasks.md` (T001 a T014, estado) e este `validation.md`.
- **Reexecuções:** `yarn docs:format:fix`, `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` rodaram depois da atualização dos documentos.

## Limitações e riscos residuais

| Limitação/risco                                                                                                                                                     | Impacto                                                                                                                                                                                     | Responsável | Aceite                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| Nunca testado com a mão real nem numa GPU real                                                                                                                      | Aparência, desempenho e resposta ao vivo podem diferir                                                                                                                                      | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Gesto ILoveYou em outras câmeras não exercitado                                                                                                                     | O reconhecimento pode variar com câmera, iluminação e pessoa                                                                                                                                | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Jogabilidade e dificuldade da mira da teia e do alcance não medidas (prende só em prédios >= 8 m acima)                                                             | A diversão e a dificuldade do primeiro balanço não foram avaliadas                                                                                                                          | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Anel externo simples nos multipolígonos OSM e pátios internos preenchidos                                                                                           | Geometria aproximada de alguns prédios                                                                                                                                                      | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Alturas ausentes estimadas (andares × 3,3 m, padrão 15 m)                                                                                                           | Alturas de parte dos prédios são estimadas, não medidas                                                                                                                                     | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Dados OSM sob ODbL com atribuição                                                                                                                                   | Exige manter a atribuição visível na tela                                                                                                                                                   | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Pose geométrica, desvio de 18° por lado e teia no céu não medidos com mão real (CQ-007)                                                                             | Os limiares, os lados e a sensação de balanço foram validados só com landmarks sintéticos girados e teclado headless                                                                        | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Mecânica da CQ-008 (corda que puxa, teia persistente, salto do chão, punho/palma, pose em 3D, câmera automática) não medida com mão real                            | A jogabilidade da PR #77 foi reprovada no teste do maintainer e esta emenda a refaz; os ganhos e a pose em 3D foram validados só com testes puros e teclado headless                        | maintainer  | aceito por wezercarvalho em `2026-10-29` |
| Mecânica da CQ-009 (uma teia por mão, assistência dividida por n, impulso do punho por teia, recolhimento que sobe até o telhado) não medida com as duas mãos reais | As duas teias ao mesmo tempo e a física por teia foram validadas só por teste puro (`twoWebs` e os ajustados) e teclado headless; o reconhecimento das duas mãos ao vivo não foi exercitado | maintainer  | aceito por wezercarvalho em `2026-10-29` |
| Licença do modelo `gesture_recognizer.task` não lida na fonte                                                                                                       | Redistribuição do modelo não confirmada (o ativo não é versionado)                                                                                                                          | maintainer  | aceito por wezercarvalho em `2026-10-28` |

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer), pelo merge do PR da issue #76 na `main`
- **Data:** `2026-10-28`
- **Escopo aprovado:** FR-001 a FR-009 e os artefatos da spec, com o pacote puro `@guess-my-move/swing`, a camada Three.js em `apps/web/src/swing`, o pipeline de dados e o JSON `midtown.json`, a página `swing.html`, a entrada `swing` do Vite e o card no menu; os outros jogos e os núcleos não foram alterados
- **Riscos aceitos:** nunca testado com a mão real nem numa GPU real; gesto ILoveYou em outras câmeras; jogabilidade e dificuldade da mira da teia e do alcance não medidas (a mira assistida só prende em prédios >= 8 m acima do jogador); dados OSM sob ODbL com atribuição; licença do modelo `gesture_recognizer.task` não lida na fonte
- **Observações:** o Gate 3 foi concedido pelo merge, sem teste ao vivo com a mão real nem medição de fps numa GPU real, a pedido do maintainer. A correção do ponto de partida e do alcance da primeira teia foi registrada como CQ-006, mantendo os Gates 1 e 2 aprovados. A CQ-007 (duas mãos, pose geométrica, teia no céu) e a CQ-008 (jogabilidade da PR #77 reprovada e refeita: corda que puxa, teia persistente com deslize, salto ao lançar do chão, soltar pela palma e segurar pelo punho, mira de cinco raios, pose em 3D e câmera automática com `steering.ts` removido) e a CQ-009 (uma teia por mão, as duas ao mesmo tempo: estado `webs[]`, entrada por lado, assistência dividida por n e impulso do punho por teia; a troca de mão da CQ-007 superada) são emendas de implementação posteriores que **não reabrem** o Gate 3 — ele segue aprovado com risco aceito pelo merge. A convergência aprovada é entre código, spec e testes (incluindo a inspeção visual em Chromium headless), não a aparência nem o desempenho finais ao vivo. Nenhuma afirmação de fps, latência ou precisão é feita.
