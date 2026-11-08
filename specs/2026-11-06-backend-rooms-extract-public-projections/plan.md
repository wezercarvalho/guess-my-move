# Plano

## Design

Issues #136, #137 e #138 da iniciativa #129. Extrair projectPlayers e projectMatch para mapper puro que recebe somente dados públicos do snapshot; ele não recebe MatchSession nem chama shooter. Preparação da bolinha da vez passa para as mutações startMatch/tick antes de publicar um estado. Comparação de snapshots e suítes de todas as modalidades demonstram preservação das posições de mira.

Extrair literalmente a busca limitada de objetivos do Swing para função com cidade indexada e posição de origem como entradas. Preservar ordem, limites, componente caminhável e raio; testes nas quatro cidades e percursos físicos anteriores permanecem como aceitação.

A investigação #138 entrega ADR com comparação entre gateways, pontos já compartilhados, diferenças que não devem ser abstraídas e decisão de composição. Não criar hierarquia ou pipeline altamente configurável para reduzir linhas sem benefício. Considerar a reserva de transporte da PR #139, ainda independente.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                 |
| --------------- | --------- | --------------------------------------------------------- |
| I. Intenção     | PASS      | Issues Ready e autorização do maintainer nesta conversa.  |
| IV. Test-first  | PASS      | Contratos de mapper imutável e gerador antes da extração. |
| VI. Privacidade | PASS      | DTOs por whitelist; nenhum token ou mídia.                |

## Validação

Node 26.12.1, TypeScript 7.0.2, Nest 12.3.3, Vitest dos manifestos. Sem dependência nova. Suíte servidor, check:all, contratos exportados/conferidos, SDD, docs, testes dos gates e auditoria. Caracterização das posições dos três modos; snapshots repetidos e mutação da saída não alteram fonte. Percursos reais nas quatro cidades.

## Constitution Check — pós-design

| Princípio/gate    | Resultado | Evidência                                                                        |
| ----------------- | --------- | -------------------------------------------------------------------------------- |
| VIII. Preservação | PASS      | Extração por composição em unidades pequenas; sem modificar contratos ou regras. |

## Riscos

Preparar a próxima bolinha no ponto errado do ciclo altera mira; mover para todas as transições relevantes e testar. Mapper deve clonar estruturas aninhadas. Se nova divergência aparecer, retornar ao serviço e corrigir a fronteira, sem modificar regra para acomodar teste. Rollback por reversão da PR, sem persistência.
