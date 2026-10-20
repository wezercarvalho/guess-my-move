# Constituição SDD

**Versão:** 1.0.0

**Status:** Proposta (aguarda ratificação do maintainer)

**Última emenda:** 2026-10-20

Esta constituição governa toda spec que declare `strategy: sdd`. Os termos **DEVE**, **NÃO DEVE**, **DEVERIA** e **PODE** expressam força normativa. Em conflito, a constituição prevalece sobre guias e templates; configurações executáveis e contratos públicos prevalecem quando representam a realidade do sistema, mas a divergência DEVE ser reconciliada na spec.

## I. Intenção antes da implementação

- Mudanças SDD DEVEM seguir Constituição → Especificação → Clarificação → Plano → Tarefas → Implementação → Validação.
- A implementação NÃO DEVE começar antes das aprovações humanas de clarificação e de plano/tarefas.
- `spec.md` DEVE descrever comportamento, escopo, requisitos e sucesso sem depender da solução técnica, salvo restrição técnica que faça parte da necessidade.
- Descobertas que alterem intenção DEVEM atualizar primeiro `spec.md`; artefatos downstream e código convergem depois.

## II. Uma fonte vigente, histórico no Git

- `spec.md` é a única fonte comportamental vigente de uma mudança.
- `clarification.md` DEVE preservar perguntas, respostas e aprovações, sem formar uma especificação concorrente.
- Plano, tarefas, validação e implementação DEVEM referenciar requisitos por IDs estáveis (`FR-001`, `NFR-001`, `SC-001`).
- Conteúdo obsoleto DEVE ser alterado ou removido; o Git preserva o histórico.

## III. Rastreabilidade demonstrável

- Todo requisito funcional DEVE estar ligado a tarefas e a evidências de validação.
- Critérios de aceitação DEVEM ser observáveis e testáveis de forma independente.
- Planos DEVEM registrar decisões, alternativas rejeitadas, riscos e o Constitution Check.
- `validation.md` DEVE registrar comandos, resultados, limitações, demonstração e veredito.

## IV. Implementação test-first e incremental

- Cada tarefa comportamental DEVE seguir: teste falhando → implementação mínima → teste passando → integração → demonstração → refatoração.
- Exceções DEVEM ser justificadas antes da implementação e compensadas por evidência adequada ao risco.
- Mudanças DEVEM ser pequenas, revisáveis e reversíveis.
- Provedores de IA DEVEM ficar atrás de uma interface, com um provedor simulado (mock) para testes e contribuições externas sem custo.

## V. Evidência honesta e proporcional ao risco

- Capacidade anunciada por provedor NÃO DEVE ser tratada como acurácia comprovada. Afirmações de precisão, latência ou custo DEVEM citar medição, fonte oficial com data ou marcação explícita de estimativa.
- Amostras pequenas NÃO DEVEM gerar taxa de acerto geral; resultados DEVEM declarar tamanho de amostra e limitações.
- Regras de segurança e privacidade DEVEM falhar de forma segura e permanecer explícitas em código e testes.

## VI. Fronteira de informação, privacidade e segredos

- A IA adivinhadora NÃO DEVE receber palavra, dica, sugestão, aliases, critérios ou resposta esperada da carta; isso DEVE ter teste automatizado.
- Chaves e credenciais de provedor NÃO DEVEM aparecer no bundle do navegador, em logs ou no repositório.
- Imagens e vídeos da webcam DEVEM ser transitórios: sem persistência nem log de conteúdo por padrão; o usuário DEVE ser informado quando frames forem enviados a um provedor externo.

## VII. Neutralidade e contexto sob demanda

- A estratégia DEVE funcionar independentemente do provedor ou agente de IA; gateways específicos apenas roteiam para fontes canônicas.
- Contexto técnico reutilizável DEVE ficar em [`../../development-context/`](../../development-context/README.md) e ser carregado somente quando aplicável.
- Pessoas e agentes DEVEM verificar a configuração real antes de confiar em exemplos documentais.

## VIII. Clareza, preservação e operação segura

- Textos DEVEM usar UTF-8 e preservar a acentuação correta em português.
- Alterações preexistentes e fora do escopo DEVEM ser preservadas.
- Operações destrutivas, de produção, de segurança ou de custo relevante DEVEM ser explicitamente autorizadas, com mitigação ou rollback documentado.
- A conclusão DEVE comparar o resultado real com spec, constituição, tarefas e gates; sucesso de processo isolado não comprova sucesso da mudança.

## Gates constitucionais

### Gate 1 — Clarificação aprovada

Antes do planejamento técnico: requisitos, fora de escopo, riscos e critérios de sucesso explícitos; ambiguidades críticas resolvidas ou aceitas como hipóteses; checklist de especificação concluída; pessoa ou função autorizada aprovou `spec.md` e `clarification.md`.

### Gate 2 — Plano e tarefas aprovados

Antes da implementação: decisões técnicas registradas; Constitution Check aprovado ou exceções justificadas; tarefas cobrem os requisitos em ordem test-first; gates e validação definidos; aprovação humana de plano, tarefas e exceções.

### Gate 3 — Convergência validada

Antes de `validated`: implementação, spec e artefatos convergem; tarefas e evidências cobrem os requisitos; testes e gates foram executados ou as limitações foram aceitas por pessoa identificável; links e metadados revisados; sem violações constitucionais sem decisão registrada.

## Governança

1. Uma emenda DEVE explicar motivação, impacto, migração e artefatos afetados, e ser aprovada pelo maintainer.
2. Templates e guias incompatíveis DEVEM ser atualizados na mesma mudança.
3. Versionamento semântico: **MAJOR** remove ou redefine princípio ou gate; **MINOR** adiciona obrigação material; **PATCH** esclarece redação.
4. Todo `plan.md` DEVE conter um Constitution Check antes e depois do design; toda exceção aparece em seção de desvios com necessidade, impacto, alternativa mais simples rejeitada e aprovação.
