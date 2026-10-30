---
id: 2026-10-29-game-marbles-modes-build-single-player-matches
title: Modos de jogo das bolinhas de gude, partidas de um jogador contra a meta e contra o bot
slug: game-marbles-modes-build-single-player-matches
strategy: sdd
domain: game
capability: marbles-modes
objective: build-single-player-matches
summary: Transforma o bete solo das bolinhas de gude num jogo de partidas com três modos (Bete, Triângulo e Cova), jogáveis por um jogador contra a meta ou contra um bot. A leitura da mão (pinça e estalo) é separada das regras num controlador de mira reutilizável; um motor de partida puro conduz 3 rodadas, a vez, os tiros e o resultado (vitória, derrota ou empate) sobre um contrato de modo que cada jogo implementa; um bot determinístico mira por simulação com `stepBodies` e erro controlado por semente; e cada modo declara campo, limite de tiros, avaliação e texto de ajuda. O Bete migra para o motor, o Triângulo captura 6 bolinhas para fora de um círculo e a Cova percorre 3 covas em ordem com entrada por velocidade. A tela escolhe modo e adversário, conduz a partida e mostra placar, vez e resultado, e a ajuda de cada modo aparece na tela. Tudo é singleplayer — multiplayer, rede e câmeras separadas ficam para depois. A fonte do tiro é uma interface que admite um segundo jogador no futuro sem implementá-lo. Gates 1 e 2 aprovados antecipadamente pelo maintainer em 2026-10-29; a implementação é test-first e o Gate 3 fica para o fim, sem afirmar equilíbrio nem diversão sem uso real.
status: implementing
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - bolinhas de gude
    - modos de jogo
    - Bete
    - Triângulo
    - Cova
    - partida
    - rodada
    - vez
    - meta
    - bot
    - fonte do tiro
    - controlador de mira
    - motor de partida
    - captura
    - cova
    - singleplayer
    - packages/marbles
    - marblesController
    - MarblesScreen
code_paths:
    - packages/marbles/
    - apps/web/
related_specs:
    - 2026-10-27-game-marbles-bete-build-pinch-shot
    - 2026-10-27-game-marbles-bete-refine-flick-thumb-release
    - 2026-10-28-frontend-design-system-adopt-dark-gold
supersedes: []
branch: feat/86-modos-de-jogo-bolinhas
constitution_version: 1.0.0
created_at: 2026-10-29
updated_at: 2026-10-29
---

# Modos de jogo das bolinhas de gude, partidas de um jogador contra a meta e contra o bot

## Resumo

Hoje o jogo das bolinhas de gude só tem o bete: uma bolinha de tiro contra um alvo parado, tiros ilimitados, fim no primeiro acerto, sem rodadas, placar, derrota nem empate. Esta entrega transforma esse treino num jogo de **partidas** com **três modos** — Bete, Triângulo e Cova —, cada um jogável por **um jogador** contra a **meta** (solo) ou contra um **bot**.

A entrega separa com nitidez a leitura da mão, as regras comuns da partida, as regras de cada modo e a apresentação. Um **controlador de mira** reutilizável no pacote puro `@guess-my-move/marbles` transforma leituras da mão (pinça e estalo, mira relativa, mão perdida, cancelamento) num tiro, sem conhecer alvo, rodada, placar nem física. Um **motor de partida** puro conduz 3 rodadas, a vez e o resultado (vitória, derrota ou empate) sobre um **contrato de modo** que declara o campo, o limite de tiros por adversário, a avaliação do campo quando as bolinhas param e de quem é a próxima vez. Um **bot** determinístico mira um ponto de chegada por **simulação com `stepBodies`** (não pela fórmula contínua), com erro angular e de força vindos de um gerador com **semente**. Os três modos implementam o contrato: o **Bete** leva o campo atual à partida com limite de tiros; o **Triângulo** captura 6 bolinhas para fora de um círculo; a **Cova** percorre 3 covas em ordem, com entrada condicionada por velocidade.

