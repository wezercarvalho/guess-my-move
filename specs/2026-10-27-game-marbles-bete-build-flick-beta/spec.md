---
id: 2026-10-27-game-marbles-bete-build-flick-beta
title: Modo de tiro por estalo (beta) do bete, selecionável na tela
slug: game-marbles-bete-build-flick-beta
strategy: sdd
domain: game
capability: marbles-bete
objective: build-flick-beta
summary: Segundo modo de tiro no bete solo, selecionável na tela ao lado da pinça, que imita o estalo real do polegar — para a câmera, uma pinça que abre rápido —, mede velocidade de abertura, duração e direção do estalo, cancela estalos lentos ou fracos e mostra os números do detector para o maintainer decidir a viabilidade (issue #68); rotulado beta porque o estalo dura poucos quadros e sua detecção ainda não foi medida.
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - estalo
    - estalo beta
    - tiro por estalo
    - flick
    - modo de tiro
    - seletor de modo
    - bete
    - packages/marbles
code_paths:
    - packages/marbles/
    - apps/web/
related_specs:
    - 2026-10-27-game-marbles-bete-build-pinch-shot
supersedes: []
branch: feat/68-estalo-beta
constitution_version: 1.0.0
created_at: 2026-10-27
updated_at: 2026-10-27
---

# Modo de tiro por estalo (beta) do bete, selecionável na tela

## Resumo

O bete solo ganha um segundo modo de tiro, escolhido por um seletor na tela: **Pinça** (o padrão já entregue, que não muda) e **Estalo (beta)**. O estalo imita o tiro real de bolinha de gude: a bolinha apoiada no indicador dobrado, o polegar preso atrás dele e disparando num estalo. Para a câmera, o estalo é uma pinça (polegar contra o indicador) que ABRE RÁPIDO. O jogador arma fechando a pinça e dispara ao abrir num estalo; a direção vem da orientação da mão no plano da imagem, medida no início da abertura, e a força vem da velocidade de abertura. A viabilidade é desconhecida (issue #68): o estalo dura poucos quadros e o detector pode perder a mão em movimento rápido, por isso o modo é rotulado **beta** e a tela mostra os números do detector para o maintainer decidir. Toda a lógica nova fica no pacote puro `@guess-my-move/marbles`; o modo pinça, seus testes, a física, o campo, o alvo e a privacidade não mudam. Esta spec estende, mas não substitui, a `2026-10-27-game-marbles-bete-build-pinch-shot`.

## Problema

O modo pinça entregue usa a pinça como estilingue: fechar, arrastar e abrir. Ele é robusto porque o gesto é lento e o detector o acompanha bem, mas não se parece com o tiro real da bolinha de gude, em que o polegar estala. A issue #68 pergunta se dá para detectar o estalo real pela mesma câmera e pelo mesmo rastreador de mão, sabendo que o estalo dura poucos quadros (estimativa não medida de 50 a 100 ms) e que o detector tende a perder a mão em movimento rápido. É preciso um segundo modo que capture o estalo como uma pinça que abre depressa, meça o quanto conseguiu capturar e exponha esses números, sem prometer desempenho que não foi medido e sem tocar no modo pinça que já funciona.

## Objetivos

- Oferecer, no mesmo jogo de bete, um segundo modo de tiro por estalo, selecionável na tela ao lado da pinça.
- Detectar o estalo como uma pinça que abre rápido: armar ao fechar, disparar ao abrir, medindo velocidade de abertura, duração da subida e direção da mão.
- Manter toda a lógica nova pura em TypeScript, sem DOM e sem MediaPipe, testável em Node, compondo o detector de pinça existente sem alterá-lo.
- Mostrar, no painel de depuração do modo estalo, os números que o maintainer precisa para decidir a viabilidade (issue #68): armado, razão, velocidade de abertura, duração e resultado do último estalo.
- Preservar o modo pinça, a física, o campo, o alvo, o jogo de cartas e a privacidade, sem regressão.

## Fora de escopo

- Gravar ou exportar séries de landmarks do estalo, suavização de sinal e calibração automática dos limiares.
- Duas mãos, mais modos de tiro além de pinça e estalo, e celular ou navegadores além do Chrome desktop.
- Afirmar taxa de quadros, latência, taxa de reconhecimento do estalo ou viabilidade sem medição no desktop do maintainer.
- Fechar a issue #68: esta spec entrega o modo beta e os números; a decisão (viável, viável com limitações, inviável) é do maintainer após o teste manual.
- Alterar o modo pinça e seus testes, a física, o campo, o alvo, o jogo de cartas e a lógica do árbitro por visão.

## Atores

- **Jogador:** escolhe o modo estalo, arma fechando a pinça, aponta a mão para o alvo e dispara abrindo num estalo; erra e tenta de novo.
- **Maintainer:** testa no Chrome desktop, lê os números do estalo no painel, calibra os placeholders e decide a viabilidade da issue #68 (Gate 3).
- **Detector de estalo:** lógica pura que compõe o detector de pinça, guarda um histórico curto de amostras e, ao abrir, emite a soltura com rápido/lento, velocidade de abertura, duração e direção.
- **Motor da rodada:** lógica pura que, no modo estalo, arma ao fechar depois de vista aberta, dispara no estalo rápido e cancela no lento, no fraco e na perda da mão.

## Histórias de usuário

### US-001 — Atirar com o estalo e acertar o alvo (P1)

Como jogador, quero armar fechando a pinça e disparar abrindo num estalo rápido, para que a bolinha parta na direção que apontei e eu acerte o alvo.

**Teste independente:** no Chrome desktop com a câmera ativa e o modo estalo selecionado, fechar a pinça (a tela mostra a seta de direção a partir da bolinha de tiro), apontar a mão para o alvo e abrir num estalo rápido; a bolinha é disparada na direção apontada, com força proporcional à velocidade de abertura, e, ao tocar o alvo, a rodada termina mostrando o número de tiros.

**Critérios de aceitação:**

1. **Dado** que a pinça foi vista aberta e depois fecha (razão <= 0,35), **quando** a mão está armada, **então** a tela mostra uma seta de direção a partir da bolinha de tiro, com a direção corrente da mão.
2. **Dado** que a mão está armada, **quando** a pinça abre (razão >= 0,55) com duração da subida <= 300 ms e velocidade de abertura >= 2 razão/s, **então** o tiro dispara na direção medida no início da abertura, com velocidade entre 300 e 1100 unid/s conforme a velocidade de abertura.
3. **Dado** que a mão está armada, **quando** a pinça abre devagar (duração > 300 ms ou velocidade < 2 razão/s), **então** o estalo é classificado como lento e o tiro é CANCELADO, sem contar tiro.
4. **Dado** que o estalo foi rápido, **quando** a velocidade de abertura é de 2 razão/s, **então** a velocidade do tiro é 300 unid/s, e **quando** é de 8 razão/s ou mais, **então** é limitada a 1100 unid/s.

### US-002 — Trocar entre pinça e estalo (P1)

Como jogador, quero alternar entre os modos pinça e estalo por um seletor na tela, para comparar os dois gestos e escolher o que prefiro.

**Teste independente:** com o jogo aberto, escolher "Estalo (beta)" no seletor e confirmar que a tela passa a mostrar as mensagens e o painel do estalo e que os tiros zeraram; voltar para "Pinça" e confirmar que o comportamento do modo pinça é o mesmo de antes; abrir `?mode=estalo` e confirmar que o jogo inicia no modo estalo.

**Critérios de aceitação:**

1. **Dado** o jogo aberto, **quando** o jogador escolhe um modo no seletor, **então** o detector e as mensagens mudam para esse modo e a rodada reinicia (tiros zerados, posições iniciais restauradas).
2. **Dado** que a URL contém `?mode=estalo`, **quando** a página carrega, **então** o modo inicial é estalo; **quando** o parâmetro está ausente ou tem qualquer outro valor, **então** o modo inicial é pinça.
3. **Dado** o modo pinça selecionado, **quando** o jogador joga, **então** o comportamento, as mensagens e os testes do modo pinça são os mesmos de antes desta spec.

### US-003 — Ver o que o detector mede no estalo (P2)

Como maintainer, quero ver se a mão está armada, a razão, a velocidade de abertura, a duração da subida e o resultado do último estalo, para calibrar os limiares e decidir a viabilidade da issue #68.

**Teste independente:** no modo estalo, o painel de depuração mostra armado (sim/não), razão da pinça, velocidade de abertura do último estalo (razão/s), duração da subida (ms) e o resultado do último estalo (disparado, lento demais, fraco demais ou nenhum), além dos campos comuns do painel.

**Critérios de aceitação:**

1. **Dado** o modo estalo ativo, **quando** o painel é consultado, **então** mostra armado (sim/não), razão corrente, velocidade de abertura e duração da subida do último estalo e o resultado do último estalo.
2. **Dado** um estalo lento ou fraco, **quando** o painel é consultado, **então** o resultado do último estalo informa "lento demais" ou "fraco demais" (sem contar tiro), e não "disparado".

### US-004 — Privacidade local (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador no modo estalo, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante o jogo no modo estalo; só há carregamento do app e dos ativos do detector, servidos pelo próprio app; nenhuma requisição carrega imagem, vídeo ou landmarks.

**Critérios de aceitação:**

1. **Dado** uma partida completa no modo estalo, **quando** as requisições são inspecionadas, **então** nenhuma carrega imagem, vídeo ou landmarks e nenhuma vai a domínio de terceiros.
2. **Dado** o código, **quando** buscado, **então** não há persistência, log ou envio de quadros, vídeo ou landmarks no modo estalo, e o aviso de privacidade informa que o processamento é local.

## Requisitos funcionais

- **FR-001:** O pacote DEVE expor um detector de estalo puro `createFlickDetector(config)` que compõe o `createPinchDetector` (herdando a histerese 0,35/0,55 e o cálculo da razão), guarda um histórico curto de amostras de 400 ms e, a cada leitura, devolve `FlickReading = PinchReading & { direction: Vec | null; release: FlickRelease | null }` com `closed` significando armado; ao cruzar a abertura (razão >= 0,55) DEVE emitir uma soltura com rápido/lento, velocidade de abertura de PICO (maior inclinação da razão por segundo entre amostras consecutivas da subida), duração da subida (do início da subida — a última amostra com razão <= 0,40, RISE_START — até a amostra que cruzou 0,55) e direção medida no início da abertura; a perda da mão DEVE zerar o estado armado do detector, de modo que voltar a abrir não dispara.
- **FR-002:** O pacote DEVE expor `handDirection(landmarks, aspect)` que devolve a orientação da mão no plano da imagem como o vetor do pulso (landmark 0) à base do dedo médio (landmark 9), com x multiplicado pela proporção da imagem e ESPELHADO em x (como o preview), normalizado para comprimento 1, e `null` quando o vetor é degenerado (comprimento quase zero).
- **FR-003:** O pacote DEVE expor `flickShot(release, config)` que converte uma soltura em `{ velocity, power } | null`: para um estalo rápido, a velocidade do tiro é a interpolação linear de 300 a 1100 unid/s quando a velocidade de abertura vai de 2 a 8 razão/s (limitada nos extremos); para um estalo lento (não rápido) ou fraco, DEVE devolver `null` (tiro cancelado, sem contar tiro).
- **FR-004:** A rodada DEVE ganhar `observeFlick(reading, nowMs)` e `snapshot().flick: { direction: Vec } | null`, de modo que, no modo estalo: só arma ao fechar depois de a pinça ter sido vista aberta; enquanto armado, publica a direção de pré-visualização no snapshot; dispara no estalo rápido passando a velocidade ao `fire`; cancela no estalo lento, no estalo fraco e na perda da mão por mais de 300 ms enquanto armado; e qualquer perda de mão zera o armado. O método `fire` DEVE passar a receber a velocidade do tiro. O modo pinça (`observePinch`) e seus testes NÃO mudam.
- **FR-005:** A tela DEVE oferecer um seletor de modo — dois botões de rádio "Pinça" e "Estalo (beta)" num `fieldset` com legenda "Modo de tiro" —, o `MarblesController` DEVE ganhar `mode` e `setMode(mode)` (a troca reinicia a rodada e os detectores), rotear cada quadro para o detector do modo e expor `mode` no snapshot; o modo inicial DEVE vir de `?mode=estalo` (qualquer outro valor ou ausência = pinça). Trocar de modo DEVE reiniciar a rodada (tiros zerados).
- **FR-006:** A tela do modo estalo DEVE desenhar no campo uma seta de direção a partir da bolinha de tiro enquanto armado (`fieldView.drawField`), exibir o rótulo beta, mostrar mensagens de orientação em pt-BR por estado (aberto, armado, disparado, lento, fraco, mão perdida) e anunciar o estado e o resultado por região `aria-live`.
- **FR-007:** O painel de depuração, no modo estalo, DEVE mostrar armado (sim/não), razão da pinça, velocidade de abertura do último estalo (razão/s), duração da subida (ms) e o resultado do último estalo (disparado, lento demais, fraco demais ou nenhum), além dos campos comuns do painel.
- **FR-008:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks no modo estalo; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-009:** O modo pinça e o jogo de cartas (Acenar) NÃO DEVEM ter seu comportamento alterado: os testes existentes de `packages/marbles` (modo pinça) e do jogo de cartas DEVEM continuar passando sem alteração.
- **FR-010:** A documentação (todos os `README.md` afetados, o guia de arquitetura, o `PROJECT_SPEC` e o catálogo de specs) DEVE descrever os dois modos de tiro do bete (pinça e estalo beta) de forma coerente, sem contradizer o fluxo do jogo de cartas nem o modo pinça.

## Requisitos não funcionais

- **NFR-001:** O detector de estalo, `handDirection`, `flickShot` e a parte de estalo da rodada DEVEM ser puros e executáveis em Node sem DOM e sem MediaPipe.
- **NFR-002:** Nenhum texto DEVE afirmar desempenho (taxa de quadros, latência, quadros por estalo) ou viabilidade do estalo sem medição; a medição no Chrome desktop do maintainer DEVE ser registrada na validação.
- **NFR-003:** O seletor de modo DEVE ser um `fieldset` com legenda e rótulos textuais, e o estado e o resultado do estalo DEVEM ser anunciados por região `aria-live`.
- **NFR-004:** `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies` DEVEM passar ao final da entrega.

## Edge cases

- Abrir a pinça devagar sem querer: o estalo é classificado como lento e o tiro é cancelado (pode frustrar; registrado como risco).
- Relaxar a mão depois de armar, sem estalo real: pode cruzar a abertura e gerar falso disparo; mitigado pelo limiar de velocidade de abertura.
- Mão apontada para a câmera: o vetor pulso–base do médio pode ficar degenerado ou ambíguo; `handDirection` devolve `null` e o tiro usa a última direção válida ou não dispara (H-02).
- Mão perdida por mais de 300 ms enquanto armado: o tiro é cancelado; qualquer perda zera o armado, e voltar a abrir não dispara.
- Webcam de 30 quadros/s: pode dar só 2 a 3 amostras por estalo, o que degrada velocidade e duração; registrado como lacuna até a medição.
- Pinça já aberta quando a mão aparece (sem ter sido vista fechada): não arma.
- Troca de modo no meio de uma mira: a rodada reinicia e o estado armado é descartado.

## Hipóteses e dependências

- **H-01:** Todos os números do estalo (histerese herdada 0,35/0,55, RISE_START em 0,40, duração <= 300 ms, velocidade >= 2 razão/s, mapeamento 2–8 razão/s para 300–1100 unid/s, histórico de 400 ms, perda de 300 ms) são placeholders de calibração, não medidos.
- **H-02:** A orientação da mão no plano da imagem (pulso à base do médio) dá a direção do tiro; a mão apontando para a câmera pode ficar degenerada ou ambígua, a validar no teste do maintainer. Hipótese adicional: o maintainer aponta a mão para o alvo.
- **H-03:** O estalo dura poucos quadros e o detector pode perder a mão por borrão de movimento (visto na spec do Acenar), o que pode cancelar estalos legítimos ou perder a medição.
- **H-04:** Uma webcam de 30 quadros/s pode dar só 2 a 3 amostras por estalo, enquanto a máquina do maintainer processou cerca de 83 quadros/s em uma medição (um dado, uma máquina); a amostragem real decide se a velocidade de abertura é mensurável.
- **Observação de alcance (conta, não medição):** com atrito 400, chegar ao alvo exige cerca de 545 unid/s, ou seja, velocidade de abertura de cerca de 4,1 razão/s no mapeamento acima.
- **Dependências:** o modo pinça da spec `2026-10-27-game-marbles-bete-build-pinch-shot` (detector de pinça, física, campo, alvo, câmera e rastreador), reaproveitado sem alteração; Chrome desktop como alvo.

## Critérios mensuráveis de sucesso

- **SC-001:** O detector de estalo, `handDirection`, `flickShot` e a rodada em modo estalo têm testes automáticos que passam em Node sem câmera (histerese herdada, histórico, rápido/lento, pico de velocidade, duração, direção, mapeamento de força, cancelamentos e perda de mão cobertos).
- **SC-002:** Em teste manual do maintainer no Chrome desktop, fica registrado se o tiro por estalo disparou, em quantas tentativas, e se houve disparo falso (Gate 3).
- **SC-003:** Os números do estalo (velocidade de abertura, duração, quadros por estalo) são registrados ou a lacuna é declarada explicitamente, e a decisão da issue #68 (viável, viável com limitações, inviável) é do maintainer.
- **SC-004:** O modo pinça e o jogo de cartas (Acenar) continuam passando sem regressão, comprovado pelos seus testes e pela ausência de mudança no comportamento do modo pinça.
- **SC-005:** `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates` e `yarn security:dependencies` passam.
