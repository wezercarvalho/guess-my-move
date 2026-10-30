---
id: 2026-10-30-game-guitar-build-air-chords-poc
title: Violão no Ar, PoC alpha de acordes básicos com visão computacional
slug: game-guitar-build-air-chords-poc
strategy: sdd
domain: game
capability: guitar
objective: build-air-chords-poc
summary: Entrega o Violão no Ar, uma PoC em alpha em que o jogador monta livremente um dos cinco acordes abertos básicos (Em, Am, D, C, G) com uma mão sobre um braço imaginário projetado e atravessa as cordas com a outra. A lógica reconhece automaticamente a combinação estável de corda e casa, sem seleção prévia nem dependência do número do dedo, tolera falhas curtas e detecta a batida por velocidade e deslocamento acumulado. O navegador usa câmera em largura total, braço fino com casas reais, diagrama somente após o reconhecimento, gaveta de depuração e som Karplus-Strong. A PoC valida a forma da mão, não o som da execução, e nenhuma precisão ou latência é afirmada sem medição. Gates 1 e 2 aprovados antecipadamente; o primeiro teste ao vivo reprovou a ergonomia original e o Gate 3 depende de novo teste do maintainer.
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

O jogo **Violão no Ar** ensina os primeiros acordes sem violão: uma mão monta uma forma sobre um braço imaginário projetado no vídeo espelhado, e a outra atravessa as cordas. O app reconhece automaticamente Em, Am, D, C ou G pela combinação de corda e casa, mostra o diagrama somente depois da identificação e toca o acorde com som de corda sintetizado no navegador. É uma PoC em **alpha**: valida a forma da mão, não o som da execução.

Issues: #95 (iniciativa) e #96 a #104 (entregas), numa PR consolidada.

## Problema

O repositório já roda visão computacional no navegador em três jogos, mas nenhum usa as duas mãos com **papéis diferentes**. Os trabalhos de visão para violão encontrados usam violão real, que ancora a geometria de cordas e casas, e os apps de ensino avaliam o áudio. Não há referência de uma versão no ar com mão sobre um braço projetado, nem medição de quão bem o MediaPipe separa as pontas dos dedos nessa situação. Ver `research.md`.

## Objetivos

- Item **Alpha** no menu e página própria do jogo.
- Cinco acordes abertos reconhecíveis (Em, Am, D, C, G), sem seleção prévia.
- Reconhecer automaticamente o acorde pela corda e casa das pontas dos dedos, sem usar profundidade nem exigir um dedilhado específico.
- Manter o resultado durante falhas curtas de rastreamento e trocar somente após a nova forma permanecer.
- Detectar a batida da outra mão por uma trajetória vertical mínima, com direção e força, e tocar o acorde reconhecido.
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

### US-002 — Montar e reconhecer o acorde (P1)

Como jogador, quero montar qualquer acorde disponível e vê-lo reconhecido pela posição, sem escolhê-lo antes.

**Teste independente:** mãos simuladas nas células de cada forma identificam Em, Am, D, C e G; formatos parciais ou com posição extra não recebem nome.

**Critérios de aceitação:**

1. **Dado** qualquer um dos cinco formatos, **quando** suas posições corda+casa permanecem pelo tempo mínimo, **então** o acorde correspondente aparece automaticamente.
2. **Dado** o mesmo formato com dedos diferentes, **quando** sustentado, **então** o resultado não muda.
3. **Dado** um formato parcial, uma posição extra ou um quadro ruim isolado, **então** o sistema não inventa outro acorde nem faz o resultado piscar.

### US-003 — Bater e ouvir o acorde (P1)

Como jogador, quero bater com a outra mão e ouvir o acorde que estou formando.

**Teste independente:** uma trajetória de batida sintética dispara o som com as notas do formato atual.

**Critérios de aceitação:**

1. **Dado** um acorde reconhecido, **quando** a outra mão percorre a distância mínima para baixo dentro da zona, **então** as cordas soam da 6ª à 1ª, com atraso crescente.
2. **Dado** uma trajetória para cima, **então** a ordem é a inversa.
3. **Dado** movimento rápido curto causado por jitter ou um formato não reconhecido, **então** nenhum som é disparado.
4. **Dado** o áudio bloqueado pelo navegador, **então** a tela avisa e o primeiro gesto o libera.

### US-004 — Ver o acorde que a mão montou (P2)

Como jogador, quero ver o nome e o diagrama do acorde reconhecido para relacionar minha posição à forma musical.

**Teste independente:** antes da mão não existe acorde selecionado; após sustentar cada forma, o nome e o diagrama correspondentes aparecem.

**Critérios de aceitação:**

1. **Dado** nenhum formato reconhecido, **então** a tela não marca nem desenha um acorde alvo sobre o braço.
2. **Dado** um acorde reconhecido e tocado, **então** a tela o marca como tocado e pede que o jogador monte qualquer outro.

