# Pesquisa — 2026-10-27-game-marbles-bete-build-flick-beta

## Pergunta

Como adicionar um segundo modo de tiro por estalo ao bete solo, lido pela mesma câmera e pelo mesmo rastreador de mão, reaproveitando o detector de pinça existente, com a lógica testável sem câmera e sem alterar o modo pinça, a física, o alvo nem o jogo de cartas?

## Decisões

### O estalo como uma pinça que abre rápido

O tiro real da bolinha de gude — bolinha no indicador dobrado, polegar preso atrás disparando — é, para a câmera, a mesma geometria do fechamento da pinça: polegar contra o indicador. O que distingue o estalo de uma abertura comum da mão é a RAPIDEZ da abertura. Por isso o modo estalo compõe o detector de pinça já entregido: herda o cálculo da razão `distância(4, 8) / distância(0, 9)` e a histerese (fecha <= 0,35, abre >= 0,55), e acrescenta a medição do quão rápido a razão subiu. Armar é fechar; disparar é abrir num estalo rápido. Reescrever um detector independente duplicaria a razão e a histerese e divergiria do modo pinça.

### Direção pela orientação da mão, medida no início da abertura

A mira do estalo não pode vir do arrasto (o estalo mal se move no plano) nem da trajetória da mão (o próprio estalo a perturba). A decisão é usar a orientação da mão no plano da imagem: o vetor do pulso (landmark 0) à base do dedo médio (landmark 9), com x corrigido pela proporção da imagem e espelhado em x como o preview, normalizado. Essa direção é medida no INÍCIO da abertura (antes de o estalo perturbar a mão) e usada no disparo. Quando o vetor é degenerado (mão apontando para a câmera, comprimento quase zero), `handDirection` devolve `null`. A hipótese de que o jogador aponta a mão para o alvo é H-02, a validar no teste do maintainer.

### Rápido vs. lento: início da subida, duração e pico de velocidade

Para separar o estalo de uma abertura lenta, o detector guarda um histórico curto de amostras (400 ms) e, ao cruzar a abertura (razão >= 0,55), calcula: o início da subida (RISE_START) como a última amostra com razão <= 0,40; a duração como o tempo do início da subida até a amostra que cruzou 0,55; e a velocidade de abertura como o PICO da inclinação da razão (diferença de razão por segundo) entre amostras consecutivas dessa subida. O pico, e não a média, é usado porque com poucas amostras a média subestima um estalo curto. É "rápido" quando duração <= 300 ms e velocidade >= 2 razão/s; senão é "lento" e o tiro é cancelado.

### Força por velocidade de abertura

A força do tiro vem da rapidez do estalo: interpolação linear de 300 a 1100 unid/s quando a velocidade de abertura vai de 2 a 8 razão/s, limitada nos extremos. Um estalo rápido mas abaixo do mínimo de força é "fraco" e não dispara. Isso dá ao jogador controle de força pela intensidade do estalo, análogo ao arrasto do modo pinça.

### Composição no pacote puro e roteamento no controlador

Toda a lógica nova fica em `packages/marbles/src/flick.ts` (`handDirection`, `createFlickDetector`, `flickShot`, `DEFAULT_FLICK`), pura e sem DOM; `round.ts` ganha `observeFlick` e `snapshot().flick`, e `fire` passa a receber a velocidade. No app web, o `MarblesController` ganha `mode`/`setMode` e roteia cada quadro para o detector do modo, preservando intacto o caminho do modo pinça. Essa composição mantém o modo pinça e seus testes sem alteração (FR-009) e a lógica executável em Node (NFR-001).

## Parâmetros de partida (placeholders)

| Parâmetro                       | Valor inicial                 | Observação                               |
| ------------------------------- | ----------------------------- | ---------------------------------------- |
| Razão para fechar (armar)       | <= 0,35                       | Herdada do detector de pinça (histerese) |
| Razão para abrir (disparar)     | >= 0,55                       | Herdada do detector de pinça (histerese) |
| Início da subida (RISE_START)   | última <= 0,40                | Primeira amostra da subida medida        |
| Histórico de amostras           | 400 ms                        | Janela curta para medir a subida         |
| Duração máxima para "rápido"    | <= 300 ms                     | Acima disso, lento (cancela)             |
| Velocidade mínima para "rápido" | >= 2 razão/s                  | Pico da inclinação da razão              |
| Mapeamento de força             | 2–8 razão/s → 300–1100 unid/s | Linear, limitado nos extremos            |
| Perda de mão na mira            | > 300 ms                      | Cancela; qualquer perda zera o armado    |

Alcance (cálculo, não medição): com atrito 400 unid/s², chegar ao alvo exige cerca de 545 unid/s, o que corresponde a uma velocidade de abertura de cerca de 4,1 razão/s no mapeamento acima. Todos os valores são placeholders (H-01) e serão ajustados pelo painel de depuração e pelo teste do maintainer.

## Limitações

- Nenhuma medição de taxa de quadros, latência ou quadros por estalo foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002).
- Uma webcam de 30 quadros/s pode dar só 2 a 3 amostras por estalo (H-04); a máquina do maintainer processou cerca de 83 quadros/s em uma medição (um dado, uma máquina). Se a amostragem for pobre, a velocidade de abertura e a duração perdem resolução.
- A detecção do estalo é a incógnita da issue #68; esta spec entrega o modo beta e os números, não a decisão de viabilidade.

## Decisão

Módulo `flick.ts` no pacote puro, compondo o detector de pinça: `handDirection` (orientação da mão espelhada e normalizada), `createFlickDetector` (histórico de 400 ms, soltura com rápido/lento, pico de velocidade, duração e direção no início da abertura, perda zera o armado) e `flickShot` (mapeamento linear de força, `null` para lento ou fraco); `observeFlick` e `snapshot().flick` na rodada; roteamento por modo no `MarblesController` com seletor e painel do estalo na tela, sem alterar o modo pinça nem o jogo de cartas.
