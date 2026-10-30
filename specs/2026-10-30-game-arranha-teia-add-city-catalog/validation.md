# Validação — 2026-10-30-game-arranha-teia-add-city-catalog

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento (implementação e gates concluídos; Gate 3 pendente)
- **Constituição:** 1.0.0
- **Data:** `2026-10-30`
- **Executor/revisor:** kirocrew (agente); Gate 3 pendente do teste do maintainer
- **Commit:** branch `docs/82-pesquisa-mapas-cidades`, PR #83; hash final a registrar

## Resumo do resultado

Implementação concluída: seleção local antes do jogo, Midtown preservado, Avenida Paulista e Santa Maria jogáveis, pipeline OSM parametrizado e passe visual procedural leve. A tentativa de material PBR/Lambert foi retirada porque a captura em 1440 excedeu 5 s no WebGL por software; o material leve aprovado foi mantido. A emenda CQ-001 adicionou Santa Maria pelo mesmo contrato local, com altura inicial calibrada ao perfil baixo da cidade e a teia no céu preservada como reserva.

## Conclusão das tarefas

- **Concluídas:** 23 (T001 a T023)
- **Pendentes:** 0 (Gate 3 continua sendo aprovação do maintainer)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas                | Evidência                                                                                                    | Resultado |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T001, T010             | `cityCatalog.test.ts`: catálogo válido, versão, campos, ids, duplicatas e caminhos externos recusados        | PASS      |
| FR-002    | T002, T010             | `SwingApp.test.tsx`/`CitySelect`: seleção e erro; screenshots 390/900/1440                                   | PASS      |
| FR-003    | T002, T003             | `SwingApp.test.tsx`: mapa monta só após escolha; "Trocar mapa" desmonta e chama `dispose`                    | PASS      |
| FR-004    | T005, T006, T013–T015  | `cities.json`, `midtown.json`, `paulista.json`, `santa-maria.json`; testes conferem nomes/atribuições        | PASS      |
| FR-005    | T004, T010, T013, T014 | `city-from-osm.test.mjs`/`city-sources.test.mjs`; builds da Paulista e de Santa Maria executados             | PASS      |
| FR-006    | T006, T010, T015       | `city-data.test.mjs`: catálogo, caminhos, altura inicial, forma, limites, faixas e tamanho dos três arquivos | PASS      |
| FR-007    | T007, T008             | `cityVisual.test.ts`; `cityRenderer.ts` usa fachadas/ruas procedurais e mantém `City`; regressões web verdes | PASS      |
| FR-008    | T001, T002             | `SwingApp.test.tsx`: URL válida abre direto; ausente/desconhecida mostra seleção                             | PASS      |
| FR-009    | T018                   | `city-from-osm.test.mjs`: nome preservado; via sem nome ou com nome vazio fica como antes                    | PASS      |
| FR-010    | T019                   | `streetSigns.test.ts`: esquinas, agrupamento, paralelas, três ruas, poste em canto livre                     | PASS      |
| FR-011    | T019, T021, T022       | `streetSigns.test.ts` (seta e ordem por guinada); placa no Chromium, seta girando e linhas trocando          | PASS      |
| FR-012    | T020                   | `streetSigns.test.ts`: o arquivo real tem ao menos 20 vias nomeadas e 10 esquinas (110 vias e 37 esquinas)   | PASS      |

## Histórias e critérios de aceitação

| História/cenário                | Demonstração                                                                             | Resultado |
| ------------------------------- | ---------------------------------------------------------------------------------------- | --------- |
| US-001 / escolher e trocar      | Chromium e RTL: seleção → mapa; botão volta e desmonta                                   | PASS      |
| US-002 / três cidades           | Midtown, Paulista e Santa Maria carregam; nomes, alturas iniciais e atribuições aparecem | PASS      |
| US-003 / visual procedural leve | Fachadas/ruas visíveis em screenshots; tentativa pesada retirada                         | PASS      |

## Comandos executados

