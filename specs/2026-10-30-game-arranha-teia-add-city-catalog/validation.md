# Validação — 2026-10-30-game-arranha-teia-add-city-catalog

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento (implementação e gates concluídos; Gate 3 pendente)
- **Constituição:** 1.0.0
- **Data:** `2026-10-30`
- **Executor/revisor:** kirocrew (agente); Gate 3 pendente do teste do maintainer
- **Commit:** branch `docs/82-pesquisa-mapas-cidades`, PR #83; hash final a registrar

## Resumo do resultado

Implementação concluída: seleção local antes do jogo, Midtown preservado, Avenida Paulista jogável, pipeline OSM parametrizado e passe visual procedural leve. A tentativa de material PBR/Lambert foi retirada porque a captura em 1440 excedeu 5 s no WebGL por software; o material leve aprovado foi mantido. Gates finais ainda serão executados quando a memória do host sair do estado crítico.

## Conclusão das tarefas

- **Concluídas:** 12 (T001 a T012)
- **Pendentes:** 0 (Gate 3 é aprovação, não tarefa de implementação)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                    | Resultado |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T001, T010 | `cityCatalog.test.ts`: catálogo válido, versão, campos, ids, duplicatas e caminhos externos recusados        | PASS      |
| FR-002    | T002, T010 | `SwingApp.test.tsx`/`CitySelect`: seleção e erro; screenshots 390/900/1440                                   | PASS      |
| FR-003    | T002, T003 | `SwingApp.test.tsx`: mapa monta só após escolha; "Trocar mapa" desmonta e chama `dispose`                    | PASS      |
| FR-004    | T005, T006 | `cities.json`, `midtown.json`, `paulista.json`; teste Node confere nomes/atribuições                         | PASS      |
| FR-005    | T004, T010 | `city-from-osm.test.mjs` (config/defaults) e `city-sources.test.mjs`; `yarn build:city paulista` executado   | PASS      |
| FR-006    | T006, T010 | `city-data.test.mjs`: catálogo, caminhos, altura inicial, forma, limites, faixas e tamanho dos dois arquivos | PASS      |
| FR-007    | T007, T008 | `cityVisual.test.ts`; `cityRenderer.ts` usa fachadas/ruas procedurais e mantém `City`; regressões web verdes | PASS      |
| FR-008    | T001, T002 | `SwingApp.test.tsx`: URL válida abre direto; ausente/desconhecida mostra seleção                             | PASS      |

## Histórias e critérios de aceitação

| História/cenário                | Demonstração                                                     | Resultado |
| ------------------------------- | ---------------------------------------------------------------- | --------- |
| US-001 / escolher e trocar      | Chromium e RTL: seleção → mapa; botão volta e desmonta           | PASS      |
| US-002 / Midtown e Paulista     | Ambos carregam; nomes, alturas iniciais e atribuições aparecem   | PASS      |
| US-003 / visual procedural leve | Fachadas/ruas visíveis em screenshots; tentativa pesada retirada | PASS      |

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
- **Escopo aprovado:** pendente do teste do catálogo, Midtown e Paulista
- **Riscos aceitos:** pendente
- **Observações:** aguarda os gates finais e o teste do maintainer; a spec fica `implementing`.
