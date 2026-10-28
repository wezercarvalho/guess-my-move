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

- **Concluídas:** 14 (T001 a T014)
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

| Comando exato                | Data       | Resultado | Evidência/observação                                                      |
| ---------------------------- | ---------- | --------- | ------------------------------------------------------------------------- |
| `yarn lint`                  | 2026-10-28 | PASS      | Oxlint type-aware, 0 avisos e 0 erros                                     |
| `yarn typecheck`             | 2026-10-28 | PASS      | `tsc --build` sem erro em todos os workspaces                             |
| `yarn test`                  | 2026-10-28 | PASS      | Vitest: core 68, marbles 111, swing 55, web 211; `node:test` do web 50    |
| `yarn test:gates`            | 2026-10-28 | PASS      | 231 testes                                                                |
| `yarn security:dependencies` | 2026-10-28 | PASS      | nenhum achado em nenhum nível                                             |
| `yarn build`                 | 2026-10-28 | PASS      | `prepare:assets` + `tsc --build` + `vite build`, saída em `apps/web/dist` |

## Medições e evidência visual (registradas como texto)

- **Testes do pacote `@guess-my-move/swing`:** 55 testes em Vitest cobrindo `vec`, `cityIndex`, `web`, `physics`, `trigger`, `steering`, `spawn` e `world`, escritos test-first.
- **Inspeção visual (Chromium headless, WebGL por software, câmera simulada, build de produção por `http.server` em `127.0.0.1`, 1440x900, teclado Espaço no lugar do gesto, sem mão real):** a cidade de Midtown renderiza com prédios, janelas e ruas; o HUD mostra velocidade e altura; a atribuição "Dados do mapa © colaboradores do OpenStreetMap (ODbL)" aparece legível; sem rolagem horizontal; as linhas de velocidade aparecem com a velocidade (148 km/h observados); ao segurar Espaço o jogo começa e a teia prende (Teias: 1).
- **Rede:** 10 requisições na tela do jogo, todas à própria origem (`127.0.0.1`); zero erros no console; nenhuma requisição a domínio de terceiros (o JSON da cidade e o Three.js saem da própria origem).
- **Dados da cidade (`midtown.json`):** distribuição de alturas dos prédios baixa — mediana 17,6 m, p90 61,9 m, máximo 366 m, 556 prédios.
- **Achados corrigidos nesta etapa (CQ-006):** o ponto de partida nascia no chão e foi corrigido para y = 90 m, como a spec manda. A 90 m, a mira assistida (ponto válido >= 8 m acima do jogador) só prenderia em prédios acima de ~98 m, que são poucos na distribuição acima; `findSpawn` passou a preferir o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente, caindo no primeiro ponto livre quando nenhum alcança. Os valores de jogo e a regra do ponto válido (FR-003) não mudaram; os Gates 1 e 2 seguem aprovados.
- **Não medido:** fps, latência e suavidade do balanço numa GPU real (o headless usa WebGL por software, que não representa uma GPU); comportamento com a mão real e com o gesto ILoveYou na câmera do usuário; jogabilidade, dificuldade da mira da teia e do alcance (a mira assistida só prende em prédios >= 8 m acima do jogador); licença do modelo `gesture_recognizer.task`, não lida na fonte.

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
| IV. Test-first e incremental                | PASS      | Cada módulo do pacote e as telas têm teste escrito antes da implementação; 55 testes do pacote, 211 + 50 no web.             |
| V. Evidência honesta                        | PASS      | Nada afirma fps, latência, precisão nem aparência final; a falta de teste ao vivo com a mão e a GPU real é declarada.        |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para terceiros; Three.js e cidade servidos pelo app; sem persistência de imagem; dados OSM sob ODbL com atribuição. |
| VII. Neutralidade e contexto sob demanda    | PASS      | README, guia de arquitetura e PROJECT_SPEC atualizados; nenhuma marca, personagem ou ativo de terceiros nos arquivos.        |
| VIII. Clareza, preservação, operação segura | PASS      | Núcleos e telas dos outros jogos preservados (só se acrescentou o card no menu); sem push direto na `main`.                  |

## Convergência

- **Divergências encontradas:** o ponto de partida nascia no chão e a primeira teia não tinha onde prender aos 90 m; corrigido em `physics.ts`/`spawn.ts` (y = 90 m e preferência pelo ponto de onde a teia alcança um prédio à frente), registrado como CQ-006.
- **Artefatos reabertos:** `spec.md` (status, FR-002), `clarification.md` (CQ-006 e lista de resolvidas), `research.md` (distribuição de alturas e regra do spawn), `tasks.md` (T001 a T014, estado) e este `validation.md`.
- **Reexecuções:** `yarn docs:format:fix`, `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` rodaram depois da atualização dos documentos.

## Limitações e riscos residuais

| Limitação/risco                                                                                         | Impacto                                                            | Responsável | Aceite                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------- | ---------------------------------------- |
| Nunca testado com a mão real nem numa GPU real                                                          | Aparência, desempenho e resposta ao vivo podem diferir             | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Gesto ILoveYou em outras câmeras não exercitado                                                         | O reconhecimento pode variar com câmera, iluminação e pessoa       | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Jogabilidade e dificuldade da mira da teia e do alcance não medidas (prende só em prédios >= 8 m acima) | A diversão e a dificuldade do primeiro balanço não foram avaliadas | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Anel externo simples nos multipolígonos OSM e pátios internos preenchidos                               | Geometria aproximada de alguns prédios                             | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Alturas ausentes estimadas (andares × 3,3 m, padrão 15 m)                                               | Alturas de parte dos prédios são estimadas, não medidas            | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Dados OSM sob ODbL com atribuição                                                                       | Exige manter a atribuição visível na tela                          | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Licença do modelo `gesture_recognizer.task` não lida na fonte                                           | Redistribuição do modelo não confirmada (o ativo não é versionado) | maintainer  | aceito por wezercarvalho em `2026-10-28` |

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer), pelo merge do PR da issue #76 na `main`
- **Data:** `2026-10-28`
- **Escopo aprovado:** FR-001 a FR-009 e os artefatos da spec, com o pacote puro `@guess-my-move/swing`, a camada Three.js em `apps/web/src/swing`, o pipeline de dados e o JSON `midtown.json`, a página `swing.html`, a entrada `swing` do Vite e o card no menu; os outros jogos e os núcleos não foram alterados
- **Riscos aceitos:** nunca testado com a mão real nem numa GPU real; gesto ILoveYou em outras câmeras; jogabilidade e dificuldade da mira da teia e do alcance não medidas (a mira assistida só prende em prédios >= 8 m acima do jogador); dados OSM sob ODbL com atribuição; licença do modelo `gesture_recognizer.task` não lida na fonte
- **Observações:** o Gate 3 foi concedido pelo merge, sem teste ao vivo com a mão real nem medição de fps numa GPU real, a pedido do maintainer. A correção do ponto de partida e do alcance da primeira teia foi registrada como CQ-006, mantendo os Gates 1 e 2 aprovados. A convergência aprovada é entre código, spec e testes (incluindo a inspeção visual em Chromium headless), não a aparência nem o desempenho finais ao vivo. Nenhuma afirmação de fps, latência ou precisão é feita.
