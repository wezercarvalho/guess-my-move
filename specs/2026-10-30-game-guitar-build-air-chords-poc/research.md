# Pesquisa: estado da arte do Violão no Ar

Data: 2026-10-30. Três levantamentos independentes (trabalhos relacionados, limites do MediaPipe, áudio e acordes), sintetizados aqui. Cada afirmação traz a fonte e a confiança:

- **Verificado:** o agente que escreve este texto abriu a fonte.
- **Relatado:** número ou citação vindo do relatório de um levantamento, com a fonte indicada, que não foi aberta de novo (por exemplo, PDF que o leitor de páginas não abre).
- **Inferido:** conclusão do levantamento ou nossa, sem medição.

## 1. Trabalhos relacionados

| Trabalho                                                                                   | O que faz                                                                                                                                  | Confiança  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [Guitar-Chord-Analyzer](https://github.com/tjross28/Guitar-Chord-Analyzer) (Python/OpenCV) | MediaPipe Hands, vídeo espelhado, grade de 6 cordas por 4 casas, pontas dos dedos em corda e casa, acordes por regras. Sem métrica.        | Verificado |
| [hawa](https://github.com/xOAviOx/hawa) (navegador)                                        | MediaPipe Tasks Vision e Tone.js. A mão esquerda escolhe o acorde pela contagem de dedos e a direita toca com pinça. Sem posição no braço. | Verificado |
| CNN sobre mãos recortadas, Stanford CS230 (2019)                                           | Classifica {C, D, Em, F, G} em violão real; 94% de acerto.                                                                                 | Relatado   |
| Padrões de dedos com aprendizado profundo (2018)                                           | Cerca de 90% com 3 acordes e 70% com 5.                                                                                                    | Relatado   |
| TapToTab (arXiv 2409.08618, 2024)                                                          | Vídeo para tablatura com YOLO no braço e FFT no áudio; usa violão real e áudio.                                                            | Relatado   |
| Fender Play, Yousician, JustinGuitar                                                       | Ensinam os primeiros acordes e avaliam pelo **microfone**, não pela imagem.                                                                | Relatado   |

Conclusões:

- Os trabalhos com bons números usam **violão real**, que ancora a geometria. Não foi achado trabalho com a mão no ar sem instrumento, nem dataset público de vídeo de mão no braço em escala. Inferido.
- O precedente mais próximo (Guitar-Chord-Analyzer) valida a ideia de grade virtual com regras, **sem publicar acerto**. Por isso esta PoC não promete percentual.
- A queda de cerca de 90% (3 acordes) para cerca de 70% (5) no relato de 2018 sugere começar com poucos acordes e ordem de ensino gradual. Inferido.

## 2. Limites do MediaPipe Hands

| Ponto                         | Achado                                                                                                                                                                                                                       | Confiança                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Profundidade (z)              | O paper ([arXiv 2006.10214](https://arxiv.org/html/2006.10214v1)) diz que a profundidade relativa ao pulso é aprendida **só de imagens sintéticas** e que o modelo é 2,5D. Estudos de terceiros confirmam que não é métrica. | Verificado (paper) / Relatado (resto) |
| Erro de regressão             | MSE normalizado pelo tamanho da palma de 13,4% (dados reais mais sintéticos).                                                                                                                                                | Relatado                              |
| Rótulo Left/Right com espelho | A documentação do Hand Landmarker diz que passar uma imagem espelhada inverte os rótulos; issues do MediaPipe relatam instabilidade perto da borda e do cruzamento das mãos.                                                 | Relatado                              |
| Ordem das mãos no vetor       | O índice da mão no resultado não é estável entre quadros com duas mãos (issues #1365 e #4610 do MediaPipe).                                                                                                                  | Relatado                              |
| Tremor das pontas             | Documentado; filtro recomendado: One Euro (Casiez et al., CHI 2012), padrões do repositório do autor `mincutoff=1.0`, `beta=0.1`, `dcutoff=1.0`.                                                                             | Relatado                              |
| Tempo de inferência           | Documentação oficial: 17,12 ms (CPU) e 12,27 ms (GPU) no Pixel 6. Num notebook não foi medido.                                                                                                                               | Relatado                              |
| Batida a 30 fps               | Nyquist de 15 Hz comporta 3 a 5 batidas por segundo, mas restam 6 a 10 quadros por batida e o borrão degrada os pontos no pico. Latência fim a fim estimada em 50 a 100 ms. Não há medição publicada de latência de batida.  | Inferido                              |

Decisões que isto sustenta:

1. **Contato do dedo por posição 2D e permanência, sem z** (FR-007). Apertar a corda é movimento em z, que o modelo não mede.
2. **Papéis das mãos por posição na tela, nunca pelo rótulo** (FR-006).
3. **Suavização com One Euro** nas pontas dos dedos e na mão da batida (FR-007, FR-011).
4. **Batida disparada no pico de velocidade**, com histerese e período refratário (FR-011).

## 3. Áudio, acordes e geometria

- **Síntese:** Karplus–Strong (Karplus e Strong, _Computer Music Journal_ 7(2), 1983): ruído numa linha de atraso de comprimento `D = Fs / F0` realimentada por uma média de duas amostras. Para seis notas simultâneas sem servidor, o caminho mais simples é pré-calcular um `AudioBuffer` por nota. Relatado.
- **Autoplay:** o `AudioContext` precisa ser criado ou retomado dentro de um gesto do usuário (MDN). `baseLatency` e `outputLatency` são propriedades de leitura e não têm valor fixo. Relatado.
- **Batida:** atraso entre cordas de cerca de 15 a 25 ms é prática comum; não há padrão oficial e fica como parâmetro. Inferido.
- **Acordes abertos**, afinação E2 A2 D3 G3 B3 E4 (MIDI 40 45 50 55 59 64). Conferidos por script (classes de altura sonantes iguais à tríade). Casa por corda da 6ª à 1ª; `x` abafada, `0` solta; dedo 1 indicador a 4 mindinho:

| Acorde | Casas       | Dedos       |
| ------ | ----------- | ----------- |
| Em     | 0 2 2 0 0 0 | 0 2 3 0 0 0 |
| Am     | x 0 2 2 1 0 | x 0 2 3 1 0 |
| D      | x x 0 2 3 2 | x x 0 1 3 2 |
| C      | x 3 2 0 1 0 | x 3 2 0 1 0 |
| G      | 3 2 0 0 0 3 | 2 1 0 0 0 3 |

O G tem uma forma alternativa de quatro dedos e o C admite variante com o mindinho; a PoC usa as formas acima. Fontes de ensino citadas pelo levantamento: Fender, JustinGuitar e Wikipedia (Guitar chord). Relatado.

- **Ordem de ensino:** o consenso das fontes começa por Em e Am (poucos dedos), depois D, C e G, deixando a troca G↔C/D, o maior gargalo, para o fim. Esta PoC adota Em, Am, D, C, G. Relatado.
- **Geometria do braço:** distância da pestana à casa n = L · (1 − 2^(−n/12)). Posições relativas (L = 1): casa 1 = 0,056126; 2 = 0,109101; 3 = 0,159104; 4 = 0,206299; 5 = 0,250846; casa 12 = 0,5. Calculado, não depende de fonte.

## 4. Decisões de escopo e alternativas rejeitadas

| Decisão                                            | Alternativa rejeitada                   | Motivo                                                                                                             |
| -------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Regras sobre célula de corda e casa                | Classificador aprendido de forma de mão | Cinco acordes fixos não justificam treino; não há dados de câmera real nem como rotular aqui.                      |
| Braço horizontal, fixo na tela, com ajuste         | Braço preso ao pulso da mão do braço    | Preso à mão, a mesma mão define o braço e os dedos; qualquer erro de pulso desloca tudo.                           |
| Batida pelo centro da palma, no pico de velocidade | Cruzamento de linha pela ponta do dedo  | O centro da palma é mais estável que uma ponta, e o pico dá a força.                                               |
| Karplus–Strong em `AudioBuffer` pré-calculado      | AudioWorklet; osciladores               | `AudioWorklet` é mais complexo sem ganho para uma batida pontual; osciladores exigem dezenas de senoides por nota. |
| Som do que a mão forma                             | Tocar sempre o acorde alvo              | Formato errado precisa soar errado para ser pedagógico; o teclado sem mão toca o alvo.                             |
| Dedo extra sobre corda solta conta como erro       | Ignorar dedos extras                    | Um dedo ali muda o som de fato; `ignoreExtraFingers` fica como parâmetro de calibração.                            |

## 5. Lacunas honestas

- Nenhuma medição com a câmera, a mão e o notebook do maintainer: separação das pontas, falsos positivos de dedo, latência da batida e fps. Tudo isso fica para o teste ao vivo (Gate 3).
- Os números de acerto da literatura vêm de relatos não reabertos e de violão real; não valem para esta PoC.
- Os valores iniciais de suavização, permanência, histerese, limiar e refratário são hipóteses declaradas em `plan.md`.

## 6. Revisão após o primeiro teste ao vivo (2026-10-30)

O maintainer informou que o braço estava grosso demais, a área de execução pequena, a batida pouco rítmica e o fluxo de escolher um acorde antes de montá-lo invertia a proposta.

### Proporção e espaço de execução

- A Yamaha publica escala de **650 mm** e largura de **52 mm** na pestana para o violão clássico GC41: [especificações Yamaha GC41](https://ca.yamaha.com/fr/products/musical_instruments/guitars_basses/cl_guitars/gc41s/specs.html). Verificado.
- Pela fórmula já usada no pacote, as cinco primeiras casas ocupam cerca de 163 mm numa escala de 650 mm. A referência física confirma um braço longo e estreito, não uma grade quase quadrada. Calculado.
- O precedente aberto mais próximo usa caixa de **40% da largura por 18% da altura** do vídeo e identifica o acorde percorrendo as posições observadas, sem seleção prévia: [implementação do Guitar-Chord-Analyzer](https://raw.githubusercontent.com/tjross28/Guitar-Chord-Analyzer/main/hand_tracking_test.py). Verificado.
- Decisão: reduzir a altura padrão de 40% para **18%**, manter casas progressivamente menores, usar linhas e pontos menores e deixar a câmera ocupar toda a largura útil. A largura foi mantida em 58% para ampliar as casas sem aumentar a separação entre cordas.

### Reconhecimento e ritmo

- O MediaPipe infere os 21 pontos a partir de cada imagem e documenta oclusão, auto-oclusão e tremor das mãos como dificuldades do problema: [Google Research, On-Device Real-Time Hand Tracking](https://research.google/blog/on-device-real-time-hand-tracking-with-mediapipe/). Verificado.
- Decisão de acorde: comparar a assinatura das posições `corda:casa` com os cinco formatos, sem depender do número do dedo. A forma precisa permanecer; o último resultado resiste a falhas curtas e uma nova forma também precisa permanecer antes da troca.
- Decisão de batida: velocidade instantânea sozinha gerava falso evento com jitter. O detector agora exige **velocidade e deslocamento acumulado** na mesma direção e dispara ao completar a trajetória, o que aproxima o evento do momento musical da travessia.
- Limite: nenhum ajuste substitui o segundo teste ao vivo. Os 18%, 100 ms de confirmação, 250 ms de tolerância e 0,55 tamanho de mão de deslocamento continuam parâmetros alpha.
