# Pesquisa — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Pergunta

Como tornar o modo estalo (alpha) do bete jogável, dado que o 1º teste com a mão real tinha a força sempre no máximo e aberturas lentas disparando, o 2º teste mostrou que armar pela pinça fechada e disparar por uma subida curta (<= 80 ms) ainda não servia — a mão fechada em movimento disparava falso e a pose real do estalo nunca armava — e, depois, o maintainer relatou que mirar pela orientação da mão ficou ruim de usar, mantendo o estalo como uma mecânica própria e distinta da pinça na FORÇA e no GATILHO (força pelo polegar esticando de uma vez; direção pela mira relativa, igual à da pinça), sem alterar o modo pinça, a física, o alvo nem o jogo de cartas, e com a lógica testável sem câmera?

## Decisões

### Pinça e estalo são mecânicas distintas (correção de rumo)

O maintainer corrigiu uma primeira tentativa que dava ao estalo a mira relativa da pinça: "Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo". Na pinça, a força é regulada pela mão (arrasto, estilingue); no estalo, pela velocidade de abertura do polegar, e a mecânica é mais complexa. A decisão é preservar a distinção na FORÇA e no GATILHO: a força do estalo vem da velocidade de abertura e o arrasto NÃO entra na força. A DIREÇÃO, essa sim, voltou a ser a mira relativa da pinça numa decisão posterior (CQ-011), depois que o maintainer relatou que mirar pela orientação da mão ficou ruim de usar — a distinção entre os modos não exige direções diferentes, só força e gatilho diferentes.

### Direção pela mira relativa (CQ-011, substituindo a orientação da mão)

A direção do estalo vinha da orientação da mão no plano da imagem (vetor do pulso à base do dedo médio, espelhado, medido na base da subida; CQ-002). Ao testar, o maintainer relatou que mirar assim ficou "muito ruim" de usar — exigia girar o punho para mudar a direção — enquanto "a mira da pinça até está ok". Não houve medição; é relato. A decisão (CQ-011) é reaproveitar a **mira relativa** da pinça, que o maintainer aprovou: quando a mão arma (razão baixa), o ponto da mão (a base do dedo médio, landmark 9, espelhada em x — não o ponto médio entre as pontas, porque a base não se move quando o polegar estica) vira a âncora; o deslocamento da mão desde a âncora, vezes o ganho `aimScale` (1,5, o mesmo da pinça), define uma pinça virtual, e a direção do tiro vai da pinça virtual para a bolinha (estilingue: afastar a mão do alvo manda o tiro para o alvo). Um arrasto mínimo de 30 unidades (o `minPull` da pinça) é exigido; abaixo disso não há seta e o estalo confirmado cancela como `sem mira`. A mira trava na última posição armada antes de a razão cruzar 1,2 (`FlickRelease.point`); durante a confirmação (fase `pending`) a posição da mão não atualiza a mira. No campo aparece só a seta de direção a partir da bolinha (sem o elástico da pinça) e o anel da mão. O detector perde `handDirection` e o campo `direction`; `flickShot` vira `flickPower(release, config)`, que devolve `{ power, speed }` (ou `null` fora de `confirmed`), e a rodada compõe a velocidade final = direção da mira × `speed`. A força continua no polegar (velocidade de abertura), então a distinção entre os modos fica só na força e no gatilho. Nada disto foi testado ao vivo; `aimScale` e `minPull` são os valores da pinça e podem não ser os melhores para o estalo (H-04).

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

### Reconhecedor de gestos, veto de palma aberta e guia de etapas (emenda CQ-010)

O maintainer pediu detectar o estalo "por troca de gestos" (os gestos prontos do MediaPipe) e uma ajuda na tela com as etapas. Para ter o gesto pronto do quadro, o jogo das bolinhas passa a usar o `GestureRecognizer` (`realGestureLoader`; modo de vídeo, uma mão) em vez do `HandLandmarker`: ele devolve os mesmos landmarks MAIS os gestos. O jogo de cartas continua com o `HandLandmarker`.

Uma conferência offline MUITO limitada (o Gesture Recognizer rodado nos recortes de câmera de duas gravações de tela — foto de baixa resolução com o esqueleto desenhado por cima; a taxa de detecção ficou baixa e não é a do app ao vivo) mediu:

| Gravação                        | Quadros | Mão detectada | Rótulos (gesto pronto)                                                                                |
| ------------------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| Vídeo B (estalos, 9,5 a 35,5 s) | 390     | 151           | `None` 127; `Open_Palm` 23 (pontuações 0,50 a 0,65); `Pointing_Up` 1; `Closed_Fist` e `Thumb_Up` ZERO |
| Vídeo A (punho em movimento)    | 238     | 35            | todos `None` (nenhum `Closed_Fist`)                                                                   |

