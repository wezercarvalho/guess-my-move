---
id: 2026-10-20-vision-gesture-recognition-validate-waving-poc
title: Validar o reconhecimento do gesto "acenar" por modelo multimodal (PoC visual)
slug: vision-gesture-recognition-validate-waving-poc
strategy: sdd
domain: vision
capability: gesture-recognition
objective: validate-waving-poc
summary: PoC visual (Fase 0) que valida se um modelo multimodal gerenciado reconhece o gesto acenar a partir de frames da webcam, sem treinamento e sem receber a carta.
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
updated_at: 2026-10-21
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

## Estratégia de provedores da PoC

O motor de palpites é um componente **plugável** atrás da interface `GuesserProvider` (FR-006). A PoC implementa **apenas dois provedores**:

1. **`mock`:** sem credencial, para desenvolvimento e testes.
2. **`codex`:** primeiro provedor real, que chama o Codex CLI em modo não interativo com o modelo `gpt-6-luna` (esforço de raciocínio configurável), usando a sessão do próprio mantenedor. Uso restrito a desenvolvimento local e ao benchmark, nunca exposto a jogadores.

Provedores como Amazon Bedrock, Claude direto, OpenRouter e a API da OpenAI são **trabalho futuro**: entram como novos adaptadores sem alterar UI, captura nem núcleo do jogo. A escolha final do provedor de produção só é feita após o benchmark.

## Fora de escopo

Banco de dados, autenticação, multiplayer, pontuação, cronômetro, baralho ampliado, árbitro semântico, árbitro visual, treinamento ou fine-tuning, MediaPipe, reconhecimento contínuo/streaming, áudio e animações geradas por IA.

Também fora de escopo nesta PoC: adaptadores para Bedrock, Claude direto, OpenRouter e API da OpenAI; configuração de conta AWS; decisão de residência de dados; exposição pública do provedor `codex`; conclusões sobre latência de produção (ver SC-004).

## Atores

- **Jogador:** autoriza a câmera, aciona a captura e vê o palpite.
- **Servidor mínimo:** mantém a credencial ou sessão do provedor fora do navegador, valida o payload e chama o provedor.
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
2. **Dado** o provedor `codex`, **quando** o processo é iniciado, **então** ele roda em diretório temporário vazio, em modo somente leitura e sem acesso ao repositório, recebendo apenas os frames e as instruções genéricas.

### US-003 — Medir o desempenho no cenário "acenar" (P1)

Como mantenedor, quero um benchmark reproduzível para decidir sobre o provedor com base em evidência.

**Teste independente:** executar o protocolo e produzir o relatório de métricas.

**Critérios de aceitação:**

1. **Dado** o conjunto de cenários positivos e negativos definido, **quando** o benchmark é executado, **então** o relatório registra acertos por cenário, falsos positivos e negativos, latência (mediana e p95 quando houver amostra), custo estimado por tentativa e falhas técnicas, com o tamanho da amostra declarado.

## Requisitos funcionais

- **FR-001:** O sistema DEVE solicitar permissão de câmera, exibir preview local e permitir parar a câmera.
- **FR-002:** O sistema DEVE capturar, sob comando explícito, uma janela de frames com timestamps e limites configuráveis de quantidade e resolução, e descartá-los após o uso.
- **FR-003:** O sistema DEVE enviar os frames por uma API server-side que mantém a credencial ou sessão do provedor fora do navegador.
- **FR-004:** O sistema DEVE obter um palpite curto e estruturado, validado por schema, permitindo a resposta "evidência insuficiente".
- **FR-005:** O sistema DEVE oferecer um provedor simulado (mock) que funcione sem credencial.
- **FR-006:** O sistema DEVE isolar o provedor de IA atrás de uma interface, de modo que trocar de modelo não exija alterar UI nem captura.
- **FR-007:** O sistema DEVE excluir do payload do adivinhador palavra, dica, sugestão, aliases e critérios da carta, com teste automatizado.
- **FR-008:** O sistema DEVE diferenciar na interface os estados `capturing`, `processing`, `success` e `error`.
- **FR-009:** O servidor DEVE validar o payload, impor limites de frames e tamanho, aplicar timeout e converter falhas do provedor em erros estáveis sem expor detalhes internos.
- **FR-010:** O sistema DEVE registrar métricas técnicas mínimas sem mídia (duração, sucesso/erro, quantidade de frames, provedor/modelo).
- **FR-011:** O sistema DEVE informar ao usuário quando os frames são enviados a um provedor externo.
- **FR-012:** O sistema DEVE implementar na PoC somente os provedores `mock` e `codex`, selecionados por configuração, sem alterar UI, captura nem núcleo ao trocar de provedor.
- **FR-013:** O provedor `codex` DEVE ficar desabilitado por padrão e só ativar com flag explícita de desenvolvimento local; o modelo e o esforço de raciocínio DEVEM ser configuráveis para o benchmark (por exemplo `none`, `low` e `high`).
- **FR-014:** O provedor `codex` DEVE aplicar timeout, limitar a uma execução simultânea por padrão e descartar os arquivos temporários dos frames ao final de cada tentativa.

