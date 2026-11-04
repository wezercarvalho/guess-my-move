# Plano — 2026-10-31-game-marbles-add-online-multiplayer

## Resumo técnico

A entrega preserva o fluxo local e separa a condução da partida da leitura da mão. O pacote `@guess-my-move/marbles` ganha linguagem neutra para o segundo competidor, disparo validável por competidor, tiros restantes para ambos e schemas do protocolo. Um novo servidor NestJS mantém salas efêmeras e avança a única sessão autoritativa. A web usa Socket.IO pela mesma origem e continua calculando a mira localmente; somente o vetor de tiro atravessa a rede.

## Contexto técnico

- **Runtime/versões:** Node >=26.12.1 <27; Yarn 4.18.1; TypeScript 7.0.2; NestJS 12.3.2; Socket.IO 4.8.4; React 19.3.1; Vite 8.3.4; Zod 4.6.7; Vitest 5.0.5.
- **Dependências:** novas somente para `apps/server` (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `@nestjs/websockets`, `reflect-metadata`, `rxjs`, `socket.io`, `zod`) e `socket.io-client` na web; `@nestjs/testing` em desenvolvimento.
- **Provedores externos:** nenhum.
- **Persistência:** nenhuma; salas, tokens e snapshots somente em memória.
- **Testes:** Vitest por workspace; integração com servidor HTTP efêmero e dois clientes Socket.IO; scripts oficiais da raiz.
- **Restrições:** nenhuma mídia ou landmark na rede; uma única instância; servidor é autoridade; modo local funciona sem servidor; sem promessa de latência ou escala.

## Constitution Check — pré-design

| Princípio/gate                      | Resultado | Evidência ou exceção                                                                     |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação  | PASS      | Spec, clarificação, pesquisa, plano e tarefas antecedem o código; Gates 1 e 2 aprovados. |
| II. Uma fonte vigente               | PASS      | Esta spec governa #111–#113; a spec singleplayer será apenas convergida no Gate 3.       |
| III. Rastreabilidade                | PASS      | FR-001 a FR-016 estão mapeados abaixo e em `tasks.md`.                                   |
| IV. Test-first                      | PASS      | Cada fase comportamental começa por teste falhando e registra o resultado.               |
| V. Evidência honesta                | PASS      | Compatibilidade, rede, latência e capacidade só serão declaradas nos cenários medidos.   |
| VI. Privacidade e segredos          | PASS      | Protocolo mínimo; mídia/landmarks proibidos por schema e teste; sem segredo.             |
| VIII. Preservação e operação segura | PASS      | Branch única a partir de `origin/main`; modo local e outros jogos preservados.           |
| Gates 1 e 2                         | PASS      | Aprovação explícita do maintainer registrada em `clarification.md` e `tasks.md`.         |

## Pesquisa e decisões

Ver `research.md`. Decisões principais: servidor novo em vez de restaurar IA; Socket.IO oficial sobre WebSocket; snapshot autoritativo; sala de duas pessoas em memória; retomada de 60 segundos; protocolo compartilhado e estrito.

## Estrutura afetada

```text
packages/marbles/src/
  match/                 sessão neutra e disparo por competidor
  multiplayer/           schemas, eventos e tipos do protocolo
apps/server/
  src/main.ts            bootstrap e health
  src/multiplayer/       gateway, serviço de salas, rate limit e ticker
  test/                  unidade e integração Socket.IO
apps/web/src/marbles/
  marblesController.ts   mira local sobre driver local/remoto
  multiplayerClient.ts  conexão, retomada e comandos
  MarblesScreen.tsx      escolha Local/Online e lobby
  fieldView.ts           intenção e distinção visual
apps/web/vite.config.ts  proxy WebSocket na mesma origem
```

## Design

### Núcleo e protocolo

