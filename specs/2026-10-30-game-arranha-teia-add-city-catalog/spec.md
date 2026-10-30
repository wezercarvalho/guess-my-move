---
id: 2026-10-30-game-arranha-teia-add-city-catalog
summary: Acrescenta ao Arranha-Teia um catálogo local e uma seleção de mapas antes da partida, preserva Midtown Manhattan, inclui Avenida Paulista como primeira cidade nova e melhora a apresentação procedural sem serviço externo em tempo de jogo.
title: Selecionar cidades no Arranha-Teia
slug: game-arranha-teia-add-city-catalog
strategy: sdd
domain: game
capability: arranha-teia
objective: add-city-catalog
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases:
    - mapas
    - cidades
    - seleção de cidade
code_paths:
    - apps/web/src/swing/
    - apps/web/public/swing/
    - apps/web/scripts/
related_specs:
    - 2026-10-28-game-arranha-teia-build-first-person-web-swing
supersedes: []
branch: docs/82-pesquisa-mapas-cidades
constitution_version: 1.0.0
created_at: 2026-10-30
updated_at: 2026-10-30
---

# Selecionar cidades no Arranha-Teia

## Resumo

Antes de entrar no Arranha-Teia, o jogador escolhe uma cidade disponível num catálogo servido pela própria origem. Midtown Manhattan continua jogável; Avenida Paulista, em São Paulo, entra como a primeira cidade nova. A apresentação procedural ganha iluminação, fachadas e ruas mais legíveis sem trocar a física, sem Cesium e sem serviço de mapas em tempo de jogo.

## Problema

O jogo carrega `midtown.json` diretamente e não permite escolher mapa. O cenário atual é pouco variado e visualmente simples. Tiles fotorrealistas poderiam melhorar a aparência, mas introduziriam rede de terceiros, token, custo, termos de uso e uma malha diferente da geometria usada pela colisão. O Rio de Janeiro também exige relevo para não virar uma cidade plana e enganosa.

## Objetivos

- Mostrar uma seleção de mapas antes da partida, com nome, local e uma frase curta.
- Preservar Midtown sem regressão e permitir trocar de mapa sem recarregar manualmente a URL.
- Adicionar Avenida Paulista como mapa local, usando o mesmo formato de colisão do jogo.
- Parametrizar o conversor/build de OSM para novas cidades sem copiar scripts.
- Melhorar o visual procedural comum mantendo a geometria de colisão e o funcionamento atual.

## Fora de escopo

- Integrar Cesium ion, Google Photorealistic 3D Tiles ou outro serviço externo em tempo de jogo.
- Entregar o Rio de Janeiro antes de existir relevo na física e no renderizador.
- Prometer fotorrealismo, fps, precisão das alturas ou cobertura urbana sem medição.
- Alterar gestos, física da teia, câmera pela cabeça ou escalada.

## Atores

- **Jogador:** escolhe uma cidade e joga com as mesmas regras.
- **Maintainer:** adiciona futuras cidades por uma definição de fonte e um catálogo, sem duplicar o pipeline.

## Histórias de usuário

### US-001 — Escolher o mapa antes de jogar (P1)

Como jogador, quero ver os mapas disponíveis antes da partida para escolher onde passear.

**Teste independente:** abrir `swing.html`, escolher Midtown e entrar; voltar à seleção e escolher Avenida Paulista.

**Critérios de aceitação:**

1. **Dado** o Arranha-Teia aberto sem mapa na URL, **quando** a página carrega, **então** mostra a seleção antes de criar o jogo.
2. **Dado** um mapa disponível, **quando** o jogador o escolhe, **então** o jogo usa o arquivo, o nome e a atribuição desse mapa.
3. **Dado** o jogo aberto, **quando** o jogador escolhe "Trocar mapa", **então** volta à seleção e encerra o controlador anterior.

### US-002 — Jogar em mais de uma cidade (P1)

Como jogador, quero Midtown e Avenida Paulista como opções reais para comparar os cenários.

**Teste independente:** carregar cada arquivo pelo catálogo, validar o formato e criar o índice de colisão.

**Critérios de aceitação:**

1. **Dado** o catálogo, **quando** seus mapas disponíveis são validados, **então** cada arquivo existe, tem prédios e vias, e o nome/atribuição correspondem.
2. **Dado** Avenida Paulista escolhida, **quando** a partida inicia, **então** a física usa os prédios desse arquivo e o crédito ODbL aparece.