## Requisitos não funcionais

- **NFR-001:** A credencial ou sessão do provedor (incluindo o login do Codex) NÃO DEVE aparecer no bundle do navegador, em logs nem no repositório; `.env.example` DEVE conter apenas placeholders.
- **NFR-002:** Frames NÃO DEVEM ser persistidos nem registrados em logs.
- **NFR-003:** O modo mock DEVE permitir executar a suíte de testes sem custo de inferência.
- **NFR-005:** Frames enviados ao `codex` DEVEM ser gravados apenas em diretório temporário do processo e removidos ao fim da tentativa, inclusive em caso de erro ou timeout.
- **NFR-004:** O README DEVE documentar requisitos, instalação, modos mock e real, configuração, privacidade, limites conhecidos e passos de teste.

## Edge cases

- Nenhuma pessoa no enquadramento, iluminação ruim, mão parcialmente fora do quadro.
- Resposta vazia, fora de formato ou com certeza alegada sem evidência: erro controlado ou "evidência insuficiente".
- Provedor indisponível, limitação de taxa ou timeout.
- Payload acima dos limites de frames/tamanho.

## Hipóteses e dependências

- A pesquisa de provedores está em [`docs/research`](../../docs/research/multimodal-model-selection.md); é provisória até o benchmark. Para a PoC, o primeiro provedor real é o `codex` com `gpt-6-luna`; Bedrock fica para depois.
- **Não verificado:** se o Codex CLI aceita várias imagens por execução, se o `gpt-6-luna` está disponível nele, se o esforço de raciocínio é configurável e como obter saída estruturada. Isso DEVE ser confirmado na primeira tarefa de implementação do adaptador; se algum ponto falhar, o plano é revisto e a API da OpenAI vira o fallback.
- Pré-requisito do modo real: Codex CLI instalado e autenticado na máquina do mantenedor. Os termos de uso da assinatura para este uso são responsabilidade do mantenedor e não foram verificados.
- Decisões em aberto do produto (idioma da UI, licença, hospedagem, metas numéricas) NÃO são tratadas como aprovadas.

## Critérios mensuráveis de sucesso

- **SC-001:** O benchmark produz um relatório reproduzível com os cenários positivos e negativos definidos em [`docs/research`](../../docs/research/multimodal-model-selection.md), sem extrapolar uma taxa de acerto geral.
- **SC-002:** O teste de fronteira de informação passa e falha quando um campo da carta é adicionado ao payload.
- **SC-003:** O modo mock executa o fluxo completo sem credencial.
- **SC-004:** O relatório identifica a latência medida via `codex` como **não representativa** da produção (inclui inicialização do processo e camada de agente) e não a usa para decidir o provedor final; a latência de produção é medida de novo no provedor definitivo.

## Questões críticas para clarificação

- Metas numéricas mínimas de acerto e falso positivo para considerar a PoC bem-sucedida. As metas de latência ficam para o provedor definitivo.
- Número e perfil das pessoas e ambientes do benchmark, e consentimento para coleta.
- Variantes a testar no benchmark: `gpt-6-luna` via `codex` com esforço `none`, `low` e `high` (a confirmar o que o CLI expõe).
- Critério para promover um provedor de produção depois da PoC (Bedrock, API da OpenAI ou outro), incluindo residência de dados.
