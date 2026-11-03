# Validação — 2026-10-31-game-marbles-add-online-multiplayer

## Estado

- **Spec:** `spec.md`
- **Status:** implementação funcional; validação final parcial
- **Constituição:** 1.0.0
- **Retomada:** `2026-11-03`
- **Executor:** Codex; histórico das Fases 0–4 por kirocrew
- **Branch:** `feat/111-marbles-multiplayer`

## Resumo do resultado

Motor, protocolo, servidor e cliente web implementados. O fluxo online foi demonstrado em duas páginas de Chromium com servidor NestJS compilado: criar, entrar, prontidão, tiro por pinça simulada, alternância, queda, retomada, reload e saída para modo local. As imagens e landmarks ficam no navegador; o frame de tiro contém apenas evento, sequência e vetor.

O Gate 3 continua pendente: `check:all` encontra um bloqueio de cache nativo SWC ao carregar os testes do servidor neste ambiente, que fornece Node 24.22.2 em vez do Node 26.12.1 exigido pelo projeto. A revisão independente de usabilidade por pessoa nova também não ocorreu. Nenhum teste ou gate não executado é tratado como aprovado.

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

### Fase 4 — NestJS e gateway WebSocket

- **Resultado:** PASS.
- **Vermelho observado:** os testes de fundação/gateway não carregaram antes dos módulos; o e2e não carregou antes de `app.setup.ts`.
- **Implementação:** NestJS 12.3.2, Socket.IO 4.8.4 forçado a WebSocket, payload de 8 KiB, health, config estrita, limiter 20/s, acks sanitizados, broadcasts e ticker de 33 ms.
- **Verde:** 22/22 testes do servidor; typecheck, build e lint oficiais verdes.
- **E2E:** duas conexões criam/entram, ficam prontas, recebem o mesmo estado, veem intenção, rejeitam vez/seq inválidas e retomam o papel após queda.
- **Isolamento:** mídia abaixo do limite vira `INVALID_PAYLOAD` sem ecoar conteúdo/stack; payload acima de 8 KiB fecha apenas o socket infrator e outra sala continua funcionando.
- **Compatibilidade:** NestJS 12.3.2 compilou e executou com Node 26.12.1, TypeScript 7.0.2 e Vitest/SWC neste repositório. Isso não prova suporte geral fora desta configuração.
- **Limitação:** teste só em loopback e uma instância; nenhuma medição de latência, carga ou internet.

### Fase 5 — Cliente e tela online

- **Resultado:** PASS nos testes direcionados e suíte web.
- **Vermelho observado nesta retomada:** dois novos testes do cliente falharam, demonstrando ausência de retomada quando o acesso já estava em memória e reinício incorreto da sequência dos tiros após reload (5 testes anteriores passaram). A tela ainda não continha seleção Local/Online nem lobby; os cenários foram escritos antes da implementação.
- **Implementação:** `MultiplayerClient`, `MultiplayerLobby`, driver remoto e proxy Vite na mesma origem; código normalizado, presença, prontidão, papel, saída, erro/pausa e resultado pela perspectiva de cada participante. Acesso e próxima sequência sobrevivem ao reload em `sessionStorage`; armazenamento bloqueado não impede a conexão corrente.
- **Regressão:** pinça e estalo só enviam vetores na própria vez conectada, para ambos os papéis; nenhuma física remota avança no navegador. Tiro pendente bloqueia outra mira.
- **Verde:** 71 testes direcionados em três arquivos (cliente, controlador e tela); suíte web completa com 429 testes Vitest e 78 testes auxiliares por `node:test`.
- **Limitação:** detector e câmera simulados; gestos reais, equilíbrio e qualidade de rede não medidos.

### Fase 6 — Demonstração e revisão

- **Demonstração:** PASS em duas páginas de Chromium, com contextos independentes, Vite e NestJS compilado em loopback. A câmera usa dispositivo falso e tracker com landmarks sintéticos; o gesto percorre a mira da aplicação e gera um frame `match:shot` real.
- **Rede:** ambas entram e ficam prontas, recebem a alternância; desconectar a convidada pausa a anfitriã, reconectar recupera a vez e reload recupera código/papel. Sair permite iniciar uma partida local.
- **Privacidade:** revisão do protocolo/gateway e frame capturado sem imagens, vídeo, áudio, landmarks, gesto bruto ou carta. Token de retomada existe somente no acesso privado e no comando de retomada; não aparece nas capturas ou logs versionados. Não há chave de provedor.
- **Evidências:** [anfitriã](evidence/online-host.png), [convidada](evidence/online-guest.png) e [resultado do navegador](evidence/browser-smoke.json).
- **Revisão visual do executor:** lobby compacto durante a partida, rótulos pela perspectiva local e contraste/contorno herdados do campo. Isso não substitui a avaliação por pessoa nova (T023).
- **Gates:** estáticos, build, web, governança e auditoria passaram; agregado bloqueado pelos testes do servidor. A evidência histórica da Fase 4 não substitui uma nova execução.

