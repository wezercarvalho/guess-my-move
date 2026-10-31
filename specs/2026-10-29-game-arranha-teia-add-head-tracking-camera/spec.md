---
id: 2026-10-29-game-arranha-teia-add-head-tracking-camera
title: Arranha-Teia, girar a câmera com a cabeça pelo MediaPipe Face Landmarker
slug: game-arranha-teia-add-head-tracking-camera
strategy: sdd
domain: game
capability: arranha-teia
objective: add-head-tracking-camera
summary: Acrescenta ao Arranha-Teia o giro da câmera pela cabeça. O MediaPipe Face Landmarker (mesmo pacote @mediapipe/tasks-vision das mãos, modelo face_landmarker.task servido pelo próprio app e conferido por SHA-256 no prepare:assets) dá a matriz de transformação facial; uma lógica pura e testada no pacote @guess-my-move/swing converte guinada e inclinação da cabeça num desvio do olhar, com correção do espelhamento, calibração do neutro, zona morta, suavização exponencial, ganho e limites, e volta suave a zero quando o rosto some. O desvio soma ao acompanhamento automático atual (a cabeça tem prioridade enquanto está fora da zona morta) e vale também para a mira da teia, que já sai da direção da câmera. A camada web alimenta mãos e rosto com o mesmo quadro, mostra status de uma linha, dica curta e o painel de depuração com a leitura da cabeça, e oferece um botão "Centralizar"; sem rosto o jogo segue como hoje e o teclado continua funcionando. Nenhuma imagem é gravada ou enviada. Issue #80. Gates 1 e 2 aprovados antecipadamente pelo maintainer em 2026-10-29; a implementação é test-first e o Gate 3 fica pendente do teste ao vivo do maintainer, sem afirmar desempenho (fps) nem precisão da pose sem medição. A emenda CQ-012 (issue #106) acrescenta a trava da direção do olhar por gesto de mão (mão aberta com o dedão para baixo, qualquer mão), porque o monitor é fixo e virar a cabeça tira a tela da vista; a direção travada vira a nova frente e, depois de centralizar o rosto, a cabeça volta a somar o desvio a partir dela.
status: validating
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - cabeça
    - rosto
    - Face Landmarker
    - MediaPipe Face
    - câmera com a cabeça
    - olhar
    - guinada
    - inclinação
    - matriz de transformação facial
    - zona morta
    - calibração do neutro
    - suavização
    - espelhamento
    - packages/swing
    - headLook.ts
    - faceTracker.ts
    - faceOverlay.ts
    - overlay do rosto
    - direção do olhar
    - seletor de olhar
    - legenda de teclado
    - inversão da câmera
    - trava da direção
    - dedão para baixo
    - lockGesture.ts
    - estabilização do rosto
code_paths:
    - packages/swing/
    - apps/web/
related_specs:
    - 2026-10-28-game-arranha-teia-build-first-person-web-swing
supersedes: []
branch: feat/80-camera-com-a-cabeca
constitution_version: 1.0.0
created_at: 2026-10-29
updated_at: 2026-10-31
---

# Arranha-Teia, girar a câmera com a cabeça pelo MediaPipe Face Landmarker

## Resumo

No Arranha-Teia a câmera é hoje automática: segue a direção do movimento (CQ-008 da spec anterior) e as mãos não giram o olhar. Esta mudança deixa o jogador olhar em volta movendo a cabeça — para os lados, para cima e para baixo — como se o personagem estivesse olhando ao redor. O rosto é lido no navegador pelo MediaPipe Face Landmarker, do mesmo pacote `@mediapipe/tasks-vision` já usado nas mãos; o modelo `face_landmarker.task` é servido pelo próprio app (sem CDN), baixado e conferido por SHA-256 no `prepare:assets`, como o do gesto.

