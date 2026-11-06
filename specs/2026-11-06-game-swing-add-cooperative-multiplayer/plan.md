# Plano

## Constitution Check — pré-design

PASS: intenção e privacidade explícitas, cooperação confirmada, implementação e gates autorizados. Nenhum custo, deploy ou merge autorizado.

## Design

Extrair módulo de bolinhas e infraestrutura realtime compartilhada. Manter namespace raiz compatível; swing usa /swing. Origem no adaptador Socket.IO, admissão e orçamento por endereço compartilhados. Métricas recebem fontes explícitas dos módulos, sem depender de gateways. Seguir providers singleton e validação estrita com ACK sanitizado; pipes globais de WebSocket podem mudar o erro e ecoar payload, portanto não serão adotados sem necessidade.

Swing usa núcleo puro existente no servidor e no navegador. Cidade é escolhida por catálogo fixo; Aurora usa gerador compartilhado. Inputs numéricos/booleanos validados, passos fixos, snapshots limitados a 10 Hz, sequência/partida monotônicas, pausa/reconexão e objetivos autoritativos. Previsão local e interpolação remota preservam resposta dos controles sem aceitar posição do cliente como autoridade. Contrato fixado antes da integração permite backend e interface em paralelo.

## Alternativas e riscos

Rejeitados relay de posições livres, envio de landmarks, conta obrigatória, banco, Redis e microserviços. Novo transporte não é necessário. O multiplayer depende da PR de HTTP nativo ainda em rascunho, declarada como base; sem integração antecipada à main. Física e custo de cidades grandes exigem teste de carga posterior; não anunciar capacidade medida.

## Fontes oficiais consultadas

- https://docs.nestjs.com/modules
- https://docs.nestjs.com/techniques/performance
- https://docs.nestjs.com/websockets/gateways
- https://docs.nestjs.com/websockets/pipes
- https://docs.nestjs.com/websockets/exception-filters
- https://docs.nestjs.com/observability/sdk

## Constitution Check — pós-design

PASS: módulos separados, nenhuma mídia no transporte, autoridade no servidor, testes de regressão e inspeção de contratos. Sem desvio constitucional; aprovação de implementação expressa na conversa.

## Resultado da revisão de versões e estrutura

A consulta ao registro npm oficial via `yarn npm info @nestjs/core @nestjs/platform-node @nestjs/observe --fields version`, em 2026-11-06, confirmou core/plataforma 12.3.3 e SDK 0.3.24, já adotados pela base. A evolução necessária é estrutural: encapsular domínios, compartilhar proteção e desacoplar métricas. Não há ganho demonstrado em acrescentar CQRS, microserviços, Redis ou providers por conexão. Mantemos singleton, HTTP nativo, serialização Standard Schema nos controllers HTTP e ACK sanitizado no Socket.IO.
