# Fase: Validação e convergência

## Propósito

Demonstrar, com evidências rastreáveis, que intenção, constituição e implementação convergem (Gate 3).

## Saídas

`validation.md` completo ([template](templates/validation.md)), matriz requisito → tarefa → evidência, limitações e riscos residuais explícitos, e veredito do Gate 3.

## Procedimento

1. Releia a solicitação original, a spec, a constituição e os critérios de sucesso.
2. Confirme que as tarefas estão completas e que cada FR aparece em uma linha formal de tarefa.
3. Execute testes direcionados e depois typecheck, lint, build e gates proporcionais ao risco.
4. Para cada comando, registre o comando exato, data, resultado (`PASS`, `FAIL`, `BLOCKED`, `NOT_APPLICABLE`) e a evidência.
5. Registre cada FR exatamente uma vez na seção `## Evidências por requisito`.
6. Demonstre as histórias e critérios de aceitação; saída zero de comando não substitui demonstração comportamental.
7. Verifique privacidade (nenhum frame persistido ou logado), segredos (nenhuma chave no bundle) e a fronteira de informação (a carta não vaza ao adivinhador).
8. Para resultados de benchmark: declare o tamanho da amostra, o protocolo e as limitações; não extrapole para uma taxa geral.
9. Execute o Constitution Check final e liste desvios ou riscos aceitos.
10. Percorra o loop de convergência até não haver divergências.

## Loop de convergência

Para cada lacuna: classifique (implementação, teste, documento, requisito ou plano), retorne ao artefato mais antigo afetado, invalide a aprovação se a intenção aprovada mudou, reabra tarefas, reexecute as evidências afetadas.

## Gate 3

Veredito: **aprovado**, **aprovado com risco aceito** (somente risco não bloqueador, com responsável e justificativa), **rejeitado** ou **bloqueado**. Para `validated`, o veredito deve ser `aprovado` ou `aprovado com risco aceito`, sem `TODO`/`TBD`, com seção `Estado` completa, aprovador, data, commit e escopo.

### Aceite pelo merge da PR de implementação

O maintainer autorizou em 2026-11-16 o merge na `main` como ato de aprovação final do Gate 3. Use, por padrão, a mesma PR para implementação e convergência. Antes do merge, reúna evidências reais, conclua as tarefas, declare o veredito proposto, o escopo, os riscos residuais não bloqueadores e o maintainer responsável em `validation.md` e na descrição da PR. Prepare a transição para `validated` como condicionada ao merge pelo maintainer; registre a data da declaração e o commit efetivamente testado, sem inventar um hash ou data de merge futuros. A identidade, o momento e o commit de integração ficam comprovados pelo histórico da PR. Aguarde os checks aplicáveis do head final. Se houver bloqueio, mantenha o estado pendente e use `Refs`, não `Closes`. O aceite não autoriza o agente a fazer merge. Não abra uma segunda PR apenas para registrar o aceite já efetivado.
