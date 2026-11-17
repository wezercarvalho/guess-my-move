---
id: 2026-11-16-engineering-governance-open-source
title: Completar governança open source
summary: Adicionar documentação pública de contribuição, conduta e reporte responsável, integrada aos checks existentes.
slug: engineering-governance-open-source
strategy: sdd
domain: engineering
capability: governance
objective: open-source
status: validated
owners:
    - wezercarvalho
reviewers: []
aliases:
    - governança open source
    - contribuição externa
    - issue 175
code_paths:
    - CONTRIBUTING.md
    - SECURITY.md
    - CODE_OF_CONDUCT.md
    - README.md
    - .github/
    - docs/contributing.md
    - scripts/git-hooks/
    - test/gates/
    - package.json
related_specs:
    - 2026-11-16-engineering-ci-harden-pr-gates
supersedes: []
branch: docs/175-open-source-governance
constitution_version: 1.0.0
created_at: 2026-11-16
updated_at: 2026-11-16
---

# Completar governança open source

## Resumo

Fornecer pontos de entrada reconhecidos pelo GitHub para colaboração, reporte de vulnerabilidades e conduta, preservando os guias, a licença MIT e a autoridade do mantenedor. Vínculo: [issue #175](https://github.com/wezercarvalho/guess-my-move/issues/175).

## Problema

A main já tem MIT, guia detalhado de contribuição, templates e CODEOWNERS, mas não os três documentos convencionais de governança. O canal privado de vulnerabilidades não foi confirmado administrativamente.

## Objetivos

- Tornar as políticas públicas localizáveis e coerentes.
- Orientar reporte responsável sem divulgar dados ou prometer canais/SLA não confirmados.
- Incluir os arquivos nos checks existentes.

## Fora de escopo

- Alterações de código dos jogos, lockfile, licença, regras administrativas, publicação de contatos privados, serviços pagos ou deploy.
- Verificação de licença de ativos externos e habilitação administrativa de reporte privado, que continuam separadas.
- Merge pelo agente, Codex ou Work.

## Atores

- **Contribuidor:** encontra regras e propõe mudanças por fork.
- **Mantenedor:** revisa contribuições, decide merge e verifica canais administrativos.
- **Pessoa que reporta:** encontra instruções de segurança e conduta.

## Histórias de usuário

### US-001 — Colaboração informada (P1)

Como contribuidor, quero localizar regras de participação e segurança antes de enviar uma contribuição.

**Teste independente:** conferir arquivos, links, templates e consistência de políticas.

**Critérios de aceitação:**

1. **Dado** o repositório público, **quando** alguém consulta o README, **então** encontra contribuição, conduta e segurança.
2. **Dado** um relato sensível, **quando** consulta a política, **então** encontra orientação de reporte privado condicionado à disponibilidade, sem detalhes públicos.

### US-002 — Governança verificável (P1)

Como mantenedor, quero que as políticas sejam cobertas pelos checks existentes sem criar novos jobs.

**Teste independente:** verificar seleção, paridade, formatação e execução do CI.

## Requisitos funcionais

- **FR-001:** Publicar os três documentos na raiz, preservar o guia canônico e conectar README e templates.
- **FR-002:** Definir reporte responsável, conduta e responsabilidade de revisão, sem afirmar disponibilidade de canal privado não verificada.
- **FR-003:** Cobrir documentação e templates nos checks e padrões locais/remotos com testes.
- **FR-004:** Consolidar evidências e aceite condicionado ao merge na mesma PR.

## Requisitos não funcionais

- **NFR-001:** Preservar MIT, contratos, jogos e lockfile.
- **NFR-002:** Não alterar configurações administrativas nem autorizar merge pelo agente.
- **NFR-003:** Não adicionar serviços pagos ou jobs.

## Edge cases

- Reporte privado indisponível: solicitar meio reservado sem publicar detalhes sensíveis.
- PR parcial ou check falho: manter issue aberta e não efetivar Gate 3.
- Licenças externas: manter atribuições e pendências existentes.

## Hipóteses e dependências

- GitHub público e mantenedor único declarado. Habilitação de reporte privado e acesso administrativo não foram verificados.
- CI remoto necessário para validar documentação e gates.

## Critérios mensuráveis de sucesso

- **SC-001:** Três arquivos presentes e links visíveis.
- **SC-002:** Política e templates orientam reporte seguro e revisão.
- **SC-003:** Checks e testes de governança aprovados, incluindo paridade.
- **SC-004:** Mesma PR contém evidências e aceite condicionado ao merge.
