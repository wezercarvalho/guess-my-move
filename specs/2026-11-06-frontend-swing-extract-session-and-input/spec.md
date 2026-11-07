---
id: 2026-11-06-frontend-swing-extract-session-and-input
title: Separar sessão online e entrada do Arranha-Teia
summary: Reduzir o controlador por composição de sincronização online, recursos de captura e derivação de sinais, preservando gestos e calibração.
slug: frontend-swing-extract-session-and-input
strategy: sdd
domain: frontend
capability: swing
objective: extract-session-and-input
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/src/swing/
    - apps/web/src/capture/
related_specs: []
supersedes: []
branch: refactor/swing-session-input
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Separar sessão online e entrada do Arranha-Teia

## Resumo

Reduzir o controlador por composição de sincronização online, recursos de captura e derivação de sinais, preservando gestos e calibração.

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

- **FR-001:** Adaptador de sessão online assume cadência de intents, reconciliação e previsão limitada, descartando deltas ao pausar e trocar partida e reaplicando estado após remontagem.
- **FR-002:** Adotar posse assíncrona de detectores e portão de quadros compartilhados sem mudar calibração, limiares ou processamento local.
- **FR-003:** Separar contratos públicos e derivação de sinais das mãos, preservando APIs, espelhamento e regressões de gestos/teclado/cleanup.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