- `Opponent` ganha `remote`; qualquer adversário diferente de `target` usa dois competidores.
- `MatchPhase` troca `bot-turn` por `opponent-turn`.
- `MatchSnapshot.shotsLeft` expõe `{ player, opponent }`; `playerShotsLeft` fica temporariamente como compatibilidade e é removido dos consumidores novos.
- `MatchSession.fireShot(competitor, velocity)` devolve resultado aceito/rejeitado sem lançar; `firePlayerShot` delega por compatibilidade.
- `opponentSource` é opcional e consultado somente em partidas contra bot. Em `remote`, a sessão espera `fireShot`.
- `multiplayer/` exporta nomes de eventos, schemas Zod estritos e tipos inferidos. O estado do fio contém sala, papel local, presença, prontidão, status, versão e snapshot.

### Servidor

- `RoomService` recebe relógio, gerador de código/token e catálogo de modos por injeção. Testes controlam todos.
- Cada sala guarda dois slots, sequência aceita por papel, `MatchSession`, versão, última intenção, prazo de retomada e pausa.
- `create`, `join`, `resume`, `ready`, `shot`, `leave`, `disconnect` validam estado antes de mudar a sala.
- O ticker chama `advance(dt)` em partidas conectadas e inicia a rodada seguinte após 900 ms. Mudanças incrementam versão e disparam broadcast.
- Gateway usa ack `{ ok: true, ... } | { ok: false, error }`, entra no room do Socket.IO e publica `room:state`.
- `maxHttpBufferSize` é 8 KiB; transporte WebSocket; limiter por socket aceita 20 comandos/s.

### Web

- A seleção ganha `Tipo de partida: Local | Online` usando o `SegmentedControl` existente.
- Online mostra duas ações objetivas: criar com modo escolhido ou entrar por código. O lobby mostra código, papel, presença e botão de prontidão.
- `MultiplayerClient` encapsula Socket.IO e `sessionStorage`; nenhuma dependência de React.
- `MarblesController` recebe uma interface de driver. O local continua sobre `MatchSession`; o remoto usa snapshots e envia o tiro quando o papel coincide com a vez.
- Status e placar usam rótulos `Você`, `Outra pessoa`, `Bot` ou `Meta`. Resultado é invertido para o segundo papel.
- Oponente recebe contorno tracejado/anel além da cor. A intenção remota/bot usa a seta já existente.

### Fluxo

1. Pessoa escolhe Online e modo; cria sala, ou informa código e entra.
2. Servidor devolve papel e token de retomada; cliente entra no room e recebe estado.
3. Ambas ficam prontas; servidor cria `MatchSession(opponent: 'remote')`.
4. Na própria vez, o cliente calcula a mira por câmera e envia `{ seq, velocity }`.
5. Servidor valida, aplica `fireShot`, avança física e publica snapshots versionados.
6. Queda pausa a sala; `resume` dentro de 60 s substitui o socket do papel e continua.
7. Saída ou expiração remove a sala; fim preserva o resultado e permite revanche por confirmação de ambos.

## Mapeamento de requisitos

| Requisito | Abordagem               | Evidência planejada                      |
| --------- | ----------------------- | ---------------------------------------- |
| FR-001    | convergir spec anterior | SDD check e diff documental              |
| FR-002    | snapshot/fase neutros   | testes de sessão e consumidores          |
| FR-003    | fonte `null` + intenção | testes do controlador/campo              |
| FR-004    | rótulo + contorno       | testes de tela e desenho                 |
| FR-005    | driver local preservado | suíte local existente                    |
| FR-006    | schemas compartilhados  | testes do protocolo                      |
| FR-007    | app Nest e gateway      | health e integração real                 |
| FR-008    | `RoomService`           | testes de criação/lotação/limite         |
| FR-009    | sessão autoritativa     | testes de prontidão e tick               |
| FR-010    | validação do tiro       | testes válido/duplicado/fora da vez/teto |
| FR-011    | estado versionado/erro  | testes do serviço e gateway              |
| FR-012    | pausa e retomada        | relógio controlado e integração          |
| FR-013    | fluxo da tela           | testes React e controlador               |
| FR-014    | protocolo mínimo        | schema e busca estrutural                |
| FR-015    | proxy/queda segura      | teste de config e tela sem servidor      |
| FR-016    | cobertura e PR draft    | gates, validação e GitHub                |

## Estratégia test-first

