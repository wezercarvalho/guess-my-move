---
id: 2026-11-06-frontend-capture-share-resource-lifecycle
title: Compartilhar ciclo de detectores e quadros de câmera
summary: Fornecer recursos assíncronos e sinalização de quadros por composição, sem regras de jogo nem persistência de mídia.
slug: frontend-capture-share-resource-lifecycle
strategy: sdd
domain: frontend
capability: capture
objective: share-resource-lifecycle
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/
related_specs: []
supersedes: []
branch: refactor/capture-resources
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Compartilhar ciclo de detectores e quadros de câmera

## Resumo

Fornecer recursos assíncronos e sinalização de quadros por composição, sem regras de jogo nem persistência de mídia.

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

- **FR-001:** Recurso assíncrono fecha resultados atrasados após cancelamento, não sobrescreve nova carga e tem estados idle/loading/ready/error explícitos.
- **FR-002:** Quadros nativos são consumidos uma vez, fallback currentTime é preservado e callbacks cancelados não rearmam observação.
- **FR-003:** Utilidades têm uso efetivo nas entregas dos dois controladores, mantendo dados de câmera transitórios e interfaces atuais.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