Conclusões: (1) os gestos prontos NÃO reconheceram a pose do estalo (punho com o polegar preso; polegar para cima), então NÃO se exige `Closed_Fist` para armar nem `Thumb_Up` para disparar — o gatilho por razão da CQ-009 permanece. (2) O gesto entra como **veto de palma aberta**: se alguma das `confirmSamples` amostras de confirmação tiver `Open_Palm` com pontuação >= `gestureMinScore` (0,8), o estalo é cancelado (veredito `open_hand`, resultado `mão aberta`). A pontuação mínima é 0,8 — e não 0,5 — porque dois estalos reais também tiveram `Open_Palm` (pontuações 0,50 a 0,65, polegar esticado, razão 1,0 a 1,4); 0,8 fica acima disso. (3) O gesto aparece no painel na linha "Gesto reconhecido" como diagnóstico. (4) Os landmarks do `GestureRecognizer` coincidiram com os do `HandLandmarker` até a 2ª casa decimal da razão nos 6 quadros em que ambos detectaram (0,67; 0,86; 0,61; 0,72; 0,67; 0,75), o que sugere que a pinça não muda — conferência pequena, não prova.

O ativo `gesture_recognizer.task` (float16, v1, cerca de 8,4 MB, SHA-256 `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`, URL `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`) é baixado por `prepare:assets` junto do `hand_landmarker.task`, servido pelo próprio app e não versionado. A licença do `.task` NÃO foi lida na fonte (mesma ressalva do outro modelo).

A ajuda na tela é o `FlickGuide`: lista ordenada "Etapas do estalo" com quatro etapas (1 fechar a mão com o polegar preso; 2 apontar a mão para o alvo; 3 esticar o polegar de uma vez e deixá-lo esticado; 4 a bolinha rola, a força vem da rapidez), com a etapa atual por `aria-current="step"` (mapeada de `state` + `phase` em `flickStep.ts`: `ready`→1; `aiming` com `phase` `pending`→3, senão→2; `rolling`/`hit`→4) e uma dica em região `aria-live="polite"` para o último estalo que não disparou.

**Ressalva:** o veto NÃO foi medido contra a mão se abrindo de verdade (não houve quadros claros de palma aberta nas gravações), então pode não ajudar; pode cancelar um estalo real se o reconhecedor rotular o polegar esticado como palma aberta com pontuação >= 0,8; os gestos prontos podem não reconhecer a pose ao vivo; a conferência foi em recortes de baixa resolução, não no app ao vivo. Nada foi testado com mão viva. O próximo teste (linha "Gesto reconhecido") decide entre gestos prontos, treino de gesto próprio (Model Maker) ou outra abordagem.

## Parâmetros (palpites, duas sessões de teste de uma pessoa, webcam de cerca de 15 quadros/s)

| Parâmetro                                                                       | Valor           | Mudança        | Evidência / observação                                                                                             |
| ------------------------------------------------------------------------------- | --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `armRatio` (armar)                                                              | 1,05            | novo           | Na pose real a razão fica em 0,6 a 1,0 (polegar preso); <= 0,35 da pinça nunca armava                              |
| `extendRatio` (esticado)                                                        | 1,2             | novo           | Os seis estalos nítidos passaram de base 0,6–1,0 para pico 1,4–2,0, cruzando 1,2                                   |
| `minRise` (subida mínima)                                                       | 0,4             | novo           | Separa um estalo de uma deriva pequena da razão                                                                    |
| `confirmSamples` (sustentar)                                                    | 3 amostras      | novo           | A razão ficou >= 1,2 por pelo menos 3 amostras (cerca de 0,7–1 s) nos estalos reais; a oscilação volta num quadro  |
| `baseWindowMs` (base)                                                           | 250 ms          | novo           | Janela antes do cruzamento em que se procura o mínimo (a base da subida)                                           |
| `powerLowSpeed` (força 0)                                                       | 3 razão/s       | de 10 para 3   | v <= 3 → power 0; a faixa real de 5–10 ficava perto de 0 na escala 10–200                                          |
| `powerHighSpeed` (força 1)                                                      | 20 razão/s      | de 200 para 20 | v >= 20 → power 1; espalha a faixa real (5–10) entre 0 e 1                                                         |
| `minShotSpeed`                                                                  | 300 unid/s      | mantido        | Velocidade do tiro com power 0                                                                                     |
| `maxShotSpeed`                                                                  | 1100 unid/s     | mantido        | Velocidade do tiro com power 1                                                                                     |
| `historyMs`                                                                     | 400 ms          | mantido        | Histórico guardado enquanto armado                                                                                 |
| `openHandGesture` (veto)                                                        | `Open_Palm`     | novo           | Gesto pronto que, visto na confirmação, indica a mão se abrindo e cancela o estalo                                 |
| `gestureMinScore` (veto)                                                        | 0,8             | novo           | Pontuação mínima do `Open_Palm` para vetar; acima dos 0,50 a 0,65 vistos em dois estalos reais                     |
| `slowMs`, `minOpenSpeed`, `riseStartRatio`, histerese 0,35/0,55, `maxOpenSpeed` | removidos       | removidos      | A cerca de 15 quadros/s a duração/velocidade não separam estalo de oscilação; a pinça fechada não arma a pose real |
| Perda de mão na mira                                                            | > 300 ms        | mantido        | Cancela; qualquer perda zera o armado                                                                              |
| Direção (mira relativa)                                                         | mudada (CQ-011) | da pinça       | Deslocamento da mão desde a âncora × `aimScale`, da pinça virtual até a bolinha; substituiu a orientação da mão    |
| `aimScale` (ganho da mira)                                                      | 1,5             | reaproveitado  | O mesmo da pinça; afasta menos a mão para o mesmo tiro                                                             |
| `minPull` (arrasto mínimo da mira)                                              | 30 unidades     | reaproveitado  | O mesmo da pinça; abaixo disso o estalo confirmado cancela como `sem mira`                                         |

