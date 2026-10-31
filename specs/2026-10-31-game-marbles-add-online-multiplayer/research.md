# Pesquisa — multiplayer online das bolinhas de gude

## Auditoria do estado atual

- A spec `2026-10-29-game-marbles-modes-build-single-player-matches` tem T001–T030 concluídas e somente T031 (Gate 3) pendente. O maintainer aceitou todos os gates em 2026-10-31.
- `MatchSnapshot.playerShotsLeft` mostra apenas o primeiro competidor. A tela usa o rótulo neutro "Tiros restantes" mesmo durante a vez do bot.
- `MarblesController.makeBotSource` devolve `{ x: 300, y: 0 }` quando não há campo ou alvo; a sessão já sabe tratar `null`, logo esse tiro não representa intenção válida.
- `MatchPhase` usa `bot-turn`, embora a lógica dos modos já trate dois `Competitor` (`player` e `opponent`).
- A sessão do pacote é a única implementação de regras e física; ela deve continuar sendo a autoridade também no servidor.

## Histórico do servidor

- `apps/server` nasceu no commit `147ec25` e foi removido no commit `4d501b8` (PR #63).
- O servidor antigo expunha HTTP para o árbitro por LLM. Não havia `WebSocketGateway`, Socket.IO, sala ou multiplayer no histórico.
- O commit de remoção excluiu também `packages/providers` e `packages/benchmark`, cerca de 5,5 mil linhas. Restaurá-lo reintroduziria o fluxo abandonado.
- Padrões aproveitáveis por reimplementação pequena: health check, validação de ambiente no boot, erros estáveis e contador de janela deslizante.

## NestJS e WebSocket

Pesquisa em 2026-10-31:

- NestJS 12 está estável; o registry npm publicou 12.3.2 em 2026-10-27.
- Pacotes oficiais: `@nestjs/websockets` e `@nestjs/platform-socket.io`; o adaptador 12.3.2 depende de Socket.IO 4.8.4.
- O Socket.IO fornece rooms, acknowledgements e retomada de conexão. Esta entrega força `transports: ['websocket']` para não depender de long polling.
- O gateway é um provider NestJS; handlers usam `@SubscribeMessage` e payload validado antes de chegar à sala.
- Erros de protocolo usam códigos próprios no acknowledgement e evento sanitizado; stack não atravessa o socket.

Fontes:

- [NestJS WebSocket gateways](https://docs.nestjs.com/websockets/gateways)
- [NestJS WebSocket adapters](https://docs.nestjs.com/websockets/adapter)
- [NestJS WebSocket pipes](https://docs.nestjs.com/websockets/pipes)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS releases](https://github.com/nestjs/nest/releases)
- [Socket.IO rooms](https://socket.io/docs/v4/rooms/)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees)

## Compatibilidade

- Repositório: Node >=26.12.1 <27, TypeScript 7.0.2, Yarn 4.18.1, ESM, Vitest 5.0.5.
- NestJS 12 declara Node >=20 e é ESM-first. A documentação de lançamento cita Node 20.19+/22.12+, mas não declara uma matriz específica para Node 26.
- O repositório NestJS usa TypeScript 5.9; suporte explícito ao TypeScript 7 não foi encontrado.
- Decisão: fixar 12.3.2 e comprovar compatibilidade neste monorepo por `typecheck`, build, testes unitários e integração real com dois clientes Socket.IO. Se falhar por incompatibilidade real, registrar o bloqueio; não reduzir a versão silenciosamente.

## Alternativas

| Alternativa                 | Vantagem                                 | Limitação                                     | Decisão             |
| --------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------- |
| Restaurar servidor antigo   | Scaffold já existiu                      | Código de IA, sem multiplayer; grande e morto | rejeitada           |
| WebSocket `ws`              | Protocolo menor                          | Sala, ack e retomada manuais                  | rejeitada nesta PoC |
| Socket.IO oficial do NestJS | Sala, ack, reconexão e testes de cliente | Dependência e protocolo próprios              | escolhida           |
| Física em cada cliente      | Menos processamento no servidor          | Divergência e trapaça; exige rollback         | rejeitada           |
| Snapshot autoritativo       | Uma fonte de verdade; simples de depurar | Mais mensagens; sem previsão local            | escolhida           |
| Banco/Redis                 | Persistência e escala                    | Fora da necessidade atual                     | rejeitada           |

## Segurança e privacidade

- O código da sala aceita somente schemas estritos e payload máximo de 8 KiB.
- O tiro é um vetor finito com sequência monotônica e teto de 1100 unid/s, o mesmo máximo dos controles existentes.
- Limite de 20 comandos por conexão em 1 segundo protege o laço sem alegar resistência a ataque distribuído.
- Código da sala não é autenticação. A credencial de retomada é aleatória, efêmera e nunca é registrada em log.
- Câmera, vídeo, áudio, landmarks e gestos continuam no cliente e não aparecem no protocolo.

## Decisão final

Criar um novo `apps/server` mínimo com NestJS 12.3.2 e Socket.IO 4.8.4. O protocolo vive no pacote puro `@guess-my-move/marbles`, para servidor e web consumirem a mesma definição. A sessão ganha disparo por competidor e adversário `remote`, sem duplicar as regras. O cliente mantém o controlador de mira local e troca somente o driver da partida: local ou remoto.