## Comandos e resultados desta retomada

Os scripts Yarn usaram `COREPACK_HOME=/tmp/guess-my-move-corepack` , `YARN_GLOBAL_FOLDER=/home/codex/Documents/Codex/runtime-tmp/yarn-global` e `TMPDIR=/home/codex/Documents/Codex/runtime-tmp`: o Yarn global era 1.22 e o `/tmp` padrão não permite executar os launchers temporários. Nenhum manifesto ou requisito de runtime foi rebaixado para contornar o ambiente.

| Comando                                                       | Resultado | Evidência e limites                                                                                                                                    |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn check:static`                                           | PASS      | Typecheck de todos os workspaces e Oxlint; executado após correções e os novos testes.                                                                 |
| `yarn check:all`                                              | BLOCKED   | Núcleos core (68 testes) e marbles (167) passam; o servidor não carrega SWC por `ERR_SWC_NATIVE_CACHE`. O agregado termina com erro; não foi aprovado. |
| `yarn workspace @guess-my-move/web test`                      | PASS      | 429 testes em 42 arquivos + 78 auxiliares. Avisos jsdom de canvas durante a suíte não impediram a conclusão.                                           |
| `yarn build`                                                  | PASS      | Todos os workspaces; aviso de chunk grande no Arranha-Teia, fora do escopo.                                                                            |
| `yarn test:gates`                                             | PASS      | 231 testes.                                                                                                                                            |
| `yarn test:sdd`                                               | PASS      | 109 testes.                                                                                                                                            |
| `yarn security:dependencies`                                  | PASS      | info/low/moderate/high/critical: todos zero.                                                                                                           |
| `yarn sdd:check`                                              | PASS      | Catálogo, estados, gates, cobertura e links válidos.                                                                                                   |
| `yarn docs:format:check`                                      | PASS      | Todos os documentos no formato esperado.                                                                                                               |
| `yarn workspace @guess-my-move/server start` + `yarn dev:web` | PASS      | Servidor compilado, health e gateway funcionando no navegador.                                                                                         |
| Chromium/Playwright, duas páginas                             | PASS      | JSON e capturas em `evidence/`; sem teste de internet ou mão real.                                                                                     |

## Pendências de conclusão

- **T023:** colher avaliação independente de usabilidade por pessoa nova. Capturas e demonstração automatizada já disponíveis.
- **T025:** repetir `check:all` no runtime alvo Node 26.12.1 e ambiente que permita carregar SWC. Os demais gates estão registrados acima.
- **T026:** documentação atualizada; abertura da PR draft será registrada antes do encerramento desta retomada.
- **T027:** reconciliar esses resultados antes de promover a spec a `validated`.

## Convergência e preservação

- **Requisitos:** FR-001–FR-015 têm implementação; FR-016/SC-007 continuam parcialmente pendentes por validação final/revisão/PR. Evidências comportamentais estão nos testes de pacote/servidor das Fases 1–4, nos testes da web e na demonstração desta retomada.
- **Alterações preexistentes:** cliente/controlador/testes/manifesto/lockfile da Fase 5 foram preservados e completados. `.kiro/settings/` permanece fora do commit e intocado.
- **Checkout:** o original em `/srv/ai-harness/workspaces/guess-my-move/guess-my-move` estava disponível somente para leitura nesta conversa. A continuidade preserva seu HEAD, branch e alterações na cópia `/home/codex/Documents/Codex/guess-my-move`; o original não foi alterado.
- **Outros jogos:** Violão no Ar em standby a pedido do maintainer; Arranha-Teia e backlog em triagem fora do escopo.
- **Runtime:** Node 24.22.2 desta sessão não demonstra compatibilidade com Node 26; a evidência histórica do Node 26 permanece identificada como histórica.
- **Gate 3:** autorização antecipada do maintainer em 2026-10-31 preservada, condicionada aos gates verdes e à convergência. Status continua `implementing`.
