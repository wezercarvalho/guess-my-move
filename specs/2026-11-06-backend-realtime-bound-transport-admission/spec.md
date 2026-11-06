---
id: 2026-11-06-backend-realtime-bound-transport-admission
title: Limitar transportes antes da entrada nos namespaces
summary: Reservar capacidade global e por endereço no handshake Engine.IO, liberar em falhas e encerramentos e distinguir transportes de sessões nas métricas.
slug: backend-realtime-bound-transport-admission
strategy: sdd
domain: backend
capability: realtime
objective: bound-transport-admission
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases:
    - Issue 124
code_paths:
    - apps/server/
    - contracts/
related_specs:
    - 2026-11-06-game-swing-add-cooperative-multiplayer
supersedes: []
branch: fix/realtime-transport-admission
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Limitar transportes antes da entrada nos namespaces

## Resumo

O teto deve proteger recursos desde o handshake, mesmo sem participação em um jogo. A sessão de namespace mantém seu orçamento adicional, sem duplicar a contagem de transporte quando dois namespaces compartilham o mesmo WebSocket.

## Problema

A issue #124 reproduziu oito transportes abertos com MAX_CONNECTIONS=1 e MAX_CONNECTIONS_PER_IP=1, enquanto o contador de sessões permanecia zero. A origem permitida não autentica clientes não-browser.

## Objetivos

- Limitar recursos desde a admissão e permitir nova conexão após liberação.
- Explicitar a diferença entre transporte e sessão de namespace.

## Fora de escopo

- Contas, autenticação nova, Redis, proteção distribuída, deploy e mudanças de regras dos jogos.
- Corrigir recuperação dos clientes (#125–#127), refatorar controladores ou aprovar Gate 3 de outras specs.

## Atores

- Operador: precisa de limites e métricas com significado claro.
- Jogador: precisa reconectar sem reservas órfãs.

## Histórias de usuário

### US-001 — Preservar capacidade (P1)

Como operador, quero que transportes ainda sem namespace consumam orçamento para que não escapem do teto.

**Teste independente:** abrir apenas Engine.IO e tentar uma segunda conexão sob teto 1.

**Critérios de aceitação:** dado um transporte admitido, quando outro ultrapassa o teto global ou por IP, então a admissão recusa antes da criação de outra sessão de jogo. Após fechar o primeiro, uma nova tentativa funciona.

## Requisitos funcionais

- **FR-001:** reservar capacidade de transporte global e por endereço antes de autorizar o handshake, incluindo clientes sem CONNECT de namespace; rejeitar excesso de forma segura.
- **FR-002:** liberar reserva exatamente uma vez ao encerrar o transporte, falhar o handshake, atingir timeout pré-namespace ou fechar a aplicação; nenhuma reserva em origem recusada.
- **FR-003:** compartilhar uma reserva entre namespaces do mesmo transporte e preservar o teto adicional agregado de sessões e as políticas de proxy/origem já existentes.
- **FR-004:** métricas e contrato HTTP distinguem transportes ativos de sessões de namespace; documentar limites e timeout sem expor endereços ou identificadores.

## Requisitos não funcionais

- **NFR-001:** não persistir nem transmitir mídia, IPs, credenciais ou tokens em métricas/logs; telemetria segue desligada por padrão.
- **NFR-002:** manter admissão síncrona e limitada, sem serviços externos, e preservar protocolos/regras dos dois jogos.

## Edge cases

- Dois handshakes concorrentes antes da criação do socket Engine.IO; falha de upgrade após autorização; fechamento duplicado; namespace recusado com outro namespace conectado; cliente que nunca envia CONNECT.

## Hipóteses e dependências

- WebSocket é o único transporte habilitado; o ciclo TCP acompanha o ciclo do WebSocket. Se polling for habilitado no futuro, este vínculo deverá ser revisado.
- O timeout pré-namespace Socket.IO atual de 45 segundos é preservado e documentado. A política é por processo, sem proteção a TCP anterior ao handshake HTTP.

## Critérios mensuráveis de sucesso

- **SC-001:** testes reais demonstram teto global e por IP antes de CONNECT, recuperação de capacidade e multiplexação sem duplicação.
- **SC-002:** contratos conferem e regressões dos dois jogos e privacidade passam; métricas novas são agregadas.
