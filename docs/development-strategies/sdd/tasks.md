# Fase: Tarefas

## Propósito

Decompor o plano em incrementos executáveis, rastreáveis e test-first, analisar a consistência e obter autorização humana para implementar (Gate 2).

## Saídas

- `tasks.md` baseado em [`templates/tasks.md`](templates/tasks.md);
- matriz de cobertura requisito → tarefa → evidência;
- análise de consistência e Gate 2 registrados; status `planned`.

## Formato

```text
- [ ] T001 [P?] [US-001] [FR-001, NFR-001] ação objetiva em caminho/esperado
```

IDs sequenciais e imutáveis; `[P]` somente quando a tarefa pode rodar em paralelo sem disputar arquivo, recurso ou pré-condição.

## Ordem test-first obrigatória

Para cada incremento comportamental: (1) teste falhando, (2) implementação mínima, (3) teste passando, (4) integração, (5) demonstração, (6) refatoração. Documentação puramente normativa pode usar revisão estrutural e demonstração manual; a exceção deve estar explícita no plano.

## Procedimento

1. Agrupe por setup, fundações, histórias e encerramento.
2. Garanta que cada história P1 seja implementável e demonstrável de forma independente.
3. Referencie cada FR em ao menos uma linha formal de tarefa; menções narrativas não contam.
4. Marque dependências, pontos paralelos e riscos operacionais (custo de API, privacidade).
5. Inclua atualização de docs e evidências no mesmo incremento.
6. Execute a análise de consistência entre spec, clarificação, pesquisa, plano e tarefas; registre revisor, data ISO e lacunas.
7. Resolva lacunas e violações constitucionais e solicite aprovação do Gate 2.

## Gate 2

Registre status, aprovador, data, artefatos, referência e exceções ("nenhuma" quando não houver). A spec só alcança `planned` quando todos os FRs têm cobertura, testes precedem implementações e a análise não tem bloqueadores.
