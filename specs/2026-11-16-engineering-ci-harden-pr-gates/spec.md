---
id: 2026-11-16-engineering-ci-harden-pr-gates
title: Reforçar a integridade dos gates de pull request
summary: Fixar Actions, reduzir exposição de credenciais, ampliar escopos e documentar a revisão de contribuições externas.
slug: engineering-ci-harden-pr-gates
strategy: sdd
domain: engineering
capability: ci
objective: harden-pr-gates
status: validated
owners:
    - wezercarvalho
reviewers: []
aliases:
    - segurança do CI
    - GitHub Actions
    - issue 172
code_paths:
    - .github/
    - scripts/git-hooks/
    - test/gates/
    - test/security/
    - docs/development-context/delivery/
    - docs/contributing.md
related_specs:
    - 2026-11-16-engineering-runtime-apply-security-patch
supersedes: []
branch: fix/172-ci-hardening
constitution_version: 1.0.0
created_at: 2026-11-16
updated_at: 2026-11-16
---

# Reforçar a integridade dos gates de pull request

## Resumo

Receber contribuições externas sem conceder controle sobre a main, reduzindo riscos de cadeia de suprimentos e falhas de seleção dos checks. Entrega vinculada à [issue #172](https://github.com/wezercarvalho/guess-my-move/issues/172).

## Problema

O ruleset exige PR e um check obrigatório. Actions externas usam tags móveis, o checkout persiste credenciais por padrão, arquivos relevantes à configuração do tooling não são todos selecionados e o consolidador usa o checkout da proposta. O workflow continua sendo um artefato sujeito a propostas de alteração; a revisão do mantenedor é indispensável.

## Objetivos

- Reduzir exposição de credenciais e referências mutáveis nas Actions.
- Preservar gates existentes, ampliar o alcance da seleção e melhorar a integridade da consolidação.
- Identificar responsáveis e documentar revisão, limitações e controles administrativos.

## Fora de escopo

- Merge pelo agente, alterações administrativas, novos colaboradores, serviços pagos, deploy e alteração dos jogos.
- Executar código externo em contextos privilegiados ou com segredos de produção.
- Acionar Codex ou Work.

## Atores

- **Mantenedor:** revisa contribuições e decide o merge.
- **Contribuidor:** propõe alterações por fork, sem acesso de escrita.
- **CI:** executa verificações com privilégio mínimo.

## Histórias de usuário

### US-001 — Execução controlada (P1)

Como mantenedor, quero depender de versões fixas e reduzir exposição de credenciais sem conceder permissões extras para PRs externas.

**Teste independente:** conferir a política dos workflows e executar testes estruturais.

**Critérios de aceitação:**

1. **Dado** um workflow versionado, **quando** inspecionado, **então** Actions externas usam SHA completo, checkout não persiste credenciais, jobs têm tempo limitado e permissões somente leitura.
2. **Dado** as auditorias periódicas, **quando** disparadas, **então** o job executa somente na main.

### US-002 — Cobertura e revisão (P1)

Como mantenedor, quero que o gate selecione as verificações necessárias e que arquivos sensíveis recebam revisão cuidadosa.

**Teste independente:** seleção por path, testes do hook, política de revisão e CI.

**Critérios de aceitação:**

1. **Dado** alteração de configuração relevante ou manifesto de workspace, **quando** classificada, **então** CI e hook selecionam os escopos pertinentes.
2. **Dado** uma PR pronta, **quando** executado o gate, **então** compara-se a base ao merge testado, falhas de diff não são ignoradas e o consolidador vem da base.
3. **Dado** contribuição externa, **quando** revisada, **então** arquivos sensíveis identificam o responsável e os limites da proteção estão documentados.

## Requisitos funcionais

- **FR-001:** Workflows DEVEM fixar Actions externas em commits completos de releases oficiais e não persistir credenciais do checkout.
- **FR-002:** Workflows DEVEM preservar permissões mínimas, runners hospedados, tempos limitados, auditorias restritas à main e ausência de contextos privilegiados de PR.
- **FR-003:** CI e hook DEVEM selecionar caminhos relevantes de instalação, governança e código, preservando paridade.
- **FR-004:** Detecção DEVE comparar base e merge testado, preservar nomes de paths e falhar em erro; o gate final DEVE usar o consolidador da base.
- **FR-005:** Revisão DEVE identificar responsáveis via CODEOWNERS e documentar controles administrativos e limitações do modelo de mantenedor único.

## Requisitos não funcionais

- **NFR-001:** Preservar dependências, lockfile, contratos, jogos, nome do check obrigatório e modo local estático.
- **NFR-002:** Não adicionar segredos, executar código externo com privilégios, alterar configurações administrativas ou realizar merge pelo agente.
- **NFR-003:** Preservar escopos, rascunhos e jobs existentes, sem serviços pagos adicionais.

## Edge cases

- Diff falha: impedir consolidação positiva; hook mantém verificação de todos os escopos se intervalo desconhecido.
- Renome ou nome incomum: tratar nomes como dados e considerar os dois lados da alteração.
- Mudança do próprio workflow: revisão humana indispensável; a proteção não é independente do YAML.
- PR draft: checks aguardam promoção para revisão.

## Hipóteses e dependências

- Repositório pessoal público com um mantenedor declarado; lista completa de colaboradores e configurações administrativas não verificadas.
- CI deve confirmar compatibilidade com os commits oficiais fixados.

## Critérios mensuráveis de sucesso

- **SC-001:** Três workflows com pins oficiais, credenciais não persistidas e testes de política aprovados.
- **SC-002:** Testes de seleção, nomes de paths, manifests e consolidador da base aprovados; required check preservado.
- **SC-003:** CODEOWNERS, guia de revisão e controles administrativos não verificados documentados.
- **SC-004:** CI aplicável aprovado e aceite humano registrado.