A lógica de converter a orientação da cabeça em olhar é pura e testável sem navegador, no pacote `@guess-my-move/swing` (`headLook.ts`): extrai guinada e inclinação da matriz de transformação facial, corrige o espelhamento da imagem da câmera, calibra o neutro (automático nos primeiros quadros estáveis e sob demanda por "Centralizar"), ignora uma zona morta, aplica ganho e limites, suaviza de forma exponencial e, sem rosto, faz o desvio voltar suave a zero. O desvio da cabeça soma ao acompanhamento automático (a cabeça tem prioridade enquanto está fora da zona morta); como a mira da teia já sai da direção da câmera (`state.yaw`/`state.pitch`), o desvio vale também para a mira, por construção.

A camera web (`faceTracker.ts`, `swingController.ts`) alimenta mãos e rosto com o mesmo quadro da câmera, mostra um status de uma linha e uma dica curta, expõe a leitura da cabeça no painel de depuração (ângulos, calibrado, rosto visível) e oferece o botão "Centralizar". Sem rosto, o jogo segue jogável como hoje e o teclado (setas) continua funcionando. Nenhuma imagem é gravada nem enviada; o aviso de privacidade único do app continua valendo.

Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."). A implementação é test-first; o Gate 3 fica pendente do teste ao vivo do maintainer, e não se afirma desempenho (fps) nem precisão da pose da cabeça sem medição registrada.

## Problema

Hoje a câmera do Arranha-Teia é automática (segue o movimento, CQ-008) e as mãos não giram o olhar. O jogador não consegue olhar para os lados, para cima ou para baixo, o que limita a imersão e a mira da teia, que sai da direção da câmera. O maintainer pediu (issue #80) que o movimento da cabeça vire a câmera, como se o personagem estivesse olhando em volta.

É fato que o app já usa o MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) para as mãos, com modelos servidos pelo próprio app. A hipótese a confirmar era se o mesmo pacote oferece o Face Landmarker com a pose da cabeça; a pesquisa (`research.md`) confirma que sim, pela matriz de transformação facial.

Quatro dificuldades concretas precisam ser tratadas: (1) o espelhamento — a imagem da câmera é invertida, então virar a cabeça para a direita deve virar a câmera do jogo para a direita; (2) o conflito de olhar — o jogador olha para o monitor e vira a cabeça, o que tira o rosto do eixo, exigindo ganho maior que 1:1 e um neutro calibrado; (3) a estabilidade — a câmera não pode tremer parada nem girar sozinha, o que pede zona morta e suavização; e (4) a perda do rosto — sem rosto, o jogo tem de seguir jogável sem salto brusco. Toda a conversão orientação → olhar é determinística e deve ser testável sem navegador.

## Objetivos

- Detectar o rosto no navegador com o MediaPipe Face Landmarker (modelo servido pelo app, conferido por SHA-256) e extrair a orientação da cabeça (guinada e inclinação) por funções puras e testáveis.
- Converter a orientação em desvio do olhar com correção do espelhamento, calibração do neutro, zona morta, suavização, ganho e limites, e volta suave a zero quando o rosto some.
- Somar o desvio ao acompanhamento automático (a cabeça tem prioridade fora da zona morta) e aplicá-lo também à mira da teia (que sai da direção da câmera).
- Manter o teclado (setas) como alternativa e a câmera automática quando não houver rosto.
- Mostrar status de uma linha, dica curta e o painel de depuração com a leitura da cabeça, mais um botão "Centralizar".
- Preservar a privacidade: nenhum frame é gravado nem enviado; nenhuma requisição a terceiros em tempo de jogo.

## Fora de escopo

- Expressões faciais, blendshapes, reconhecimento de identidade ou emoção.
- Qualquer gravação, envio ou log de imagem, vídeo ou landmarks do rosto.
- Afirmar precisão da pose da cabeça, latência ou fps sem medição registrada.
- Mudar a física do balanço, a mira assistida, o pipeline da cidade ou os gestos das mãos.
- Rosto de mais de uma pessoa (o detector usa `numFaces: 1`).

## Atores e histórias

