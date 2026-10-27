# Validação — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-27`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho pendente (Gate 3)
- **Commit:** não disponível

## Resumo do resultado

Spec em `implementing`. Os documentos (spec, clarificação, plano, pesquisa e tarefas) estão escritos e os Gates 1 e 2 foram aprovados de forma antecipada pelo maintainer em 2026-10-27 ("pode fazer então, abre um PR"). A implementação do código (mira relativa no estalo, gatilho rápido, remoção da direção pela orientação da mão, processamento só de quadros novos da câmera e painel com a taxa da câmera e o resultado do último estalo) está PENDENTE, assim como a validação com os gates automatizados e o teste manual do maintainer. **Nada do estalo com mira relativa foi exercitado com a mão de ninguém**; a viabilidade segue sendo a pergunta da issue #72. Este documento é o esqueleto honesto: será preenchido com evidências quando as tarefas de implementação (T002, T005, T007, T009) e as finais (T013, T014) forem concluídas.

## Conclusão das tarefas

- **Concluídas:** 0
- **Pendentes:** 14 (T001 a T014)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas    | Evidência                        | Resultado |
| --------- | ---------- | -------------------------------- | --------- |
| FR-001    | T003, T005 | pendente (testes da rodada)      | PENDENTE  |
| FR-002    | T001, T002 | pendente (testes do detector)    | PENDENTE  |
| FR-003    | T004, T005 | pendente (testes da rodada)      | PENDENTE  |
| FR-004    | T004, T005 | pendente (testes da rodada)      | PENDENTE  |
| FR-005    | T006, T007 | pendente (testes do controlador) | PENDENTE  |
| FR-006    | T007, T009 | pendente (controlador e painel)  | PENDENTE  |
| FR-007    | T008, T009 | pendente (tela e desenho)        | PENDENTE  |
| FR-008    | T010       | pendente (busca e rede)          | PENDENTE  |
| FR-009    | T011       | pendente (testes pinça e cartas) | PENDENTE  |
| FR-010    | T012       | pendente (docs e catálogo)       | PENDENTE  |

Para promoção a `validated`, cada FR precisará de exatamente uma linha PASS com tarefa e evidência preenchidas; nenhuma está pronta.

## Histórias e critérios de aceitação

| História/cenário       | Demonstração | Resultado |
| ---------------------- | ------------ | --------- |
| US-001 / mira relativa | pendente     | PENDENTE  |
| US-002 / gatilho       | pendente     | PENDENTE  |
| US-003 / quadros novos | pendente     | PENDENTE  |
| US-004 / tela e painel | pendente     | PENDENTE  |
| US-005 / privacidade   | pendente     | PENDENTE  |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                     |
| ---------------------------- | ---------- | --------- | ---------------------------------------- |
| `yarn docs:format:check`     | 2026-10-27 | PENDENTE  | a rodar ao fim da redação dos documentos |
| `yarn sdd:check`             | 2026-10-27 | PENDENTE  | a rodar ao fim da redação dos documentos |
| `yarn test:sdd`              | 2026-10-27 | PENDENTE  | a rodar ao fim da redação dos documentos |
| `yarn check:all`             | —          | PENDENTE  | só após a implementação do código        |
| `yarn test:gates`            | —          | PENDENTE  | só após a implementação do código        |
| `yarn security:dependencies` | —          | PENDENTE  | só após a implementação do código        |

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** pendente. A medição que vale é a do Chrome desktop do maintainer, com a mira relativa e a taxa real da câmera lida no painel (T014).
- **Métricas:** pendente (se disparou, em quantas tentativas, se acertou o alvo, disparo falso, quadros novos da câmera por segundo).
- **Limitações:** até o teste do maintainer, não há medição do estalo com mira relativa nem da taxa real da câmera; os limiares (`slowMs` 80 ms, `minOpenSpeed` 2 razão/s) são palpites de uma única sessão de cerca de 40 s (H-01).

## Validações estruturais e documentais

- **Links e catálogo:** a confirmar por `yarn sdd:check`.
- **Contratos:** `packages/marbles` deve seguir sem dependência de `packages/core`; a mira relativa reusa `computeShot` sem relógio próprio (o tempo entra por argumento). A confirmar na implementação.
- **Privacidade e segredos:** a confirmar (sem frame persistido ou logado; sem chaves).
- **UTF-8 e acentuação:** conferidos na redação dos documentos.
- **Alterações fora de escopo:** nenhuma prevista além da marcação da spec antiga como `superseded`.

## Constitution Check final

| Princípio/gate                     | Resultado | Evidência ou desvio aprovado |
| ---------------------------------- | --------- | ---------------------------- |
| I. Intenção antes da implementação | PENDENTE  | a preencher no Gate 3        |

## Convergência

- **Divergências encontradas:** pendente.
- **Artefatos reabertos:** nenhum até aqui.
- **Reexecuções:** pendente.

## Limitações e riscos residuais

| Limitação/risco                                                            | Impacto                                                    | Responsável | Aceite   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- | -------- |
| Estalo com mira relativa não testado com a mão                             | Viabilidade da issue #72 desconhecida                      | maintainer  | pendente |
| `slowMs` de 80 ms e `minOpenSpeed` de 2 razão/s são palpites de uma sessão | Pode cancelar estalos legítimos ou passar aberturas lentas | maintainer  | pendente |
| Taxa real da câmera ainda não medida                                       | Hipótese de reprocessamento (H-02) aberta                  | maintainer  | pendente |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** pendente (maintainer wezercarvalho)
- **Data:** pendente
- **Escopo aprovado:** pendente
- **Riscos aceitos:** pendente
- **Observações:** o Gate 3 depende da implementação do código, dos gates automatizados verdes e do teste manual do maintainer no Chrome desktop com a mira relativa e a taxa real da câmera. A issue #72 permanece aberta até esse registro.