### US-003 — Cenário procedural mais legível (P2)

Como jogador, quero ruas e prédios com mais profundidade visual para reconhecer melhor o movimento entre as fachadas.

**Teste independente:** construir a geometria/texturas de uma cidade sintética e conferir materiais, iluminação e descarte.

**Critérios de aceitação:**

1. **Dado** qualquer cidade do catálogo, **quando** o renderizador é criado, **então** usa iluminação e materiais procedurais sem buscar textura externa.
2. **Dado** o renderizador antigo, **quando** a física é executada após o passe visual, **então** colisão, mira e teias continuam usando o mesmo `City`.

## Requisitos funcionais

- **FR-001:** O app DEVE carregar `swing/cities.json` da própria origem e rejeitar catálogo inválido ou caminho absoluto/externo.
- **FR-002:** A tela DEVE mostrar a seleção antes do jogo, com cards curtos, estado de carregamento/erro e uma ação por mapa.
- **FR-003:** Escolher um mapa DEVE montar uma instância nova do jogo com o arquivo escolhido; "Trocar mapa" DEVE desmontá-la e voltar à seleção.
- **FR-004:** O catálogo DEVE incluir Midtown Manhattan e Avenida Paulista como disponíveis, com arquivo, nome, região, descrição e atribuição ODbL.
- **FR-005:** O pipeline OSM DEVE aceitar id, nome, bbox, rotação e saída por cidade, mantendo Midtown compatível e sem rede em tempo de jogo.
- **FR-006:** Cada mapa disponível DEVE passar por validação automatizada de catálogo, arquivo, limites, prédios, vias, atribuição e caminho local.
- **FR-007:** O passe visual DEVE usar somente Three.js e conteúdo procedural/local, sem mudar o contrato `City` usado pela física.
- **FR-008:** Um parâmetro `?city=<id>` PODE abrir diretamente um mapa válido; id ausente ou desconhecido DEVE mostrar a seleção.

## Requisitos não funcionais

- **NFR-001:** Nenhuma requisição de mapa, imagem ou tile para terceiros em tempo de jogo; nenhum token no bundle.
- **NFR-002:** A mudança DEVE ser test-first; exceções reais ficam registradas em `validation.md`.
- **NFR-003:** `check:all`, gates SDD/docs e auditoria de dependências DEVEM passar antes do push.
- **NFR-004:** A seleção DEVE funcionar em 390, 900 e 1440 px sem rolagem horizontal; a verificação visual fica registrada como texto e screenshot fora do repositório.
- **NFR-005:** Tamanho, prédios, vias e alturas dos mapas DEVEM ser registrados; fps só pode ser citado se medido.

## Edge cases

- Catálogo não carrega: mostrar erro curto e não montar o jogo.
- Arquivo de cidade não carrega: manter o erro dentro da partida e permitir trocar o mapa.
- URL aponta para id desconhecido: mostrar seleção, sem tentar caminho derivado do id.
- Troca de cidade com câmera ativa: desmontar controlador e renderizador; a câmera compartilhada é encerrada ao desmontar a tela.
- Cidade baixa ou sem altura suficiente: não entra só para aumentar o número de opções; precisa ser jogável com a teia.

## Hipóteses e dependências

- A Avenida Paulista tem perfil vertical útil para o jogo: a pesquisa anterior mediu 960 prédios, 186 vias, 96% de alturas explícitas e 23% de raios acertando paredes a 60 m, com dados daquela consulta.
- O passe visual melhora legibilidade, não comprova realismo nem desempenho.
- Rio de Janeiro depende de uma próxima spec de relevo e dados abertos; Cesium continua como experimento opcional futuro.

## Critérios mensuráveis de sucesso

- **SC-001:** Dois mapas disponíveis aparecem e abrem por seleção e por URL, sem requisição externa em tempo de jogo.
- **SC-002:** Os arquivos de Midtown e Paulista passam pelos testes de dados e pelo índice de colisão.
- **SC-003:** Os gates oficiais passam e nenhuma regressão ocorre nos jogos ou na física do Arranha-Teia.
- **SC-004:** A seleção é legível em 390, 900 e 1440 px; o jogo mostra o nome e a atribuição do mapa escolhido.
