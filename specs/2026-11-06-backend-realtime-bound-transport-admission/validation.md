# Validação

## Estado

- Spec: spec.md
- Status: validação técnica aprovada; aceite final do maintainer pendente.
- Constituição: 1.0.0
- Data: 2026-11-06
- Executor/revisor: agente implementador.
- Commit: branch fix/realtime-transport-admission; commit final identificável na PR vinculada à issue #124.

## Resultado e tarefas

T001–T004 concluídas. Reserva síncrona antes do callback positivo do handshake, liberada no fechamento físico, sem duplicar transporte multiplexado. Namespace conserva orçamento adicional. Endpoint e resumo periódico passam o contador correto de transportes. A alteração é aditiva no contrato HTTP; não modifica regras de partidas nem mídia.

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                                                                                                        | Resultado |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001, T002, T004 | transport-admission.test.ts: teto global e por IP antes de CONNECT; quatro handshakes concorrentes admitem somente um sob teto 1.                                                | PASS      |
| FR-002    | T001, T002, T004 | Fechar e readmitir; upgrade inválido sem reserva órfã; timeout pré-namespace; encerramento da aplicação ainda com transporte aberto.                                             | PASS      |
| FR-003    | T001, T002, T004 | Um Manager com dois namespaces conta 1 transporte e 2 sessões; saída parcial preserva o transporte; headers forjados não mudam IP, proxy confiável preserva endereços distintos. | PASS      |
| FR-004    | T003, T004       | activeTransports no schema/gauge e nas duas origens de métricas; OpenAPI regenerado e conferido; documentação distingue tetos e prazos.                                          | PASS      |

## História e demonstração

US-001 demonstrada com Managers Socket.IO que abrem apenas Engine.IO. O teste de concorrência não envia CONNECT de namespace e comprova que a reserva precede a criação de sessão. Os testes de liberação fazem nova admissão real, sem acessar nem alterar coleções privadas. TCP local com upgrade malformado comprova o caminho de falha após autorização.

O teste de timeout confirma o default real de 45.000 ms e acelera somente a instância do servidor no teste para 50 ms usando API pública. O teste de shutdown mantém a conexão aberta e fecha a aplicação, depois observa ambos os contadores em zero.

## Comandos executados

Todos em Node 26.12.1 / Yarn 4.18.1, em 2026-11-06.

| Comando                                                       | Resultado     | Evidência                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| yarn install --immutable e node scripts/git-hooks/install.mjs | PASS          | Dependências imutáveis e hook conferido antes do push.                                                                                                                          |
| yarn workspace @guess-my-move/server test — antes de produção | FAIL esperado | 6 novos cenários falharam, 76 testes existentes passaram. Concorrência admitia 4 sob teto 1; activeTransports não existia. [Resumo sanitizado](evidence/test-first.json).       |
| Mesmo script após implementação                               | PASS          | 83 testes; após acrescentar shutdown explícito, 84 testes aprovados.                                                                                                            |
| yarn check:all                                                | PASS          | Tipos, lint, core 68, marbles 174, swing 234, servidor 83, web 470, scripts web 79 e builds. Última adição somente de teste de shutdown validada com backend 84 e check:static. |
| yarn check:static após último teste                           | PASS          | Tipos e lint sem erros/avisos.                                                                                                                                                  |
| yarn contracts:export e yarn contracts:check                  | PASS          | HTTP atualizado e três documentos conferidos.                                                                                                                                   |
| yarn test:sdd                                                 | PASS          | 109 testes.                                                                                                                                                                     |
| yarn test:gates                                               | PASS          | 231 testes.                                                                                                                                                                     |
| yarn security:dependencies                                    | PASS          | Zero achados em todas as severidades.                                                                                                                                           |
| yarn sdd:check e yarn docs:format:check                       | PASS          | Estrutura, catálogo, rastreabilidade, links e formatação conferidos.                                                                                                            |

Servidor e agregado rodaram em contêiner Node exigido, com dependências e fontes copiadas e rede desativada. O host falha antes de carregar testes por restrição de ancestrais do cache nativo do SWC; não é falha de comportamento da aplicação. Os assets MediaPipe existentes foram copiados ao ambiente isolado para build sem download. Não houve persistência de câmera nem tráfego externo nos testes de transporte.

## Descobertas e convergência

- A recusa antecipada aparece como erro de WebSocket no cliente, antes do middleware de namespace. Regressões foram atualizadas para observar a recusa e a população ativa, sem depender da mensagem antiga Capacidade.
- O resumo periódico do gateway de bolinhas inicialmente usava o default zero para a nova métrica; foi reconciliado com a política real antes da aprovação dos testes.
- A primeira execução integral falhou na asserção booleana de um input do E2E preexistente, sem registrar o código da recusa. A análise identificou a possibilidade de o ticker concluir a coleta enquanto o último input está em trânsito. O teste agora admite somente invalid-state com sala efetivamente finished, mantendo as provas de todos os objetivos, resultado bilateral e revanche. Todas as outras recusas falham; nenhuma regra de produção foi afrouxada.
- A #130 foi descartada: o teste existente de contratos já bloqueou a divergência do OpenAPI durante esta implementação. Relatório/PR #133 corrigidos; nenhuma conferência redundante adicionada.

## Constitution Check final

| Princípio/gate               | Resultado | Evidência                                                                                                     |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| I. Intenção e autorização    | PASS      | Spec/plano/tarefas antes de produção; pedido explícito de iniciar no escopo da #124.                          |
| IV. Test-first               | PASS      | Vermelho anterior registrado, correção e regressões verdes.                                                   |
| VI. Privacidade e carta      | PASS      | Métricas agregadas; testes de privacidade existentes e núcleo core completos aprovados; nenhuma captura nova. |
| VIII. Preservação e operação | PASS      | Branch isolada; sem deploy, merge, alteração de runtime ou Violão.                                            |

## Limitações e riscos residuais

Não é benchmark nem demonstração de capacidade em produção. Teto por processo, por transporte e por namespace, sem proteção de TCP anterior ao handshake e sem identidade autenticada contra abuso distribuído. Vinculação ao fechamento TCP depende de WebSocket exclusivo; habilitar polling exige redesenho. Câmera/GPU física não testadas neste incremento. Avisos conhecidos de canvas/React no DOM simulado e bundle acima de 500 kB permaneceram sem bloquear os checks.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-004, NFR-001–NFR-002, SC-001–SC-002.
- Observações: autorização de iniciar desenvolvimento não é aceite final nem autorização de merge.
