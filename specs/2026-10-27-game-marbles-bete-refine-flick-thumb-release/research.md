# Pesquisa — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Pergunta

Como tornar o modo estalo (alpha) do bete jogável, dado que o 1º teste com a mão real tinha a força sempre no máximo e aberturas lentas disparando, e o 2º teste mostrou que armar pela pinça fechada e disparar por uma subida curta (<= 80 ms) ainda não servia — a mão fechada em movimento disparava falso e a pose real do estalo nunca armava —, mantendo o estalo como uma mecânica própria e distinta da pinça (direção pela orientação da mão, força pelo polegar esticando de uma vez), sem alterar o modo pinça, a física, o alvo nem o jogo de cartas, e com a lógica testável sem câmera?

## Decisões

### Pinça e estalo são mecânicas distintas (correção de rumo)

O maintainer corrigiu uma primeira tentativa que dava ao estalo a mira relativa da pinça: "Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo". Na pinça, a força é regulada pela mão (arrasto, estilingue); no estalo, pela velocidade de abertura do polegar, e a mecânica é mais complexa. A decisão é preservar a distinção: a direção do estalo vem da orientação da mão no plano da imagem e a força, da velocidade de abertura; o arrasto relativo NÃO entra no estalo. O refino muda a escala de força e o gatilho, não a fonte de direção nem de força.

### Direção pela orientação da mão, medida na base da subida

A direção vem do vetor do pulso (landmark 0) à base do dedo médio (landmark 9), com x multiplicado pela proporção da imagem e espelhado em x (como o preview), normalizado para comprimento 1, e `null` quando o vetor é degenerado. É medida na base da subida (o mínimo recente da razão, antes de o estalo perturbar a mão) e publicada como seta de prévia a partir da bolinha enquanto armado, para o jogador ajustar a mão antes de soltar. No 1º teste, os dois vetores legíveis apontaram para cima e para a esquerda e nenhum dos 8 tiros acertou; isso é incerteza a medir (H-04), não motivo para trocar a fonte. Um estalo sem direção medida cancela ("sem direção").

### Gatilho por razão esticada sustentada, não por duração curta

O 2º teste mediu a taxa real da webcam em cerca de 15 quadros novos/s (14,6 a 15,3; cerca de 67 ms entre amostras). A essa taxa, um limite de duração de 80 ms só aceitava a subida de UM quadro, e a oscilação do rastreamento da mão fechada sobe num quadro tão rápido quanto um estalo. Além disso, a velocidade de abertura dos estalos reais (5 a 10 razão/s, limitada pela taxa de quadros) era igual ou menor que a dos disparos falsos do vídeo A (6 a 19 razão/s). Conclusão: a duração e a velocidade NÃO separam estalo de oscilação. O que separa é a razão ficar ESTICADA por vários quadros, que a oscilação não sustenta. A decisão é modelar o estalo como o polegar se esticando de uma vez e ficando esticado:

- **Armar** com a razão <= `armRatio` (1,05), não pela pinça fechada (<= 0,35): na pose real o polegar fica preso contra o indicador dobrado e a razão fica em 0,6 a 1,0, nunca chegando a <= 0,35, então a mão nunca armava pelo critério da pinça. O detector deixa de compor o detector de pinça; só reaproveita `pinchRatio`.
- **Candidato** quando a razão chega a >= `extendRatio` (1,2): procura-se o mínimo da razão nos últimos `baseWindowMs` (250 ms) — a base da subida. Se `razão − base < minRise` (0,4), veredito `weak` ("fraco demais").
- **Confirmação** só se as `confirmSamples` (3) primeiras amostras seguidas ficarem >= `extendRatio` (cerca de 200 ms a 15 quadros/s); se alguma voltar abaixo de 1,2, veredito `unsustained` ("não sustentado"), e rearma se a razão estiver <= `armRatio`.

Os limiares vêm da pose real observada no vídeo B: base 0,6 a 1,0, pico 1,4 a 2,0, razão >= 1,2 por pelo menos 3 amostras nos seis estalos nítidos. Saem `slowMs`, `minOpenSpeed`, `riseStartRatio` e a histerese 0,35/0,55. São palpites de duas sessões de uma pessoa (H-01).

### Força pela velocidade de abertura numa escala logarítmica de 3 a 20

