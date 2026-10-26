---
id: 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser
title: Árbitro do gesto por visão computacional no navegador (substitui o adivinhador por LLM)
slug: vision-hand-gesture-referee-replace-llm-guesser
strategy: sdd
domain: vision
capability: hand-gesture-referee
objective: replace-llm-guesser
summary: O árbitro do fluxo principal passa a ser a visão computacional local (MediaPipe Hand Landmarker no navegador) que reconhece o gesto da carta pela oscilação do ângulo da mão; o caminho do LLM (servidor, provedores, árbitro semântico) é removido.
status: planned
owners:
    - wezercarvalho
reviewers: []
aliases:
    - árbitro por visão computacional
    - MediaPipe
    - hand landmarker
    - ângulo da mão
    - oscilação
    - botão Começar
    - substitui o Codex
code_paths:
    - apps/web/
    - packages/core/
related_specs:
    - 2026-10-20-vision-gesture-recognition-validate-waving-poc
    - 2026-10-21-game-engine-round-referee-build-core-loop
    - 2026-10-21-backend-api-validation-centralize-zod-nestjs12
supersedes:
    - 2026-10-20-vision-gesture-recognition-validate-waving-poc
    - 2026-10-21-game-engine-round-referee-build-core-loop
    - 2026-10-21-backend-api-validation-centralize-zod-nestjs12
branch: feat/63-cv-referee
constitution_version: 1.0.0
created_at: 2026-10-26
updated_at: 2026-10-26
---

# Árbitro do gesto por visão computacional no navegador (substitui o adivinhador por LLM)

## Resumo

O jogador vê a carta, aperta **Começar** e faz o gesto diante da webcam. O navegador detecta a mão com o MediaPipe Hand Landmarker, calcula o ângulo da mão a cada quadro e um avaliador determinístico decide se o critério da carta (para o Acenar, a oscilação repetida do ângulo da mão) foi cumprido. Nenhuma imagem sai do navegador e não há servidor nem provedor de IA no fluxo principal. O caminho do LLM (servidor, adaptadores de provedor, benchmark, adivinhador e árbitro semântico) é removido; o histórico do Git e as specs substituídas servem de referência para um futuro modo de IA jogadora, que continuará sem receber a carta.

## Problema

O fluxo anterior fazia um modelo multimodal adivinhar o gesto a partir de seis frames em 2,4 s e um árbitro de texto comparar o palpite com a carta. Isso foi julgado pelo maintainer como não escalável e caro por tentativa, subamostra o aceno e depende de um servidor com credenciais. Um spike com o Hand Landmarker (12 clipes do maintainer; evidência inicial, uma pessoa e um cenário) mostrou que o ângulo da mão oscila de forma distinta no aceno e permanece estável em confusores comuns, e que a posição do pulso não serve como sinal.

## Objetivos

- Reconhecer o Acenar localmente, em tempo de rodada, com critério determinístico, testável sem câmera e parametrizado pela carta.
- Mostrar ao jogador, para depuração e ajuste, o que o detector está lendo (esqueleto da mão, ângulo, contagem de inversões e latência de inferência).
- Eliminar do repositório o código sem uso depois do pivô, mantendo `main` consistente com gates verdes.
- Preservar a regra de privacidade: frames transitórios, sem persistência, sem log de imagem e sem envio a terceiros.

## Fora de escopo

- Modo de IA jogadora (a IA tenta adivinhar sem conhecer a carta); fica para uma spec futura.
- Detecção automática do início do gesto (a rodada começa no botão **Começar**).
- Mais de uma carta, baralho, pontuação, internacionalização, tempo de rodada configurável pela interface.
- Navegadores além do Chrome desktop; celular.
- Detecção de trapaça, multiplayer, autenticação, banco de dados, áudio.
- Treinar ou ajustar modelos; qualquer modelo além do Hand Landmarker pré-treinado.
- Afirmar acurácia geral, recall ou taxa de falso positivo gerais a partir da amostra do spike.

## Atores