- **US-001 (jogador, P1): olhar em volta com a cabeça.** Com o rosto à vista e calibrado, virar a cabeça para a direita gira a câmera para a direita; o mesmo para esquerda, cima e baixo. Testável: orientação → desvio do olhar (puro) e o controlador com rastreador simulado giram o olhar no sentido certo.
- **US-002 (jogador, P1): câmera estável.** Parado no neutro, a câmera não gira sozinha. Testável: dentro da zona morta o desvio é zero; parado no neutro o olhar não sai de perto de zero.
- **US-003 (jogador, P1): perder o rosto sem quebrar o jogo.** Quando o rosto sai do quadro, o desvio volta suave a zero e a câmera retoma o acompanhamento automático, sem salto; o teclado segue funcionando. Testável: `update(null, dt)` decai a zero e marca o rosto ausente; o controlador não dá salto no primeiro quadro sem rosto.
- **US-004 (jogador, P2): calibrar o neutro.** Um botão "Centralizar" trata a pose atual da cabeça como o novo zero. Testável: após `recenter`, a pose virada passa a dar desvio perto de zero.
- **US-005 (operador, P1): privacidade e origem do modelo.** O modelo de rosto é servido pelo app (sem CDN), conferido por SHA-256, e nenhuma imagem é gravada ou enviada. Testável: o `prepare:assets` tem arquivo, URL do Google e SHA-256 próprios do modelo de rosto; o rastreador lê só a matriz de transformação (sem landmarks nem blendshapes guardados).

- **US-006 (jogador, P1, CQ-012): manter a direção sem olhar de lado.** O monitor é fixo; ao virar a cabeça para o lado o jogador não vê a tela. Com a mão aberta e o dedão para baixo (qualquer mão), a direção do olhar trava; ele tira a mão, olha para a tela e a câmera continua na direção travada; ao centralizar o rosto, a cabeça volta a girar a câmera a partir dela. Sem o gesto, nada trava. Testável: a unidade pura de `headLook` e o controlador com mãos e rosto simulados.

## Requisitos funcionais

- **FR-001**: A orientação da cabeça (guinada e inclinação) DEVE ser extraída da matriz de transformação facial do MediaPipe por função pura, devolvendo `null` para matriz de tamanho inválido.
- **FR-002**: A conversão orientação → olhar DEVE corrigir o espelhamento com o sinal certo: virar a cabeça para a direita do jogador gira a câmera do jogo para a direita; para a esquerda, o oposto; a inclinação segue o mesmo princípio para cima e para baixo (ver FR-011 e CQ-010 para a convenção e a correção da inversão).
- **FR-003**: O neutro DEVE ser calibrado automaticamente nos primeiros quadros estáveis e DEVE poder ser recalibrado sob demanda ("Centralizar"); antes de calibrar, o olhar não reage.
- **FR-004**: A conversão DEVE ignorar uma zona morta em volta do neutro, aplicar ganho e limitar o desvio de guinada e de inclinação a um máximo configurável.
- **FR-005**: O desvio DEVE ser suavizado de forma exponencial, sem saltar de uma vez para o alvo.
- **FR-006**: Sem rosto, o desvio DEVE voltar suave a zero e o estado DEVE marcar o rosto como ausente; o jogo segue jogável e o teclado continua funcionando.
- **FR-007**: O desvio da cabeça DEVE somar ao olhar do jogo e, enquanto a cabeça comanda (fora da zona morta ou voltando ao neutro), o acompanhamento automático NÃO DEVE sobrescrever o olhar; como a mira da teia sai da direção da câmera, ela segue o desvio por construção.
- **FR-008**: O detector de rosto DEVE usar o modelo servido pelo app, baixado e conferido por SHA-256 no `prepare:assets`, com recuo de delegate GPU → CPU como o detector de mão.
- **FR-009**: A camada web DEVE alimentar mãos e rosto com o MESMO quadro novo da câmera; a falha do detector de rosto o desliga sem derrubar o jogo nem o detector de mão.
- **FR-010**: A tela DEVE mostrar um status de uma linha e uma dica curta do estado do rosto (ex.: "Rosto fora do quadro. Centralize a cabeça."), o painel de depuração com a leitura da cabeça (ângulos, calibrado, rosto visível) e um botão "Centralizar".
- **FR-011 (CQ-010)**: A convenção de sinal DEVE ser `yaw > 0` quando o jogador olha para a SUA direita e `pitch > 0` quando olha para cima, de modo que o olhar do jogo (`state.yaw` cresce para a direita, `state.pitch` positivo olha para cima) siga a cabeça sem inversão. A derivação (matriz `Ry`/`Rx` + relato do dono, não medida com instrumento) DEVE ser registrada e fixada por testes com matrizes conhecidas.
- **FR-012 (CQ-010)**: O detector de rosto DEVE devolver também os pontos do rosto (`FaceReading { orientation, landmarks }`); a tela DEVE desenhá-los de forma TRANSITÓRIA no mesmo overlay espelhado das mãos (esboço esparso do rosto e um eixo do olhar a partir do nariz, em cor discreta), sem gravar, persistir nem logar landmark algum.
- **FR-013 (CQ-010)**: A tela DEVE oferecer um seletor "Direção do olhar" com **Automática** (câmera segue o movimento; setas ajustam) e **Rosto** (a cabeça soma o desvio), padrão **Rosto**, só em memória de sessão, sempre que a câmera estiver ativa. Em Automática o detector de rosto NÃO DEVE ser carregado (liberado se já estava), nada de rosto é lido nem desenhado, o botão "Centralizar" fica oculto, e o desvio da cabeça é descartado sem salto. Trocar durante o jogo DEVE ser seguro (sem vazar tracker nem acumular desvio). O estado vive no `SwingController` (`setLookMode`, snapshot `lookMode`) e o painel de depuração mostra o modo ativo.
- **FR-014 (CQ-010)**: A tela DEVE mostrar uma legenda de teclado sempre visível (painel "Teclado", uma linha por grupo, com `<kbd>`), definida como DADOS exportados (`KEYS`) para evolução sem conflito de layout.

