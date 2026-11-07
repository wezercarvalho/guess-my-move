---
id: 2026-11-07-game-swing-configure-face-look
title: Configurar sensibilidade do rosto e recentralizar o olhar
summary: Ajustar o giro pelo rosto e recalibrar o neutro na recuperação e no gesto de trava, com transições suaves.
slug: game-swing-configure-face-look
strategy: sdd
domain: game
capability: swing
objective: configure-face-look
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - apps/web/src/swing/
    - packages/swing/src/headLook.ts
    - packages/swing/test/headLook.test.ts
related_specs: []
supersedes: []
branch: feat/swing-face-sensitivity
constitution_version: 1.0.0
created_at: 2026-11-07
updated_at: 2026-11-07
---

# Configurar sensibilidade do rosto e recentralizar o olhar

## Resumo e problema

Issue #149. Ganho fixo não permite adaptar o giro à amplitude confortável de cada pessoa. O neutro antigo após perda do rosto e após o gesto pode somar um desvio indesejado. Configuração e recalibração devem ser previsíveis, sem saltos ou reabrir detectores.

## Objetivos

- Ajustar o giro da câmera pelo rosto nos dois eixos e centralizar automaticamente em transições significativas.

## Fora de escopo

- Novos modelos, mapas, física, regras, limiares de escalada, persistência de dados, telemetria, Violão, merge e deploy.

## Atores e história de usuário

### US-001 — Ajustar o olhar (P1)

Como jogador local ou cooperativo, quero escolher quanto a câmera gira com meu rosto e retomar o neutro ao reenquadrar ou travar, para controlar a mira sem movimentos desconfortáveis ou giro duplicado.

Teste independente: mesmo movimento com fatores diferentes produz giros proporcionais dentro dos limites; transições de perda/trava neutralizam a pose atual sem salto.

## Requisitos funcionais

- **FR-001:** Disponibilizar controle acessível de sensibilidade do rosto de 0,5× a 3×, passo 0,1, padrão 1× equivalente ao atual; mostrar valor e explicar o efeito. Ajustar yaw/pitch ao vivo sem recarregar detectores e preservar valor durante reinício/alternância de modo na mesma tela. Valores não finitos são ignorados e fora do intervalo limitados. Sem storage.
- **FR-002:** Depois de perda de rosto/orientação inválida já calibrada, a primeira nova amostra válida define o neutro automaticamente. Convergir suavemente à centralização, sem refazê-la em amostras seguintes, nem usar renders repetidos como nova amostra. Calibração inicial estável permanece.
- **FR-003:** Ao começar a trava, recalibrar o neutro e preservar a direção escolhida pelo histórico. Enquanto travado, pose/recuperação/sensibilidade não mudam a direção congelada. Ao liberar o gesto, a pose válida atual vira neutro para evitar aplicar o movimento feito durante a trava. Sem pose válida, a recuperação seguinte resolve o neutro.
- **FR-004:** Centralização manual, modo automático, teclado, escalada e limites de yaw/pitch permanecem. Sensibilidade só altera o giro da câmera, sem alterar limiares da escalada ou dados/protocolo enviados ao servidor; mesma tela local/online. Deltas angulares são consumidos uma vez por atualização física e acumulados se o render não produz subpasso; reset descarta o acumulado. Testes cobrem núcleo, controlador e UI.

## Requisitos não funcionais

- **NFR-001:** Vídeo/landmarks permanecem locais e transitórios, sem logs/storage/telemetria novos; só a configuração numérica fica em memória.
- **NFR-002:** Alterações de sensibilidade convergem suavemente; limites angulares existentes são preservados. Não anunciar ganho de FPS ou precisão física sem medição.

## Edge cases

- NaN/infinito, valores extremos, rosto sem matriz válida, perda breve/longa, recuperação durante trava, pose movida enquanto travada, câmera desligada e reinício. Cancelamento/descarte existente deve permanecer.

## Critérios mensuráveis de sucesso

- **SC-001:** FR-001–FR-004 demonstrados por testes observáveis e rastreados às tarefas/evidências; comandos oficiais aprovados, com câmera física explicitamente reservada ao maintainer.