| Comando exato                                                              | Data       | Resultado | Evidência/observação                                                     |
| -------------------------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------ |
| `yarn sdd:check`                                                           | 2026-10-30 | PASS      | spec, catálogo, Gates 1/2 e links válidos antes do código                |
| `yarn test:sdd`                                                            | 2026-10-30 | PASS      | 109 testes                                                               |
| `node --test scripts/city-from-osm.test.mjs scripts/city-sources.test.mjs` | 2026-10-30 | PASS      | 23 testes                                                                |
| `yarn workspace @guess-my-move/web test`                                   | 2026-10-30 | PASS      | 328 Vitest + 64 node:test (antes do ajuste visual final)                 |
| `yarn check:static`                                                        | 2026-10-30 | PASS      | typecheck e lint, 176 arquivos (antes da documentação final)             |
| `yarn workspace @guess-my-move/web build`                                  | 2026-10-30 | PASS      | build Vite; aviso de chunk >500 KB já existente                          |
| `yarn build:city paulista` (em `apps/web`)                                 | 2026-10-30 | PASS      | recorte final: 510 prédios, 102 vias, 81.503 bytes, altura explícita 98% |
| `yarn check:all`                                                           | 2026-10-30 | BLOCKED   | adiado: host em estado crítico, 1,9 GB livres e carga 3,26/core          |
| `yarn test:gates`                                                          | 2026-10-30 | PASS      | 231 testes                                                               |
| `yarn test:sdd`                                                            | 2026-10-30 | PASS      | 109 testes                                                               |
| `yarn sdd:check`                                                           | 2026-10-30 | PASS      | catálogo, estados, gates, cobertura e links válidos                      |
| `yarn docs:format:check`                                                   | 2026-10-30 | PASS      | todos os arquivos no padrão após `docs:format:fix`                       |
| `yarn security:dependencies`                                               | 2026-10-30 | PASS      | info=0 low=0 moderate=0 high=0 critical=0                                |

## Medições e benchmark

- **Dados finais:** Paulista 510 prédios, 102 vias, 81.503 bytes, altura mediana 12,823 m e máxima 100,37 m; 529/540 elementos da resposta OSM com altura/andares (98%). Midtown 556 prédios, 177 vias, mediana 17,6 m, máxima 366 m.
- **Amostra de raycast:** grade 20×20, 8 direções por ponto, altura 60 m, alcance 160 m: Paulista 14%, Midtown 27%. Mede esta extração e protocolo, não a cidade inteira nem a chance real de lançar teia.
- **Spawn:** Midtown 90 m; Paulista 55 m. `findSpawn` achou ponto livre e com preferência por teia para ambos.
- **Chromium:** WebGL por software, build de produção servido em `127.0.0.1:5192`. Seleção conferida em 390, 900 e 1440 px; Midtown e Paulista em 1440; HUD móvel corrigido depois de "Teia" ficar cortado na primeira captura. Console: 0 erros. O log do servidor registrou só a própria origem.
- **Limitação:** não mede fps em GPU real nem sensação com câmera/mão real. A primeira área da Paulista (5.770 prédios/812 KB) e a segunda (2.020/288 KB) foram reduzidas; a terceira (705/108 KB) ainda atrasou capturas largas; o recorte final tem 510/82 KB, próximo do Midtown, e capturou em 1440.

## Validações estruturais e documentais

- **Links e catálogo:** `sdd:check`, `test:sdd` e `docs:format:check` passaram após a reconciliação.
- **Contratos:** catálogo recusa caminho externo; arquivos são City v1; Midtown compatível.
- **Privacidade e segredos:** zero chave/token; mapas e imagens não saem da própria origem; câmera intocada.
- **Fronteira de informação:** não alterada; o teste de `toPublicCard` passou dentro do `check:all` (core 68).
- **UTF-8 e acentuação:** preservadas.
- **Alterações fora de escopo:** nenhuma; Rio/Cesium não implementados.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado                                         |
| ---------------------------------- | --------- | -------------------------------------------------------------------- |
| I. Intenção antes da implementação | PASS      | Spec e Gates 1/2 antes do código                                     |
| III. Rastreabilidade               | PASS      | FR-001 a FR-008 têm tarefa e evidência                               |
| IV. Test-first                     | PASS      | Catálogo, seleção, pipeline e visual começaram por testes falhando   |
| V. Evidência honesta               | PASS      | Sem alegar fotorrealismo/fps; tentativa pesada e limites registrados |
| VI. Privacidade e segredos         | PASS      | Só arquivos locais em runtime; sem token                             |
| VIII. Preservação                  | PASS      | Midtown preservado; física/câmera/gestos não alterados               |

