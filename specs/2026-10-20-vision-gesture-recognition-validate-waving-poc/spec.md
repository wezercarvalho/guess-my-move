---
id: 2026-10-20-vision-gesture-recognition-validate-waving-poc
title: Validar o reconhecimento do gesto "acenar" por modelo multimodal (PoC visual)
slug: vision-gesture-recognition-validate-waving-poc
strategy: sdd
domain: vision
capability: gesture-recognition
objective: validate-waving-poc
status: draft
owners:
  - wezercarvalho
reviewers: []
aliases:
  - poc visual
  - fase 0
  - acenar
  - waving
  - adivinhador
code_paths:
  - apps/
related_specs: []
supersedes: []
branch: null
constitution_version: 1.0.0
created_at: 2026-10-20
updated_at: 2026-10-20
---

# Validar o reconhecimento do gesto "acenar" por modelo multimodal (PoC visual)

## Resumo

Provar, de forma executável localmente e com medições honestas, se um modelo multimodal pré-treinado e gerenciado consegue produzir um palpite textual útil sobre o gesto "acenar" a partir de uma sequência curta de frames da webcam, sem treinamento próprio e sem receber a carta.

## Problema

A hipótese central do produto (ver [`PROJECT_SPEC.md`](../../docs/product/PROJECT_SPEC.md)) é que um modelo multimodal reconhece ações simples a partir de poucos frames com precisão e latência adequadas ao jogo. Essa hipótese ainda não foi testada. Construir motor, árbitro e mecânica de rodada antes de validá-la arrisca abstrações sobre uma premissa falsa.

## Objetivos

- Capturar uma janela curta de frames ordenados após comando explícito do jogador.
- Obter, via servidor, um palpite curto de um modelo multimodal (modo real) ou de um provedor simulado (modo mock).
- Medir acertos, falsos positivos, falsos negativos, latência e custo estimado por tentativa em cenários positivos e negativos de "acenar".
- Produzir um relatório com limitações explícitas e a decisão de manter, ajustar ou trocar o provedor.

## Fora de escopo

Banco de dados, autenticação, multiplayer, pontuação, cronômetro, baralho ampliado, árbitro semântico, árbitro visual, treinamento ou fine-tuning, MediaPipe, reconhecimento contínuo/streaming, áudio e animações geradas por IA.

## Atores

- **Jogador:** autoriza a câmera, aciona a captura e vê o palpite.
- **Servidor mínimo:** guarda a credencial, valida o payload e chama o provedor.
- **Provedor multimodal:** gera um palpite curto a partir dos frames e de instruções genéricas.
- **Avaliador humano:** registra o resultado esperado dos cenários para o benchmark.

## Histórias de usuário

### US-001 — Obter um palpite a partir dos frames (P1)

Como jogador, quero acionar a captura diante da webcam para ver o palpite da IA sobre minha ação.

**Teste independente:** com a câmera autorizada, acionar a captura e observar um palpite ou um erro recuperável, nos modos mock e real.

**Critérios de aceitação:**

1. **Dado** que a câmera foi autorizada, **quando** o jogador aciona a captura, **então** o sistema coleta frames em ordem temporal e exibe um palpite textual ou um erro recuperável.
2. **Dado** que a câmera foi negada, **quando** o jogador tenta iniciar, **então** nenhuma requisição ao modelo é feita e há instruções para reabilitar a permissão.
3. **Dado** um erro ou timeout do provedor, **quando** a tentativa termina, **então** a interface entra em estado recuperável, sem palpite inventado e sem travar a câmera.

### US-002 — Garantir que a carta não vaza ao adivinhador (P1)

Como mantenedor, quero que o payload ao modelo nunca contenha dados da carta para que a avaliação seja válida.

**Teste independente:** teste automatizado que inspeciona o payload montado para o provedor.

**Critérios de aceitação:**

1. **Dado** que a carta "Acenar" está visível na tela, **quando** o adivinhador é chamado, **então** o payload não contém palavra, dica, sugestão, resposta canônica, aliases nem critérios de avaliação.

### US-003 — Medir o desempenho no cenário "acenar" (P1)