**Ressalva de sobreajuste:** os limiares acima foram escolhidos olhando DUAS gravações de UMA pessoa e UMA webcam de cerca de 15 quadros/s. O replay dessas duas séries (`flick-replay.test.ts`) protege contra regressão, mas não prova que o estalo funciona com outra mão, outra webcam ou ao vivo. Nenhum estalo ao vivo foi testado após esta recalibração (Gate 3 pendente).

## Limitações

- Nenhuma medição ao vivo do estalo com a escala logarítmica de 3 a 20 e o gatilho por razão esticada sustentada foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002), incluindo a força lida no painel e se o tiro acerta o alvo.
- A faixa 3 a 20 da escala de força vem só da amplitude observada (estalos reais de 5 a 10 razão/s); não se sabe quais estalos foram fracos ou fortes (H-02).
- A taxa real da câmera foi medida em cerca de 15 quadros/s (H-03 confirmada); com outra webcam o número e o número de amostras por estalo podem mudar.
- A mira do estalo passou da orientação da mão para a mira relativa da pinça (CQ-011), porque o maintainer relatou que mirar pela orientação da mão ficou ruim de usar; a usabilidade não foi medida e a convenção de estilingue, o `aimScale` (1,5) e o `minPull` (30) são os valores da pinça e podem não ser os melhores para o estalo (H-04); nada foi testado ao vivo.
- A razão polegar-indicador sozinha não distingue abrir a mão de esticar o polegar: uma mão fechada que se abre pode confirmar um estalo (1 caso no replay do vídeo A); limitação conhecida, não resolvida.
- Os vídeos do teste não fazem parte do repositório; só os números lidos do painel entram nos documentos e na fixture `flick-sessions.ts`.
- Os limiares foram ajustados a DUAS sessões de UMA pessoa e UMA webcam; o replay protege contra regressão mas é sobreajuste a essas séries.
- Os gestos prontos do MediaPipe não reconheceram a pose do estalo na conferência offline (recortes de baixa resolução, taxa de detecção baixa, não a do app ao vivo); por isso entram só como veto de palma aberta (pontuação >= 0,8) e diagnóstico, não como gatilho. O veto não foi medido contra a mão se abrindo de verdade, pode não ajudar e pode cancelar um estalo real; nada foi testado ao vivo. A licença do `gesture_recognizer.task` não foi lida na fonte.

## Decisão

No modo estalo, a mão arma com a razão <= `armRatio` (1,05); quando a razão chega a >= `extendRatio` (1,2) subindo pelo menos `minRise` (0,4) acima do mínimo dos últimos `baseWindowMs` (250 ms) e ficando esticada por `confirmSamples` (3) amostras, o estalo confirma e dispara com a direção da mira relativa (deslocamento da mão desde a âncora × `aimScale` 1,5, da pinça virtual para a bolinha, travada na última posição armada) e a força da velocidade de abertura por uma escala logarítmica de 3 a 20 razão/s (`powerLowSpeed` 3, `powerHighSpeed` 20, `minShotSpeed` 300, `maxShotSpeed` 1100), compondo a velocidade = direção × `speed`. Subida pequena cancela como `fraco demais`, uma volta abaixo de 1,2 antes de confirmar cancela como `não sustentado`, o arrasto < `minPull` (30) cancela como `sem mira`, e a perda da mão zera o armado. Saem `slowMs`, `minOpenSpeed`, `riseStartRatio`, a histerese 0,35/0,55, `maxOpenSpeed`, `handDirection` e o campo `direction`; `flickShot` vira `flickPower`; o detector deixa de compor o de pinça (só reaproveita `pinchRatio`). A rodada arma sem exigir a pinça vista aberta antes. O laço processa só quadros novos da câmera (`requestVideoFrameCallback` com recuo para `currentTime`, taxa real medida de cerca de 15/s) e o painel mostra a taxa real da câmera, a força e o resultado do último estalo (`disparado`, `fraco demais`, `não sustentado`, `mão aberta`, `sem mira`). A pinça não muda. A spec de criação do estalo passa a `superseded` apontando para esta.
