---
id: 2026-11-09-game-swing-guide-calibration-and-eye-alpha
title: Preparação guiada e assistência ocular alpha do Arranha-Teia
slug: game-swing-guide-calibration-and-eye-alpha
strategy: sdd
domain: game
capability: swing
objective: guide-calibration-and-eye-alpha
status: validating
summary: Preparação guiada de rosto e mãos, início por positivo e assistência ocular opcional alpha.
owners: [wezercarvalho]
reviewers: [wezercarvalho]
aliases: [calibragem, positivo, ocular]
code_paths: [packages/swing/src/, apps/web/src/swing/]
related_specs: [2026-11-07-game-swing-configure-face-look]
supersedes: []
branch: feat/swing-guided-calibration
constitution_version: 1.0.0
created_at: 2026-11-09
updated_at: 2026-11-10
---

# Preparação guiada e assistência ocular alpha

## Resumo

Preparar rosto, sentidos e mãos antes de iniciar por positivo. Olhos são assistência voluntária alpha desligada por padrão. Issues #156–#162.

## Problema

Carregar cenário libera controles sem conferência guiada; positivo também satisfaz o classificador de punho. Calibração ocular não existe.

## Objetivos

Preparação visível sem ações acidentais e assistência ocular isolada para teste.

## Fora de escopo

Cartas, Violão no Ar, bolinhas, identificação pessoal, mira ocular precisa garantida, persistência de câmera, merge e publicação.

## Atores

Jogador local/cooperativo e maintainer que testa câmera real.

## Histórias de usuário

### US-001 — Preparar controles (P1)

Como jogador quero conferir rosto e mãos antes de jogar. Teste independente: preparação bloqueia física e comandos até confirmação.

### US-002 — Experimentar olhos (P2)

Como jogador quero testar assistência opcional. Teste independente: falha ocular não bloqueia jogo pela cabeça.

## Requisitos funcionais

- **FR-001:** Reconhecer rosto e centro. Caixa facial inteira na imagem, centro nos 50% centrais, orientação finita; 1 s estável, 12 amostras novas, tolerância 2°, intervalo máximo 250 ms. Movimento/ausência reinicia janela. Centralizar rejeita pose antiga.
- **FR-002:** Conferir sentidos. Esquerda/centro/direita/centro/cima/centro/baixo/centro; desvio 8° por 400 ms e centro até 5° por 400 ms. Inferir sinais opostos por eixo e aplicar correção uma única vez antes dos consumidores faciais. Sem ações durante preparação.
- **FR-003:** Guiar mãos e alternativas. Rosto+mãos, mãos+automático ou teclado; uma ou duas mãos. Palma inteira aberta por 500 ms (duas simultâneas se selecionadas). Preview espelhado de apoio, guias, instrução da etapa, progresso, erros e ações no centro da área da cidade, sem exigir olhar para a coluna lateral. O ponto neutro é olhar para o centro do cenário; a câmera é somente a captura. Troca de modo/câmera reinicia. Lados espaciais da tela, não identidade anatômica.
- **FR-004:** Confirmar por positivo. Após preparar, observar não-positivo e depois polegar para cima/outros dedos dobrados por 800 ms de amostras novas a até 250 ms. Consumir gesto e exigir palma aberta por 200 ms antes de liberar ações. Teclado usa botão explícito. Reinício exige confirmação nova. Bloquear física local, inputs e contadores antes de liberar.
- **FR-005:** Preparar cooperativo no lobby. Manter captura entre lobby e partida; confirmação marca prontidão individual e servidor espera ambos. Invalidação enquanto espera retira ready; corrida com início bloqueia inputs locais sem pausar mundo compartilhado. Revanche exige confirmação nova, reconexão com captura válida conserva preparo.
- **FR-006:** Calibrar ocular opcional. experimentalEyeTracking desligado a cada sessão e temporariamente indisponível na interface, por solicitação do maintainer após teste. O núcleo experimental fica preservado para trabalho futuro; os critérios abaixo se aplicam quando sua disponibilidade for retomada. Nunca obrigatório para iniciar. A opção fica disponível após preparar os controles; durante o ensaio ocular escolhido pelo jogador os comandos locais ficam suspensos, com botão Pular para retomar imediatamente. Nove alvos de calibração e quatro distintos de validação; permitir repetir/pular. Rejeitar erro médio normalizado acima de 0,18 ou máximo acima de 0,3. Parâmetros somente em memória.
- **FR-007:** Limitar assistência ocular. Deslocamento máximo 6° horizontal/4° vertical, zona neutra 0,15 em coordenadas centradas, permanência 300 ms, suavização exponencial 8/s. Excluir HUD/painéis/fora do cenário; trava bloqueia olhos. Piscadas, leitura antiga >250 ms, qualidade insuficiente ou cabeça além de 10° da pose calibrada suspendem; retorno exige 400 ms válidos. Sem alimentar giro contínuo/escalada. Desligar retira suavemente. Centralizar/câmera/redimensionar invalida calibração ocular.
- **FR-008:** Entregar teste em draft. Testes automatizados, roteiro real e matriz #161/#162, gates oficiais e PR draft com instruções. Não inventar medições com câmera real. Sem merge ou publicação.

## Requisitos não funcionais

- **NFR-001:** Nenhuma mídia/landmark/calibração enviada, gravada ou logada; uma captura para ambos os detectores, sem serviço remoto de inferência.
- **NFR-002:** Preservar gestos, teclado após liberação, sensibilidade, trava, giro contínuo e contratos de rede.

## Edge cases

Frames repetidos não contam. Perda facial antes de iniciar volta à estabilização; durante jogo preserva recuperação existente. Captura interrompida exige preparo novo. Positivo já mantido antes da confirmação não inicia sozinho.

## Hipóteses e dependências

Limiares iniciais de jogo, não precisão comprovada. Luz, óculos e webcam podem inviabilizar olhos. Teste real permanece para o maintainer; aprovação antecipada de gates não comprova medição.

## Critérios mensuráveis de sucesso

- **SC-001:** Testes de núcleo e integração cobrem requisitos; gates oficiais passam.
- **SC-002:** PR draft com roteiro e limitações, sem alegar teste real inexistente.
