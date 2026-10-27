# Pesquisa — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Pergunta

Como tornar o modo estalo (alpha) do bete jogável, dado que no primeiro teste com a mão real a força era sempre a máxima, aberturas lentas disparavam e a direção não acompanhava a intenção, reaproveitando a mira do modo pinça (que acertou o alvo), sem alterar o modo pinça, a física, o alvo nem o jogo de cartas, e com a lógica testável sem câmera?

## Decisões

### Mira pelo arrasto relativo da pinça virtual, não pela orientação da mão

O modo pinça mira pela "pinça virtual": a posição alvo é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale` (1,5), e direção e força saem do arrasto por `computeShot`. Essa mira é relativa (começa em qualquer ponto) e não depende da profundidade, que a câmera não vê. No primeiro teste do estalo, a direção vinha da orientação da mão no plano da imagem e nenhum dos 8 tiros acertou o alvo; o modo pinça, com a mesma câmera, acertou. A decisão é dar ao estalo a MESMA mira relativa, reaproveitando a pinça virtual do modo pinça sem duplicá-la. A orientação da mão deixa de ter função e sai do código.

### A abertura rápida como gatilho, não como força

A velocidade de abertura media o salto da razão por quadro: no teste foi de 9,1 a 199 razão/s, toda acima do teto de 8, então todos os tiros saíram na força máxima (1100 unid/s), e em 8 das 15 a subida durou um quadro (11 a 13 ms). Isso mostra que a velocidade de abertura não reflete a força do dedo numa webcam de poucos quadros. A decisão é separar os papéis: a abertura rápida só autoriza o disparo (gatilho), e a direção e a força vêm do arrasto previsto. Assim `flickShot` e os parâmetros `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed` saem; a velocidade e a duração da abertura continuam medidas e mostradas como dado.

### Limite de abertura lenta de 80 ms

Das 15 aberturas, 13 ficaram em 37 ms ou menos e duas (103 e 192 ms) dispararam por o limite ser 300 ms. Baixar `slowMs` para 80 ms rejeita as duas lentas e deixa folga sobre os 37 ms observados, separando o estalo de uma abertura comum. `minOpenSpeed` segue em 2 razão/s. São palpites de uma sessão (H-01): 80 ms é um meio-termo entre não cancelar estalos legítimos (que foram rápidos) e barrar aberturas lentas.

### Processar só quadros novos da câmera: rVFC com recuo para currentTime

Foram processados cerca de 86 quadros/s, mais que os 30/s de uma webcam comum. O laço usava `requestAnimationFrame` e só pulava quando `video.currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo (o `currentTime` pode avançar sem um quadro novo decodificado). A decisão é usar `requestVideoFrameCallback`, a API específica que entrega um callback por quadro de vídeo, quando disponível, e recuar para a comparação de `currentTime` quando não (por exemplo no jsdom, onde a API não existe), sem reprocessar um `currentTime` repetido. O painel passa a mostrar "Quadros novos da câmera/s" (janela de 1 s) para medir a taxa real. Isso vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos. A hipótese de que a taxa real é menor que 86/s (H-02) é a medir, não um fato.

### Substituir em parte a spec de criação do estalo

`spec.md` é a única fonte vigente do comportamento (Princípio II). Como este refino troca o que define direção e força do estalo e remove a orientação da mão, a seta e `flickShot`, a spec de criação `2026-10-27-game-marbles-bete-build-flick-beta` deixa de descrever o comportamento vigente. O validador estrutural (`scripts/sdd/check-state.mjs`, função `checkState`) trata uma spec `superseded` como um caso que só exige `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres fora de fences), e retorna sem reprocessar os demais artefatos daquela spec. Esses dois requisitos são atendidos, então marcar a antiga como `superseded` apontando para esta não quebra `yarn sdd:check`. Por isso a antiga passa a `superseded`, esta declara `supersedes`, e o catálogo é atualizado. A spec do modo pinça não muda de comportamento e entra só em `related_specs`.

## Parâmetros (placeholders, uma sessão de teste)

| Parâmetro                          | Valor     | Mudança                | Observação                                                       |
| ---------------------------------- | --------- | ---------------------- | ---------------------------------------------------------------- |
| Razão para fechar (armar)          | <= 0,35   | mantido                | Herdado do detector de pinça (histerese)                         |
| Razão para abrir (gatilho)         | >= 0,55   | mantido                | Herdado do detector de pinça (histerese)                         |
| `aimScale`                         | 1,5       | mantido (vem da pinça) | Deslocamento da mão vezes a escala                               |
| `slowMs` (duração máx. do gatilho) | 80 ms     | de 300 para 80 ms      | 13 de 15 aberturas <= 37 ms; rejeita 103 e 192 ms                |
| `minOpenSpeed` (gatilho)           | 2 razão/s | mantido                | Abaixo disso é fraco (cancela)                                   |
| Perda de mão na mira               | > 300 ms  | mantido                | Cancela; qualquer perda zera o armado                            |
| Força por velocidade de abertura   | removida  | removida               | `flickShot`, `maxOpenSpeed`, `minShotSpeed`, `maxShotSpeed` saem |

## Limitações

- Nenhuma medição do estalo com a mira relativa foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002), incluindo se o tiro acerta o alvo.
- A taxa real da câmera é a medir pelo novo contador do painel; a hipótese de reprocessamento (H-02) só se confirma ou refuta com esse número.
- Os vídeos do teste não fazem parte do repositório; só os números lidos do painel entram nos documentos.
- O estalo real de lado, com a câmera baixa (segundo vídeo), pode não ser seguido pelo detector; está fora do escopo (H-04).

## Decisão

No modo estalo, a rodada mira pela pinça virtual do modo pinça (reaproveitada, não duplicada) e dispara o tiro previsto pelo arrasto quando a abertura é um gatilho rápido (subida <= 80 ms e velocidade >= 2 razão/s) com arrasto suficiente; cancela quando lenta, fraca ou sem arrasto, ou quando perde a mão. O detector de estalo deixa de produzir direção e força; `handDirection`, `direction`, a seta, `flickShot` e os parâmetros de força saem. O laço processa só quadros novos da câmera (`requestVideoFrameCallback` com recuo para `currentTime`) e o painel mostra a taxa real da câmera e o resultado do último estalo (`disparado`, `lento demais`, `fraco demais`, `sem tiro`). A spec de criação do estalo passa a `superseded` apontando para esta.