## Convergência

- **Divergências encontradas:** material PBR/Lambert e áreas grandes da Paulista prejudicaram a captura no WebGL por software.
- **Artefatos reabertos:** `plan.md`, `research.md`, `city-sources.mjs` e `cityRenderer.ts` foram ajustados para o caminho leve e o recorte final.
- **Reexecuções:** três reduções do bbox da Paulista; material voltou a `MeshBasicMaterial`; screenshots e build repetidos.

## Limitações e riscos residuais

| Limitação/risco                        | Impacto                      | Responsável | Aceite             |
| -------------------------------------- | ---------------------------- | ----------- | ------------------ |
| Paulista tem menos edifícios altos     | Mais uso da teia no céu      | maintainer  | pendente do Gate 3 |
| Visual é procedural, não fotorrealista | Não reproduz fachadas reais  | maintainer  | explícito          |
| Sem relevo                             | Rio ainda não pode ser fiel  | maintainer  | fora desta entrega |
| fps com câmera/mão/rosto não medido    | Desempenho real desconhecido | maintainer  | pendente do Gate 3 |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Escopo aprovado:** pendente do teste do catálogo, Midtown, Paulista e Santa Maria
- **Riscos aceitos:** pendente
- **Observações:** gates finais concluídos; aguarda o teste do maintainer e a spec permanece `validating`.

## Emenda CQ-001 — Santa Maria (2026-10-30)

### Test-first e dados finais

- O primeiro `yarn workspace @guess-my-move/web test`, após atualizar as expectativas, falhou nos dois pontos esperados: `city-sources.test.mjs` e `city-data.test.mjs` ainda não encontravam `santa-maria`.
- Recorte final do Centro: bbox `-29.6923,-53.8105,-29.6853,-53.8035`, rotação 0°, no entorno da Rua do Acampamento e da Avenida Rio Branco.
- `santa-maria.json`: 81.257 bytes em disco (81.256 caracteres serializados; 84.635 bytes depois da CQ-002, que acrescentou os nomes das ruas), 845 prédios e 174 vias.
- A resposta OSM tinha altura/andares explícitos em 201 de 851 elementos de prédio (24%). No resultado convertido, a altura mediana e o p90 são 15 m e a máxima é 49,5 m; ausências usam a estimativa documentada de 15 m.
- O recorte inicial amplo tinha 4.039 prédios e 371.427 caracteres; foi rejeitado para não repetir a carga excessiva encontrada na Paulista. O recorte final mantém tamanho próximo da Paulista.
- Altura inicial: 20 m. A busca de spawn encontrou ponto livre, mas nenhuma das 16 direções amostradas encontrou âncora normal a partir dele; Santa Maria depende da teia no céu no início. As alturas do OSM não foram infladas para contornar o perfil baixo.

### Demonstração no navegador

- Backend: sessão isolada do Browser via `playwright-cli`, Vite em `127.0.0.1:5193`, Chromium/WebGL por software.
- Seleção com três mapas conferida em 1440×900 e 390×844, sem corte horizontal; Santa Maria apareceu com nome, região e ação própria.
- Santa Maria abriu por seleção com altura inicial de 20 m, nome e atribuição ODbL. Console: 0 erros e 4 avisos do driver WebGL por software sobre `ReadPixels`.
- Um toque em Espaço lançou e soltou a teia como esperado. Depois de reiniciar e segurar Espaço por 3 s, o snapshot mostrou `Teias: 1`, 67 km/h, 15 m de altura, 13 m percorridos e status "Balançando. Punho fechado puxa.". Isso prova o fluxo por teclado nessa execução, não fps nem sensação com mão real.

### Gates após a emenda

