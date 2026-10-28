# Privacidade e segredos

Aplica-se a qualquer mudança que toque câmera, quadros, landmarks, logs ou documentação para usuários.

## Câmera, quadros e landmarks

- Solicite consentimento explícito do navegador, mostre um indicador de câmera ativa e permita parar a captura a qualquer momento.
- O processamento é **100% local**: o detector de mão roda no navegador e nenhum quadro, vídeo ou landmark sai dele.
- Não persista imagens nem vídeos e não registre dados de imagem (base64, bytes, miniaturas, landmarks) em logs ou telemetria.
- A rodada guarda apenas as amostras numéricas da janela de tempo (`{ t, angleDeg }`) e as descarta ao terminar.
- Em conteúdo de menores, aplique salvaguardas adequadas antes de ampliar o público.

## Sem servidor nem provedor de IA no fluxo principal

- O fluxo principal não tem servidor, não faz chamada a provedor de IA e não usa variável de ambiente de provedor nem chave de API. Uma rodada completa não gera requisição de rede com imagem, vídeo ou landmarks; só há o carregamento do app e dos arquivos do detector, servidos pelo próprio app.
- A pesquisa de modelo multimodal em [`docs/research`](../../research/multimodal-model-selection.md) é referência para uma futura IA jogadora, fora do fluxo atual.

## Arquivos do detector

- O `.wasm` do MediaPipe e os modelos `.task` (`hand_landmarker.task` no jogo de cartas e `gesture_recognizer.task` no jogo das bolinhas) são servidos pelo próprio app (sem CDN), preparados por `prepare:assets`.
- Os modelos não são versionados: `apps/web/public/mediapipe/` fica fora do Git. O download é verificado por SHA-256 fixado; a licença dos arquivos `.task` ainda não foi confirmada na fonte, e a verificação fica pendente antes de qualquer redistribuição.

## Fronteira de informação

- O jogador e uma IA jogadora futura nunca recebem o critério de avaliação da carta. `toPublicCard` devolve só `public`, e o schema estrito recusa campos desconhecidos; há teste automatizado que falha se `evaluation` vazar na projeção.

## Observabilidade sem mídia

Registre apenas eventos sem mídia bruta, com o id da rodada e tempos (por exemplo, início e fim da rodada, veredito). Os números de depuração (delegate, ângulo, inversões, amostras, quadros, latência) são mostrados na tela para ajuste, não persistidos. Nunca registre o conteúdo bruto de quadros ou landmarks.