- **FR-015 (CQ-012)**: Um gesto de mão DEVE travar a direção do olhar: mão aberta com o dedão para baixo, de qualquer mão. A pose é reconhecida por função pura (`isThumbDownOpenHand`, em `pose.ts`): os quatro dedos esticados, o polegar afastado e a ponta do polegar abaixo do centro da palma, na imagem, por pelo menos `LOCK_THUMB_DROP` (0,9) do tamanho da palma (valor de jogo). Uma mão nessa pose NÃO conta como palma aberta (não agarra a parede nem solta a teia por palma) nem como pose de teia, e não derruba um agarre em andamento.
- **FR-016 (CQ-012)**: Um módulo puro (`lockGesture.ts`) DEVE filtrar a pose: só vira "travar" depois de `onsetMs` (200 ms, valor de jogo) contínuos, e só deixa de valer depois de `releaseGraceMs` (150 ms, valor de jogo) sem a pose, para um quadro ruim não soltar nem um gesto passageiro travar.
- **FR-017 (CQ-012)**: O `headLook` DEVE aceitar o pedido de trava por quadro (`update(orientation, dt, lock)`) e ter três estados. **Seguindo**: como hoje, o desvio da cabeça soma ao olhar. **Travada** (enquanto o gesto vale): o olhar fica fixo na direção que a cabeça tinha `lookbackMs` (400 ms, valor de jogo) ANTES de o gesto ser reconhecido, porque levar a mão ao gesto mexe a cabeça; a cabeça não gira a câmera. **Aguardando o centro** (gesto desfeito): a direção travada continua, e a cabeça só volta a girar a câmera depois que o rosto fica dentro da zona morta por `recenterMs` (300 ms, valor de jogo). A direção travada vira a nova frente: com o rosto centralizado, o desvio da cabeça soma a ela, sem salto. Re-travar a qualquer momento é permitido. "Centralizar" encerra a trava e zera a direção travada (o olhar volta ao acompanhamento automático).
- **FR-018 (CQ-012)**: Com a direção travada ou aguardando o centro, perder o rosto NÃO DEVE mudar o olhar. Fora da trava, perder o rosto DEVE manter o desvio atual por `faceLostHoldMs` (1500 ms, valor de jogo) antes de voltar suave à direção travada (zero se não houver), no lugar de voltar na hora. Isso altera o FR-006 apenas no prazo, não no destino.
- **FR-019 (CQ-012)**: O acompanhamento automático NÃO DEVE sobrescrever uma direção travada: a cabeça "comanda" o olhar também travada e aguardando o centro, mesmo sem rosto à vista. A escalada pelo olhar (FR-009 da spec do agarre) DEVE usar só o desvio vivo da cabeça, nunca a direção travada, e ficar parada travada e aguardando o centro.
- **FR-020 (CQ-012)**: A tela DEVE ensinar e mostrar o estado em uma linha no painel "Direção do olhar": seguindo ("Vire a cabeça para olhar. Mão aberta com o dedão para baixo trava a direção."), travada ("Direção travada. Tire a mão e olhe para a tela.") e aguardando o centro ("Direção mantida. Centralize o rosto para voltar a seguir a cabeça."). A depuração DEVE mostrar o estado da trava, a pose do dedão por mão e o progresso da centralização.

