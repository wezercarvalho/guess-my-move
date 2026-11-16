---
id: 2026-11-16-engineering-runtime-apply-security-patch
title: Aplicar correção de segurança do runtime Node
summary: Adotar Node 26.13.1 e validar a compatibilidade do monorepo sem alterar o comportamento dos jogos.
slug: engineering-runtime-apply-security-patch
strategy: sdd
domain: engineering
capability: runtime
objective: apply-security-patch
status: validated
owners:
    - wezercarvalho
reviewers: []
aliases:
    - Node 26.13.1
    - issue 132
    - atualização de segurança
code_paths:
    - .node-version
    - package.json
    - README.md
    - docs/development-context/
    - test/gates/hook-and-gate.node-test.mjs
related_specs:
    - 2026-11-06-engineering-runtime-monitor-security-releases
    - 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26
supersedes: []
branch: fix/132-node-security-26-13-1
constitution_version: 1.0.0
created_at: 2026-11-16
updated_at: 2026-11-16
---

# Aplicar correção de segurança do runtime Node

## Resumo

Adotar a correção publicada para Node 26 e demonstrar a compatibilidade do monorepo, mantendo a proteção e o comportamento existentes. A entrega corresponde à parte de atualização e validação da [issue #132](https://github.com/wezercarvalho/guess-my-move/issues/132).

## Problema

Antes da PR #169, a main fixava 26.12.1. O monitor diário de runtime reprovou em 15/11/2026 por identificar 26.13.1 como release de segurança posterior. O [boletim oficial de novembro](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) motiva a atualização. Um resultado positivo na auditoria npm não cobre o binário Node.

## Objetivos

- Adotar a versão corretiva 26.13.1 de forma consistente no ambiente de desenvolvimento e no CI.
- Demonstrar regressões e contratos no novo runtime e registrar evidências rastreáveis.
- Tornar a validação dos contratos parte permanente do gate de código e do modo completo local, sem alterar contratos.

## Fora de escopo

- Atualizações de outras dependências, alterações de regras, arquitetura, contratos públicos, workflows ou política de auditoria.
- Merge, deploy, mudanças administrativas e validação de ambiente de produção.
- Acionar Codex ou ChatGPT Work.

## Atores

- **Mantenedor:** revisa a alteração e as evidências, autoriza integração.
- **Contribuidor:** utiliza requisitos reproduzíveis e preserva o comportamento existente.
- **Jogador:** mantém as experiências local e online, sem alteração intencional de comportamento.

## Histórias de usuário

### US-001 — Runtime corrigido (P1)

Como mantenedor, quero que a versão suportada incorpore o patch publicado para reduzir a exposição ao runtime desatualizado.

**Teste independente:** conferir o pin, a faixa suportada e a execução da auditoria do runtime no novo ambiente.

**Critérios de aceitação:**

1. **Dado** o patch 26.13.1 publicado, **quando** a configuração é lida, **então** desenvolvimento e CI indicam essa versão como pin e não aceitam versões anteriores como mínimo declarado.
2. **Dado** um ambiente com o novo pin, **quando** a auditoria é executada, **então** o resultado real é registrado e qualquer correção posterior ou falha bloqueia o aceite.

### US-002 — Compatibilidade demonstrada (P1)

Como mantenedor, quero evidências de regressão e privacidade antes de integrar a atualização.

**Teste independente:** executar os gates existentes, inclusive contratos e cenários de sessão multiplayer, e conferir o diff.

**Critérios de aceitação:**

1. **Dado** o novo runtime, **quando** o monorepo é instalado e testado, **então** os checks aplicáveis e o servidor compilado devem passar, sem mudança de dependências ou contratos.
2. **Dado** o resultado dos checks, **quando** a entrega é revisada, **então** as evidências e pendências são rastreáveis e o aceite humano permanece separado.

## Requisitos funcionais

- **FR-001:** A configuração e a documentação DEVEM declarar Node 26.13.1 como versão pinada e mínima na linha 26.
- **FR-002:** A aplicação DEVE preservar o comportamento existente, comprovado pelos gates de código, smoke compilado e cenários de sessão dos jogos online.
- **FR-003:** Os checks de contratos, governança e auditorias de dependências/runtime DEVEM ser executados no ambiente atualizado, sem enfraquecer critérios.
- **FR-004:** A entrega DEVE registrar resultados, limitações, aceite humano e vínculo com a issue #132 em artefatos rastreáveis.
- **FR-005:** O gate de código completo DEVE executar a verificação oficial dos contratos, bloquear divergências e preservar o modo estático rápido.

## Requisitos não funcionais

- **NFR-001:** Não alterar a arquitetura, regras dos jogos, fronteira de informação, tratamento de mídia, segredos ou contratos públicos; conferir diff e regressões.
- **NFR-002:** Preservar a política de segurança, lockfile e workflows; não realizar merge, deploy ou contornar checks.
- **NFR-003:** Não acionar Codex ou Work nem autorizar operações de custo incerto sem consulta ao mantenedor.

## Edge cases

- Release corretiva posterior: o auditor deve manter o comportamento de bloqueio; não ignorar a falha.
- Falha de rede, disponibilização do binário ou instalação: registrar bloqueio sem inventar resultado.
- PR em draft: os jobs completos ficam pendentes até a promoção autorizada para revisão.
- Contrato divergente ou ausente: o check deve falhar, sem exportar ou sobrescrever automaticamente.

## Hipóteses e dependências

- Artefatos oficiais do Node, registry e recursos do CI disponíveis para a validação futura.
- A exposição direta às falhas depende do uso efetivo de APIs do Node e da infraestrutura; severidade não demonstra explorabilidade.
- O aceite do ambiente implantado é separado; nenhum ambiente de produção foi auditado ou alterado.

## Critérios mensuráveis de sucesso

- **SC-001:** Pin, faixa e referências normativas consistentes na linha 26; auditoria do runtime aprovada no ambiente atualizado.
- **SC-002:** Checks de código, contratos, governança, dependências e cenários multiplayer comprovados, com resultados e limitações documentados.
- **SC-003:** Diff restrito ao escopo, PR inicialmente em draft e nenhum merge/deploy pelo agente.
- **SC-004:** Teste de regressão estrutural comprova a inclusão de `yarn contracts:check` em `check:all`; o job existente executa a verificação e uma falha impede o gate de código.
