# Checks de qualidade

**Estado atual:** o repositório ainda não tem código nem `package.json`. Esta página define a intenção dos gates; os comandos oficiais passam a ser os scripts de `package.json` assim que a Fase 0 for implementada, e este documento DEVE ser atualizado na mesma mudança.

## Gates previstos (stack proposta: React + Vite + TypeScript + Node.js)

| Gate | Propósito | Quando |
| --- | --- | --- |
| `typecheck` | Tipos explícitos em frontend e backend. | Todo PR com código. |
| `lint` | Estilo e erros estáticos. | Todo PR com código. |
| `test` | Testes unitários e de contrato (motor, árbitro, adaptadores com provedor simulado). | Todo PR com código. |
| `build` | Compilação do frontend e do servidor. | Todo PR com código. |
| Teste de fronteira | Prova que o payload ao adivinhador não contém palavra, dica, sugestão, aliases nem critérios da carta. | Qualquer mudança em motor, adaptador ou prompts. |
| Verificador de specs (`sdd:check`) | Estrutura, estados, links e catálogo de specs. | Quando existir. |

## Regras

- Use somente scripts oficiais de `package.json`; registre comando, data e resultado reais em `validation.md`.
- Testes automatizados usam o provedor simulado (`MockGuesserProvider`). Chamadas reais a provedores pagos ficam em um comando separado e explícito (benchmark), nunca no gate padrão.
- Um benchmark com amostra pequena é evidência exploratória: registre o tamanho da amostra e as limitações; não publique taxa de acerto geral.
- Não declare sucesso de gate não executado; registre `BLOCKED` ou `NOT_APPLICABLE` com justificativa.
- Documentação puramente normativa pode usar revisão estrutural e verificação de links em vez de teste unitário.