## Requisitos não funcionais

- **NFR-001 (privacidade)**: Nenhum frame, vídeo ou landmark do rosto DEVE ser gravado, enviado ou logado. O rastreador lê a matriz de transformação facial e os pontos do rosto por quadro; os pontos são desenhados de forma TRANSITÓRIA no overlay e descartados a cada quadro (CQ-010), nunca persistidos.
- **NFR-002 (sem terceiros)**: O modelo de rosto DEVE ser servido pelo próprio app (sem CDN); em tempo de jogo não há requisição a terceiros.
- **NFR-003 (evidência honesta)**: Afirmações de fps, latência ou precisão da pose DEVEM citar medição registrada como texto em `validation.md`, com tamanho de amostra e limitações; capacidade anunciada pelo provedor NÃO DEVE ser tratada como desempenho comprovado.
- **NFR-004 (licença do modelo)**: A licença do arquivo `face_landmarker.task` DEVE ser lida na fonte e registrada; se não for confirmada, DEVE ser declarado que não foi, como já ocorre com os modelos de mão e de gesto.
- **NFR-005 (escopo pequeno)**: As mudanças nos arquivos compartilhados com a issue #81 (`swingController.ts`, `world.ts`, `SwingScreen.tsx`, `guide.ts`) DEVEM ser pequenas e localizadas; o máximo possível fica em arquivos novos.

## Critérios de sucesso

- **SC-001**: Com o rosto visível e calibrado, virar a cabeça para cada direção gira a câmera na mesma direção (US-001, FR-002).
- **SC-002**: Parado no neutro, a câmera não gira sozinha (US-002, FR-004).
- **SC-003**: Ao perder o rosto, a câmera volta ao acompanhamento automático sem salto, e o teclado segue funcionando (US-003, FR-006).
- **SC-004**: O rastreio de mãos e de rosto funciona ao mesmo tempo, alimentado pelo mesmo quadro (FR-009); o fps com os dois ativos é medido e registrado, sem afirmar desempenho antes da medição (NFR-003).
- **SC-005**: Privacidade: nenhum frame é guardado nem enviado, o modelo de rosto é servido pelo app e a licença é lida e registrada ou declarada como não confirmada (US-005, NFR-001, NFR-002, NFR-004).
- **SC-006**: A lógica de orientação, zona morta, suavização e perda do rosto tem testes automatizados escritos antes do código (FR-001..FR-006).
- **SC-007 (CQ-012)**: A pose do dedão para baixo (nas duas mãos), o filtro do gesto e os três estados da trava têm testes escritos antes do código; o controlador com mãos e rosto simulados mantém a direção ao tirar a mão e só volta a seguir a cabeça depois de centralizar (FR-015..FR-019).

## Hipóteses

