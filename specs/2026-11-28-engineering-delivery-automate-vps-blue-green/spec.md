---
id: 2026-11-28-engineering-delivery-automate-vps-blue-green
title: Automatizar o deploy na VPS com blue-green e drenagem de salas
summary: Atualizar o piloto após o CI, mantendo partidas e convites na versão em que a sala foi criada.
slug: engineering-delivery-automate-vps-blue-green
strategy: sdd
domain: engineering
capability: delivery
objective: automate-vps-blue-green
status: clarified
owners:
    - wezercarvalho
reviewers: []
aliases:
    - deploy na VPS
    - blue-green
    - drenagem de salas
    - issue 181
code_paths:
    - .github/workflows/
    - apps/server/
    - apps/web/
related_specs:
    - 2026-10-31-game-marbles-add-online-multiplayer
    - 2026-11-06-game-swing-add-cooperative-multiplayer
    - 2026-11-16-engineering-governance-review-license-evidence
supersedes: []
branch: feat/181-vps-blue-green
constitution_version: 1.0.0
created_at: 2026-11-28
updated_at: 2026-11-28
---

# Automatizar o deploy na VPS com blue-green e drenagem de salas

## Resumo

A [issue #181](https://github.com/wezercarvalho/guess-my-move/issues/181) define a atualização automática do piloto público. Novas salas usam a versão ativa e salas existentes continuam no servidor que mantém seu estado. A volta ao lobby aplica a atualização antes de criar outra sala.

## Problema

A atualização manual recria a única instância do servidor. As salas de Bolinhas e Arranha-Teia ficam em memória e são encerradas pela recriação. Uma página aberta também mantém os arquivos da versão que carregou.

## Objetivos

- Publicar um par versionado de frontend e backend após CI e verificação privada da candidata.
- Preservar partidas, convites, reconexões e arquivos de frontend durante a transição.
- Expor o estado da drenagem e permitir reverter o destino das novas salas.
- Demonstrar que a VPS comporta a sobreposição antes de habilitar o deploy.

## Fora de escopo

- Migração de partidas entre processos, persistência de salas ou recuperação de estado após perda do próprio processo.
- Distribuição pública ampliada de imagens ou artefatos e mudanças na política de acesso do piloto.
- Rollout canary, mudança de hospedagem e mudanças nas regras dos jogos.

## Atores

- **Jogador:** joga, entra via convite, reconecta e cria salas pelo lobby.
- **Mantenedor:** acompanha publicação, drenagem, capacidade e reversão.
- **GitHub Actions:** inicia a entrega depois dos checks da revisão integrada.

## Histórias de usuário

### US-001 — Publicar uma revisão validada (P1)

Como mantenedor, quero validar o par de imagens da revisão integrada antes de expô-lo no piloto.

**Teste independente:** integrar uma revisão de teste e simular uma falha no pré-teste da candidata.

1. **Dado** o CI bem-sucedido após um merge na `main`, **quando** a entrega iniciar, **então** as imagens de Nginx e NestJS identificam o mesmo commit.
2. **Dado** que frontend, API ou Socket.IO falham na candidata, **quando** o pré-teste terminar, **então** o piloto e suas salas continuam no slot ativo.

### US-002 — Completar uma partida durante a troca (P1)

Como jogador, quero jogar, usar um convite ou reconectar enquanto uma nova versão fica ativa.

**Teste independente:** em cada jogo, abrir uma sala antes da troca e usar três clientes para observar a continuidade, o convite e a reconexão.

1. **Dado** que uma sala existe antes da troca, **quando** a candidata se torna ativa, **então** a partida e as conexões da sala continuam no slot original.
2. **Dado** um convite ou uma reconexão válida para essa sala, **quando** o jogador entra após a troca, **então** chega ao slot original pelo código da sala.
3. **Dado** que a troca terminou, **quando** alguém cria uma sala, **então** a sala nasce no slot ativo.

### US-003 — Atualizar ao voltar ao lobby (P1)

Como jogador, quero usar a versão ativa ao começar outra sala sem recarregar a página manualmente.

**Teste independente:** manter uma aba aberta antes da troca, concluir a partida e voltar ao lobby com a versão ativa disponível.

1. **Dado** que a aba está desatualizada, **quando** o jogador volta ao lobby para criar uma sala, **então** a atualização acontece automaticamente antes da criação, sem ciclo de recargas.
2. **Dado** que a aba segue em partida, **quando** o slot ativo muda, **então** a aba conserva a sessão e pode carregar arquivos necessários da sua versão.

### US-004 — Acompanhar e reverter a troca (P1)

Como mantenedor, quero acompanhar a drenagem, impedir sobreposição de deploys e restaurar o destino das novas salas.

**Teste independente:** solicitar uma segunda atualização e exercitar reversão enquanto há salas nos dois slots.

1. **Dado** que ambos os slots estão ocupados, **quando** outra revisão pede publicação, **então** ela aguarda um slot livre.
2. **Dado** que o slot anterior está drenando, **quando** sua última sala termina segundo o ciclo de vida do jogo, **então** o slot pode ser desligado e a operação registra seu estado e duração.
3. **Dado** que o slot anterior segue disponível após a troca, **quando** o mantenedor aciona a reversão, **então** novas salas voltam a ele sem recriá-lo e o destino das salas já abertas é verificável.

## Requisitos funcionais

- **FR-001:** A cada merge na `main` com CI bem-sucedido, o GitHub Actions DEVE iniciar a entrega do mesmo commit para as duas imagens, seguindo uma receita versionada.
- **FR-002:** A entrega DEVE autenticar-se com identidade dedicada, conferir a chave do host e operar com permissões restritas.
- **FR-003:** A operação DEVE manter dois slots Docker Compose atrás do Traefik e testar frontend, API e Socket.IO da candidata de forma privada antes de expor tráfego público.
- **FR-004:** A criação DEVE usar o slot ativo. Uma sala existente DEVE conservar o slot de origem, incluindo entrada com convite e reconexão pelo código.
- **FR-005:** A versão aberta DEVE ter acesso aos arquivos de frontend de que ainda depende. Ao retornar ao lobby com uma versão anterior, a página DEVE atualizar automaticamente antes de criar outra sala, sem recarga durante partida ou repetição indefinida.
- **FR-006:** A operação DEVE serializar deploys e preservar o slot em drenagem enquanto houver sala retida pelo ciclo de vida dos jogos. O estado e a duração da drenagem DEVEM ser observáveis.
- **FR-007:** Enquanto o slot anterior estiver disponível, a reversão DEVE devolver novas salas a ele sem recriá-lo. Salas que nasceram no outro slot continuam vinculadas a ele enquanto ele estiver alcançável. Falha que destrói seu processo pode perder as salas desse slot.
- **FR-008:** A operação DEVE reter as imagens necessárias para a transição e para recuperação após a liberação de um slot. A validação DEVE distinguir reversão de rota sem recriação de recuperação a partir de uma imagem retida.

## Requisitos não funcionais

- **NFR-001:** Verificar continuidade do HTTPS, preservação dos avisos de atribuição e da política de publicação do piloto, e ausência de intervenção nos outros serviços da VPS.
- **NFR-002:** Medir CPU e memória durante a sobreposição com carga representativa e submeter evidência e margem operacional antes de habilitar a automação.
- **NFR-003:** As verificações e registros devem preservar sigilo de credenciais e da avaliação das cartas, além do caráter transitório dos frames de câmera. Nenhuma ampliação de distribuição fica autorizada por testes ou builds bem-sucedidos.

## Edge cases

- Falha no pré-teste mantém as rotas públicas anteriores. Repetir ou sobrepor entregas não pode substituir o slot que contém salas.
- Enquanto uma sala aceita reconexão pelo contrato vigente, sua ausência momentânea de conexões não basta para concluir a drenagem.
- Uma versão ativa temporariamente indisponível ou uma recarga que ainda devolve a revisão anterior não deve produzir um ciclo de recargas ou criar uma sala com o cliente desatualizado.
- Após desligar o slot anterior, recuperação com imagem retida não restaura partidas que já perderam seu processo.

## Hipóteses e dependências

- Reconfirmar acesso administrativo autorizado, configuração efetiva do piloto e a receita histórica. A revisão repassada é `b91f4199`. O piloto usa HTTPS e combina a configuração base, a exposição pública e os avisos.
- Demonstrar compatibilidade com clientes da revisão em execução, inclusive no primeiro rollout. Essa revisão pode precisar de uma etapa de transição antes da primeira troca com drenagem.
- A habilitação depende de validação de ponta a ponta e decisão do mantenedor sobre os limites operacionais. A [issue #179](https://github.com/wezercarvalho/guess-my-move/issues/179) deve ser considerada antes de ampliar a distribuição de artefatos.

## Critérios mensuráveis de sucesso

- **SC-001:** Uma execução no GitHub registra o mesmo commit nas duas imagens e comprova que uma candidata com falha não recebe tráfego público.
- **SC-002:** Em Bolinhas e Arranha-Teia, os testes durante a troca demonstram continuidade, convite, reconexão e novas salas na versão ativa.
- **SC-003:** Uma aba anterior mantém uma partida e carrega os arquivos necessários. Ao voltar ao lobby, ela atualiza sem intervenção, sem loop, e cria a próxima sala na ativa.
- **SC-004:** Evidência registra segunda entrega aguardando, duração da drenagem, liberação após a última sala e reversão sem recriar o slot anterior ainda disponível. A validação demonstra o efeito de indisponibilidade nas salas dos dois slots.
- **SC-005:** Evidência de ponta a ponta registra HTTPS, avisos, CPU e memória em sobreposição, além do resultado dos testes privados.
