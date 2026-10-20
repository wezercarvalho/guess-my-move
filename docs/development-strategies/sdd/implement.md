# Fase: Implementação

## Propósito

Executar tarefas aprovadas em incrementos test-first, preservando a rastreabilidade e reconciliando descobertas sem substituir silenciosamente a intenção.

## Entradas

`spec.md` em `planned`, Gate 2 aprovado, artefatos vigentes, checkout e configurações reais revisados, alterações preexistentes identificadas.

## Ciclo por incremento

1. **Teste falhando:** escreva o teste e confirme que falha pela razão esperada.
2. **Implementação mínima.**
3. **Teste passando:** primeiro o teste direcionado, depois regressões relacionadas.
4. **Integração** de contratos, módulos, docs e configuração.
5. **Demonstração** do critério de aceitação em um caminho observável.
6. **Refatoração** mantendo os testes verdes.
7. **Registro:** marque a tarefa concluída só quando resultado e dependências estiverem completos.

Promova a spec para `implementing` quando a primeira tarefa começar.

## Protocolo de descoberta

- **Técnica e compatível:** atualize pesquisa/plano/tarefas, implemente e registre a razão.
- **Comportamental ou de escopo:** pare, atualize primeiro `spec.md`, reconcilie e invalide os gates afetados.
- **Violação constitucional:** bloqueie, simplifique ou registre exceção aprovada.
- **Risco de segurança, privacidade ou custo:** interrompa e obtenha autorização explícita.
- **Fora de escopo:** registre como follow-up (issue) sem expandir a mudança.

## Regras de execução

- Leia os arquivos antes de editá-los e use os padrões do repositório.
- Use apenas scripts oficiais de `package.json`; valide incrementalmente.
- Chamadas reais a provedores pagos só em testes marcados e explicitamente autorizados; o padrão é o provedor simulado.
- Nunca registre credenciais nem conteúdo de imagens em logs.
- Registre limitações reais; um comando não executado não é evidência de sucesso.

## Gate de saída

Promova para `validating` quando todas as tarefas estiverem `[x]`, os testes direcionados passaram, as demonstrações foram feitas e spec, plano, tarefas, código e docs convergem.