- **H-01 (fechada)**: O `@mediapipe/tasks-vision` (já no app, versão 1.1.1) oferece o `FaceLandmarker` com a matriz de transformação facial no Web. Confirmada na pesquisa (guia oficial do Web, 2026-10-29).
- **H-02**: A matriz de transformação facial dá guinada e inclinação suficientes para um olhar utilizável sem usar landmarks individuais. Hipótese de jogo: a precisão da pose não é afirmada sem medição ao vivo.

## Dependências e riscos

- **D-01**: Depende do modelo `face_landmarker.task` do Google (storage.googleapis.com), baixado uma vez no `prepare:assets` e conferido por SHA-256; não versionado no Git (como os demais `.task`).
- **R-01 (custo)**: Rodar dois modelos por quadro numa webcam de ~15 fps tem custo não medido; registrar a medição em `validation.md` sem generalizar para outras máquinas.
- **R-02 (precisão)**: A pose da cabeça com óculos, pouca luz ou rosto parcial não foi medida; declarar como não medida.
- **R-03 (conflito de olhar)**: Olhar o monitor e virar a cabeça tira o rosto do eixo; mitigado por ganho > 1 e calibração do neutro.
- **R-04 (licença do modelo)**: A licença do `.task` pode não estar confirmável na fonte; declarar o que foi e o que não foi lido (NFR-004).
- **R-05 (CQ-012, leitura do gesto)**: Não foi medido se o MediaPipe lê bem o dedão para baixo com a mão de lado, nem se a mão relaxada dispara a pose sem querer. Os tempos e o limiar do polegar são valores de jogo; a depuração mostra a pose e o estado para ajustar ao vivo.
- **R-06 (CQ-012, mão da teia)**: Uma mão no gesto de travar não segura a pose de teia, então a teia daquela mão solta como em qualquer outra pose. A outra mão segue livre.

## Decisões

- **Combinação com o acompanhamento automático**: a cabeça soma um desvio ao olhar enquanto está fora da zona morta (prioridade da cabeça); sem rosto, o desvio volta suave a zero e o acompanhamento automático retoma. Razão: é o comportamento pedido na issue e o menos surpreendente, e evita disputa entre dois controles no mesmo quadro.
- **Mira da teia segue o olhar**: sim. A mira já sai de `state.yaw`/`state.pitch`; aplicar o desvio ao olhar faz a mira segui-lo sem código extra. Razão: coerência (a teia vai para onde se olha) e escopo menor.
- **Calibração**: automática nos primeiros quadros estáveis, mais um botão "Centralizar" para recalibrar. Razão: é a opção mais simples e testável; não exige um fluxo de calibração dedicado.
- **Matriz e pontos transitórios**: o rastreador lê a matriz (orientação) e, desde a CQ-010, também os pontos do rosto, desenhados de forma transitória no overlay e descartados a cada quadro (sem blendshapes, sem persistência). Razão: o overlay do rosto, pedido pelo dono, precisa dos pontos para desenhar; a privacidade é mantida porque nada é gravado, enviado ou logado.
- **Trava da direção (CQ-012)**: embreagem por gesto de mão, relativa ao movimento. A direção travada vira a nova frente e o desvio da cabeça soma a ela depois de centralizar o rosto (o comportamento pedido: "volta a ter o mesmo comportamento de esquerda e direita"); não é fixa no mundo. Razão: usa a soma de desvio que o jogo já tem, sem estado novo no mundo, e o maintainer descreveu exatamente esse retorno. As alternativas descartadas (joystick de taxa, trava por tempo, tecla) estão em `clarification.md`.

## Adoção constitucional

- **Versão preservada:** 1.0.0
- **Status:** aprovado
- **Aprovador:** Wezer (@wezercarvalho)
- **Data:** 2026-10-29
- **Referência:** mensagem do maintainer na sessão de 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue...").
- **Justificativa:** A spec adota a constituição vigente 1.0.0 sem emenda; registro incluído por conformidade estrutural do catálogo.
