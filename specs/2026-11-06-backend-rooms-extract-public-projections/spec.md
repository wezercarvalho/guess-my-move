---
id: 2026-11-06-backend-rooms-extract-public-projections
title: Separar projeções e objetivos dos serviços de sala
summary: Extrair serialização pura de bolinhas, geração determinística de objetivos Swing e registrar a decisão sobre composição dos gateways.
slug: backend-rooms-extract-public-projections
strategy: sdd
domain: backend
capability: rooms
objective: extract-public-projections
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/server/
    - docs/
related_specs: []
supersedes: []
branch: refactor/backend-public-projections
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Separar projeções e objetivos dos serviços de sala

## Resumo

Extrair serialização pura de bolinhas, geração determinística de objetivos Swing e registrar a decisão sobre composição dos gateways.

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

- **FR-001:** Projetar jogadores e partida de bolinhas por funções puras com campos públicos explícitos, sem tokens e sem preparar a sessão ao serializar.
- **FR-002:** Extrair a seleção de objetivos cooperativos para componente determinístico e limitado, preservando posições e alcançabilidade nas quatro cidades.
- **FR-003:** Entregar decisão arquitetural sobre políticas de gateway, preservando diferenças dos protocolos e admissão compartilhada, sem impor uma superclasse genérica.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
