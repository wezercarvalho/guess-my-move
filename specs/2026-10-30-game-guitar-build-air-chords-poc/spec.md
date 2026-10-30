---
id: 2026-10-30-game-guitar-build-air-chords-poc
title: Violão no Ar, PoC alpha de acordes básicos com visão computacional
slug: game-guitar-build-air-chords-poc
strategy: sdd
domain: game
capability: guitar
objective: build-air-chords-poc
summary: Entrega o Violão no Ar, uma PoC em alpha em que o jogador forma um dos cinco acordes abertos básicos (Em, Am, D, C, G) com uma mão sobre um braço de violão imaginário projetado no vídeo espelhado e bate com a outra mão para ouvir o acorde, sintetizado no navegador. A lógica fica num pacote puro de TypeScript (afinação, acordes, geometria do braço, papéis das mãos, dedos em corda e casa por posição 2D e permanência sem profundidade, conferência do acorde com uma correção por vez, detector de batida e síntese de corda por Karplus-Strong), com testes primeiro. O navegador acrescenta a tela com câmera, braço projetado, status de uma linha, escolha do acorde com diagrama e guia, gaveta de depuração, ajuste do braço e teclado como alternativa, além de um card Alpha no menu e uma entrada própria no Vite. A PoC valida a forma da mão, não o som da execução, e nenhuma precisão ou latência é afirmada sem medição. Gates 1 e 2 aprovados antecipadamente pelo pedido do maintainer em 2026-10-30; o Gate 3 depende do teste ao vivo do maintainer.
status: validating
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - Violão no Ar
    - violão
    - air guitar
    - acordes
    - braço de violão
    - batida
    - strum
    - Karplus-Strong
    - alpha
    - fingering
code_paths:
    - packages/guitar/
    - apps/web/guitar.html
    - apps/web/src/guitar/
    - apps/web/src/home/
    - apps/web/src/design/
related_specs:
    - 2026-10-28-frontend-design-system-adopt-dark-gold
    - 2026-10-28-game-arranha-teia-build-first-person-web-swing
supersedes: []
branch: feat/95-violao-no-ar
constitution_version: 1.0.0
created_at: 2026-10-30
updated_at: 2026-10-30
---

# Violão no Ar, PoC alpha de acordes básicos com visão computacional

## Resumo

O jogo **Violão no Ar** ensina os primeiros acordes sem violão: uma mão forma o acorde sobre um braço imaginário projetado no vídeo espelhado, a outra bate. O app diz se o acorde está certo, indica **uma** correção por vez e toca o acorde com som de corda sintetizado no navegador. É uma PoC em **alpha**: valida a forma da mão, não o som da execução.

Issues: #95 (iniciativa) e #96 a #104 (entregas), numa PR consolidada.

## Problema

O repositório já roda visão computacional no navegador em três jogos, mas nenhum usa as duas mãos com **papéis diferentes**. Os trabalhos de visão para violão encontrados usam violão real, que ancora a geometria de cordas e casas, e os apps de ensino avaliam o áudio. Não há referência de uma versão no ar com mão sobre um braço projetado, nem medição de quão bem o MediaPipe separa as pontas dos dedos nessa situação. Ver `research.md`.

## Objetivos

- Item **Alpha** no menu e página própria do jogo.
- Cinco acordes abertos (Em, Am, D, C, G) com dedilhado padrão, na ordem de ensino Em, Am, D, C, G.
- Reconhecer a corda e a casa das pontas dos dedos da mão do braço, sem usar profundidade.
- Dizer se o acorde está certo e indicar uma correção por vez.
- Detectar a batida da outra mão, com direção e força, e tocar o acorde com som de corda sintetizado.
- Expor parâmetros e números de depuração para o maintainer calibrar no teste ao vivo.

## Fora de escopo

- Ouvir o som real do jogador (microfone), violão físico e tablatura.
- Pestana, outros acordes, outras afinações e capotraste.
- Troca de acordes cronometrada, ritmo, músicas e pontuação.
- Multiplayer e persistência do ajuste entre sessões.
- Qualquer afirmação de precisão, latência ou taxa de quadros sem medição registrada.

## Atores

- **Jogador:** forma o acorde com uma mão e bate com a outra diante da câmera do notebook.
- **Maintainer:** testa ao vivo, calibra pelos números de depuração e concede o Gate 3.

## Histórias de usuário

### US-001 — Encontrar o jogo no menu como alpha (P1)

Como jogador, quero ver o Violão no Ar no menu com o selo Alpha para saber que é um jogo em teste.

**Teste independente:** abrir o menu e a página do jogo.

**Critérios de aceitação:**

1. **Dado** o menu, **quando** abre, **então** há quatro cards e o do Violão no Ar mostra o selo "Alpha" e leva a `guitar.html`.
2. **Dado** `guitar.html`, **quando** abre, **então** carrega o módulo da tela e tem o link "← Menu" para `./`.

### US-002 — Formar o acorde e saber se está certo (P1)

