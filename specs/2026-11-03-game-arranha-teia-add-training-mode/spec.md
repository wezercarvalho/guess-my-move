---
id: 2026-11-03-game-arranha-teia-add-training-mode
summary: Seleção Treino e Viajante, cidade procedural Aurora, exercícios cumulativos e correções de enquadramento da câmera, calibração do olhar e trabalho gráfico repetido.
title: Aprender Arranha-Teia num cenário de treino
slug: game-arranha-teia-add-training-mode
strategy: sdd
domain: game
capability: arranha-teia
objective: add-training-mode
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - treino
    - Aurora
code_paths:
    - apps/web/src/swing/
    - packages/swing/src/city.ts
    - packages/swing/src/headLook.ts
    - apps/web/scripts/swing-layout.test.mjs
related_specs:
    - 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback
supersedes: []
branch: feat/108-arranha-teia-treino
constitution_version: 1.0.0
created_at: 2026-11-03
updated_at: 2026-11-04
---

# Aprender Arranha-Teia num cenário de treino

## Contexto e escopo

A issue #108 pede um ambiente próprio para aprender os comandos sem lidar primeiro com cidades reais. O maintainer autorizou iniciar em paralelo às bolinhas em 2026-11-03. Violão permanece em standby.

## Requisitos funcionais

- FR-001: escolher Treino ou Viajante antes da partida; Viajante preserva as cidades e links `?city=...`; treino usa `?mode=training`.
- FR-002: treino procedural Aurora com torres variadas, néon, atmosfera, pontes, plataformas e mirante; colisão por pegadas e alturas City v1; primeira teia alcança âncora e há parede larga.
- FR-003: lista recolhível lateral registra lançar cada mão, puxar, soltar, agarrar, escalar pelo olhar e travar direção, cumulativamente e sem tempo nem pontuação.
- FR-004: feedback existente continua na base do palco; exercícios fora do centro.

## Requisitos não funcionais

- NFR-001: nenhum arquivo de mídia, biblioteca nova ou serviço externo para o cenário; câmera e dados permanecem locais.
- NFR-002: materiais simples, sem luz por prédio; nenhuma afirmação de fps ou precisão sem medição.
- NFR-003: testes precedem código; validação pelo maintainer com câmera real fica pendente.

## Sucesso e fora de escopo

SC-001: testes demonstram seleção, URLs, colisão/alcance e exercícios. SC-002: maintainer avalia o visual e a câmera real. Sem Rio, relevo, Cesium, multiplayer, som ou placar no treino.

## Correções após teste do maintainer — 2026-11-04

O maintainer relatou pontos de mãos/rosto deslocados, engasgos e dificuldade ao olhar para cima/baixo. Autorizou tratar o Arranha-Teia antes de bolinhas nesta conversa. Esta revisão corrige o comportamento existente, sem antecipar o aceite de T006.

- FR-005: preview e pontos devem compartilhar o mesmo enquadramento e espelhamento, inclusive com câmeras 4:3 no painel 16:9.
- FR-006: atualizações do HUD não devem redimensionar/recriar recursos gráficos quando o tamanho do palco não mudou; o néon repetido de Aurora deve compartilhar os envios de desenho sem mudar cenário/colisões.
- FR-007: o neutro deve usar leituras novas e estáveis do rosto, sem contar repetições do quadro no laço de desenho; centralizar exige rosto válido. Inclinação para cima/baixo não deve receber desvio espúrio de rotação lateral.
- SC-003: regressões automatizadas reproduzem as falhas; navegador mede redimensionamentos, alinhamento e chamadas de desenho antes/depois. Medidas headless não provam fluidez ou precisão no dispositivo do maintainer.
