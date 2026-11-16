# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** aprovado
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** GitHub Actions (execução), agente assistente (reconciliação) e wezercarvalho (maintainer, aceite).
- **Commit:** `1dbc6a998acf7f29dcd0eedc0004853b33bd0658` (main); head testado `e5847ec8673daa826991ffd0ec8ba3ca58e6d5d9`.

## Resumo do resultado

As [PR #169](https://github.com/wezercarvalho/guess-my-move/pull/169) e [PR #170](https://github.com/wezercarvalho/guess-my-move/pull/170) foram integradas pelo mantenedor em 16/11/2026. O pin da main é 26.13.1 e a verificação oficial dos contratos integra `check:all`. Os cinco jobs do CI da PR #170 passaram. O conteúdo integrado corresponde à árvore do head testado. Aceite humano explícito registrado após a apresentação dos resultados e das limitações.

## Conclusão das tarefas

- **Concluídas:** 10 (T001–T010).
- **Pendentes:** 0.
- **Evidência:** [tasks.md](tasks.md).

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                               | Resultado |
| --------- | ---------- | --------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001–T003  | Pin e engines atualizados; RED anterior e GREEN no Node 26.13.1.                        | PASS      |
| FR-002    | T004       | check:all, smoke compilado, E2E de Swing e bolinhas.                                    | PASS      |
| FR-003    | T005, T010 | Contratos, governança, regressões e auditorias aprovados.                               | PASS      |
| FR-004    | T006–T007  | PRs, commits, logs, limitações, issue e aceite registrados.                             | PASS      |
| FR-005    | T008–T010  | Teste estrutural do agregado e três contratos conferidos no CI; modo static preservado. | PASS      |

## Histórias e critérios de aceitação

- US-001: pin da main confirmado, CI efetivamente executado no Node 26.13.1; nenhuma release marcada security posterior ao pin na consulta.
- US-002: regressões e smoke aprovados, contratos conferidos, revisão e aceite registrados.

## Comandos executados

O [run 43806311592](https://github.com/wezercarvalho/guess-my-move/actions/runs/43806311592) comprovou a atualização inicial. O [run 43807120382](https://github.com/wezercarvalho/guess-my-move/actions/runs/43807120382) comprovou a emenda CQ-003 e o conjunto final no Node 26.13.1.

| Comando                                 | Data       | Resultado | Evidência                                                                                                             |
| --------------------------------------- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `yarn security:runtime` (main anterior) | 2026-11-15 | FAIL      | [RED](https://github.com/wezercarvalho/guess-my-move/actions/runs/43732104155): pin 26.12.1, última security 26.13.1. |
| `yarn install --immutable`              | 2026-11-16 | PASS      | Instalação aprovada em código, governança e segurança.                                                                |
| `yarn security:runtime`                 | 2026-11-16 | PASS      | Pin e última release security 26.13.1.                                                                                |
| `yarn security:dependencies`            | 2026-11-16 | PASS      | info=0, low=0, moderate=0, high=0, critical=0 na consulta.                                                            |
| `yarn check:all`                        | 2026-11-16 | PASS      | Tipos, lint, testes, build, smoke compilado e contratos.                                                              |
| `yarn test:sdd`                         | 2026-11-16 | PASS      | Job de governança aprovado.                                                                                           |
| `yarn sdd:check`                        | 2026-11-16 | PASS      | Checker do catálogo e links aprovado.                                                                                 |
| `yarn docs:format:check`                | 2026-11-16 | PASS      | Formatação aprovada.                                                                                                  |
| `yarn test:gates`                       | 2026-11-16 | PASS      | Inclui teste da obrigatoriedade dos contratos no agregado.                                                            |
| `yarn contracts:check`                  | 2026-11-16 | PASS      | Três contratos conferidos dentro de check:all.                                                                        |

Logs finais: [código](https://github.com/wezercarvalho/guess-my-move/actions/runs/43807120382/job/133100361320), [governança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43807120382/job/133100361371), [segurança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43807120382/job/133100361379), [gate obrigatório](https://github.com/wezercarvalho/guess-my-move/actions/runs/43807120382/job/133100773114).

### Multiplayer e regressões

No CI da PR #169, as suítes `swing.e2e.test.ts` (6 testes), `swing-room.test.ts` (11), `multiplayer.e2e.test.ts` (10) e `marbles-client-server.test.ts` (4) passaram, incluindo entrada, retomada e revanche. O smoke compilado demonstrou DI/metadados, health 200, início 201, validação 400 e cancelamento 200, sem logs de credenciais reportados pelo teste. O CI da PR #170 aprovou novamente o agregado completo.

### Contratos e teste estrutural

O log de código da PR #170 contém os três resultados:

- `Conferido: http.openapi.json`
- `Conferido: swing.socketio.json`
- `Conferido: multiplayer.socketio.json`

A asserção isolada do último segmento de check:all falhou no manifesto anterior e passou no candidato. O CI da PR #170 executou e aprovou o teste oficial de regressão estrutural. O comando compara os contratos, não os sobrescreve; o encadeamento com `&&` propaga falhas ao gate.

## Validações estruturais e documentais

- As PRs preservaram contratos públicos, código dos jogos, dependências, lockfile e workflows. A emenda altera o agregado de código, teste estrutural e documentação.
- Governança e testes de fronteira/privacidade existentes passaram no agregado remoto. Não se realizou pentest, varredura integral de histórico ou nova auditoria manual de segredos.
- O hook local não foi executado porque o ambiente de execução do chat não teve acesso de rede ao checkout e ao runtime requerido. O CI remoto passou; a limitação foi expressamente aceita.
- Câmera física e implantação estão fora do escopo. Alertas não bloqueantes anteriores de tamanho de chunk, mensagens React act e depreciações não foram tratados.
- Não houve uso de Codex ou Work, merge pelo agente ou deploy.

## Constitution Check final

- PASS: escopo aprovado, rastreabilidade, critérios de segurança e checks remotos preservados.
- PASS: resultados reais e conteúdo integrado conferidos.
- PASS: aprovação humana explícita com a limitação operacional registrada.

## Convergência e limitações

A lacuna inicial de contratos foi resolvida pela PR #170. O registro final consolida evidências já executadas, sem alegar nova execução local. A aprovação não equivale a ausência de vulnerabilidades nem comprova adoção do runtime em produção. O monitor periódico permanece ativo.

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** 2026-11-16
- **Escopo aprovado:** FR-001 a FR-005, SC-001 a SC-004, atualização do Node e validação permanente de contratos integradas à main.
- **Riscos aceitos:** hook local não executado nesta sessão, compensado pelos gates remotos aprovados; não houve validação de implantação, fora do escopo.
- **Observações:** na conversa de 16/11/2026, após a apresentação das evidências e da pergunta explícita sobre o aceite formal do Gate 3 com essas limitações, o mantenedor respondeu “Sim”. O aceite não foi inferido do merge. A issue #132 pode ser encerrada com o registro deste veredito.
