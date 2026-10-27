# Pesquisa — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Pergunta

Como tornar o modo estalo (alpha) do bete jogável, dado que no primeiro teste com a mão real a força saía sempre no máximo, aberturas lentas disparavam e a direção não acompanhava a intenção, mantendo o estalo como uma mecânica própria e distinta da pinça (direção pela orientação da mão, força pelo polegar), sem alterar o modo pinça, a física, o alvo nem o jogo de cartas, e com a lógica testável sem câmera?

## Decisões

### Pinça e estalo são mecânicas distintas (correção de rumo)

O maintainer corrigiu uma primeira tentativa que dava ao estalo a mira relativa da pinça: "Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo". Na pinça, a força é regulada pela mão (arrasto, estilingue); no estalo, pela velocidade de abertura do polegar, e a mecânica é mais complexa. A decisão é preservar a distinção: a direção do estalo vem da orientação da mão no plano da imagem e a força, da velocidade de abertura; o arrasto relativo NÃO entra no estalo. O refino muda a escala de força e o gatilho, não a fonte de direção nem de força.

### Direção pela orientação da mão, medida no início da abertura

A direção vem do vetor do pulso (landmark 0) à base do dedo médio (landmark 9), com x multiplicado pela proporção da imagem e espelhado em x (como o preview), normalizado para comprimento 1, e `null` quando o vetor é degenerado. É medida no início da abertura e publicada como seta de prévia a partir da bolinha enquanto armado, para o jogador ajustar a mão antes de soltar. No teste, os dois vetores legíveis apontaram para cima e para a esquerda e nenhum dos 8 tiros acertou; isso é incerteza a medir (H-04), não motivo para trocar a fonte. Um estalo sem direção medida cancela ("sem direção").

### Força pela velocidade de abertura numa escala logarítmica

A velocidade de abertura é o pico da inclinação da razão entre amostras consecutivas da subida. No teste, as 15 velocidades (9,1 a 199 razão/s) ficaram todas acima do teto linear de 8 razão/s, então todos os tiros saíram na força máxima (1100 unid/s); a escala linear de 2 a 8 satura de imediato. A decisão é trocar para uma escala logarítmica, que espalha a amplitude observada (10 a 200) entre força 0 e 1:

```text
power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)
velocidadeDoTiro = minShotSpeed + power × (maxShotSpeed − minShotSpeed)
```

com `powerLowSpeed` = 10 (v <= 10 dá força 0), `powerHighSpeed` = 200 (v >= 200 dá força 1), `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. O parâmetro linear `maxOpenSpeed` (8) sai. A faixa 10 a 200 vem só da amplitude observada; o maintainer não informou quais estalos foram fracos e quais fortes, então a variação de ~22 vezes pode ser em parte a força do polegar, não confirmada (H-02).

Conta de alcance (não medição): o campo é 800 × 600; o alvo fica a 400 unid da bolinha e o atrito é 400 unid/s², então a bolinha só chega ao alvo com cerca de 545 unid/s ou mais, ou seja, com `power` >= cerca de 0,31, `v` >= cerca de 25 razão/s.

### Limite de abertura lenta de 80 ms

Das 15 aberturas, 13 ficaram em 37 ms ou menos e duas (103 e 192 ms) dispararam por o limite ser 300 ms. Baixar `slowMs` para 80 ms rejeita as duas lentas e deixa folga sobre os 37 ms observados, separando o estalo de uma abertura comum. `minOpenSpeed` segue em 2 razão/s (corte de abertura fraca). São palpites de uma sessão (H-01).

### Processar só quadros novos da câmera: rVFC com recuo para currentTime

Foram processados cerca de 86 quadros/s, mais que os 30/s de uma webcam comum. O laço usava `requestAnimationFrame` e só pulava quando `video.currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo. A decisão é usar `requestVideoFrameCallback`, a API específica que entrega um callback por quadro de vídeo, quando disponível, e recuar para a comparação de `currentTime` quando não (por exemplo no jsdom), sem reprocessar um `currentTime` repetido. O painel passa a mostrar "Quadros novos da câmera/s" (janela de 1 s) para medir a taxa real. A velocidade de abertura é medida entre amostras consecutivas do detector; com quadros novos da câmera, as amostras passam a ser quadros reais. Numa abertura de um quadro, a velocidade é limitada pela taxa de quadros (H-05). Vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos. A hipótese de reprocessamento (H-03) é a medir.

