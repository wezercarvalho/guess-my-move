# Validação

## Estado

- Spec: spec.md
- Status: validação técnica concluída; revisão final e merge pendentes do maintainer.
- Data: 2026-11-08
- Executor: agente implementador.
- Base: b9335d5dba89a606a795108f00865fed8e7f411f (main após #150).
- Branch: test/marbles-real-client-lobby; commit de entrega identificado na PR.

## Evidências por requisito

| Requisito                  | Tarefas   | Evidência                                                                                                                                                                                                                                                                                                                                                                               | Resultado |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001                     | T001      | ACKs reais de create/join retidos após broadcast; access/room permanecem nulos até confirmação; Ana/player e Bia/opponent convergem no mesmo estado e uma única sala.                                                                                                                                                                                                                   | PASS      |
| FR-002                     | T002      | ACK de join descartado por 5 s; cliente abandona transporte; reserva desconhecida expira pelo prazo real configurado, avançado apenas pelo relógio do harness; nova criação funciona. Queda pausa e retomada mantém apelido/papel, bloqueando tiros antes do ACK. Saída cancela comando pendente e ignora sua confirmação atrasada, limpa os dois clientes e rejeita tiro fora da sala. | PASS      |
| FR-003                     | T003      | Tiros reais completam três rodadas; pedido unilateral preserva resultado; confirmação bilateral inicia matchNumber 2 com mesmos sockets/código e uma única sala. Reenvio do payload real anterior é recusado.                                                                                                                                                                           | PASS      |
| FR-004                     | T004      | Script test:lobby incluído no test do servidor e check:all; tsconfig próprio cobre importação do cliente; timeouts de 20 s/caso e 5 s/hook; afterEach descarta clientes, listeners, sockets e servidor.                                                                                                                                                                                 | PASS      |
| NFR-001 / NFR-002 / SC-001 | T001–T004 | Sem novas dependências, API de teste em produção, câmera, persistência ou logs de credenciais. Falhas só nos callbacks do harness. Física/serviço/gateway/protocolo reais; avanço de relógio explicitado no plano.                                                                                                                                                                      | PASS      |

## Comandos e resultados

Node 26.12.1 e Yarn 4.18.1. Host Linux x64 para typecheck/lint/gates; Docker Linux x64, rede externa desativada e VITEST_MAX_WORKERS=1 para execução Nest/SWC e check:all. Só loopback interno na integração.

- yarn install --immutable + instalação do hook: PASS.
- yarn workspace @guess-my-move/server typecheck: PASS, incluindo a fronteira de integração.
- yarn lint: PASS, zero avisos/erros.
- yarn workspace @guess-my-move/server test:lobby: PASS, 4 testes em 9,08 s; execução agregada em 10,26 s. Aproximadamente 5 s são o timeout intencional e 2,5 s são os tiros da partida completa. Amostras de uma execução de cada contexto, sem garantia universal de custo no CI.
- VITEST_MAX_WORKERS=1 yarn check:all: PASS; core 68, bolinhas 174, Swing 264, servidor 98 + 4 integrados, web 525 + 79 scripts; typecheck, lint e builds aprovados.
- yarn test:gates: resultado registrado no gate local antes do push.
- yarn sdd:check e yarn docs:format:check: exigidos e conferidos no hook antes do push.

## Demonstração e complementaridade

Os testes usam o cliente de produção e sockets reais, cobrindo a lacuna entre os testes isolados do cliente e os E2E de servidor com sockets diretos. A primeira execução encontrou duas hipóteses incorretas do harness: pressupor entrega garantida de leave imediatamente antes da queda e considerar pronta uma fase que ainda exibia intenção de tiro. O harness foi corrigido para observar expiração efetiva e aguardar consumo da intenção; nenhuma alteração de comportamento de produção foi necessária.

## Limitações e veredito

FR-001–FR-004 demonstrados. Não mede navegador, rede pública, fluidez, inferência ou câmera real; a UI mantém suas suítes existentes. A integração não substitui esses testes. Aceite final/Gate 3 pendentes; status validating. CI remoto será executado ao sair de draft, sem alegar aprovação remota antecipada.

## Entrega consolidada — 2026-11-09

Por solicitação do maintainer, esta implementação foi incorporada à branch `codex/consolidate-game-deliveries`, junto das outras quatro PRs. O [registro de integração](../../docs/development-context/delivery/consolidated-games-2026-11-09.md) identifica commits, validação conjunta, fechamento das PRs substituídas e pendências de aceite. As evidências específicas acima permanecem vinculadas às execuções e limitações registradas.
