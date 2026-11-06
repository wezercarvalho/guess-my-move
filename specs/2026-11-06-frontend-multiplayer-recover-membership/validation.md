# Validação

## Estado

- Spec: spec.md
- Status: validação técnica concluída; revisão final do maintainer pendente.
- Data: 2026-11-06
- Executor: agente implementador no escopo autorizado.
- Commit: branch fix/multiplayer-session-recovery, identificado na PR.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                                                                                         | Resultado |
| --------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | recover privado real por Socket.IO após create sem callback; socket estranho e payload com código de outra sala recusados; uma única sala ativa, snapshots sem token.                                                             | PASS      |
| FR-002    | T002    | Repetição de resume no mesmo socket/token nos dois jogos; token incorreto e outro socket recusados; atividade não renovada. Timeout repete e mantém tiros bloqueados até confirmação; tentativas finitas, descarte cancela waits. | PASS      |
| FR-003    | T003    | Queda/destruição cancela ACKs e esperas de connect de bolinhas; resposta antiga de create/ready não grava storage nem limpa nova sessão.                                                                                          | PASS      |
| FR-004    | T004    | Entrada com estado provisório recupera acesso privado; ausência definitiva de participação limpa lobby; falha persistente abandona transporte e permite nova ação. UI oferece retomada explícita e mantém o mesmo mundo/câmera.   | PASS      |

## Test-first e demonstrações

Antes de produção: web 6 falhas / 28 aprovações e servidor 3 falhas / 76 aprovações, pelo comportamento ausente. [Resumo sanitizado](evidence/test-first.json). Após produção, testes de idempotência, três tentativas finitas, confirmação tardia, destruição e erro antigo demonstram os cenários. Novo E2E usa sockets reais e descarta o ACK de criação de propósito; nenhum hook de teste foi acrescentado à produção.

O coletor de observabilidade recebe o novo trace swing:recover, com a sentinela de credencial ausente do conteúdo exportado. Nenhuma mídia, landmark, nickname privado, header ou token passou a integrar as métricas.

## Comandos e resultados

Node 26.12.1 / Yarn 4.18.1, em 2026-11-06.

| Comando                                                                                                                                        | Resultado | Alcance                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| yarn install --immutable e instalação do hook                                                                                                  | PASS      | Manifestos consistentes.                                                                        |
| yarn workspace @guess-my-move/web test:multiplayer-clients                                                                                     | PASS      | Suíte dirigida de ACKs, sessão e UI.                                                            |
| VITEST_MAX_WORKERS=1 yarn workspace @guess-my-move/web test                                                                                    | PASS      | 480 testes web e 79 scripts, incluindo controles/câmera simulada.                               |
| yarn workspace @guess-my-move/server test                                                                                                      | PASS      | 80 testes em Docker antes da indisponibilidade do daemon, incluindo recover real e privacidade. |
| yarn workspace @guess-my-move/server test --config ../../specs/2026-11-06-frontend-multiplayer-recover-membership/evidence/compiled-vitest.mjs | PASS      | 80 testes repetidos com produção recém-compilada, metadados Nest emitidos pelo TypeScript.      |
| yarn check:static, yarn build                                                                                                                  | PASS      | Todos os tipos, lint e builds.                                                                  |
| yarn contracts:export e yarn contracts:check                                                                                                   | PASS      | Evento aditivo exportado; três contratos conferidos.                                            |
| yarn test:sdd, yarn test:gates                                                                                                                 | PASS      | 109 e 231 testes.                                                                               |
| yarn security:dependencies                                                                                                                     | PASS      | Zero achados.                                                                                   |

O agregado check:all foi iniciado em Docker: core 68, marbles 174, swing 234 e servidor 80 passaram. Uma primeira execução web perdeu um worker SIGKILL; a segunda perdeu a conexão com o daemon. O host também impede o cache nativo do SWC. Por isso, as etapas restantes foram executadas separadamente pelos scripts oficiais, com configuração explícita que redireciona imports de src do servidor ao dist recompilado; a configuração padrão não foi alterada. Web concorrente também excedeu tempo em dois testes de física preexistentes; a execução serial integral passou. Não se declara check:all padrão aprovado integralmente no ambiente indisponível. O CI remoto permanece obrigatório quando a PR sair de draft.

## Decisões e limites

Consulta de recover é limitada ao próprio socket e não estende TTL. Criação não é repetida automaticamente. Abandono sem ACK de leave pode depender da expiração normal de 60 segundos; uma reconexão do transporte permite voltar ao formulário sem forçar outra criação. Credencial conhecida permanece em memória/sessionStorage conforme cada jogo. Swing continua sem retomada após reload. Não há mudança de regras, mapas, limites ou runtime.

## Constituição e convergência

Testes precederam produção; fonte/contrato/plano convergem; dados privados ficam fora dos estados públicos e da telemetria. Artefatos foram atualizados para explicitar a alternativa de teste compilado e limites reais do ambiente. Não há exceção de comportamento ou aprovação final inferida.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-004, NFR-001–NFR-002 e SC-001.
