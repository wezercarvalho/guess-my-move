# Pesquisa — 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser

## Pergunta

Um detector de landmarks executado no navegador consegue reconhecer o Acenar de forma determinística, com poucos falsos positivos, sem enviar imagens a terceiros?

## Método do spike

- **Detector:** `@mediapipe/tasks-vision` 1.1.1 (Apache-2.0), `HandLandmarker` (`hand_landmarker.task`, float16) e `PoseLandmarker` (lite, full e heavy), em modo de vídeo, delegate CPU (WebAssembly), no Chromium headless de uma VPS.
- **Entrada:** gravações de tela em 1080p feitas pelo maintainer, recortadas na região da webcam. Cada vídeo foi percorrido a 15 quadros por segundo, um quadro por vez, por busca no tempo do vídeo.
- **Duas rodadas:** (1) dois vídeos de uma sessão do app, um parado e um com dois ensaios (parado e acenando); (2) 12 clipes roteirizados (5 acenos e 7 confusores).
- **Regra testada:** inversões de direção do sinal com histerese de amplitude, em uma janela deslizante; o sinal é o ângulo do vetor do pulso (ponto 0) ao início do dedo médio (ponto 9).
- **Limite do método:** os limiares foram escolhidos antes do ajuste e confirmados por varredura nos mesmos 12 clipes; não há conjunto separado de validação.

## Resultados

### Escolha do detector e do sinal (rodada 1)

| Detector e sinal                    | Resultado                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pose lite, posição lateral do pulso | Falso positivo no vídeo parado (34 de 121 quadros): cotovelos e pulsos fora do quadro eram inventados, com visibilidade de 0,5 a 0,7. |
| Pose full, posição lateral do pulso | Não reconheceu o aceno (0 quadros positivos).                                                                                         |
| Hand Landmarker, posição do pulso   | Uma inversão em 7,3 s de aceno: o pulso quase não se desloca na horizontal.                                                           |
| Hand Landmarker, ângulo da mão      | 23 inversões em 7,3 s de aceno; nenhuma mão detectada no vídeo parado.                                                                |

### Os 12 clipes (rodada 2)

Regra: amplitude 15 graus, 3 inversões, janela de 2,5 s, ao menos 5 amostras com mão.

| Clipe                    | Duração | Quadros com mão | Inversões máx. | Reconhecido | Do surgimento da mão ao veredito |
| ------------------------ | ------- | --------------- | -------------- | ----------- | -------------------------------- |
| 01 aceno direita normal  | 11,1 s  | 75 de 166       | 8              | sim         | 1,4 s                            |
| 02 aceno esquerda normal | 10,2 s  | 72 de 154       | 10             | sim         | 1,7 s                            |
| 03 aceno devagar         | 13,8 s  | 39 de 208       | 4              | sim         | 6,1 s                            |
| 04 aceno rápido          | 5,7 s   | 15 de 86        | 7              | sim         | 0,9 s                            |
| 05 aceno longe           | 10,2 s  | 81 de 153       | 9              | sim         | 1,6 s                            |
| 06 coçar a cabeça        | 10,3 s  | 55 de 155       | 0              | não         | —                                |
| 07 ajeitar o fone        | 22,3 s  | 166 de 335      | 1              | não         | —                                |
| 08 mão passando          | 8,1 s   | 0 de 122        | 0              | não         | —                                |
| 09 mão parada levantada  | 13,9 s  | 143 de 208      | 0              | não         | —                                |
| 10 mão no rosto          | 14,7 s  | 200 de 221      | 0              | não         | —                                |
| 11 sair do quadro        | 13,0 s  | 0 de 196        | 0              | não         | —                                |
| 12 parado                | 12,9 s  | 0 de 194        | 0              | não         | —                                |

Sensibilidade (mesmos clipes): com 3 inversões, as amplitudes de 15 e 20 graus dão 5 de 5 acenos e 0 de 7 confusores; 10 graus dá 5 de 5 com 1 falso positivo, que 4 inversões elimina (5 inversões já perde 1 aceno); 25 graus perde 1 aceno. Janelas de 1,5 s, 2 s e 3 s mantêm 5 de 5 e 0 de 7 com 15 graus e 3 inversões.

Correção de proporção: os landmarks são normalizados por largura e altura da imagem, então o ângulo bruto depende da proporção. O ângulo foi recalculado em espaço de pixels (deslocamento horizontal multiplicado por largura/altura, 1360 por 1020 nos clipes) e o resultado se manteve (5 de 5 e 0 de 7 com 15 graus e 3 inversões; 2 inversões passa a ter 1 falso positivo). O núcleo adota o ângulo corrigido e as fixtures são geradas com ele.

### Latência medida (não representa o desktop do maintainer)

Mediana de 90 a 145 ms por quadro no recorte pequeno e de 170 a 190 ms no recorte grande, com p95 de 205 a 250 ms, em CPU, Chromium headless, VPS compartilhada. O número só indica ordem de grandeza do custo do modelo; a medida que vale é a do Chrome desktop do maintainer (NFR-002).

## Limitações

- 12 clipes, uma pessoa, uma câmera, um cenário; amostra pequena demais para afirmar taxa de acerto geral.
- Os acenos têm cobertura de mão de 17% a 55% dos quadros; o motivo provável é borrão de movimento no modo de busca por quadro, não confirmado.
- O modo de vídeo contínuo do app pode rastrear melhor que o spike (hipótese H-02).

## Fontes e pendências

- Pacote `@mediapipe/tasks-vision` 1.1.1, licença Apache-2.0 (registro npm, consultado em 2026-10-26).
- Modelo `hand_landmarker.task` baixado de `storage.googleapis.com/mediapipe-models`; a licença do arquivo do modelo não foi confirmada na fonte. O arquivo não é versionado no repositório e a confirmação fica pendente antes de qualquer redistribuição.
- Conjuntos públicos (HMDB51, Kinetics, HaGRID) foram avaliados e não usados: câmera e enquadramento diferentes do jogo, licenças e termos variados, imagens estáticas no caso do HaGRID.

## Decisão

Detector: Hand Landmarker, uma mão. Sinal: ângulo do vetor pulso até o início do dedo médio. Critério da carta: `hand-angle-oscillation` com `amplitudeDeg: 15`, `minReversals: 3`, `windowMs: 2500`, `minSamples: 5`. O Pose Landmarker fica fora do desenho.