- **Jogador:** vê a carta, inicia a rodada e faz o gesto.
- **Maintainer:** testa no Chrome desktop, ajusta limiares com base nos números mostrados e aprova os gates.
- **Detector de mão:** componente do navegador que devolve os 21 pontos da mão por quadro.
- **Avaliador do gesto:** lógica pura que decide, por janela de tempo, se o critério da carta foi cumprido.

## Histórias de usuário

### US-001 — Reconhecer o aceno em uma rodada (P1)

Como jogador, quero apertar Começar, acenar e ver se o app reconheceu o gesto, para jogar sem depender de uma IA externa.

**Teste independente:** com a câmera ativa no Chrome desktop, iniciar a rodada e acenar; o app indica "gesto reconhecido". Repetir sem acenar; o app indica "não reconhecido" ao fim do limite.

**Critérios de aceitação:**

1. **Dado** que a câmera está ativa e o detector carregado, **quando** o jogador aperta Começar e acena, **então** o app indica que o gesto foi reconhecido e encerra a rodada.
2. **Dado** que a rodada começou, **quando** o limite de tempo termina sem o critério cumprido, **então** o app indica que o gesto não foi reconhecido.
3. **Dado** que o jogador coça a cabeça, ajeita o fone ou mantém a mão levantada parada, **quando** o limite termina, **então** o app indica que o gesto não foi reconhecido.
4. **Dado** que a câmera foi negada, **quando** o jogador tenta começar, **então** o app explica como reabilitar a permissão e nenhum detector é executado.

### US-002 — Critério da carta avaliado de forma determinística e testável (P1)

Como mantenedor, quero que o critério do Acenar seja dado da carta e avaliado por uma função pura, para testar e ajustar sem câmera.

**Teste independente:** rodar o avaliador sobre as séries de ângulo dos 12 clipes de referência e obter 5 reconhecidos e 0 falsos positivos.

**Critérios de aceitação:**

1. **Dado** uma série de amostras (tempo, ângulo) e o critério da carta, **quando** o avaliador é chamado, **então** devolve reconhecido ou não, o número de inversões e o número de amostras da janela.
2. **Dado** menos amostras que o mínimo da janela, **quando** o avaliador é chamado, **então** devolve não reconhecido.
3. **Dado** os cinco clipes de aceno e os sete clipes de confusor, **quando** reproduzidos no avaliador, **então** cinco são reconhecidos e nenhum confusor é.

### US-003 — Ver o que o detector lê (P2)

Como mantenedor, quero ver o esqueleto da mão sobre o vídeo e os números do avaliador, para ajustar limiares.

**Teste independente:** durante uma rodada, a mão aparece desenhada sobre o vídeo e o painel mostra ângulo, inversões, amostras da janela, latência mediana e o delegate em uso.

**Critérios de aceitação:**

1. **Dado** uma mão visível, **quando** a rodada está em andamento, **então** os 21 pontos e as conexões são desenhados sobre o vídeo.
2. **Dado** que a rodada terminou, **quando** o painel é consultado, **então** mostra a latência mediana e o p95 de inferência dos quadros processados.

### US-004 — Fluxo principal sem servidor nem IA externa (P1)

Como jogador, quero que nenhuma imagem minha saia do navegador, para jogar com privacidade.

**Teste independente:** inspecionar as requisições de rede durante uma rodada; só há carregamento do app e dos arquivos do detector, servidos pelo próprio app.

**Critérios de aceitação:**

1. **Dado** uma rodada completa, **quando** as requisições são inspecionadas, **então** nenhuma requisição carrega imagem, vídeo ou landmarks e nenhuma é feita a domínio de terceiros.
2. **Dado** o repositório, **quando** buscado, **então** não existem `apps/server`, `packages/providers`, `packages/benchmark`, nem referências a Codex, Bedrock ou provedores de IA no código executável.

## Requisitos funcionais

