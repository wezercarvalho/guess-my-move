---
id: 2026-11-08-frontend-marbles-test-real-lobby
title: Validar lobby de bolinhas com cliente e servidor reais
summary: Cobrir entrada, retomada, abandono e revanche com o cliente de produção conectado ao servidor real.
slug: frontend-marbles-test-real-lobby
strategy: sdd
domain: frontend
capability: marbles
objective: test-real-lobby
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/
    - apps/server/
related_specs: []
supersedes: []
branch: test/marbles-real-client-lobby
constitution_version: 1.0.0
created_at: 2026-11-08
updated_at: 2026-11-08
---

# Validar lobby de bolinhas com cliente e servidor reais

## Resumo

Issue #148: exercitar o cliente de produção contra Nest e Socket.IO reais em porta efêmera, sem navegador ou câmera.

## Problema

Testes de servidor e testes do cliente com transporte simulado não comprovam a integração dos dois lados, principalmente a ordem entre broadcast e confirmação privada.

## Objetivos

- Comprovar identidade, cancelamento e continuidade de uma sala real, sem uma implementação paralela do protocolo.

## Fora de escopo

- Alterar regras, contratos públicos, câmera, dependências, Violão, merge ou deploy.

## Atores

- Mantenedor: executar regressões determinísticas sem câmera.

## Histórias de usuário

### US-001 — Fluxo de sala integrado (P1)

Como mantenedor, quero reproduzir corridas de mensagens com o cliente e o servidor de produção para identificar divergências antes do merge.

**Teste independente:** executar o script oficial de integração do lobby.

**Critérios de aceitação:** dado um servidor em porta efêmera, quando duas instâncias reais do cliente entram, retomam ou pedem revanche, então identidade e sala convergem e respostas atrasadas não ressuscitam participação encerrada.

## Requisitos funcionais

- **FR-001:** Demonstrar create/join com estado recebido antes do ACK, sem publicar sala provisória e com apelidos/papéis corretos após confirmação.
- **FR-002:** Demonstrar ACK perdido, desconexão, retomada da mesma vaga e saída, sem sala fantasma nem aceitação de comandos obsoletos.
- **FR-003:** Concluir partida e revanche bilateral na mesma sala, sem recarregar página nem criar outro transporte.
- **FR-004:** Disponibilizar script oficial, incluído no teste agregado e tipado, com prazos explícitos e descarte de todos os recursos; registrar custo observado e complementaridade.

## Requisitos não funcionais

- **NFR-001:** Não persistir mídia nem registrar credenciais; injeção de falhas somente no harness de testes, sem API especial na produção.
- **NFR-002:** Usar cliente, contratos, gateway, física e serviço reais; acelerar somente os relógios de simulação e expiração nos respectivos cenários, sem fabricar estados.

## Edge cases

ACK perdido ou atrasado, resposta anterior à saída, estado antes da identidade, retomada antes da confirmação, tiro de partida anterior e tentativa após abandono.

## Hipóteses e dependências

Dependências já instaladas. Relógio real para transporte/ACKs; avanço determinístico de tick para partida completa e offset de Date.now injetado antes de criar a aplicação para expiração. A reserva desconhecida pode permanecer pausada durante a janela de reconexão vigente, mas precisa expirar e liberar capacidade.

## Critérios mensuráveis de sucesso

- **SC-001:** FR-001–FR-004 comprovados pela suíte real, sem câmera, com typecheck e regressões existentes aprovados.
