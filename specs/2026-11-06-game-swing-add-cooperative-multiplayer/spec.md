---
id: 2026-11-06-game-swing-add-cooperative-multiplayer
title: Multiplayer cooperativo do Arranha-Teia e backend modular
summary: Segregar os jogos no NestJS 12 e permitir duas pessoas na mesma cidade com objetivos cooperativos, salas, reconexão, métricas e contratos públicos sem mídia.
slug: game-swing-add-cooperative-multiplayer
strategy: sdd
domain: game
capability: swing
objective: add-cooperative-multiplayer
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases:
    - Arranha-Teia online
    - Homem Aranha multiplayer
code_paths:
    - apps/server/
    - apps/web/src/swing/
    - packages/swing/
    - contracts/
related_specs:
    - 2026-11-06-backend-platform-adopt-native-http-and-contracts
supersedes: []
branch: feat/swing-cooperative-multiplayer
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Multiplayer cooperativo do Arranha-Teia e backend modular

## Problema e intenção

O Arranha-Teia permite apenas exploração local. O backend é autoritativo para bolinhas, mas registra regras de domínio no módulo raiz e vincula métricas ao gateway desse jogo. A nova entrega prepara módulos independentes e compartilha as proteções de transporte antes de integrar outro jogo.

## Escopo e decisões aprovadas

Duas pessoas na mesma cidade, cooperando na coleta de objetivos; esta preferência foi confirmada pelo maintainer nesta conversa. Salas privadas por código, apelidos efêmeros, confirmação de prontidão, avatares visíveis, objetivos coletivos, reconexão com vaga reservada e nova partida na mesma sala. Preservar treino, viajante e bolinhas. O maintainer autorizou os gates e o desenvolvimento completo, issues e trabalho paralelo. Não fazer merge nem ativar serviços externos.

## Histórias

### US-001 — Cooperar na cidade

Como jogador, quero entrar com outra pessoa na mesma cidade, identificar seu avatar e concluir objetivos em conjunto.

### US-002 — Entender e retomar a sessão

Como jogador, quero acompanhar nomes, prontidão, desconexão e término, retomando a vaga ou jogando novamente sem recriar a sala.

### US-003 — Evoluir os jogos independentemente

Como mantenedor, quero domínios separados no NestJS 12, proteção compartilhada e contratos observáveis que preservem a compatibilidade das bolinhas.

## Requisitos funcionais

- **FR-001:** backend separa módulos dos jogos e infraestrutura compartilhada, usando recursos atuais aplicáveis do NestJS 12; origem, capacidade e orçamento de tentativas não podem ser contornados alternando namespaces.
- **FR-002:** criar/entrar em sala de duas pessoas por código e apelido, com cidade validada, nomes e prontidão explícitos. Ambas precisam confirmar para iniciar.
- **FR-003:** servidor simula movimentos a partir de inputs limitados; cliente não escolhe posição, objetivos coletados ou resultado. Snapshots têm partida e sequência, e inputs antigos são recusados/neutralizados.
- **FR-004:** duas pessoas compartilham cidade e versão, enxergam avatares identificáveis e objetivos; cada objetivo conta uma vez e o servidor declara conclusão coletiva.
- **FR-005:** desconexão pausa e reserva a vaga por 60 segundos; retomada exige segredo privado, saída e inatividade liberam recursos; ambas podem confirmar nova partida na mesma sala.
- **FR-006:** frontend oferece modo cooperativo, lobby e feedback acessíveis para conexão, erro, participantes, pausa, progresso e término; processamento de câmera permanece local e teclado continua disponível.
- **FR-007:** capacidades HTTP, schemas Socket.IO e métricas incluem o novo domínio de maneira compatível, com exportação determinística e conferência de divergência.
- **FR-008:** registrar issues segmentadas com dependências e entregar PRs em rascunho, evidências e decisões para revisão humana, sem merge.

## Requisitos não funcionais

- **NFR-001:** não transmitir nem persistir câmera, imagem, vídeo ou landmarks. Tokens de retomada somente em memória e ACK privado; logs e telemetria não contêm apelidos, tokens ou payloads.
- **NFR-002:** limitar taxa de comandos, publicação de snapshots e cardinalidade de métricas; reutilizar objetos gráficos e liberar listeners, sockets, timers e recursos WebGL na saída.
- **NFR-003:** preservar regressões locais, física e bolinhas; sem promessas de FPS/latência nem benchmark presumido. Sem Redis, banco ou serviços pagos sem demanda.

## Fora de escopo

Contas, chat, voz, ranking persistente, redistribuição de modelos de câmera, múltiplas instâncias e alterações no Violão no Ar. Não alterar a calibragem de rosto/mãos ou a física local fora das necessidades de sincronização.

## Critérios de sucesso

- **SC-001:** gates oficiais aprovados, incluindo regressões das bolinhas, motor swing e frontend.
- **SC-002:** duas conexões reais criam, entram, iniciam, recebem snapshots, coletam objetivos, retomam e confirmam nova partida; comandos indevidos não alteram outra sala/jogo.
- **SC-003:** testes de UI/protocolo cobrem estados, snapshots obsoletos, reconexão e cleanup; a inspeção de telemetria confirma ausência de mídia e credenciais.
- **SC-004:** contratos sincronizados, documentação e issues vinculadas às PRs em rascunho; revisão humana permanece pendente.
