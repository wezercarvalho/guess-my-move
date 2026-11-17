---
id: 2026-11-16-engineering-governance-review-license-evidence
title: Reforçar evidências de licenciamento
summary: Reconhecer metadados legados, preservar avisos upstream e inspecionar os artefatos compilados sem liberar distribuição.
slug: engineering-governance-review-license-evidence
strategy: sdd
domain: engineering
capability: governance
objective: review-license-evidence
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - licenças legadas
    - evidências de licença
    - issue 179
code_paths:
    - scripts/lib/license-inventory.mjs
    - scripts/lib/license-notices/
    - apps/web/scripts/
    - test/security/
    - .github/workflows/
    - docs/development-context/security/
related_specs:
    - 2026-11-16-engineering-governance-audit-licenses
supersedes: []
branch: fix/179-license-evidence
constitution_version: 1.0.0
created_at: 2026-11-16
updated_at: 2026-11-16
---

# Reforçar evidências de licenciamento

## Resumo

Incremento da [issue #179](https://github.com/wezercarvalho/guess-my-move/issues/179): ampliar evidências, resolver falsos desconhecidos e preservar documentos upstream; não confirmar liberação sem direitos verificados.

## Problema

O inventário ignora o campo legado licenses, avisos presentes em README e textos upstream. Os modelos e WASM compilados exigem investigação adicional e a estrutura dos artefatos ainda não foi registrada.

## Objetivos

- Interpretar declarações legadas sem presumir alternativa entre licenças.
- Acrescentar avisos vinculados a versões e verificar sua integridade.
- Produzir evidência dos artefatos compilados e registrar bloqueios de distribuição.

## Fora de escopo

- Aprovar distribuição pública sem confirmação autoritativa, deploy, alterações de detector, gameplay, dependências ou licença MIT.
- Codex, Work, novo serviço pago, alteração administrativa e merge pelo agente.

## Atores

- **Mantenedor:** revisa evidências e decide release.
- **CI:** verifica testes e registra artefatos sem publicá-los.
- **Contribuidor:** preserva avisos e declarações.

## Histórias de usuário

### US-001 — Declarações inequívocas (P1)

Como mantenedor, quero reconhecer uma licença legada única e não aceitar conflitos como confirmação.

**Teste independente:** fixtures de declaração moderna, legada, ambígua e ausente.

### US-002 — Avisos e evidência do artefato (P1)

Como mantenedor, quero preservar avisos originais e conhecer hashes e estrutura dos modelos compilados.

**Teste independente:** logs do build e da inspeção; comparação com hashes dos arquivos fixados.

## Requisitos funcionais

- **FR-001:** Reconhecer campo legado inequívoco e rejeitar ambiguidade; demonstrar com testes.
- **FR-002:** Preservar textos upstream vinculados a versão e blob, sem promover automaticamente a confirmação de todos os avisos; gerar índice para web e servidor.
- **FR-003:** Inspecionar hashes, estrutura de arquivos e avisos dos artefatos sem publicação.
- **FR-004:** Registrar lacunas de liberação, reconciliar spec #177 e apresentar resultados e aceite por merge na mesma PR; manter #179 aberta se as obrigações não estiverem comprovadas.

## Requisitos não funcionais

- **NFR-001:** Preservar código dos jogos, detector, MIT, lockfile e privacidade.
- **NFR-002:** Não tratar inventário ou gate verde como liberação jurídica.

## Edge cases

- Campo legado múltiplo, malformado ou conflito moderno: continuar revisão.
- Texto upstream não prova avisos do binário; verificar blob.
- Metadados .task não interpretados: registrar limite e não liberar.
- Python ausente: build continua disponível; inspeção requer Python 3.

## Hipóteses e dependências

CI Ubuntu com Python 3 e dependências instaladas. A inspeção local dos modelos não foi possível; ausência de licença nos arquivos internos não prova direitos. O incremento não encerra o trabalho de liberação de #179.

## Critérios mensuráveis de sucesso

- **SC-001:** Testes de declarações legadas e conflitos aprovados.
- **SC-002:** Índices com avisos preservados e blobs upstream verificados.
- **SC-003:** Registro de hashes e estrutura dos artefatos no CI.
- **SC-004:** #177 reconciliada, riscos documentados e Gate 3 da entrega parcial preparado na PR.
