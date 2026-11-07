# Validação

## Estado

- Status: validação técnica concluída; aceite final do maintainer pendente.
- Data: 2026-11-06

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                     | Resultado |
| --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | Carga cancelada, reabertura, falhas e fechamento idempotente por teste unitário.                                              | PASS      |
| FR-002    | T002    | Quadro nativo único, fallback e callback cancelado por teste unitário.                                                        | PASS      |
| FR-003    | T003    | Adoção real nos dois controladores, regressões de câmera simulada e cleanup; suíte web integrada com 498 testes + 79 scripts. | PASS      |

## Gate 3 — Convergência validada

- Veredito: pendente.
- Aprovador: maintainer.

## Etapa de base

As duas suítes foram escritas antes dos módulos e falharam por imports ainda inexistentes. Após implementação, oito testes de recursos/quadros aprovados por test:capture e tipos/lint aprovados. Adoção real (FR-003/T003) concluída nas branches dos dois controladores; a PR final de bolinhas integra as adoções e propõe encerrar #142. Não houve captura real ou rede.

A mensagem de fallback é injetável por domínio: teste adicional falhou antes da extensão e passou após o construtor aceitar o formatador. Isso preserva o texto de erro de bolinhas sem acoplar a utilidade ao jogo.

Regressão adicional: cancelamento reentrante dentro do callback de quadro falhou com um reagendamento indevido. Guarda de geração após o callback corrigiu o caso; oito testes compartilhados aprovados.

A base e as duas adoções usam o mesmo ciclo de posse/cancelamento. Última validação conjunta: 8 testes compartilhados, 125 de controles de bolinhas e 498 + 79 scripts na web. Gate 3 permanece pendente; câmera física não foi usada.