Como jogador, quero formar o acorde com a mão do braço e ver se está certo, com uma correção por vez, para aprender sem instrutor.

**Teste independente:** com mãos simuladas nas células do Em, a tela diz que está certo; com um dedo faltando, mostra a correção.

**Critérios de aceitação:**

1. **Dado** o Em como alvo e os dedos 2 e 3 nas cordas 5 e 4, casa 2, **quando** sustentados pelo tempo mínimo, **então** o acorde fica certo e não há correção.
2. **Dado** o Em como alvo e só o dedo 2 na corda 5, **quando** sustentado, **então** a correção é colocar o dedo 3 na corda 4, casa 2.
3. **Dado** o D como alvo (cordas 6 e 5 abafadas) e um dedo sobre a corda 6, **quando** sustentado, **então** a corda 6 não conta como erro.

### US-003 — Bater e ouvir o acorde (P1)

Como jogador, quero bater com a outra mão e ouvir o acorde que estou formando.

**Teste independente:** uma trajetória de batida sintética dispara o som com as notas do formato atual.

**Critérios de aceitação:**

1. **Dado** o Em formado, **quando** a mão da batida desce acima do limiar na zona de batida, **então** soam as 6 cordas do 6ª à 1ª, com atraso crescente.
2. **Dado** uma batida para cima, **então** a ordem é a inversa.
3. **Dado** um formato errado, **então** a nota da corda errada muda de acordo.
4. **Dado** o áudio bloqueado pelo navegador, **então** a tela avisa e o primeiro gesto o libera.

### US-004 — Aprender os cinco acordes em ordem (P2)

Como jogador, quero escolher o acorde, ver o diagrama e seguir etapas curtas para aprender os cinco acordes.

**Teste independente:** escolher cada acorde e conferir diagrama, alvos no braço e dica.

**Critérios de aceitação:**

1. **Dado** cada acorde escolhido, **então** o diagrama e os alvos no braço mostram as casas e os dedos certos, com cordas abafadas marcadas.
2. **Dado** o acorde formado e uma batida, **então** a etapa avança, o acorde fica concluído e a tela sugere o próximo da ordem.

### US-005 — Calibrar e tocar sem câmera (P2)

Como maintainer, quero ajustar o braço, ver os números do reconhecimento e tocar pelo teclado para calibrar e testar sem a mão.

**Teste independente:** abrir a gaveta de depuração, mover o braço e tocar com Espaço sem câmera.

**Critérios de aceitação:**

1. **Dado** a gaveta aberta, **então** mostra mãos, delegate, fps, célula de cada dedo, estado por corda, velocidade da mão da batida e latência de áudio.
2. **Dado** a câmera negada, **quando** o jogador usa Espaço, seta para cima ou clique, **então** o acorde alvo soa.

## Requisitos funcionais

- **FR-001:** O menu DEVE mostrar quatro cards, e o do Violão no Ar DEVE mostrar o selo "Alpha" e levar a `guitar.html`; os três cards existentes DEVEM seguir iguais.
- **FR-002:** `guitar.html` DEVE carregar o módulo da tela, ter o link "← Menu" para `./` e ser uma entrada do Vite.
- **FR-003:** O selo Alpha DEVE ser um componente do design system, com tokens e sem cor fixa, e o texto "Alpha" DEVE ser lido por leitor de tela.
- **FR-004:** O pacote puro `@guess-my-move/guitar` DEVE declarar a afinação padrão (E2 A2 D3 G3 B3 E4) e os acordes Em, Am, D, C e G na ordem de ensino, por corda (abafada, solta ou casa com o número do dedo), e DEVE exportar os tipos de geometria, acorde e afinação.
- **FR-005:** O pacote DEVE calcular a posição das casas 0 a 5 pela regra dos 12 semitons (distância da pestana = L·(1 − 2^(−n/12))), as 6 cordas e as zonas de corda e casa em coordenadas do braço de 0 a 1, e a nota MIDI de cada corda tocada.
- **FR-006:** A mão do braço DEVE ser escolhida pelo lado da tela e pela opção destro ou canhoto, nunca pelo rótulo Left/Right do MediaPipe; o resultado NÃO DEVE mudar com o rótulo certo, trocado ou ausente.
- **FR-007:** O sistema DEVE traduzir as pontas do indicador, médio, anelar e mindinho em corda e casa, com suavização, histerese de célula e tempo mínimo de permanência, sem usar profundidade (z); o polegar e pontas fora do braço NÃO DEVEM contar, e os dedos estáveis DEVEM se manter por uma tolerância curta quando a mão some.
- **FR-008:** A conferência DEVE usar, em cada corda, a casa mais alta com dedo estável, classificar cada corda como abafada, certa, errada ou faltando e declarar o acorde completo quando todas as cordas tocadas estão certas; dedos sobre cordas que o acorde pede soltas DEVEM contar como erro, com a opção de ignorá-los por parâmetro.
- **FR-009:** A conferência DEVE devolver no máximo uma correção estruturada (colocar, mover ou tirar, com dedo, corda e casa), em ordem determinística: primeiro as cordas erradas, depois as faltando, da 6ª à 1ª.
- **FR-010:** O estado "certo" DEVE exigir o acorde completo sustentado por um tempo mínimo e só voltar a "errado" depois de uma tolerância, para não piscar.
- **FR-011:** O detector de batida DEVE usar a velocidade vertical do centro da palma normalizada pelo tamanho da mão, com histerese e período refratário, disparar no pico dentro da zona de batida, devolver direção (para baixo ou para cima) e força de 0 a 1, e reiniciar ao perder a mão.
- **FR-012:** A síntese DEVE gerar uma nota de corda dedilhada pelo algoritmo Karplus-Strong, de forma determinística por semente, sem arquivo de áudio de terceiros.
- **FR-013:** O plano da batida DEVE ordenar as cordas (da grave à aguda para baixo, o inverso para cima), com atraso entre cordas e ganho pela força, e DEVE tocar o que a mão está formando, deixando de fora as cordas abafadas do acorde.
- **FR-014:** O tocador DEVE usar um único `AudioContext` criado ou retomado dentro de um gesto do usuário e DEVE mostrar o estado "som bloqueado" com o aviso para ativar.
- **FR-015:** A tela DEVE ligar câmera espelhada, rastreador de até duas mãos, braço projetado, reconhecimento, batida e som, mostrar status de uma linha com a próxima ação, permitir escolher a mão do braço e explicar em português a câmera negada.
- **FR-016:** A tela DEVE oferecer a escolha do acorde, o diagrama com dedos numerados, o guia "Como jogar" com a etapa atual em `aria-current`, dicas curtas da correção e o progresso por acorde concluído, sem pontuação.
- **FR-017:** A tela DEVE oferecer ajuste de posição e tamanho do braço, a gaveta de depuração (fechada por padrão) e o teclado e o clique como alternativas de batida, tocando o acorde alvo quando não há mão.

