# Validação

## Estado

- Status: validação técnica concluída; revisão final do maintainer pendente.
- Data: 2026-11-06.
- Branch: chore/node-runtime-monitor; commit identificado na PR.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                            | Resultado |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | Comparação numérica, ordem inversa, security posterior, prerelease/outra major, pin ausente, calendário/EOL e formatos inválidos no test:gates.                      | PASS      |
| FR-002    | T002    | Fetch simulado com fontes fixas, signal timeout, redirect:error, HTTP/JSON/timeout e limite de stream com cancelamento; consulta oficial real por security:runtime.  | PASS      |
| FR-003    | T003    | Workflow diário/manual read-only, seleção PR/hook espelhada, pin também seleciona code; política e responsável em docs/development-context/security/runtime-node.md. | PASS      |

## Test-first e comandos

Primeira execução de test:gates: 231 testes anteriores aprovados e nova suíte falhou por módulo ausente. Depois da implementação, o caso de integração falhou por ausência de seleção/workflow; corrigido com os padrões e passo do auditor. Outro ciclo red/green demonstrou que mudar o pin também precisa selecionar code. Execução final de yarn test:gates: **241 testes aprovados**, sem rede nos testes.

Consulta real por yarn security:runtime em 06/11/2026: pin 26.12.1, versão estável 26.13.0, última marcada security 26.12.1, exit 0. Isso demonstra leitura/avaliação atual, sem declarar inexistência de falhas. Fontes oficiais consultadas: índice de releases, calendário, nota de 26.13.0 e anúncio de novembro. test:sdd: 109 aprovados; sdd:check e formatação conferidos antes do push. security:dependencies também aprovado, zero achados. O incremento só muda tooling/docs; código de jogo é o da composição validada na PR anterior.

## Decisões e limites

Flags publicadas e suporte são verificáveis; o monitor não lê nem interpreta automaticamente advisories futuros. Não atualiza runtime nem cria PR/issue/merge. Falha de fonte não vira aprovação. NFR-001/NFR-002 preservadas, sem dados de jogo ou alterações de física/rede. Agendamento só opera depois de integrado à main; CI em draft não prova execução agendada.

A entrega satisfaz rotina e responsabilidade de #132, mas **Refs #132**: ainda falta publicação do patch previsto para 11/11/2026 ou após, leitura das CVEs, atualização consistente e testes nessa versão. Responsável @wezercarvalho; próxima conferência nessa data, horário de Brasília. Não alegar que a versão 26.13.0 corrige o advisory futuro.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-003, NFR-001–NFR-002 e SC-001; atualização futura do binário fora do incremento disponível.

## Revalidação integrada após revisão adicional

A composição em eb90b93 (aplicação igual à branch final de bolinhas) passou `VITEST_MAX_WORKERS=1 yarn check:all` completo no container Node 26.12.1, com configuração padrão: core 68, bolinhas 174, Swing 234, servidor 98, web **504 testes + 79 scripts**, tipos/lint e builds aprovados. Sem alteração de dependências, contratos, backend ou núcleos nesta revisão adicional. Os seis casos novos de bolinhas complementam as regressões de sessão; o contrato de transporte neutro e a formatação do lobby mantêm as fachadas.

O aviso não bloqueante de tamanho do chunk 3D continua explícito; investigação e critérios estão em #147. Cobertura de frontend/servidor juntos foi organizada em #148. Ambas em triagem P2, com responsável e sem implementação futura presumida. Relatório/checklist em docs/reviews/2026-11-06-post-merge/MAINTENANCE.md, na PR #133. Câmera física, CI ao sair de draft, aceite Gate 3 e merges continuam com o maintainer. O patch futuro de #132 também permanece dependente da publicação.
