# Validação

## Estado

- Status: validação técnica concluída; revisão final do maintainer pendente.
- Data: 2026-11-06.
- Branch: refactor/backend-public-projections, commit final identificado na PR.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                                                                                  | Resultado |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | public-room-projection.test.ts: três modos, cópia profunda dos dados públicos, saída mutável sem alterar origem e slots com tokens/ids privados excluídos. Serviço prepara a bolinha na mutação, antes do primeiro estado. | PASS      |
| FR-002    | T002    | cooperative-objectives.test.ts: quatro cidades, seleção determinística, origem preservada e cópia independente. Os quatro percursos reais existentes continuam aprovados.                                                  | PASS      |
| FR-003    | T003    | ADR de composição compara fluxos, políticas comuns, diferenças e gatilho de reavaliação. Decisão: preservar composição e não introduzir executor altamente parametrizado ou superclasse de jogos.                          | PASS      |

## Test-first e comandos

Os testes dos novos componentes foram escritos antes da extração: duas suítes falharam porque os módulos ainda não existiam; 76 testes anteriores passaram em Docker. [Resumo](evidence/test-first.json). A seleção geométrica e a whitelist foram extraídas sem alteração das constantes ou formatos.

- yarn install --immutable e instalação do hook: PASS.
- yarn check:static: PASS, sem erros/avisos após remover duas assertions desnecessárias nos testes.
- yarn contracts:check: PASS, três arquivos sem divergência; não foi alterado contrato público.
- yarn workspace @guess-my-move/server test --config ../../specs/2026-11-06-backend-rooms-extract-public-projections/evidence/compiled-vitest.mjs: PASS, 86 testes.
- SDD estrutural, formatação e verificações de pré-push: registradas na entrega da PR.

Após o vermelho, o daemon Docker tornou-se indisponível. SWC no host não materializa o addon por validação do cache/montagem noexec. A configuração explícita de diagnóstico redireciona somente imports de src do servidor para dist recém-compilado pelos scripts oficiais, preservando metadados de produção emitidos pelo TypeScript. Nenhuma configuração padrão do repo foi trocada para tornar o gate verde. CI padrão continua obrigatório quando a PR sair de draft; não se declara check:all padrão integralmente executado no ambiente indisponível.

## Decisões e limites

RoomService continua como agregado de ciclo da partida, com métodos de leitura sem a preparação do próximo tiro. A preparação passou a startMatch e às transições de tick; nextCompetitor e projeção são leituras. Mapper não recebe MatchSession, relógio nem token; operações continuam restritas aos dados do snapshot. Gerador de objetivos não conhece sala, socket ou participante.

A busca geométrica mantém os mesmos limites e ordem. Não há promessa nova de FPS ou capacidade. Não foram testadas câmera/GPU física, rede externa ou múltiplas instâncias. Cópias de estruturas aninhadas preservam isolamento entre serialização e domínio.

## Constituição e convergência

T001–T003 demonstradas; intenção, testes, extração e ADR convergem. Privacidade por whitelist, sem dados pessoais em logs/métricas e sem mudança na carta. Não houve deploy ou merge. A limitação de infraestrutura fica explícita para revisão, sem inferir aceite humano.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-003, NFR-001–NFR-002 e SC-001.