### Substituir a spec de criação do estalo

`spec.md` é a única fonte vigente do comportamento (Princípio II). Como este refino redefine a escala de força (linear → log), o gatilho (300 → 80 ms) e o processamento de quadros, a spec de criação `2026-10-27-game-marbles-bete-build-flick-beta` deixa de ser a fonte vigente. O validador estrutural (`scripts/sdd/check-state.mjs`, função `checkState`) trata uma spec `superseded` como um caso que só exige `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres fora de fences), e retorna sem reprocessar os demais artefatos. Ambos atendidos. Por isso a antiga passa a `superseded`, esta declara `supersedes`, é a fonte vigente completa do modo estalo, e o catálogo é atualizado. A spec do modo pinça não muda de comportamento e entra só em `related_specs`.

## Parâmetros (palpites, uma sessão de teste)

| Parâmetro                            | Valor       | Mudança           | Observação                                            |
| ------------------------------------ | ----------- | ----------------- | ----------------------------------------------------- |
| Razão para fechar (armar)            | <= 0,35     | mantido           | Herdado do detector de pinça (histerese)              |
| Razão para abrir (gatilho)           | >= 0,55     | mantido           | Herdado do detector de pinça (histerese)              |
| `slowMs` (duração máx. do gatilho)   | 80 ms       | de 300 para 80 ms | 13 de 15 aberturas <= 37 ms; rejeita 103 e 192 ms     |
| `minOpenSpeed` (gatilho/corte fraco) | 2 razão/s   | mantido           | Abaixo disso é fraco (cancela)                        |
| `powerLowSpeed` (força 0)            | 10 razão/s  | novo              | v <= 10 → power 0                                     |
| `powerHighSpeed` (força 1)           | 200 razão/s | novo              | v >= 200 → power 1                                    |
| `minShotSpeed`                       | 300 unid/s  | mantido           | Velocidade do tiro com power 0                        |
| `maxShotSpeed`                       | 1100 unid/s | mantido           | Velocidade do tiro com power 1                        |
| `maxOpenSpeed` (teto linear)         | removido    | removido          | Escala linear de 2 a 8 satura; sai com a escala log   |
| Perda de mão na mira                 | > 300 ms    | mantido           | Cancela; qualquer perda zera o armado                 |
| Direção (orientação da mão)          | mantida     | mantida           | Pulso → base do dedo médio, espelhada; `null` cancela |

## Limitações

- Nenhuma medição do estalo com a escala logarítmica e o gatilho de 80 ms foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002), incluindo a força lida no painel e se o tiro acerta o alvo.
- A faixa 10 a 200 da escala de força vem só da amplitude observada; não se sabe quais estalos foram fracos ou fortes (H-02).
- A taxa real da câmera é a medir pelo novo contador do painel; a hipótese de reprocessamento (H-03) só se confirma ou refuta com esse número.
- A direção pela orientação da mão pode não corresponder ao estalo real (H-04); o estalo real vai para a frente (profundidade), eixo que a câmera não vê.
- Os vídeos do teste não fazem parte do repositório; só os números lidos do painel entram nos documentos.
- O estalo real de lado, com a câmera baixa (segundo vídeo), pode não ser seguido pelo detector; está fora do escopo (H-04).

## Decisão

No modo estalo, a direção vem da orientação da mão (pulso → base do dedo médio, espelhada), medida no início da abertura e mostrada como seta de prévia; a força vem da velocidade de abertura do polegar por uma escala logarítmica (`powerLowSpeed` 10, `powerHighSpeed` 200, `minShotSpeed` 300, `maxShotSpeed` 1100); o `maxOpenSpeed` linear sai. A rodada dispara o tiro quando a abertura é um gatilho rápido (subida <= 80 ms e velocidade >= 2 razão/s) com direção medida; cancela quando lenta, fraca ou sem direção, ou quando perde a mão. O laço processa só quadros novos da câmera (`requestVideoFrameCallback` com recuo para `currentTime`) e o painel mostra a taxa real da câmera, a força e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem direção`). A pinça não muda. A spec de criação do estalo passa a `superseded` apontando para esta.
