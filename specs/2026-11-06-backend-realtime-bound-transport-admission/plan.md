# Plano

## Resumo técnico

Composição de uma segunda ConnectionAdmission na RealtimePolicy para transportes; não transformar os gateways em superclasses. AllowRequest valida origem, tenta reserva síncrona pelo endereço confiável e registra liberação no close do socket TCP. WeakMap associa socket a ID opaco do orçamento, prevenindo dupla reserva; os contadores existentes por namespace permanecem separados.

## Contexto técnico

Node 26.12.1, Nest 12.3.3, Socket.IO 4.8.4 e TypeScript 7.0.2, conforme manifestos. Nenhuma dependência nova. WebSocket é exclusivo. Testes reais usam Manager de socket.io-client sem criar um Socket de namespace; handshake inválido usa TCP local. Socket.IO expõe connectTimeout para acelerar apenas o cenário de teste.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                          |
| --------------- | --------- | ------------------------------------------------------------------ |
| I. Intenção     | PASS      | Issue #124 e autorização registrada antes da implementação.        |
| IV. Test-first  | PASS      | Testes de admissão reais precedem produção e devem falhar na base. |
| VI. Privacidade | PASS      | Somente contadores agregados; sem payload ou mídia.                |

## Design e decisões

- Reutilizar a política de endereço/forwarded headers; não confiar em Origin como identidade.
- Manter orçamento por namespace para não ampliar a capacidade atual por multiplexação. Novo orçamento físico evita a lacuna pré-namespace.
- Usar close do socket, inclusive upgrade inválido e timeout; não usar timer independente que possa liberar uma conexão ainda aberta. Timeout Socket.IO existente encerra o transporte sem namespace.
- Alternativas rejeitadas: consultar somente engine.clientsCount sofre janela concorrente e não oferece teto por IP; contar só namespace mantém a vulnerabilidade; Redis/deploy não pertencem a este incremento.
- Acrescentar activeTransports no DTO/gauge e regenerar contratos. Compatibilidade aditiva, métricas continuam protegidas.

## Estrutura afetada

RealtimePolicy, RealtimeAdapter, BackendMetrics/BackendTelemetry, schema de métricas, contratos exportados, testes de infraestrutura realtime e documentação de API/operação.

## Testes e validação

Script oficial `yarn workspace @guess-my-move/server test`, seguido de `yarn check:all`, `yarn contracts:check`, `yarn sdd:check`, `yarn docs:format:check`, `yarn test:sdd`, `yarn test:gates` e `yarn security:dependencies`. Se SWC do host impedir os testes, usar checkout isolado sem rede no runtime exigido e registrar a limitação.

## Constitution Check — pós-design

| Princípio/gate | Resultado | Evidência                                                         |
| -------------- | --------- | ----------------------------------------------------------------- |
| IV. Incremento | PASS      | Somente proteção do transporte, testes e métricas compatíveis.    |
| VIII. Operação | PASS      | Sem alteração de ambiente hospedado; rollback por reversão da PR. |

## Riscos e desvios

Nenhuma exceção constitucional. Vínculo ao socket TCP depende de WebSocket exclusivo. Não protege conexões TCP anteriores ao handshake nem ataque distribuído; explicitar em docs. Gate 3 continua humano.

## Descobertas de integração

- Recusa de excesso agora acontece antes do namespace, portanto Socket.IO cliente recebe erro de WebSocket em vez da mensagem Capacidade do middleware. Os testes verificam a recusa e os contadores, sem depender do texto do transporte como regra de produto.
- O resumo periódico do gateway de bolinhas também precisa receber o contador de transportes, além do endpoint agregado, para não publicar zero indevido.
- A conferência de contratos já existe em native-platform.test.ts, incluído no check:all. A issue #130 era um falso positivo e foi encerrada como not planned; o relatório #133 foi corrigido.
- O E2E de coleta com relógio acelerado pode terminar a partida no ticker real enquanto o último input atravessa o socket. O teste aceita exclusivamente invalid-state quando a sala já está finished e mantém todas as provas de coleta/revanche; qualquer outra recusa continua falhando. Não foi alterada produção para adaptar o teste.