### US-005 — Calibrar e tocar sem câmera (P2)

Como maintainer, quero ajustar o braço, ver os números do reconhecimento e tocar pelo teclado para calibrar e testar sem a mão.

**Teste independente:** abrir a gaveta de depuração, mover o braço e tocar com Espaço sem câmera.

**Critérios de aceitação:**

1. **Dado** a gaveta aberta, **então** mostra mãos, delegate, fps, célula de cada dedo, estado por corda, velocidade da mão da batida e latência de áudio.
2. **Dado** a câmera negada, **quando** o jogador usa Espaço, seta para cima ou clique, **então** o som de teste usa o último acorde reconhecido ou Em no estado inicial.

## Requisitos funcionais

- **FR-001:** O menu DEVE mostrar quatro cards, e o do Violão no Ar DEVE mostrar o selo "Alpha" e levar a `guitar.html`; os três cards existentes DEVEM seguir iguais.
- **FR-002:** `guitar.html` DEVE carregar o módulo da tela, ter o link "← Menu" para `./` e ser uma entrada do Vite.
- **FR-003:** O selo Alpha DEVE ser um componente do design system, com tokens e sem cor fixa, e o texto "Alpha" DEVE ser lido por leitor de tela.
- **FR-004:** O pacote puro `@guess-my-move/guitar` DEVE declarar a afinação padrão (E2 A2 D3 G3 B3 E4) e os acordes Em, Am, D, C e G na ordem de ensino, por corda (abafada, solta ou casa com o número do dedo), e DEVE exportar os tipos de geometria, acorde e afinação.
- **FR-005:** O pacote DEVE calcular a posição das casas 0 a 5 pela regra dos 12 semitons (distância da pestana = L·(1 − 2^(−n/12))), as 6 cordas e as zonas de corda e casa em coordenadas do braço de 0 a 1, e a nota MIDI de cada corda tocada.
- **FR-006:** A mão do braço DEVE ser escolhida pelo lado da tela e pela opção destro ou canhoto, nunca pelo rótulo Left/Right do MediaPipe; o resultado NÃO DEVE mudar com o rótulo certo, trocado ou ausente.
- **FR-007:** O sistema DEVE traduzir as pontas do indicador, médio, anelar e mindinho em corda e casa, com suavização, histerese de célula e tempo mínimo de permanência, sem usar profundidade (z); o polegar e pontas fora do braço NÃO DEVEM contar, e os dedos estáveis DEVEM se manter por uma tolerância curta quando a mão some.
- **FR-008:** O reconhecimento DEVE reduzir cada corda à casa mais alta com dedo estável e comparar a combinação corda+casa com Em, Am, D, C e G, sem depender do número do dedo usado.
- **FR-009:** Formatos parciais, vazios ou com posição extra NÃO DEVEM receber nome nem tocar pela mão; a tela DEVE pedir apenas o ajuste dos dedos, sem sugerir um acorde alvo.
- **FR-010:** Um acorde DEVE exigir a mesma forma sustentada pelo tempo mínimo; o resultado DEVE resistir a quadros ruins curtos e a troca para outro acorde DEVE exigir nova permanência.
- **FR-011:** O detector de batida DEVE usar a trajetória vertical do centro da palma normalizada pelo tamanho da mão, exigir velocidade e deslocamento mínimos, respeitar período refratário, disparar ao completar a travessia dentro da zona, devolver direção e força e reiniciar ao perder a mão.
- **FR-012:** A síntese DEVE gerar uma nota de corda dedilhada pelo algoritmo Karplus-Strong, de forma determinística por semente, sem arquivo de áudio de terceiros.
- **FR-013:** O plano da batida DEVE ordenar as cordas (da grave à aguda para baixo, o inverso para cima), com atraso entre cordas e ganho pela força, e só DEVE tocar um acorde confirmado pela posição.
- **FR-014:** O tocador DEVE usar um único `AudioContext` criado ou retomado dentro de um gesto do usuário e DEVE mostrar o estado "som bloqueado" com o aviso para ativar.
- **FR-015:** A tela DEVE ligar câmera espelhada, rastreador de até duas mãos, braço projetado, reconhecimento, batida e som; a câmera DEVE ocupar toda a largura útil, e o braço padrão DEVE usar 18% da altura do vídeo, mantendo ampla zona de batida.
- **FR-016:** A tela NÃO DEVE exigir escolha de acorde; DEVE mostrar o nome e o diagrama somente depois do reconhecimento, o guia "Como jogar" com a etapa atual em `aria-current`, dicas curtas e o progresso por acorde tocado.
- **FR-017:** A tela DEVE oferecer ajuste de posição, comprimento e espaçamento das cordas, a gaveta de depuração fechada por padrão e teclado e clique como teste de som usando o último acorde reconhecido ou Em no estado inicial.

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
