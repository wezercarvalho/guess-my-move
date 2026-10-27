# Pesquisa — 2026-10-27-game-marbles-bete-build-pinch-shot

## Pergunta

Como construir um bete solo de bolinhas de gude, jogável por gesto de pinça no navegador, reaproveitando a câmera e o rastreador de mão existentes, com física testável sem câmera e sem alterar o jogo de cartas?

## Decisões

### Reaproveitamento da câmera e do rastreador

A spec `2026-10-26-vision-hand-gesture-referee-replace-llm-guesser` já entregou `useCamera`, `CameraPanel`, a interface `HandTracker`/`createMediaPipeHandTracker` (MediaPipe Hand Landmarker, uma mão, delegate automático ou forçado por URL) e `drawHand`. O bete reaproveita esses componentes sem alteração. A consequência é que a leitura de mão herda as características observadas lá (perda de mão em movimento rápido, cobertura parcial de quadros), o que motiva um arrasto lento por desenho (H-03).

### Sinal de controle: pinça por razão de distâncias

Para o estilingue é preciso um gesto discreto (preparar/soltar) e um ponto contínuo (mira). A pinça atende aos dois: a razão `distância(4, 8) / distância(0, 9)` entre as pontas de polegar e indicador, normalizada pela distância pulso–base do dedo médio, é pequena quando os dedos se juntam e grande quando se afastam, e é aproximadamente invariante à escala da mão na imagem. A correção de proporção em x (multiplicar o deslocamento horizontal pela razão largura/altura) segue a mesma lição da spec do árbitro, em que o ângulo bruto dependia da proporção dos landmarks normalizados. A histerese (fecha com razão <= 0,35, abre com razão >= 0,55) evita oscilação no limiar; os valores são placeholders de calibração.

### Física arcade determinística

Passo fixo de 1/120 s torna a simulação reprodutível e testável em Node: a mesma sequência de eventos produz a mesma trajetória, o que permite verificar atrito, paradas, ricochete nas paredes e colisão elástica entre bolinhas de massas iguais sem câmera. A alternativa de integração contínua dependente do relógio real foi rejeitada por não ser determinística e, portanto, difícil de testar.

### Página extra em vez de app novo (CQ-007)

Uma segunda entrada do Vite (`marbles.html`) com código próprio em `apps/web/src/marbles/` reaproveita a câmera e o rastreador sem duplicá-los e sem extrair um pacote compartilhado. O jogo de cartas (`index.html`, `App.tsx`, `src/round/`) não é tocado, preservando o isolamento exigido (FR-010). Um app separado duplicaria a infraestrutura de câmera; extrair um pacote compartilhado agora seria complexidade antecipada sem segundo consumidor comprovado.

### Pacote puro `packages/marbles` (CQ-008)

A lógica de física, pinça, tiro e rodada fica em `@guess-my-move/marbles`, sem DOM, sem MediaPipe e sem dependência de `@guess-my-move/core`, com tipos de ponto próprios e estruturais `{x, y}` compatíveis com os landmarks do MediaPipe. Assim o núcleo do jogo de cartas não é acoplado ao bete e a lógica é executável em Node (NFR-001).

## Parâmetros de partida (placeholders)

| Parâmetro                  | Valor inicial | Observação                                     |
| -------------------------- | ------------- | ---------------------------------------------- |
| Campo                      | 800 x 600     | Proporção 4:3, compatível com webcam 640 x 480 |
| Raio da bolinha            | 14            | Igual para tiro e alvo                         |
| Posição inicial do tiro    | (150, 300)    | Volta a esta posição ao errar                  |
| Posição do alvo            | (550, 300)    | Distância fixa de 400                          |
| Passo da física            | 1/120 s       | Determinístico                                 |
| Atrito                     | 400 unid/s²   | Constante                                      |
| Limiar de parada           | 8 unid/s      | Abaixo disso, a bolinha para                   |
| Restituição nas paredes    | 0,8           | —                                              |
| Restituição entre bolinhas | 1,0           | Colisão elástica, massas iguais                |
| Razão para fechar a pinça  | <= 0,35       | Histerese                                      |
| Razão para abrir a pinça   | >= 0,55       | Histerese                                      |
| Raio de pega               | 70 unidades   | Distância máxima da pinça à bolinha de tiro    |
| Ganho de velocidade        | 5x o arrasto  | —                                              |
| Limite de arrasto          | 220 unidades  | Velocidade máxima 1100 unid/s                  |
| Cancelamento de arrasto    | < 30 unidades | Tiro cancelado                                 |
| Perda de mão na mira       | > 300 ms      | Cancela o tiro em preparação                   |

Alcance (cálculo, não medição): para o contato com o alvo (centros a 372 unidades da posição inicial até a distância de colisão), o atrito de 400 unid/s² exige velocidade de cerca de 545 unid/s, ou seja, arrasto de cerca de 109 unidades. A bolinha de tiro em x = 150 permite arrastar até 150 unidades para a esquerda, o que dá folga. Com atrito de 700 o mínimo seria de cerca de 144 unidades, quase sem folga; por isso o valor inicial é 400. Todos os valores seguem sendo palpites a calibrar com uso real.

Todos os valores são anteriores a qualquer calibração (H-01) e serão ajustados pelo painel de depuração e pelo teste do maintainer.

## Limitações

- Nenhuma medição de taxa de quadros ou latência foi feita; a medição que vale é a do Chrome desktop do maintainer (NFR-002).
- O reconhecimento da pinça não foi medido; a sensibilidade dos limiares será avaliada no uso real.
- A física arcade não modela rotação nem spin das bolinhas; está fora do escopo.

## Decisão

Pacote puro `packages/marbles` com física arcade determinística, detector de pinça por razão de distâncias com histerese e correção de proporção, tiro por estilingue com ganho e limites, e máquina de estados da rodada; página extra `marbles.html` no app web reaproveitando câmera, rastreador e desenho da mão, sem alterar o jogo de cartas.