- **FR-001:** A carta DEVE separar `public` (palavra, dica, sugestão, dificuldade) de `evaluation`, e `evaluation` DEVE conter o critério tipado do gesto; `toPublicCard` DEVE devolver apenas `public`, com teste automatizado que falha se `evaluation` aparecer na projeção.
- **FR-002:** O critério do Acenar DEVE ser `hand-angle-oscillation` com `amplitudeDeg: 15`, `minReversals: 3`, `windowMs: 2500` e `minSamples: 5`; o schema DEVE rejeitar campos desconhecidos e valores não positivos.
- **FR-003:** O núcleo DEVE expor `handAngleDeg(landmarks, aspect)`, que devolve o ângulo (graus, 0 apontando para cima, positivo para a direita da imagem) do vetor do pulso (ponto 0) ao início do dedo médio (ponto 9), com o deslocamento horizontal corrigido pela proporção largura/altura da imagem (`aspect`), ou `null` quando o vetor é degenerado.
- **FR-004:** O núcleo DEVE expor um avaliador puro que, dadas as amostras `(tempo em ms, ângulo)` e o critério, considera apenas as amostras da janela terminada no instante atual, conta as inversões de direção com histerese de `amplitudeDeg` e devolve `{ recognized, reversals, windowSamples }`; reconhece quando `windowSamples >= minSamples` e `reversals >= minReversals`.
- **FR-005:** O núcleo DEVE expor uma máquina de estados da rodada com `idle → card_revealed → camera_ready → detecting → recognized | timed_out` e os estados de exceção `camera_denied`, `tracker_error` e `user_cancelled`; o relógio DEVE ser injetável, o limite padrão de `detecting` DEVE ser 10 s, e um evento de amostra DEVE reconhecer o gesto no primeiro instante em que o avaliador devolve reconhecido.
- **FR-006:** A interface DEVE exibir a carta pública, o painel da câmera e o botão **Começar**, habilitado somente com câmera ativa e detector carregado; durante a rodada DEVE oferecer **Cancelar**; ao fim DEVE oferecer **Nova rodada**.
- **FR-007:** O detector DEVE usar o `HandLandmarker` do `@mediapipe/tasks-vision` em modo de vídeo com no máximo uma mão, tentando o delegate GPU e recorrendo ao CPU quando a criação falhar; o parâmetro de URL `delegate=cpu` ou `delegate=gpu` DEVE forçar um delegate, sem recuo, para comparação; o delegate efetivo DEVE ser exibido no painel de depuração.
- **FR-008:** A interface DEVE desenhar sobre o vídeo os 21 pontos e as conexões da mão durante a rodada e DEVE exibir ângulo atual, inversões, amostras da janela, latência mediana e p95 de inferência.
- **FR-009:** O `.wasm` do MediaPipe e o modelo `.task` DEVEM ser servidos pelo próprio app, sem CDN; o modelo NÃO DEVE ser versionado no repositório e DEVE ser obtido por um script oficial do `package.json` com hash SHA-256 fixado e verificado.
- **FR-010:** O app NÃO DEVE persistir, registrar em log ou transmitir quadros, vídeo ou landmarks; o aviso de privacidade DEVE informar que o processamento é local.
- **FR-011:** O repositório DEVE remover `apps/server`, `packages/providers`, `packages/benchmark`, o adivinhador, o árbitro semântico, os schemas de palpite, a captura de frames e o cliente de palpite, além das variáveis do `.env.example`, dos scripts de workspace e das referências em documentação e configuração.
- **FR-012:** Falhas do detector (modelo não carregou, delegate indisponível, erro de inferência) DEVEM levar a `tracker_error` com mensagem em português, sem marcar reconhecimento nem consumir a rodada como tentativa.
- **FR-013:** O `PROJECT_SPEC.md`, o README e o contexto técnico em `docs/development-context/` DEVEM descrever o novo fluxo e remover as regras do fluxo por LLM que deixaram de valer.
- **FR-014:** As séries de ângulo dos 12 clipes de referência DEVEM existir como fixtures de teste do avaliador, contendo apenas números (tempo e ângulo), sem imagem, sem vídeo e sem landmarks.

## Requisitos não funcionais