A velocidade de abertura é o pico da inclinação da razão entre amostras consecutivas da base até a última amostra de confirmação. Os estalos reais tiveram 5 a 10 razão/s (limitados pela taxa de 15 quadros/s: a subida acontece em 1 a 2 quadros). A escala anterior de 10 a 200 colocava toda essa faixa real perto de força 0. A decisão é usar uma escala logarítmica de 3 a 20 razão/s, que espalha a faixa observada entre força 0 e 1:

```text
power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)
velocidadeDoTiro = minShotSpeed + power × (maxShotSpeed − minShotSpeed)
```

com `powerLowSpeed` = 3 (v <= 3 dá força 0), `powerHighSpeed` = 20 (v >= 20 dá força 1), `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. A faixa 3 a 20 vem só da amplitude observada; o maintainer não informou quais estalos foram fracos e quais fortes (H-02).

Conta de alcance (não medição): o campo é 800 × 600; o alvo fica a 400 unid da bolinha e o atrito é 400 unid/s², então a bolinha só chega ao alvo com cerca de 545 unid/s ou mais, ou seja, com `power` >= cerca de 0,31, `v` >= cerca de 5,4 razão/s — dentro da faixa dos estalos reais (5 a 10).

### A rodada arma sem exigir a pinça vista aberta antes

No modo estalo, a mira começa assim que a mão está armada, sem exigir ter visto a pinça aberta antes. A pose de estalo fica armada logo após o tiro (o polegar volta a ficar preso contra o indicador), e exigir "aberta antes" desperdiçava o primeiro estalo. O modo pinça NÃO muda: continua exigindo a pinça vista aberta antes.

### Processar só quadros novos da câmera: rVFC com recuo para currentTime

Foram processados cerca de 86 quadros/s, mais que os 30/s de uma webcam comum. O laço usava `requestAnimationFrame` e só pulava quando `video.currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo. A decisão é usar `requestVideoFrameCallback`, a API específica que entrega um callback por quadro de vídeo, quando disponível, e recuar para a comparação de `currentTime` quando não (por exemplo no jsdom), sem reprocessar um `currentTime` repetido. O painel mostra "Quadros novos da câmera/s" (janela de 1 s). O 2º teste mediu a taxa real em cerca de 15 quadros novos/s (14,6 a 15,3), confirmando que o laço antes reprocessava quadros repetidos (H-03). A velocidade de abertura é medida entre amostras consecutivas do detector; com quadros novos da câmera, as amostras passam a ser quadros reais, e numa subida de 1 a 2 quadros a velocidade é limitada pela taxa de quadros (H-05) — motivo pelo qual o gatilho passou a exigir a razão esticada por vários quadros em vez de uma subida rápida. Vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos.

### Substituir a spec de criação do estalo