1. Convergir a spec antiga e registrar a auditoria sem código.
2. Escrever testes falhando do snapshot, fase, disparo por competidor e bot sem alvo; implementar mínimo e manter equivalência.
3. Escrever testes falhando dos schemas do protocolo; implementar contratos estritos.
4. Escrever testes falhando do `RoomService`; implementar sala, autoridade, sequência, pausa e expiração.
5. Escrever integração falhando com dois clientes Socket.IO; implementar gateway/bootstrap.
6. Escrever testes falhando do cliente/driver remoto e da tela; integrar sem alterar o fluxo local.
7. Capturar fluxo real em duas abas, executar revisão de novo usuário e gates; reconciliar docs.

## Riscos, rollout e rollback

| Risco                            | Mitigação                                    | Rollback/contingência                         |
| -------------------------------- | -------------------------------------------- | --------------------------------------------- |
| NestJS 12 + TS7 incompatíveis    | provar cedo com workspace mínimo             | registrar bloqueio; não mudar versão sem spec |
| Cliente e servidor divergem      | schema compartilhado + snapshot autoritativo | desabilitar Online; Local permanece           |
| Spam de comandos                 | payload 8 KiB, schema estrito, 20/s          | desconectar somente o socket infrator         |
| Sala órfã                        | prazo de 60 s e coleta periódica             | remover estado em memória                     |
| Atualização parece travada       | versão e estados curtos na tela              | reduzir frequência só após medição            |
| Resultado invertido no convidado | função pura de perspectiva                   | ocultar rótulo até corrigir                   |
| Escopo grande                    | commits/fases documentados                   | PR draft e rollback por fase                  |

## Constitution Check — pós-design

| Princípio/gate                         | Resultado | Evidência ou exceção                                                             |
| -------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| Intenção, rastreabilidade e test-first | PASS      | Design cobre FR-001 a FR-016 e tarefas ordenam testes antes do código.           |
| Privacidade, segredos e informação     | PASS      | Somente vetor/snapshot; schemas proíbem mídia e carta; sem credenciais externas. |
| Núcleo puro                            | PASS      | Regras continuam no pacote; servidor apenas hospeda e avança a sessão.           |
| Preservação e reversibilidade          | PASS      | Local não depende do servidor; fases e commits são separáveis.                   |

## Complexidade e desvios

| Necessidade                    | Impacto                      | Alternativa mais simples rejeitada                   | Aprovação                                                 |
| ------------------------------ | ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Novo servidor NestJS           | novo processo e dependências | cliente como autoridade diverge e aceita trapaça     | maintainer, 2026-10-31                                    |
| Socket.IO em vez de `ws`       | protocolo adicional          | implementar sala/ack/reconexão manualmente           | maintainer autorizou WebSocket; decisão técnica do agente |
| Credencial efêmera de retomada | estado adicional por papel   | retomar só pelo código permite ocupar o papel alheio | maintainer, gates antecipados                             |

## Plano da revisão de usabilidade — 2026-11-04

FR-017: schema compartilhado de apelido, opcional em comandos legados; validação e unicidade no servidor; nicknames apenas em slots efêmeros. FR-018: motor expõe próxima vez por método de leitura, servidor publica, web deriva rótulos de estágio e lista duas pessoas com marca local. Sem duplicar física/regras no cliente. FR-019: evento de prontidão da revanche, indexado pelo número da partida; novo número ao iniciar ambos, versão monotônica e sequência de tiro preservadas. Tiros passam a identificar partida; comandos legados sem número valem somente na primeira. Evitar replay de requisição/tiro antigo. Resultado não some na primeira confirmação. SC-008: testes antes do código, integração Socket.IO e navegador com duas pessoas, incluindo desconexão, nomes e resultado/revanche.

Constitution Check pré/pós-design: intenção de UX solicitada explicitamente pelo maintainer; extensão de nomes livres anterior atualizada primeiro na spec. Sem conta, banco, imagem, landmark ou segredo novo. Apelidos limitados e exibidos como texto. Sem novas dependências e sem mudar a física. Plano/tarefas desta correção autorizados pelo pedido de execução do maintainer em 2026-11-04; teste e aceite final permanecem pendentes.
