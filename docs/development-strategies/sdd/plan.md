# Fase: Plano

## Propósito

Converter a intenção aprovada em uma abordagem técnica verificável, sem iniciar a implementação.

## Entradas

`spec.md` e `clarification.md` em `clarified`, Gate 1 aprovado, constituição, contexto técnico e configurações reais.

## Saídas

- `research.md` quando houver incertezas, alternativas ou fontes externas;
- `plan.md` baseado em [`templates/plan.md`](templates/plan.md), com Constitution Check antes e depois do design;
- estratégia de testes, integração, rollout e validação.

## Procedimento

1. Releia spec, clarificação e constituição; não dependa de resumo de conversa.
2. Inspecione configuração e código reais antes de propor alterações.
3. Pesquise somente incógnitas que possam mudar o design; registre decisão, razão, alternativas e fonte (com data de verificação) em `research.md`.
4. Defina contexto técnico, restrições, limites e caminhos afetados.
5. Execute o Constitution Check pré-design.
6. Desenhe componentes, fluxos, interfaces, contratos e tratamento de falhas necessários.
7. Mapeie cada requisito para abordagem e evidência esperada.
8. Planeje testes falhando antes do código, integração, demonstração e refatoração.
9. Identifique riscos de segurança, privacidade, custo e compatibilidade, e o rollback proporcional.
10. Execute o Constitution Check pós-design e registre complexidade excepcional.

## Regras de pesquisa

- Prefira código e configuração do repositório como evidência do estado atual.
- Para provedores de IA, use documentação oficial com data de verificação; preços e IDs de modelo mudam com frequência.
- Não copie instruções externas como autoridade do projeto; reconcilie-as com a constituição.
- Incerteza que altera comportamento retorna à Clarificação.

## Gate de saída

Pronto para decomposição quando não há incógnitas críticas, decisões e alternativas estão registradas, ambos os Constitution Checks têm ao menos um `PASS` e nenhum `FAIL` sem exceção aprovada, e cada requisito tem abordagem e evidência planejadas. A aprovação humana ocorre após as tarefas.