- **NFR-001:** Nenhum texto, relatório ou documento DEVE afirmar acurácia, recall, falso positivo ou latência gerais; resultados DEVEM declarar a amostra e as condições (Constituição V).
- **NFR-002:** A latência de inferência DEVE ser medida no Chrome desktop do maintainer e registrada em `validation.md` com número, máquina e navegador; até lá nenhuma meta de taxa de quadros é afirmada.
- **NFR-003:** O avaliador e a máquina de estados DEVEM ser puros e executáveis em Node sem DOM e sem MediaPipe.
- **NFR-004:** O alvo suportado é o Chrome desktop; a ausência de `getUserMedia` ou de WebAssembly DEVE resultar em mensagem explicativa, sem falha silenciosa.
- **NFR-005:** O estado da rodada e os resultados DEVEM ser anunciados por região `aria-live`, e os controles DEVEM ter rótulo textual.
- **NFR-006:** `yarn check:all`, `yarn sdd:check`, `yarn docs:format:check` e `yarn test:gates` DEVEM passar no final da entrega.

## Edge cases

- Nenhuma mão visível durante a rodada: nenhuma amostra; ao fim, `timed_out`.
- Duas mãos: apenas a primeira devolvida pelo detector é considerada.
- Mão sai e volta do quadro: as amostras fora da janela deixam de contar; a janela não preenche lacunas.
- Troca de aba ou queda do vídeo: a rodada segue pelo relógio; sem amostras, `timed_out`.
- Câmera interrompida durante a rodada: a rodada termina como `user_cancelled` se o usuário cancelou, ou `tracker_error` se o fluxo caiu.
- Aceno lento: pode levar vários segundos para acumular inversões; o limite de 10 s é uma hipótese a ajustar.
- Cobertura baixa de quadros (borrão de movimento): o avaliador tolera lacunas desde que `minSamples` seja atingido na janela.

## Hipóteses e dependências

- **H-01:** Os resultados do spike (5 de 5 acenos, 0 de 7 confusores) valem para os 12 clipes gravados em Chromium headless; não generalizam para outras pessoas, câmeras e iluminação.
- **H-02:** No modo de vídeo contínuo o rastreamento da mão é igual ou melhor que o do spike (quadro isolado); a hipótese é validada no teste do maintainer.
- **H-03:** O delegate GPU funciona e é mais rápido que o CPU no Chrome desktop do maintainer. A criação do delegate GPU pode ter sucesso e ainda ser lenta (no Chromium headless da VPS, WebGL por software levou cerca de 1,3 s por quadro), por isso o recuo automático não basta e o parâmetro `delegate` existe; a comparação é verificável no painel.
- **H-04:** Os limiares (15°, 3 inversões, 2,5 s, 5 amostras) foram escolhidos antes de qualquer ajuste e confirmados numa região estável de parâmetros; não foram validados em dados separados.
- **H-05:** A licença do arquivo `.task` não foi verificada em sua fonte; por isso ele não é versionado e a verificação fica registrada em `research.md` como pendência antes de qualquer redistribuição.
- **Dependências:** `@mediapipe/tasks-vision` 1.1.1 (Apache-2.0); acesso de rede no desenvolvimento e no build apenas para obter o modelo.

## Critérios mensuráveis de sucesso

- **SC-001:** Nas séries de referência, o avaliador reconhece 5 de 5 acenos e 0 de 7 confusores (regressão sobre 12 clipes; não é medida de acurácia geral).
- **SC-002:** Em teste manual do maintainer no Chrome desktop, com N tentativas de aceno e N de cada confusor declaradas em `validation.md`, o recall é >= 80% e os falsos positivos são <= 10%, com nenhum falso positivo em "pessoa parada". São as metas vigentes do projeto, ajustáveis conforme o resultado.
- **SC-003:** A mediana do tempo entre apertar Começar e o reconhecimento, medida no teste do maintainer, é <= 8 s, e o p95 é <= 15 s. A latência por quadro e o delegate efetivo são registrados.
- **SC-004:** Uma rodada completa não gera requisição de rede com imagem, vídeo ou landmarks, verificada por inspeção das requisições em um teste de ponta a ponta no Chromium.
- **SC-005:** O repositório não contém `apps/server`, `packages/providers` nem `packages/benchmark`, e `yarn check:all` passa sem código órfão.
