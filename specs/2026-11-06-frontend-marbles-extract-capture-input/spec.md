---
id: 2026-11-06-frontend-marbles-extract-capture-input
title: Separar captura e entrada de bolinhas
summary: Compor recursos de detector, quadros e tradução de pinça/estalo, preservando a fachada e as regras locais/online.
slug: frontend-marbles-extract-capture-input
strategy: sdd
domain: frontend
capability: marbles
objective: extract-capture-input
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/src/marbles/
    - apps/web/src/capture/
related_specs: []
supersedes: []
branch: refactor/marbles-capture-input
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Separar captura e entrada de bolinhas

## Resumo

Compor recursos de detector, quadros e tradução de pinça/estalo, preservando a fachada e as regras locais/online.

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

- **FR-001:** Traduzir pinça e estalo por componente independente de câmera e rede, com os mesmos detectores, mira, vetores e resets de turno/sessão.
- **FR-002:** Adotar posse assíncrona e portão de quadros compartilhados, com descarte e falha explícitos sem callbacks ou detector órfãos.
- **FR-003:** Separar contratos públicos e manter APIs, gestos, física, autoridade de turno e regressões de UI/cleanup.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
