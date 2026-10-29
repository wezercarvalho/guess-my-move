# Pesquisa — 2026-10-29-game-marbles-modes-build-single-player-matches

## Pergunta

Como transformar o bete solo das bolinhas de gude num jogo de partidas com três modos (Bete, Triângulo e Cova) jogáveis contra a meta e contra um bot, concentrando a lógica num pacote puro e determinístico, reaproveitando a física atual (`stepBodies`), sem inventar números novos além dos fixados nas issues #86 a #93, e sem afirmar equilíbrio ou diversão sem uso real?

## Fatos verificáveis (código atual do repositório)

### A mira já vive dentro do bete

Em `packages/marbles/src/round.ts`, `createBeteRound` mistura a leitura da mão (pinça por `observePinch`/`virtualPinch`, estalo por `observeFlickReading`, âncora relativa pela `aimAnchor`/`aimScale`, mão perdida por `lostHandMs`, cancelamento por `cancelAim`) com as regras do bete (duas bolinhas, acerto entre os índices 0 e 1, tiros ilimitados, fim em `hit`). O tiro nasce em `fire(velocity)` e o `computeShot` (de `shot.ts`) calcula o vetor a partir do arrasto. **Decisão:** a mira sai para um módulo próprio e o bete passa a consumi-lo (issue #86), provando a paridade pela não alteração de `round.test.ts` e `flick-replay.test.ts`.

### A física desacelera em degrau e zera abaixo de `stopSpeed`

Em `packages/marbles/src/physics.ts`, `moveBody` subtrai `friction * dt` da velocidade a cada passo e, quando o resultado cai abaixo de `stopSpeed` (8 unid/s no `DEFAULT_PHYSICS`), **zera a velocidade de uma vez**. O passo é fixo em 1/120 s, as colisões entre bolinhas são elásticas de massas iguais (`marbleRestitution` 1), e as paredes refletem com `wallRestitution` 0,8. Esse degrau de parada é o motivo de o bot não poder usar a fórmula contínua `v = √(2·atrito·distância)`: ela ignora o `stopSpeed` e erra perto do alvo. **Decisão:** o bot acha a velocidade por **busca com `stepBodies`** (CQ-006, H-01).

### O tiro tem teto de velocidade conhecido

Em `packages/marbles/src/shot.ts`, `DEFAULT_SHOT` tem `gain` 5 e `maxPull` 220, então a maior velocidade que o jogador produz é `gain · maxPull` = 1100 unid/s. A issue #88 fixa esse mesmo teto para o bot. **Decisão:** o planejador do bot limita o resultado a `gain · maxPull`.

### A física não tem alvo, cova nem remoção de corpo

`stepBodies` opera sobre uma lista de `Body` (posição, velocidade, raio) e devolve corpos novos e os pares em contato; não conhece "alvo", "círculo", "cova" nem remove corpos. **Decisão:** a geometria de cada modo (alvo do bete, círculo do triângulo, covas) e a remoção de bolinhas (captura, entrada na cova) vivem no **modo**, que monta e filtra a lista passada a `stepBodies`; a física fica intacta.

## Decisões de arquitetura

### Camadas: mira, motor, bot e modos, separados da apresentação

Toda a lógica determinística fica em `@guess-my-move/marbles`, sem DOM, sem MediaPipe e sem relógio, testável em Vitest. A camada web (`apps/web/src/marbles`) só consome o contrato.

| Módulo (novo)                 | Responsabilidade                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `aim/` (controlador de mira)  | leitura da mão (pinça e estalo) → tiro; âncora relativa, escala, mão perdida, cancelamento; não conhece alvo, rodada nem física |
| `match/` (motor de partida)   | 3 rodadas, competidor do tiro, vez, resultado da rodada e da partida; recebe o tiro pela fonte do tiro; opera sobre o contrato  |
| `bot/` (planejador)           | direção até um ponto; velocidade por busca com `stepBodies`; erro angular/força por semente; `DEFAULT_BOT`; teto `gain·maxPull` |
| `modes/bete/`                 | campo do bete, 3 posições de alvo, limites de tiro, avaliação de acerto, texto de ajuda                                         |
| `modes/triangulo/`            | círculo e 6 bolinhas, captura por sair do círculo, vez mantida por captura, texto de ajuda                                      |
| `modes/cova/`                 | 3 covas em ordem, entrada por velocidade < 120, bolinha que fica onde parou, texto de ajuda                                    |

### Contrato de modo que nasce com o que os três modos precisam e nada além

A issue #87 alerta para um contrato grande demais. **Decisão:** o contrato declara exatamente (a) montagem do campo por rodada, (b) limite de tiros por competidor e por adversário, (c) avaliação do campo em repouso (o que o tiro rendeu, se a rodada terminou e o resultado), e (d) de quem é a próxima vez (padrão alterna, o modo pode manter). Nada além. **Alternativa rejeitada:** um contrato que também fixasse o número de competidores ou o limite de tiros no motor — a issue proíbe, porque o triângulo mantém a vez e os limites diferem por modo e por adversário.

### Vez decidida pelo modo, não pelo motor

O bete e a cova alternam a vez a cada tiro; o triângulo mantém a vez enquanto o jogador captura. **Decisão:** o motor pergunta ao modo de quem é a próxima vez (padrão: alterna); o triângulo responde "mantém" quando o tiro capturou. **Alternativa rejeitada:** fixar a alternância no motor (não serve ao triângulo).

### Bot por simulação, não por fórmula contínua

Já fundamentado nos fatos acima e na CQ-006/H-01: a busca com `stepBodies` converge para a velocidade que para a bolinha no ponto, respeitando o degrau de `stopSpeed`. O erro é um desvio angular e um fator de força a partir de um PRNG com semente, para o mesmo jogo repetir o mesmo tiro. **Alternativas rejeitadas:** fórmula contínua (imprecisa perto do alvo); tabela pré-calculada (frágil a mudanças de física e de raio).

### Cova e triângulo como geometria do modo, não da física

A física continua sendo só círculos, paredes e atrito. **Decisão:** o círculo do triângulo e as covas são conceitos do modo: o triângulo testa "centro totalmente fora do círculo" para capturar e remove a bolinha; a cova testa "centro dentro do raio da cova ativa e velocidade < 120" a cada passo e na parada, fixa a bolinha e a retira da lista. **Alternativa rejeitada:** acrescentar covas e remoção de corpo na física (acoplaria a física a um modo e quebraria a paridade do bete).

### Fonte do tiro como interface, aberta ao segundo jogador

A issue #87 pede uma interface de fonte do tiro atrás da qual o motor recebe o tiro, sem assumir um único humano. **Decisão:** a mão do jogador e o bot são duas fontes de tiro; um segundo jogador no futuro é uma terceira fonte, sem ser implementado (CQ-005, D-05). **Alternativa rejeitada:** o motor ler a mão diretamente (fecharia a porta ao bot e ao segundo jogador).

## Determinismo e privacidade

- Todo o pacote é puro: o tempo entra pelos argumentos, o acaso entra por semente. A mesma sequência de leituras e a mesma semente produzem o mesmo resultado (SC-002), inclusive os tiros do bot.
- A privacidade segue a dos outros jogos: processamento local, sem gravar nem enviar imagem, sem requisição a terceiros; o aviso de privacidade, a câmera e a depuração recolhida ficam como estão (NFR-003). O jogo das bolinhas não tem carta, então a fronteira de informação da constituição não se aplica aqui.

## Limitações declaradas (sem medição)

- Os valores de jogo (3 rodadas, 5/8/9 tiros, metas de vitória, 3 posições/layouts, velocidade de entrada 120, `DEFAULT_BOT`) são **palpites iniciais a calibrar com uso real**, fixados em configuração (NFR-002).
- A **faixa de acerto do bot** (30% a 60% em 1000 tiros) é **proteção de regressão, não equilíbrio medido** nem prova de diversão (NFR-004, H-02).
- A **velocidade de entrada da cova** pode ser difícil para a mão; é um palpite a calibrar (H-03).
- Não há **teste ao vivo com a mão real** nesta entrega; a verificação é por testes e, na tela, por câmera e rastreador simulados.