| Comando                                                                | Resultado | Evidência                                                                                      |
| ---------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `yarn check:all`                                                       | PASS      | core 68, marbles 159, swing 188, web 329 Vitest + 71 node:test; typecheck, lint e build verdes |
| `yarn test:gates`                                                      | PASS      | 231 testes                                                                                     |
| `yarn test:sdd`                                                        | PASS      | 109 testes                                                                                     |
| `yarn sdd:check`                                                       | PASS      | catálogo, estados, gates, cobertura, tarefas e links válidos                                   |
| `yarn docs:format:check`                                               | PASS      | documentação formatada pelo script oficial e verificada novamente                              |
| `yarn security:dependencies`                                           | PASS      | info=0, low=0, moderate=0, high=0, critical=0                                                  |
| `yarn workspace @guess-my-move/web test`                               | PASS      | 329 Vitest + 71 node:test                                                                      |
| `node --test scripts/city-sources.test.mjs scripts/city-data.test.mjs` | PASS      | 26 testes focados                                                                              |

### Limitações da emenda

- Santa Maria é baixa e somente 24% dos elementos consultados tinham altura ou número de andares explícito; o visual não reproduz fachadas reais.
- A primeira teia usa a reserva no céu. A disponibilidade de fachadas úteis depois do início depende do local e não foi medida com mão real.
- Não houve medição de fps em GPU real, câmera ou gestos. As imagens de verificação permanecem fora do repositório.

## Emenda CQ-002 — placas de rua (2026-10-30)

### Test-first e dados

- Vermelho observado antes de implementar: `city-from-osm.test.mjs` (nome da rua ausente no resultado) e `streetSigns.test.ts` (módulo inexistente; depois só o teste do arquivo real falhou, até regenerar o mapa).
- A Overpass respondeu HTTP 502 em três tentativas seguidas e voltou na quarta; o arquivo local não foi alterado nas falhas.
- `santa-maria.json` regenerado com nomes: 845 prédios e 174 vias (iguais à geração anterior), 84.635 bytes. 110 das 174 vias têm nome, 30 nomes distintos, 37 esquinas com placa e 27 nomes aparecendo em esquinas.
- Tamanho do recorte: cerca de 677 m de leste a oeste por 774 m de norte a sul de área de prédios (bbox `-29.6923,-53.8105,-29.6853,-53.8035`), ou seja, um trecho do Centro e não a cidade inteira.

### Demonstração no navegador

- Backend: sessão isolada via `playwright-cli`, Vite em `127.0.0.1:5193`, Chromium/WebGL por software. Console: 0 erros.
- A primeira versão tinha a placa a 11,5 m e ela ficava atrás dos telhados (mediana de 15 m); foi elevada para 25 m, com poste de 20 m, e ampliada em 50% porque o texto a 91 m ficava com cerca de 12 px.
- Da posição inicial, a esquina mais próxima (Rua Professor Braga × Rua Tuiuti, 91 m à frente) aparece com a rua que segue para a frente na linha de cima. Virando a câmera para a direita, a ordem das linhas trocou (Rua Tuiuti subiu) e as setas giraram, como esperado. De perto (após um voo de 2,5 s com a teia) os nomes ficam legíveis.
- Midtown e Paulista não têm nomes e não criam placa; a suíte de testes cobre o mapa sem nomes.

### Gates após a emenda

| Comando                      | Resultado | Evidência                                                                                      |
| ---------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `yarn check:all`             | PASS      | core 68, marbles 159, swing 188, web 347 Vitest + 73 node:test; typecheck, lint e build verdes |
| `yarn test:gates`            | PASS      | 231 testes                                                                                     |
| `yarn test:sdd`              | PASS      | 109 testes                                                                                     |
| `yarn security:dependencies` | PASS      | info=0, low=0, moderate=0, high=0, critical=0                                                  |

### Limitações da emenda

- A seta é de duas pontas e mostra o eixo da rua, não o sentido do tráfego (a maioria das ruas é de mão dupla e o jogo não lê `oneway`).
- A placa é maior e mais alta que uma de verdade para dar para ler em voo; não foi medida a leitura em movimento rápido nem o fps com as placas.
- Só 110 das 174 vias têm nome no OSM; ruas sem nome não aparecem nas placas. Nomes dependem do que está no OpenStreetMap na data da geração.
- O poste só evita prédios pela pegada do mapa; pode ficar sobre calçada ou encostado em um prédio onde a geometria for imprecisa.
- Sem câmera ou mão reais nesta verificação.