## Requisitos não funcionais

- **NFR-001:** Nenhum quadro da câmera DEVE sair do navegador, ser gravado ou ser registrado em log, e a tela DEVE usar o aviso de privacidade único dos outros jogos.
- **NFR-002:** O jogo NÃO DEVE usar arquivo de áudio, fonte ou biblioteca em rede de terceiros, nem dependência nova de execução.
- **NFR-003:** Nenhuma precisão de reconhecimento, latência ou taxa de quadros DEVE ser afirmada sem medição registrada; os parâmetros iniciais DEVEM ser tratados como hipóteses a calibrar.
- **NFR-004:** Os módulos do pacote DEVEM ser puros e determinísticos (sem DOM, MediaPipe nem relógio global; o tempo é injetado), e os testes DEVEM usar landmarks sintéticos (só números) e um `AudioContext` simulado.
- **NFR-005:** A tela DEVE ser acessível: etapas em lista ordenada com `aria-current`, diagrama com alternativa em texto e estado de câmera e de áudio anunciados.
- **NFR-006:** Identificadores de código DEVEM estar em inglês e o texto da interface em português do Brasil, curto, com status de uma linha.

## Edge cases

- Sem z, um dedo parado sobre o braço sem apertar é indistinguível de um dedo apertando; a permanência e o mapa de depuração são a mitigação, e a taxa de falsos positivos só se mede ao vivo.
- Duas mãos que se aproximam ou saem do quadro trocam de índice no vetor do MediaPipe; os papéis vêm da posição, com margem de histerese em torno da divisa.
- Salto de posição ao reencontrar a mão não gera batida fantasma.
- Dois dedos na mesma corda valem pela casa mais alta.
- Câmera negada ou ausente: mensagem em português e batida pelo teclado ou clique.
- Áudio bloqueado até o primeiro gesto.

## Hipóteses e dependências

- **H-01:** a câmera real do maintainer separa as pontas dos dedos sobre o braço projetado; não verificado.
- **H-02:** permanência mais histerese bastam para distinguir dedo apertando de dedo passando; não verificado.
- **H-03:** a velocidade vertical da palma em tamanho de mão por segundo separa a batida do movimento comum; o limiar inicial é um palpite.
- **H-04:** a latência fim a fim (câmera, inferência, áudio) fica numa faixa tocável; estimada em 50 a 100 ms na pesquisa, não medida.
- Dependências: rastreador de duas mãos e câmera existentes; design system (#74); `packages/swing` como molde de pacote.

## Critérios mensuráveis de sucesso

- **SC-001:** `yarn check:all`, `yarn sdd:check`, `yarn docs:format:check` e `yarn test:gates` passam na branch.
- **SC-002:** Um teste de fumaça com rastreador falso passa por câmera, reconhecimento, batida e som, e um teste de acordes prova que as classes de altura de cada acorde igualam as da tríade.
- **SC-003:** O maintainer testa ao vivo e registra em `validation.md` o que funcionou e os limites encontrados (Gate 3).