A camada web adapta `marblesController` e `useMarblesGame` para conduzir uma partida do motor, acrescenta a tela de escolha de **modo** e **adversário** e de condução das rodadas com placar, vez e resultado, e alimenta o painel "Como jogar" com o **texto de ajuda** declarado por cada modo. Tudo é **singleplayer**: multiplayer, rede e câmeras separadas ficam para uma discussão posterior. A interface de **fonte do tiro** (a mão do jogador ou o bot) nasce aberta a um segundo jogador no futuro, sem implementá-lo aqui. Os valores (3 rodadas, limites de tiros, metas de vitória, velocidade de entrada da cova, nível do bot) são palpites iniciais a calibrar com uso real, fixados em configuração; nenhum equilíbrio ou diversão é afirmado sem uso real. Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29; a implementação é test-first e a validação com o Gate 3 seguem ao fim, com o risco aceito de não haver teste ao vivo com a mão real.

## Problema

O jogo das bolinhas de gude (`createBeteRound`, `packages/marbles/src/round.ts`) mistura duas responsabilidades: a leitura da mão (pinça e estalo, mira relativa, mão perdida) e as regras do bete (uma bolinha contra um alvo, acerto encerra). O tiro nasce em `fire(velocity)` e o resto da máquina só conhece duas bolinhas e um alvo. Não há rodadas, placar, limite de tiros, derrota, empate nem adversário, e não existe mais de um modo de jogo.

Para ter vários modos, a leitura da mão precisa servir a qualquer regra, as regras comuns da partida (rodadas, vez, resultado) precisam viver num motor comum, e cada modo precisa declarar as suas regras sobre esse motor. Jogar contra o computador exige um adversário que atire sozinho, sem câmera, com a mesma física do jogador, com acerto nem sempre garantido nem impossível. A tela abre direto no bete solo e não oferece escolha de modo ou de adversário, acompanhamento de rodadas nem resultado da partida. O guia "Como jogar" só explica o gesto, não como cada modo vence, perde e empata.

## Objetivos

- Separar a leitura da mão das regras do jogo num controlador de mira puro e reutilizável, mantendo o bete atual com o mesmo comportamento observável.
- Conduzir partidas de 3 rodadas com vez e resultado (vitória, derrota ou empate) por um motor puro, sobre um contrato de modo que cada jogo implementa.
- Oferecer um adversário bot determinístico que mira por simulação com erro controlado por semente, sem câmera.
- Entregar três modos jogáveis contra a meta e contra o bot: Bete, Triângulo e Cova, cada um com o seu campo, limites de tiros, regras de vitória/derrota/empate e texto de ajuda.
- Conduzir a partida na tela com escolha de modo e adversário, placar das rodadas, vez, tiros restantes e resultado da partida, e mostrar a ajuda de cada modo.
- Manter a privacidade dos outros jogos (processamento local, sem gravar nem enviar imagem) e a troca entre pinça e estalo.

## Fora de escopo