Como mantenedor, quero um benchmark reproduzível para decidir sobre o provedor com base em evidência.

**Teste independente:** executar o protocolo e produzir o relatório de métricas.

**Critérios de aceitação:**

1. **Dado** o conjunto de cenários positivos e negativos definido, **quando** o benchmark é executado, **então** o relatório registra acertos por cenário, falsos positivos e negativos, latência (mediana e p95 quando houver amostra), custo estimado por tentativa e falhas técnicas, com o tamanho da amostra declarado.

## Requisitos funcionais

- **FR-001:** O sistema DEVE solicitar permissão de câmera, exibir preview local e permitir parar a câmera.
- **FR-002:** O sistema DEVE capturar, sob comando explícito, uma janela de frames com timestamps e limites configuráveis de quantidade e resolução, e descartá-los após o uso.
- **FR-003:** O sistema DEVE enviar os frames por uma API server-side que mantém a credencial fora do navegador.
- **FR-004:** O sistema DEVE obter um palpite curto e estruturado, validado por schema, permitindo a resposta "evidência insuficiente".
- **FR-005:** O sistema DEVE oferecer um provedor simulado (mock) que funcione sem credencial.
- **FR-006:** O sistema DEVE isolar o provedor de IA atrás de uma interface, de modo que trocar de modelo não exija alterar UI nem captura.
- **FR-007:** O sistema DEVE excluir do payload do adivinhador palavra, dica, sugestão, aliases e critérios da carta, com teste automatizado.
- **FR-008:** O sistema DEVE diferenciar na interface os estados `capturing`, `processing`, `success` e `error`.
- **FR-009:** O servidor DEVE validar o payload, impor limites de frames e tamanho, aplicar timeout e converter falhas do provedor em erros estáveis sem expor detalhes internos.
- **FR-010:** O sistema DEVE registrar métricas técnicas mínimas sem mídia (duração, sucesso/erro, quantidade de frames, provedor/modelo).
- **FR-011:** O sistema DEVE informar ao usuário quando os frames são enviados a um provedor externo.

## Requisitos não funcionais

- **NFR-001:** A credencial do provedor NÃO DEVE aparecer no bundle do navegador, em logs nem no repositório; `.env.example` DEVE conter apenas placeholders.
- **NFR-002:** Frames NÃO DEVEM ser persistidos nem registrados em logs.
- **NFR-003:** O modo mock DEVE permitir executar a suíte de testes sem custo de inferência.
- **NFR-004:** O README DEVE documentar requisitos, instalação, modos mock e real, configuração, privacidade, limites conhecidos e passos de teste.

## Edge cases

- Nenhuma pessoa no enquadramento, iluminação ruim, mão parcialmente fora do quadro.
- Resposta vazia, fora de formato ou com certeza alegada sem evidência: erro controlado ou "evidência insuficiente".
- Provedor indisponível, limitação de taxa ou timeout.
- Payload acima dos limites de frames/tamanho.

## Hipóteses e dependências

- A escolha do provedor/modelo está em [`docs/research`](../../docs/research/multimodal-model-selection.md); é provisória até o benchmark.
- Acesso a credenciais/conta do provedor escolhido é pré-requisito do modo real.
- Decisões em aberto do produto (idioma da UI, licença, hospedagem, metas numéricas) NÃO são tratadas como aprovadas.

## Critérios mensuráveis de sucesso

- **SC-001:** O benchmark produz um relatório reproduzível com os cenários positivos e negativos definidos em [`docs/research`](../../docs/research/multimodal-model-selection.md), sem extrapolar uma taxa de acerto geral.
- **SC-002:** O teste de fronteira de informação passa e falha quando um campo da carta é adicionado ao payload.
- **SC-003:** O modo mock executa o fluxo completo sem credencial.

## Questões críticas para clarificação

- Metas numéricas mínimas de acerto, falso positivo e latência para considerar a PoC bem-sucedida.
- Número e perfil das pessoas e ambientes do benchmark, e consentimento para coleta.
- Modelo(s) a testar no benchmark entre os candidatos da pesquisa.
