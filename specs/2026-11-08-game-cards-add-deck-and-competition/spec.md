---
id: 2026-11-08-game-cards-add-deck-and-competition
title: Ampliar baralho e pontuação competitiva
summary: Oferecer cartas selecionáveis, traduções e rodadas com pontuação e relógio autoritativos no servidor.
slug: game-cards-add-deck-and-competition
strategy: sdd
domain: game
capability: cards
objective: add-deck-and-competition
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - package.json
    - docs/
    - apps/web/
    - apps/server/
    - packages/core/
    - contracts/
related_specs: []
supersedes: []
branch: codex/cards-deck-competitive
constitution_version: 1.0.0
created_at: 2026-11-08
updated_at: 2026-11-08
---

# Ampliar baralho e pontuação competitiva

## Resumo

Issues #18 e #19: baralho versionado com categorias/dificuldades, seleção e tradução das cartas e da interface de cartas; modo treino local preservado e competitivo opcional com avaliação, tempo e pontuação no servidor.

## Problema

O jogo de cartas só oferece Acenar. Tempo e critério locais são adequados ao treino, mas não são autoridade de uma pontuação competitiva.

## Objetivos

- Permitir novas cartas por dados sem mudar motor/árbitro.
- Calcular reconhecimento e pontos competitivos usando o critério privado e relógio do servidor.
- Oferecer português brasileiro por padrão e inglês na experiência de cartas.

## Fora de escopo

- Novos tipos de gesto, IA, ranking global, contas, banco de dados, prêmio, antifraude por vídeo, idiomas dos outros jogos, Violão, merge/deploy.

## Atores

- Jogador: seleciona carta, idioma e treino local ou rodada competitiva experimental.
- Servidor: retém metadados privados e decide resultado/pontos.

## Histórias de usuário

### US-001 — Baralho selecionável (P1)

Como jogador, quero escolher cartas por categoria/dificuldade e ler os textos em meu idioma.

**Teste independente:** filtrar e selecionar uma carta diferente de Acenar e iniciar treino com ela.

**Critérios de aceitação:** dado o baralho versionado, quando seleciono categoria, dificuldade ou idioma, então a seleção e a carta pública são consistentes e a carta usa o mesmo motor/árbitro.

### US-002 — Rodada competitiva (P1)

Como jogador, quero tempo e pontos definidos pelo servidor para comparar tentativas sob as mesmas regras.

**Teste independente:** iniciar rodada no servidor, enviar ângulos suficientes no tempo correto e observar reconhecimento/pontos calculados ali.

**Critérios de aceitação:** dado o modo competitivo, quando a rodada termina, então somente metadados do baralho e relógio do servidor determinam resultado e pontos; payload com score, elapsed ou critério fornecido pelo cliente é rejeitado.

## Requisitos funcionais

- **FR-001:** Disponibilizar ao menos quatro cartas versionadas em três categorias e dois níveis de dificuldade, usando o critério de oscilação já suportado; novos dados válidos não exigem mudança no motor/árbitro. Explicar que avalia o movimento, não o significado da mímica.
- **FR-002:** Oferecer seleção de carta, categoria e dificuldade, mantendo filtros consistentes e reiniciando a rodada ao trocar a seleção.
- **FR-003:** Disponibilizar pt-BR padrão e en-US para seleção, carta, controles, tempo, resultado e privacidade do fluxo de cartas; preferência local opcional com fallback seguro. Não prometer tradução do painel técnico nem dos outros jogos.
- **FR-004:** Definir duração e pontos-base privados por carta; treino usa a duração configurada. No competitivo o servidor carrega a carta por id e avalia ângulos com seu relógio, sem aceitar pontuação, resultado, timestamps ou metadados de avaliação do cliente.
- **FR-005:** Pontuar reconhecimento como arredondamento de basePoints × (0,5 + 0,5 × fração de tempo restante). Timeout, cancelamento e falha valem zero. Resultado final imutável e repetível, sem pontos duplicados. Não há penalidade por dicas nesta entrega.
- **FR-006:** Competitive experimental transmite apenas ângulo escalar/null e sequência; mostrar aviso antes de iniciar. Não transmitir imagem, landmarks ou credenciais de provedor. Sem conexão/servidor não conceder pontos competitivos nem fazer fallback silencioso.
- **FR-007:** Limitar capacidade de rodadas, tamanho/frequência de comandos e tempo de retenção; token privado por rodada, validação estrita, origem permitida e erros genéricos; não registrar token ou amostras. Documentar que ângulos fornecidos pelo dispositivo não provam presença/identidade e não sustentam premiações.
- **FR-008:** Publicar contratos HTTP exportáveis do fluxo competitivo e demonstrar frontend/servidor, descarte, expiração e fronteira pública/privada com testes.

## Requisitos não funcionais

- **NFR-001:** A projeção pública nunca contém evaluation ou critérios; preserve os testes de fronteira em todas as cartas/idiomas. Processamento de imagem continua local/transitório.
- **NFR-002:** Reutilizar núcleo, captura e validação existentes; sem provedor externo, dependência nova ou persistência de rodada. Recursos e tarefas assíncronas devem ser descartados ao sair.

## Edge cases

Filtro vazio, idioma inválido/storage indisponível, carta inexistente, troca de carta durante rodada, relógio no limite exato, amostra repetida/fora de ordem, rajada, token incorreto, timeout sem mão, resposta atrasada após saída e servidor indisponível.

## Hipóteses e dependências

Defaults decididos no escopo autorizado: pt-BR/en-US, 10 s por rodada inicialmente, pontuação com bônus de rapidez de até 50% e sem ranking. Cartas representam variações de oscilação reconhecível, sem alegar classificação semântica. Limitações de validação com câmera real permanecem explícitas.

## Critérios mensuráveis de sucesso

- **SC-001:** Todas as cartas passam schema/projeção, seleção e traduções possuem regressões e novas cartas não exigem mudança no avaliador.
- **SC-002:** Rodada competitiva real reconhece e pontua no servidor; forjar score/metadados não altera resultado, e cancelamento/timeout não pontuam.
- **SC-003:** Scripts oficiais e contratos aprovados, com PR draft e limitações registradas; aceite final permanece humano.
