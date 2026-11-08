# Composição das políticas realtime

## Estado e escopo

Decisão técnica da investigação #138, para revisão do maintainer na PR. Base: main em `889d765`, considerando a reserva de transporte proposta na PR #139 (`36da876`). Não muda protocolos nem autoriza merge.

## Problema

Os gateways de bolinhas e Swing repetem etapas, mas não executam o mesmo algoritmo completo. Uma extração baseada apenas na semelhança textual criaria um framework de flags e callbacks que precisaria conhecer os dois jogos.

## Comparação observada

| Responsabilidade   | Bolinhas                                                | Swing                                             | Fronteira proposta                                                      |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Origem/handshake   | Adaptador comum                                         | Adaptador comum, defesa adicional no middleware   | RealtimeAdapter / RealtimePolicy comuns.                                |
| Capacidade         | Namespace raiz                                          | Namespace /swing                                  | Orçamento compartilhado, sem multiplicar por módulo.                    |
| Tentativas de sala | create/join/resume                                      | create/join/resume                                | Política comum por endereço; seleção dos comandos permanece no domínio. |
| Rate limit         | Constantes do pacote marbles                            | Limite de comandos cooperativos                   | Implementação de janela comum; limites explícitos no gateway.           |
| Validação e ACK    | Códigos de erro em maiúsculas, RoomError                | Códigos próprios, SwingRoomError; recover privado | Schemas e traduções locais. Não converter erros por convenção de nomes. |
| Publicação         | Estado resultante/intent, atualização quando necessário | Snapshots periódicos a 10 Hz                      | Scheduler e política de publicação por jogo.                            |
| Métricas           | Operações conhecidas e resumo periódico                 | Operações conhecidas                              | BackendTelemetry e BackendMetrics comuns.                               |
| Domínio            | Sessão de turnos, dwell, física de bolinhas             | Mundo contínuo, objetivos e inputs neutros        | Serviços independentes, núcleo puro.                                    |

## Decisão

Manter composição de políticas pequenas já existente: RealtimePolicy, ConnectionAdmission, SlidingWindowRateLimiter, RoomBudget e BackendTelemetry. Não criar uma superclasse de gateways nem um executor genérico de comandos neste incremento. A política de transporte da #124 deve continuar independente da sessão de namespace e não pode ser reimplementada em cada jogo.

A duplicação restante de `try/parse/action/catch/record` não justifica introduzir um pipeline com parametrização de erros, eventos, publicação, admissão e relógios. O ponto de extensão para um terceiro jogo é um módulo com seu serviço e protocolo, reutilizando os providers da infraestrutura por injeção. Isso preserva a possibilidade de alterar regras do novo jogo sem editar os anteriores; o composition root e o catálogo público devem continuar explícitos, sem discovery dinâmico de plugins sem necessidade.

Neste conjunto de PRs, as extrações concretas são mappers públicos puros e gerador de objetivos, com contratos de dados menores e sem dependência de gateways. São fronteiras que já têm uso real, em vez de um pattern imposto por nome.

## Quando reavaliar

Reabrir a decisão se um terceiro domínio demonstrar a mesma semântica de execução ou se uma mudança repetida de segurança exigir alterar vários gateways. Um possível incremento deve começar por um teste comum de comportamento, definir uma interface mínima de política e manter a tradução de erros e publicação no adaptador do domínio. O critério é reduzir acoplamento comprovado, não apenas número de linhas.

## Testes e riscos

Admissão/origem/capacidade são exercitadas na infraestrutura e em integrações reais dos dois namespaces. Mappers têm testes de imutabilidade e whitelist; gerador tem determinismo e percursos das quatro cidades. O risco residual é drift na sequência local dos gateways; revisão e testes de integração permanecem obrigatórios. Nenhum token, IP ou mídia passa a integrar métricas ou logs por causa desta decisão.
