# Validação — 2026-10-31-game-marbles-add-online-multiplayer

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-31`
- **Executor/revisor:** kirocrew (agente), com Gate 3 autorizado pelo maintainer e condicionado à convergência
- **Commit:** não disponível

## Resumo do resultado

Auditoria e planejamento concluídos. A implementação ainda não começou. Esta página será atualizada ao fim de cada fase para permitir retomada sem depender do histórico da conversa.

## Progresso por fase

### Fase 0 — Auditoria e planejamento

- **Resultado:** PASS.
- **Evidência:** issues #111, #112 e #113; `spec.md`, `clarification.md`, `research.md`, `plan.md`, `tasks.md` e checklist.
- **Decisões:** servidor novo; Socket.IO sobre WebSocket; sala efêmera; autoridade no servidor; câmera e landmarks fora da rede.
- **Limitação:** nenhuma implementação ou execução do NestJS foi validada nesta fase.

### Fase 1 — Motor e leitura da partida

- **Resultado:** PASS.
- **Vermelho observado:** `multiplayer-session.test.ts` falhou em 3/3 casos por ausência de `shotsLeft`, `fireShot` e retorno do adaptador legado; `marblesController.test.ts` falhou nos 2 casos novos por ausência do helper sem fallback e da prévia.
- **Implementação:** adversário `remote`, fase `opponent-turn`, `shotsLeft`, `fireShot`/`passShot`, helper do bot sem tiro arbitrário, prévia de 450 ms, contador nomeado e anel tracejado no segundo competidor.
- **Verde:** pacote marbles 162/162; 68 testes direcionados da web; typecheck de marbles/web; lint após ajuste final pendente de repetição.
- **Mutação:** remover a seta fez o teste da intenção falhar; remover "do bot" fez o teste do contador falhar; ambas as implementações foram restauradas e os testes passaram.
- **Limitação:** 450 ms é valor inicial sem teste de usabilidade; nenhuma regra de força, vitória ou física foi recalibrada.

### Fase 2 — Protocolo compartilhado

- **Resultado:** PASS.
- **Vermelho observado:** `multiplayer-protocol.test.ts` não carregou porque `src/multiplayer/index.ts` ainda não existia.
- **Implementação:** eventos estáveis, códigos/credenciais, schemas Zod Mini estritos, vetor de 150–1100 unid/s, estado versionado e snapshot de rede sem `playerShotsLeft`.
- **Verde:** 5/5 testes do protocolo e typecheck do pacote.
- **Privacidade:** os testes recusam `frame`, `video`, `landmarks` e qualquer campo desconhecido; os tipos não incluem câmera, gesto bruto ou carta.
- **Dependência:** Zod 4.6.7 já usado no monorepo foi declarado também em `@guess-my-move/marbles`; `yarn install` alterou apenas a entrada do workspace no lockfile.
- **Limitação:** a autoridade, idempotência por sala e integração Socket.IO ainda não existem; serão provadas nas Fases 3 e 4.

### Fase 3 — Sala autoritativa

- **Resultado:** PASS.
- **Vermelho observado:** `room.service.test.ts` não carregou porque o serviço ainda não existia.
- **Implementação:** sala de duas vagas, código/token injetáveis, modo fixo, prontidão idempotente, uma `MatchSession(remote)`, sequência por papel, prévia de 450 ms, tick, pausa, retomada e expiração de 60 s.
- **Correção durante o verde:** 6/7 testes passaram; o sétimo mostrou que o teto de 250 ms da física estava encurtando o relógio da prévia. O serviço passou a limitar só o passo físico e usar o tempo integral nas pausas.
- **Verde:** 10/10 testes; Bete, Triângulo e Cova concluem três rodadas com duas fontes remotas; typecheck do servidor.
- **Limitação:** estado somente em memória e uma instância, como especificado; a integração de transporte pertence à Fase 4.

## Conclusão das tarefas

- **Concluídas:** 12 (T001–T012)
- **Pendentes:** 15
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas                | Evidência                                                          | Resultado |
| --------- | ---------------------- | ------------------------------------------------------------------ | --------- |
| FR-001    | T001                   | spec singleplayer validada; T031 e Gate 3 aprovados em 2026-10-31  | PASS      |
| FR-002    | T003, T004             | `multiplayer-session.test.ts`; `match-session-equivalence.test.ts` | PASS      |
| FR-003    | T005, T020             | bot sem fallback e prévia local PASS; integração remota pendente   | BLOCKED   |
| FR-004    | T006, T020             | contador e anel local PASS; rótulos remotos pendentes              | BLOCKED   |
| FR-005    | T007, T021             | 162 testes do pacote + 68 web PASS; fallback de rede pendente      | BLOCKED   |
| FR-006    | T008, T009             | 5 testes de schemas/eventos compartilhados                         | PASS      |
| FR-007    | T013–T015              | pendente                                                           | BLOCKED   |
| FR-008    | T010, T011             | criação, lotação, modo e limite em `room.service.test.ts`          | PASS      |
| FR-009    | T010–T012              | prontidão + sessão única; três modos remotos concluídos            | PASS      |
| FR-010    | T008–T012, T015        | vetor/seq/vez/idempotência no serviço PASS; e2e pendente           | BLOCKED   |
| FR-011    | T008–T015              | estado versionado no serviço PASS; gateway pendente                | BLOCKED   |
| FR-012    | T010, T011, T015       | pausa/retomada/expiração unitárias PASS; e2e pendente              | BLOCKED   |
| FR-013    | T017–T020              | pendente                                                           | BLOCKED   |
| FR-014    | T008, T009, T016, T024 | schema recusa mídia/campos extras; revisão de logs/bundle pendente | BLOCKED   |
| FR-015    | T017, T018, T021       | pendente                                                           | BLOCKED   |
| FR-016    | T002, T025–T027        | documentação inicial criada                                        | BLOCKED   |

## Histórias e critérios de aceitação

| História/cenário            | Demonstração | Resultado |
| --------------------------- | ------------ | --------- |
| US-001 / leitura da partida | pendente     | BLOCKED   |
| US-002 / criar e entrar     | pendente     | BLOCKED   |
| US-003 / autoridade         | pendente     | BLOCKED   |
| US-004 / retomada           | pendente     | BLOCKED   |
| US-005 / local e online     | pendente     | BLOCKED   |

## Comandos executados

| Comando exato                                                            | Data       | Resultado | Evidência/observação                                                    |
| ------------------------------------------------------------------------ | ---------- | --------- | ----------------------------------------------------------------------- |
| `git fetch --prune origin`                                               | 2026-10-31 | PASS      | `origin/main` em `a614920`, merge do PR #110.                           |
| `git log --all --oneline -- apps/server`                                 | 2026-10-31 | PASS      | criação em `147ec25`, remoção em `4d501b8`; nenhum gateway multiplayer. |
| `yarn npm info` para NestJS/Socket.IO                                    | 2026-10-31 | PASS      | NestJS 12.3.2 e Socket.IO 4.8.4 publicados.                             |
| `yarn workspace @guess-my-move/marbles test multiplayer-session.test.ts` | 2026-10-31 | FAIL/PASS | 3 falhas esperadas antes do código; 3/3 verdes depois.                  |
| `yarn test` em `packages/marbles`                                        | 2026-10-31 | PASS      | 162 testes em 15 arquivos.                                              |
| `yarn exec vitest run` nos 3 testes de marbles da web                    | 2026-10-31 | PASS      | 68 testes direcionados; avisos `act` preexistentes não falham.          |
| `yarn workspace` typecheck de marbles e web                              | 2026-10-31 | PASS      | contratos neutros e consumidores compilam.                              |
| `yarn exec vitest run test/multiplayer-protocol.test.ts`                 | 2026-10-31 | FAIL/PASS | módulo ausente antes; 5/5 testes verdes após os schemas.                |
| `yarn typecheck` em `packages/marbles`                                   | 2026-10-31 | PASS      | Zod Mini e exports públicos compilam no TypeScript 7.                   |
| `yarn exec vitest run test/room.service.test.ts` em `apps/server`        | 2026-10-31 | FAIL/PASS | módulo ausente antes; 10/10 verdes, incluindo três modos completos.     |
| `yarn typecheck` em `apps/server`                                        | 2026-10-31 | PASS      | serviço e snapshot de rede compilam com Node 26/TS7.                    |

## Medições e benchmark

- **Protocolo e amostra:** nenhuma medição; somente auditoria estática e consulta de versões.
- **Métricas:** nenhuma.
- **Limitações:** nenhuma conclusão sobre latência, fps, capacidade, estabilidade na internet ou compatibilidade prática antes dos testes.

## Validações estruturais e documentais

- **Links e catálogo:** catálogo ainda precisa ser atualizado e validado por `sdd:check`.
- **Contratos:** protocolo compartilhado implementado e testado; sala e gateway pendentes.
- **Privacidade e segredos:** schemas estritos recusam mídia, landmarks e campos extras; prova de logs/bundle pendente.
- **Fronteira de informação:** nenhuma carta entra no protocolo planejado; teste pendente.
- **UTF-8 e acentuação:** arquivos criados em UTF-8.
- **Alterações fora de escopo:** `.kiro/settings/` preexistente permanece sem rastreio e intocado.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado                           |
| ---------------------------------- | --------- | ------------------------------------------------------ |
| I. Intenção antes da implementação | PASS      | documentos SDD criados antes do código.                |
| II. Test-first                     | BLOCKED   | implementação ainda não começou.                       |
| III. Núcleo puro e determinístico  | BLOCKED   | desenho aprovado; prova pendente.                      |
| IV. Privacidade local              | BLOCKED   | desenho aprovado; prova pendente.                      |
| V. Sem código órfão                | PASS      | decisão explícita de não restaurar o servidor de IA.   |
| VI. Convergência (Gate 3)          | BLOCKED   | aprovação antecipada existe; evidência final pendente. |

## Convergência

- **Divergências encontradas:** spec singleplayer ainda em `implementing`; T001 trata a convergência.
- **Artefatos reabertos:** nenhum.
- **Reexecuções:** nenhuma.

## Limitações e riscos residuais

| Limitação/risco                                                 | Impacto                             | Responsável   | Aceite                  |
| --------------------------------------------------------------- | ----------------------------------- | ------------- | ----------------------- |
| Node 26/TypeScript 7 não aparecem na matriz explícita do NestJS | pode bloquear build/runtime         | kirocrew      | aceito para prova local |
| 30 Hz e 60 s são valores iniciais                               | suavidade/espera não medidas        | wezercarvalho | aceito para teste       |
| Sem teste na internet                                           | qualidade de rede desconhecida      | wezercarvalho | risco aceito            |
| Equilíbrio e fps seguem não medidos                             | diversão/desempenho não comprovados | wezercarvalho | risco aceito            |

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito, condicionado à conclusão de T001–T027 e ausência de falha material
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Escopo aprovado:** FR-001 a FR-016, issues #111, #112 e #113
- **Riscos aceitos:** compatibilidade a provar; valores iniciais; sem teste de internet, fps ou equilíbrio real
- **Observações:** a autorização antecipada não promove a spec a `validated`; a promoção ocorre somente após implementação, evidências e gates convergirem.