- **Multiplayer** (dois jogadores humanos), rede e sincronização entre navegadores.
- **Câmeras separadas** por jogador.
- **Aprendizado do bot** e níveis de dificuldade além dos três (fácil, médio e difícil).
- **Outras formações** do triângulo (círculo cheio, quadrado) e **obstáculos** ou pontuação por posição na cova.
- **Teste ao vivo com a mão real** e qualquer afirmação de equilíbrio, diversão ou desempenho medido.
- A **tela de partida** e a **ajuda por modo** não fazem parte das issues de lógica (#86 a #91 entregam o pacote puro); a issue #92 entrega a tela e a #93 a ajuda, cobertas aqui como parte da mesma iniciativa.
- Qualquer alteração no jogo de cartas ou no reconhecedor de gestos além de consumir a fonte do tiro.

## Atores

- **Jogador:** usa a câmera (pinça ou estalo) para mirar e atirar; escolhe o modo e o adversário; acompanha o placar e o resultado.
- **Bot:** adversário automático que atira sozinho, sem câmera, pela interface de fonte do tiro, quando o adversário escolhido é o bot.
- **Maintainer (wezercarvalho):** aprova os gates e calibra os valores iniciais com uso real.
- **Interface da partida (`MarblesScreen` / `marblesController`):** liga a câmera, o teclado e o bot à sessão da partida e desenha o campo, o placar, a vez e a ajuda.

## Histórias de usuário

### US-001 — Mira reutilizável, sem regra de jogo (P1)

Como pessoa que desenvolve os modos, quero um controlador de mira que transforme leituras da mão num tiro sem conhecer alvo, rodada nem física, para qualquer modo reaproveitar a mesma leitura (issue #86).

**Teste independente:** exercitar o controlador com leituras de pinça e de estalo e verificar o tiro produzido, sem bolinha alvo e sem física; e confirmar que os testes atuais do bete e do estalo passam sem alteração.

**Critérios de aceitação:**

1. **Dado** `packages/marbles/test/round.test.ts` e `packages/marbles/test/flick-replay.test.ts` sem nenhuma alteração, **quando** executados, **então** passam (paridade com o comportamento anterior).
2. **Dado** o controlador de mira, **quando** recebe a posição da bolinha de tiro, as leituras da mão e o relógio, **então** devolve a mira em andamento e o tiro disparado, sem importar `physics.ts` nem `round.ts`.
3. **Dado** uma mão perdida durante a mira por mais que o tempo de tolerância, **quando** observada, **então** a mira é cancelada, como hoje.

### US-002 — Partida de rodadas com resultado (P1)

Como jogador, quero jogar uma partida de 3 rodadas com placar e resultado (vitória, derrota ou empate), para que o jogo tenha começo, meio e fim, e não um treino sem fim (issue #87).

**Teste independente:** rodar um modo de teste simples pelo motor e verificar o resultado da partida a partir dos resultados das rodadas, contra a meta e contra o bot.

**Critérios de aceitação:**

1. **Dado** 3 rodadas, **quando** o jogador vence 2 e perde 1, **então** a partida é vitória; 1 vitória, 1 empate e 1 derrota é empate; 3 empates é empate; 1 vitória e 2 derrotas é derrota.
2. **Dado** que o limite de tiros de um competidor se esgota, **quando** o motor pede o resultado ao modo, **então** a rodada termina e não fica presa; e uma vitória decidida antes do limite encerra a rodada sem consumir os tiros restantes.
3. **Dado** o jogo contra a meta, **quando** as bolinhas estão paradas, **então** o jogador atira sem vez; contra o bot, o jogador atira primeiro na rodada 1, a ordem alterna por rodada e atirar fora da vez não tem efeito.

### US-003 — Adversário bot por simulação (P1)

Como jogador sem um segundo humano, quero um bot que atire sozinho com erro controlado e reproduzível, para ter um desafio sem câmera (issue #88).

**Teste independente:** pedir ao planejador um tiro para um ponto de chegada e medir, na física real, onde a bolinha para, com erro zero e com o nível padrão, usando sementes.

**Critérios de aceitação:**

1. **Dado** erro zero, **quando** o bot mira um ponto entre 50 e 700 unidades numa trajetória livre, **então** a bolinha para a no máximo 1 unidade do ponto na física real (`stepBodies`).
2. **Dado** a mesma semente e o mesmo campo, **quando** o bot atira, **então** o tiro é idêntico; com sementes diferentes, os tiros diferem.
3. **Dado** o `DEFAULT_BOT`, **quando** faz 1000 tiros com sementes distintas contra um alvo parado a 400 unidades (raio 14), **então** a taxa de acerto fica entre 55% e 80% (nível médio); o fácil fica entre 30% e 55%, o difícil entre 78% e 95%, e a taxa cresce do fácil ao difícil; a velocidade de qualquer tiro é no máximo `gain · maxPull`.

### US-004 — Bete na partida (P1)

Como jogador, quero jogar o Bete como modo da partida contra a meta e contra o bot, para que o bete deixe de ser um treino sem fim (issue #89).

**Teste independente:** jogar o Bete pelo motor contra a meta e contra o bot e verificar os resultados por rodada e as posições do alvo.

**Critérios de aceitação:**

1. **Dado** o Bete contra a meta, **quando** o jogador acerta no 3º tiro, **então** a rodada é vitória e termina ali; acertar no 4º ou no 5º é empate; gastar os 5 sem acertar é derrota.
2. **Dado** o Bete contra o bot, **quando** o bot acerta em menos tiros que o jogador, **então** a rodada é derrota; o jogador acertar em menos tiros é vitória; os dois acertarem no mesmo número de tiro (quem começou ainda dá o tiro de igual número ao outro) é empate, e 5 tiros de cada sem acerto também; na rodada 2 o bot atira primeiro e na 3 o jogador.
3. **Dado** uma rodada, **quando** o alvo é posicionado, **então** ele ocupa uma de 3 posições fixas (uma por rodada), igual para os dois competidores; após um tiro errado a bolinha de tiro volta ao ponto de partida e o alvo à posição desta rodada.

### US-005 — Modo Triângulo (P1)

Como jogador, quero o modo Triângulo, em que tiro 6 bolinhas para fora de um círculo, para jogar um modo clássico das bolinhas (issue #90).

**Teste independente:** montar a formação do triângulo e verificar a captura por posição parada, os resultados contra a meta e contra o bot e a estabilidade da formação sem tiro.

**Critérios de aceitação:**

1. **Dado** o triângulo inicial (6 bolinhas em fileiras de 1, 2 e 3 dentro do círculo), **quando** nenhum tiro foi dado, **então** as 6 estão dentro do círculo, nenhum par de centros está a menos que a soma dos raios e nenhuma bolinha se move sozinha.
2. **Dado** uma bolinha parada com o centro totalmente fora do círculo (a pelo menos raio do círculo + raio da bolinha do centro), **quando** o campo é avaliado, **então** ela é capturada e removida e a captura vale para o competidor do tiro, inclusive a de uma bolinha empurrada por outra.
3. **Dado** o Triângulo contra a meta, **quando** captura as 6 em até 8 tiros, **então** é vitória e encerra na 6ª; 4 ou 5 ao esgotar os tiros é empate; 3 ou menos é derrota. Contra o bot, a vez passa a cada tiro, com ou sem captura, cada competidor tem até 5 tiros, e mais capturas vence (iguais, inclusive 0 a 0, é empate).

### US-006 — Modo Cova (P1)

Como jogador, quero o modo Cova, em que percorro 3 covas em ordem com o menor número de tiros, para jogar outro modo clássico das bolinhas (issue #91).

**Teste independente:** jogar o percurso de covas pelo motor e verificar a entrada por velocidade, a permanência da bolinha e os resultados contra a meta e contra o bot.

**Critérios de aceitação:**

1. **Dado** a bolinha com o centro dentro da cova ativa, **quando** a velocidade é menor que 120 unid/s (inclusive parada), **então** ela entra, fixa no centro, sai da simulação e a próxima cova fica ativa; acima do limite passa sem entrar; covas que não são a ativa não capturam.
2. **Dado** o Cova contra a meta, **quando** completa as 3 covas em até 6 tiros, **então** é vitória e encerra; em 7 a 9 é empate; 9 tiros sem completar é derrota. A bolinha de tiro permanece onde parou entre os tiros.
3. **Dado** o Cova contra o bot, **quando** a rodada é avaliada, **então** quem completou vence quem não completou; se ambos completaram, menos tiros vence e iguais empatam; se nenhum completou, mais covas feitas vence e igualdade empata. Cada rodada usa um percurso diferente, igual para os dois competidores.

### US-007 — Conduzir a partida na tela (P1)

Como jogador, quero escolher modo e adversário na tela, jogar as rodadas e ver o placar e o resultado, para jogar a partida completa pela câmera (issue #92).

**Teste independente:** rodar o fluxo completo da tela com câmera e rastreador simulados, para cada modo disponível, contra a meta e contra o bot.

**Critérios de aceitação:**

1. **Dado** que a tela abriu, **quando** o jogador escolhe modo e adversário e começa, **então** o campo mostrado é do modo escolhido; modo e adversário só mudam entre partidas.
2. **Dado** uma partida em curso, **quando** termina uma rodada, **então** o placar mostra o resultado dela, e ao fim da terceira aparece Vitória, Derrota ou Empate segundo o motor, com "Jogar de novo" e "Trocar de modo".
3. **Dado** "Contra o bot", **quando** é a vez do bot, **então** uma leitura de mão fechando a pinça não dispara tiro, o status de uma linha diz que é a vez do bot e o tiro do bot é animado; a troca entre pinça e estalo continua funcionando; existe mensagem de status de uma linha para cada estado (sem câmera, mão não vista, sua vez, vez do bot, rodada vencida/empatada/perdida, partida encerrada).

### US-008 — Ajuda de cada modo na tela (P2)

Como jogador, quero ver como cada modo vence, perde e empata e dicas curtas do que corrigir, para aprender o modo sem sair da tela (issue #93).

**Teste independente:** exibir o painel para cada modo e cada adversário e verificar as regras e as etapas do gesto destacadas.

**Critérios de aceitação:**

1. **Dado** cada um dos 3 modos e cada adversário, **quando** o painel é exibido, **então** traz as regras de vitória, derrota e empate daquele modo e adversário, cada mensagem com no máximo 2 frases.
2. **Dado** que o jogador está na etapa 2 de 3 do gesto, **quando** o painel é exibido, **então** só essa etapa tem `aria-current`.
3. **Dado** o estalo com resultado "fraco demais", **quando** o painel é exibido, **então** a dica de força aparece como hoje; o painel muda de conteúdo com o modo e o adversário e, antes de começar, mostra a ajuda do modo selecionado.

## Requisitos funcionais

- **FR-001:** O pacote `@guess-my-move/marbles` DEVE expor um **controlador de mira** puro e determinístico que recebe a posição da bolinha de tiro, as leituras da mão (pinça e estalo) e o relógio e devolve a mira em andamento e o tiro disparado (vetor de velocidade), sem conhecer alvo, rodada, placar nem física, e sem importar `physics.ts` nem `round.ts`.
- **FR-002:** O Bete atual DEVE passar a usar o controlador de mira sem nenhuma mudança de comportamento observável, provada pela não alteração de `round.test.ts` e `flick-replay.test.ts`.
- **FR-003:** O pacote DEVE expor um **motor de partida** puro que conduz uma partida de 3 rodadas (configurável), registra o competidor do tiro corrente, atribui a ele tudo o que o campo render até as bolinhas pararem (inclusive efeitos em cadeia) e produz o resultado da rodada e da partida (vitória, empate ou derrota do ponto de vista do jogador), sem importar DOM, MediaPipe nem relógio do navegador.
- **FR-004:** O motor DEVE operar sobre um **contrato de modo** que declara: (a) como montar o campo de cada rodada; (b) o limite de tiros de cada competidor por adversário (meta ou bot); (c) como avaliar o campo quando as bolinhas param, devolvendo o que o tiro rendeu, se a rodada terminou e o resultado; (d) a vez é sempre alternada a cada tiro, sem regra de vez própria de cada modo. A rodada termina pelo resultado do modo ou pelo esgotamento dos tiros, o que vier primeiro; uma vitória decidida encerra sem consumir os tiros restantes.
- **FR-005:** O motor DEVE tratar **meta** e **bot** como adversários: contra a meta há um competidor e nenhuma vez; contra o bot há dois competidores, quem começa alterna por rodada (jogador na primeira), atirar fora da vez não tem efeito, e o resultado da partida é mais rodadas vencidas que perdidas é vitória, menos é derrota e igual é empate.
- **FR-006:** O motor DEVE receber o tiro por uma interface de **fonte do tiro** (a mão do jogador ou o bot), sem assumir um único humano; um segundo jogador no futuro é uma nova fonte de tiro, não implementada nesta entrega.
- **FR-007:** O pacote DEVE expor um **bot** determinístico com ferramentas de pontaria: direção até um ponto e a velocidade para a bolinha parar num ponto, calculada por **simulação com `stepBodies`** (busca da velocidade) e não pela fórmula contínua, com desvio angular e de força vindos de um gerador pseudoaleatório com **semente**, e **três níveis** (`BOT_LEVELS`: fácil, médio e difícil, por desvio angular e de força), com o médio como nível padrão (`DEFAULT_BOT`). A velocidade de qualquer tiro do bot NÃO DEVE passar de `gain · maxPull` do jogador. Na tela, a semente DEVE ser **sorteada a cada partida** (a semente fixa só existe em teste), para a sequência de acertos e erros do bot não se repetir de uma partida para a outra.
- **FR-008:** O **Bete** DEVE ser um modo da partida, jogável contra a meta (até 5 tiros; vitória ao acertar em até 3, empate no 4º ou 5º, derrota sem acertar nos 5; acerto encerra) e contra o bot (vez alternada a cada tiro, até 5 tiros por competidor; os dois atiram o mesmo número de vezes, então o acerto de quem começou só fecha a rodada depois do tiro de igual número do outro: quem acertou em menos tiros vence, acertar no mesmo número de tiro é empate e 5 tiros cada sem acerto também é empate), com o alvo em 3 posições fixas (uma por rodada, igual para os dois), e DEVE remover o código do bete solo antigo que ficar sem uso.
- **FR-009:** O **Triângulo** DEVE ser um modo com 6 bolinhas em triângulo (fileiras de 1, 2 e 3) dentro de um círculo e uma bolinha de tiro de ponto fixo; captura quando uma bolinha para totalmente fora do círculo (centro a pelo menos raio do círculo + raio da bolinha), atribuída ao competidor do tiro inclusive em cadeia; contra a meta até 8 tiros (6 capturas é vitória e encerra na 6ª, 4 ou 5 empate, 3 ou menos derrota); contra o bot um tiro para cada um, sempre (capturar não mantém a vez), até 5 tiros por competidor, mais capturas vence e iguais (inclusive 0 a 0) empatam. As 3 rodadas usam a mesma formação.
- **FR-010:** O **Cova** DEVE ser um modo com 3 covas numeradas (raio da cova 22, raio da bolinha 14) jogadas em ordem, só a cova da vez ativa, em 3 layouts fixos (um por rodada, iguais para os dois); a bolinha fica onde parou entre os tiros; entra na cova ativa quando o centro está dentro do raio e a velocidade é menor que 120 unid/s (configurável, sempre maior que `stopSpeed`), avaliado a cada passo e na parada; contra a meta até 9 tiros (3 covas em até 6 é vitória e encerra, 7 a 9 empate, sem completar derrota); contra o bot, cada um com a sua bolinha, vez alternada, até 9 tiros cada, resultado por completar > tiros > covas feitas, com os empates definidos; quem completa as 3 covas sai da disputa e não recebe mais vez (os tiros dele não crescem), enquanto o outro usa os tiros que lhe restam.
- **FR-011:** Cada modo DEVE declarar um **texto de ajuda** não vazio (regra em poucas linhas, etapas do gesto e dicas do que corrigir) que cite vitória, derrota e empate, consumido pela interface.
- **FR-012:** A camada web DEVE adaptar `marblesController` e `useMarblesGame` para conduzirem uma **partida do motor** em vez da rodada do bete, com tela inicial de escolha de modo (os disponíveis), de adversário (meta ou bot), do **nível do bot** (fácil, médio ou difícil; só aparece contra o bot, com o médio marcado) e do controle de tiro (pinça ou estalo alpha) e botão "Começar partida"; durante a partida DEVE mostrar o campo do modo, o número da rodada, o placar das rodadas, os tiros restantes do jogador, de quem é a vez e um status de uma linha; DEVE mostrar também o **modo, o adversário e o nível do bot** da partida, a **contagem da rodada** do modo (capturas do Triângulo e covas da Cova, "Você × Bot" contra o bot) e, contra o bot, a **cor própria da bolinha do bot** em todos os modos, com legenda; na Cova contra o bot a bolinha parada de quem não está na vez DEVE continuar visível na cor do dono; e ao fim mostrar o resultado da rodada e da partida com "Jogar de novo" e "Trocar de modo". Modo e adversário só mudam entre partidas.
- **FR-013:** Durante a **vez do bot**, a interface DEVE ignorar o gesto da mão, dizer no status que é a vez do bot e animar o tiro do bot; a troca entre pinça e estalo DEVE continuar funcionando; DEVE existir mensagem de status de uma linha para cada estado (sem câmera, mão não vista, sua vez, vez do bot, rodada vencida/empatada/perdida, partida encerrada).
- **FR-014:** O painel "Como jogar" DEVE ser alimentado pelo texto de ajuda de cada modo, trazendo como vence, perde e empata contra a meta e contra o bot em frases curtas (no máximo 2 frases por mensagem), com as etapas do gesto e a atual destacada por `aria-current`, e dicas curtas no lugar de parágrafos; DEVE mudar de conteúdo com o modo e o adversário e, antes de começar, mostrar a ajuda do modo selecionado.

## Requisitos não funcionais

- **NFR-001:** O controlador de mira, o motor, o bot e os modos DEVEM ser puros e determinísticos: o tempo entra só pelos argumentos, sem relógio nem DOM, e o pacote NÃO DEVE importar MediaPipe. A mesma sequência de leituras e a mesma semente DEVEM produzir o mesmo resultado.
- **NFR-002:** Os valores de jogo (3 rodadas, 5/8/9 tiros, metas de vitória, 3 posições/layouts, velocidade de entrada da cova 120, nível do bot) DEVEM ficar em configuração e ser declarados como palpites iniciais a calibrar com uso real, sem afirmação de equilíbrio medido.
- **NFR-003:** A privacidade DEVE ser preservada como nos outros jogos: processamento local, sem gravar nem enviar imagem, sem requisição a terceiros; o aviso de privacidade, a depuração recolhida e a câmera ficam como estão, com a mesma redação curta.
- **NFR-004:** A entrega NÃO DEVE afirmar precisão, latência, equilíbrio ou diversão sem medição; a faixa de acerto do bot é uma proteção de regressão, não prova de equilíbrio, e não há teste ao vivo com a mão real nesta entrega.
- **NFR-005:** A implementação DEVE ser test-first e incremental, com os gates oficiais verdes; a entrega NÃO DEVE deixar código morto (o bete solo antigo sem uso é removido).

## Edge cases

- **Mão perdida durante a mira:** sem a mão por mais que o tempo de tolerância, a mira é cancelada; o controlador de mira preserva esse comportamento.
- **Efeito em cadeia:** uma bolinha empurrada por outra (que foi empurrada pelo tiro) que sai do campo do modo é atribuída ao competidor do tiro corrente.
- **Vitória antes do limite:** uma vitória decidida encerra a rodada sem consumir os tiros restantes do competidor.
- **Esgotamento de tiros:** quando os tiros de um competidor acabam sem decisão, o motor pede o resultado ao modo e a rodada não fica presa; contra o bot, quem esgotou os tiros é pulado.
- **Tiro fora da vez:** contra o bot, uma leitura que tentaria atirar fora da vez do competidor não tem efeito.
- **Bolinha rápida sobre a cova:** acima de 120 unid/s a bolinha passa por cima da cova sem cair; covas que não são a ativa nunca capturam.
- **Formação do triângulo instável:** seis bolinhas encostadas poderiam se mover sozinhas; a folga inicial (centros a mais que a soma dos raios) evita o deslocamento sem tiro.
- **Captura e tiro errado no triângulo/bete:** a bolinha capturada sai do campo e as demais ficam onde pararam; no bete, após erro a bolinha de tiro volta ao ponto de partida e o alvo à posição da rodada.
- **Alternância de quem começa:** contra o bot, o jogador começa a rodada 1, o bot a 2 e o jogador a 3.

## Hipóteses e dependências

- **H-01 — Simulação do bot:** a velocidade exata para parar num ponto é encontrada por busca com `stepBodies`, porque `moveBody` desacelera linearmente e zera a velocidade abaixo de `stopSpeed` (8 unid/s) no passo de 1/120 s, de modo que a fórmula contínua `v = √(2·atrito·distância)` não é exata. Hipótese de que a busca converge dentro da faixa 50..700 unidades; validada pelo teste de parada a 1 unidade.
- **H-02 — Faixa de acerto do bot:** os desvios dos três níveis (`BOT_LEVELS`) são palpites; as faixas de acerto em 1000 tiros (30%–55%, 55%–80% e 78%–95%) são uma proteção de regressão, não uma medida de equilíbrio. A calibração real fica para o uso.
- **H-03 — Velocidade de entrada da cova:** 120 unid/s é um palpite de jogo, sempre maior que `stopSpeed`; pode ser difícil para a mão e será calibrado com uso real.
- **H-04 — Solver de colisão:** o `stepBodies` faz uma passada de colisão por passo; a folga na formação do triângulo e o teste de estabilidade sem tiro mitigam o estresse de seis bolinhas encostadas.
- **Dependência:** a física atual (`stepBodies`, `isAtRest`, `moveBody`, `computeShot`) é reaproveitada; a física não tem cova nem remoção de corpo, então a regra vive no modo, que retira a bolinha da lista passada a `stepBodies` ao capturar ou ao entrar na cova.
- **Dependência de ordem:** #87 (motor) é o gargalo de risco e depende de #86; #88 depende de #87 só pela interface de fonte do tiro; #89, #90 e #91 dependem de #86, #87 e #88; #92 depende de #87 e #88 e os modos entram no seletor conforme ficam prontos; #93 depende de #92 e dos textos de ajuda dos modos.

## Critérios mensuráveis de sucesso

- **SC-001:** Os testes do pacote `@guess-my-move/marbles` (controlador de mira, motor, bot e os três modos) passam, e `round.test.ts` e `flick-replay.test.ts` passam sem alteração.
- **SC-002:** Com a mesma sequência de leituras e a mesma semente, uma partida produz o mesmo resultado (determinismo), verificado por teste.
- **SC-003:** O teste do bot registra, em 1000 tiros com sementes distintas, por nível, uma taxa de acerto dentro da faixa do nível (fácil 30%–55%, médio 55%–80%, difícil 78%–95%) contra um alvo a 400 unidades (raio 14), crescente do fácil ao difícil, e nenhum tiro excede `gain · maxPull`.
- **SC-004:** O teste do fluxo da tela cobre, com câmera e rastreador simulados, cada modo disponível contra a meta e contra o bot, e os testes de componente do painel cobrem os 3 modos e os 2 adversários.
- **SC-005:** `yarn check:static`, `yarn test` e `yarn build` ficam verdes, e os gates documentais (`yarn sdd:check`, `yarn docs:format:check`) passam.
- **SC-006:** As limitações (sem teste ao vivo com a mão real, valores a calibrar, faixa de acerto como proteção de regressão e não equilíbrio) ficam declaradas na spec, no plano e no Gate 3.
