# Fase: Clarificação

## Propósito

Resolver ambiguidades de alto impacto antes do design técnico e obter aprovação humana da intenção vigente (Gate 1).

## Entradas

`spec.md` em `specified`, checklist concluída, constituição vigente e dúvidas das pessoas interessadas.

## Saídas

- `clarification.md` baseado em [`templates/clarification.md`](templates/clarification.md);
- `spec.md` atualizado com cada decisão comportamental;
- Gate 1 registrado e status `clarified`.

## Priorização das perguntas

Pergunte primeiro o que pode alterar escopo, contrato, privacidade, segurança, custo, arquitetura ou critério de sucesso. Depois, operação, UX e preferências. Não bloqueie por detalhe de baixo risco: registre uma hipótese explícita e como validá-la.

Faça perguntas curtas, uma decisão por vez, com opções e recomendação quando houver base.

## Procedimento

1. Examine spec, checklist, constituição e contratos relacionados.
2. Liste ambiguidades e classifique impacto e urgência.
3. Pergunte somente o que não pode ser inferido com segurança.
4. Para cada resposta, registre ID, data, pergunta, decisão, razão, impacto e seções afetadas.
5. Atualize imediatamente `spec.md`; `clarification.md` é log auditável, não uma segunda fonte vigente.
6. Revise a consistência entre objetivos, fora de escopo, histórias, requisitos e sucesso.
7. Liste as hipóteses remanescentes e confirme que nenhuma é crítica.
8. Solicite aprovação explícita de `spec.md` e `clarification.md` e registre aprovador, data ISO, artefatos e observações.
9. Promova o status para `clarified`.

## Gate 1

Válido quando o aprovador é pessoa ou função autorizada, a intenção aprovada está refletida em `spec.md`, riscos aceitos e hipóteses estão explícitos e as observações registram condições reais ou "nenhuma". Se o escopo mudar depois, invalide as aprovações afetadas e retorne ao primeiro estado necessário.
