---
id: 2026-11-06-backend-platform-adopt-native-http-and-contracts
title: HTTP nativo, observabilidade e contratos públicos do backend
summary: Migrar para o HTTP nativo do Nest, adicionar métricas protegidas e SDK Observe opcional e exportar contratos HTTP OpenAPI e eventos Socket.IO sem dados privados.
slug: backend-platform-adopt-native-http-and-contracts
strategy: sdd
domain: backend
capability: platform
objective: adopt-native-http-and-contracts
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases:
    - NodeAdapter
    - OpenAPI
    - observabilidade
    - Nest Observe
code_paths:
    - apps/server/
    - contracts/
    - package.json
    - yarn.lock
related_specs:
    - 2026-10-31-game-marbles-add-online-multiplayer
supersedes: []
branch: feat/native-http-observability
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# HTTP nativo, observabilidade e contratos públicos do backend

## Resumo

Migrar o backend para o adaptador HTTP nativo do Nest, integrar observabilidade configurável e fornecer contratos HTTP OpenAPI e de eventos Socket.IO consumíveis por outros frontends. Preservar as proteções de salas, regras e privacidade já integradas.

## Problema

O backend ainda depende do adaptador Express e sua API HTTP não tem contrato exportável. Contadores estão ligados ao gateway; a operação não dispõe de uma consulta autenticada nem de integração com o SDK de observabilidade do Nest. Os comandos de jogo são Socket.IO e não podem ser apresentados como operações REST.

## Objetivos

- Usar o adaptador nativo em execução e testes.
- Disponibilizar métricas locais com controle de acesso e integração opcional com o SDK oficial, desativada por padrão.
- Publicar contratos determinísticos, com verificação de divergência no CI e instruções de consumo por outros frontends.

## Fora de escopo

- Ativar serviços externos, criar conta, fornecer credenciais, contratar planos ou publicar infraestrutura.
- Alterar física, câmera, persistência, autenticação de jogadores ou adicionar uma API REST paralela para salas.
- Prometer desempenho ou fluidez sem medição do aplicativo.

## Atores

- Jogador: mantém o multiplayer existente.
- Integrador: consulta capacidades e consome contratos de HTTP e eventos.
- Operador: consulta métricas autenticadas e decide explicitamente se habilita telemetria externa.

## Histórias de usuário

### US-001 — Evoluir a plataforma sem regressão

Como mantenedor, quero usar o HTTP nativo e manter origem, limites, reconexão e revanche. Teste independente: suíte real Socket.IO sobre o mesmo adaptador de produção.

### US-002 — Integrar e observar

Como integrador e operador, quero contratos verificáveis e métricas seguras. Teste independente: exportar contratos sem iniciar uma porta pública, consultar capacidades e verificar que métricas exigem credencial.

## Requisitos funcionais

- **FR-001:** execução e testes usam NodeAdapter explicitamente; remover a dependência direta do adaptador Express e preservar headers, health, shutdown, origem, limites e multiplayer.
- **FR-002:** observabilidade local registra métricas agregadas e durações por operação conhecida, sem payloads nem identificadores de jogadores. Endpoint de métricas exige token e fica desativado sem configuração.
- **FR-003:** integrar o SDK oficial do Nest Observe de forma desativada por padrão, sem qualquer envio quando desativado. Ativação exige opção explícita e credenciais validadas; não capturar headers, corpo, parâmetros, usuários, fonte de erros ou logs brutos. Testar com coletor simulado local, sem acesso ao serviço real.
- **FR-004:** API HTTP publica capacidades e possui documento OpenAPI exportável com operações reais, respostas e segurança de métricas. A documentação de desenvolvimento pode ser habilitada explicitamente, sem expor segredos.
- **FR-005:** contrato dos eventos Socket.IO é exportado a partir dos schemas existentes, distinguindo mensagens, respostas, erros e credencial privada de retomada. Outro frontend não depende de código React para consumir os contratos.
- **FR-006:** exportação e conferência de contratos são scripts oficiais; o CI detecta divergência entre código e arquivos versionados e executa o gate quando esses arquivos mudam.

## Requisitos não funcionais

- **NFR-001:** câmera, mídia e landmarks permanecem locais. Telemetria não contém apelidos, tokens, IPs ou conteúdo arbitrário do cliente. Métricas usam conjunto limitado de operações.
- **NFR-002:** dependências fixadas, famílias Nest compatíveis e auditoria aprovada. A migração não depende de credenciais externas ou serviço pago para desenvolvimento e CI.

## Edge cases

Origem ausente/indevida, capacidade excedida, proxy forjado, token de métricas ausente/incorreto, telemetria habilitada sem credenciais, erros com texto sensível e documentos gerados fora de sincronia devem ter resultados verificáveis e seguros.

## Hipóteses e dependências

O SDK Nest Observe é voltado a um serviço hospedado; preparar integração não configura esse serviço. A observabilidade local funciona independentemente dele. OpenAPI cobre HTTP; o protocolo Socket.IO tem contrato próprio. Recursos adicionais sem necessidade atual, como filas, outbox e locks distribuídos, ficam fora desta entrega.

## Critérios mensuráveis de sucesso

- **SC-001:** suíte de backend e gates completos aprovados no adaptador nativo, com regressões das salas.
- **SC-002:** testes provam ausência de envio quando desativado e ausência de dados sensíveis no coletor simulado, além de proteção do endpoint local.
- **SC-003:** exportação seguida de conferência passa; alteração deliberada de contrato é detectada; exemplos de HTTP e de eventos documentados.
