---
id: 2026-11-06-frontend-multiplayer-recover-membership
title: Recuperar participação e invalidar respostas antigas
summary: Corrigir recuperação de ACKs perdidos no cooperativo e isolamento de gerações em bolinhas, sem perder a vaga recuperável.
slug: frontend-multiplayer-recover-membership
strategy: sdd
domain: frontend
capability: multiplayer
objective: recover-membership
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/
    - apps/server/
    - packages/swing/
    - contracts/
related_specs: []
supersedes: []
branch: fix/multiplayer-session-recovery
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Recuperar participação e invalidar respostas antigas

## Resumo

Corrigir recuperação de ACKs perdidos no cooperativo e isolamento de gerações em bolinhas, sem perder a vaga recuperável.

## Problema

Issues da revisão pós-merge definem comportamentos reproduzidos e limites de manutenção; executar apenas o incremento explicitado no plano.

## Objetivos

- Entregar resultado observável e rastreável com comportamento anterior preservado fora da correção.

## Fora de escopo

- Merge, deploy, Violão, mídia externa, contas e nova persistência.

## Atores

- Jogador: sessão consistente e controles preservados.
- Mantenedor: componentes e evidências revisáveis.

## Histórias de usuário

### US-001 — Incremento verificável (P1)

Como mantenedor, quero o comportamento descrito pelos requisitos para revisar e integrar sem misturar regras de outros jogos.

**Teste independente:** executar a regressão dirigida do requisito e o agregado adequado.

**Critérios de aceitação:** dado o cenário da issue, quando a operação ou extração acontece, então os requisitos abaixo são demonstráveis e regressões permanecem aprovadas.

## Requisitos funcionais

- **FR-001:** Recuperar o acesso privado da participação já vinculada ao mesmo socket Swing após perda do ACK, sem criar outra sala nem expor credenciais em snapshots.
- **FR-002:** Preservar credenciais em falhas transitórias de retomada, permitir repetição idempotente pelo mesmo socket e limitar retries com cancelamento no descarte.
- **FR-003:** Invalidar comandos e esperas de conexão de bolinhas em desconexão ou destroy, sem escrita tardia no storage ou liberação prematura de tiros.
- **FR-004:** Recuperar ou limpar estado provisório sem identidade após timeout de criação/entrada, com feedback e regressões de sessão/privacidade.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