`spec.md` é a única fonte vigente do comportamento (Princípio II). Como este refino redefine a escala de força (linear → log), o gatilho (300 → 80 ms) e o processamento de quadros, a spec de criação `2026-10-27-game-marbles-bete-build-flick-beta` deixa de ser a fonte vigente. O validador estrutural (`scripts/sdd/check-state.mjs`, função `checkState`) trata uma spec `superseded` como um caso que só exige `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres fora de fences), e retorna sem reprocessar os demais artefatos. Ambos atendidos. Por isso a antiga passa a `superseded`, esta declara `supersedes`, é a fonte vigente completa do modo estalo, e o catálogo é atualizado. A spec do modo pinça não muda de comportamento e entra só em `related_specs`.

## Parâmetros (palpites, duas sessões de teste de uma pessoa, webcam de cerca de 15 quadros/s)

| Parâmetro                                                                       | Valor       | Mudança        | Evidência / observação                                                                                             |
| ------------------------------------------------------------------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `armRatio` (armar)                                                              | 1,05        | novo           | Na pose real a razão fica em 0,6 a 1,0 (polegar preso); <= 0,35 da pinça nunca armava                              |
| `extendRatio` (esticado)                                                        | 1,2         | novo           | Os seis estalos nítidos passaram de base 0,6–1,0 para pico 1,4–2,0, cruzando 1,2                                   |
| `minRise` (subida mínima)                                                       | 0,4         | novo           | Separa um estalo de uma deriva pequena da razão                                                                    |
| `confirmSamples` (sustentar)                                                    | 3 amostras  | novo           | A razão ficou >= 1,2 por pelo menos 3 amostras (cerca de 0,7–1 s) nos estalos reais; a oscilação volta num quadro  |
| `baseWindowMs` (base)                                                           | 250 ms      | novo           | Janela antes do cruzamento em que se procura o mínimo (a base da subida)                                           |
| `powerLowSpeed` (força 0)                                                       | 3 razão/s   | de 10 para 3   | v <= 3 → power 0; a faixa real de 5–10 ficava perto de 0 na escala 10–200                                          |
| `powerHighSpeed` (força 1)                                                      | 20 razão/s  | de 200 para 20 | v >= 20 → power 1; espalha a faixa real (5–10) entre 0 e 1                                                         |
| `minShotSpeed`                                                                  | 300 unid/s  | mantido        | Velocidade do tiro com power 0                                                                                     |
| `maxShotSpeed`                                                                  | 1100 unid/s | mantido        | Velocidade do tiro com power 1                                                                                     |
| `historyMs`                                                                     | 400 ms      | mantido        | Histórico guardado enquanto armado                                                                                 |
| `slowMs`, `minOpenSpeed`, `riseStartRatio`, histerese 0,35/0,55, `maxOpenSpeed` | removidos   | removidos      | A cerca de 15 quadros/s a duração/velocidade não separam estalo de oscilação; a pinça fechada não arma a pose real |
| Perda de mão na mira                                                            | > 300 ms    | mantido        | Cancela; qualquer perda zera o armado                                                                              |
| Direção (orientação da mão)                                                     | mantida     | medida na base | Pulso → base do dedo médio, espelhada; `null` cancela                                                              |

**Ressalva de sobreajuste:** os limiares acima foram escolhidos olhando DUAS gravações de UMA pessoa e UMA webcam de cerca de 15 quadros/s. O replay dessas duas séries (`flick-replay.test.ts`) protege contra regressão, mas não prova que o estalo funciona com outra mão, outra webcam ou ao vivo. Nenhum estalo ao vivo foi testado após esta recalibração (Gate 3 pendente).

## Limitações

- Nenhuma medição ao vivo do estalo com a escala logarítmica de 3 a 20 e o gatilho por razão esticada sustentada foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002), incluindo a força lida no painel e se o tiro acerta o alvo.
- A faixa 3 a 20 da escala de força vem só da amplitude observada (estalos reais de 5 a 10 razão/s); não se sabe quais estalos foram fracos ou fortes (H-02).
- A taxa real da câmera foi medida em cerca de 15 quadros/s (H-03 confirmada); com outra webcam o número e o número de amostras por estalo podem mudar.
- A direção pela orientação da mão pode não corresponder ao estalo real (H-04); o estalo real vai para a frente (profundidade), eixo que a câmera não vê.
- A razão polegar-indicador sozinha não distingue abrir a mão de esticar o polegar: uma mão fechada que se abre pode confirmar um estalo (1 caso no replay do vídeo A); limitação conhecida, não resolvida.
- Os vídeos do teste não fazem parte do repositório; só os números lidos do painel entram nos documentos e na fixture `flick-sessions.ts`.
- Os limiares foram ajustados a DUAS sessões de UMA pessoa e UMA webcam; o replay protege contra regressão mas é sobreajuste a essas séries.

## Decisão

No modo estalo, a mão arma com a razão <= `armRatio` (1,05); quando a razão chega a >= `extendRatio` (1,2) subindo pelo menos `minRise` (0,4) acima do mínimo dos últimos `baseWindowMs` (250 ms) e ficando esticada por `confirmSamples` (3) amostras, o estalo confirma e dispara com a direção da orientação da mão medida na base e a força da velocidade de abertura por uma escala logarítmica de 3 a 20 razão/s (`powerLowSpeed` 3, `powerHighSpeed` 20, `minShotSpeed` 300, `maxShotSpeed` 1100). Subida pequena cancela como `fraco demais`, uma volta abaixo de 1,2 antes de confirmar cancela como `não sustentado`, a falta de direção cancela como `sem direção`, e a perda da mão zera o armado. Saem `slowMs`, `minOpenSpeed`, `riseStartRatio`, a histerese 0,35/0,55 e `maxOpenSpeed`; o detector deixa de compor o de pinça (só reaproveita `pinchRatio`). A rodada arma sem exigir a pinça vista aberta antes. O laço processa só quadros novos da câmera (`requestVideoFrameCallback` com recuo para `currentTime`, taxa real medida de cerca de 15/s) e o painel mostra a taxa real da câmera, a força e o resultado do último estalo (`disparado`, `fraco demais`, `não sustentado`, `sem direção`). A pinça não muda. A spec de criação do estalo passa a `superseded` apontando para esta.
