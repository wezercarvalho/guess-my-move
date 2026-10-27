---
id: 2026-10-21-game-engine-round-referee-build-core-loop
title: Motor da rodada, carta e árbitro semântico do núcleo do jogo
slug: game-engine-round-referee-build-core-loop
strategy: sdd
domain: game-engine
capability: round-referee
objective: build-core-loop
summary: Núcleo puro do jogo (packages/core) — carta com dados públicos e privados, máquina de estados da rodada com limites de tentativas, árbitro semântico determinístico com fallback opcional por LLM e histórico de palpites rejeitados.
status: superseded
owners:
    - wezercarvalho
reviewers: []
aliases:
    - motor da rodada
    - árbitro semântico
    - carta
    - rejectedGuesses
    - máquina de estados
code_paths:
    - packages/core/
related_specs:
    - 2026-10-20-vision-gesture-recognition-validate-waving-poc
    - 2026-10-26-vision-hand-gesture-referee-replace-llm-guesser
supersedes: []
branch: docs/1-clarify-plan-tasks
constitution_version: 1.0.0
created_at: 2026-10-21
updated_at: 2026-10-26
---

# Motor da rodada, carta e árbitro semântico do núcleo do jogo

## Resumo

Entregar o núcleo puro do jogo em `packages/core` (TypeScript sem framework e sem I/O): o contrato da carta com separação entre dados públicos e metadados de avaliação, a máquina de estados da rodada com limites de tentativas, o árbitro semântico determinístico com interface opcional de fallback por LLM e o histórico de palpites rejeitados enviado ao adivinhador como `rejectedGuesses`, acompanhado de documentação de execução.

## Problema

Depois que a PoC visual (ver [`spec relacionada`](../2026-10-20-vision-gesture-recognition-validate-waving-poc/spec.md)) valida o reconhecimento do gesto, o jogo precisa de um núcleo que orqueste rodadas, julgue palpites sem confirmação manual e evite repetir palpites recusados — sem persistência e sem violar a fronteira de informação da carta. Hoje esse núcleo não existe: a carta, o árbitro e o motor são apenas regras escritas.

## Objetivos

- Modelar a carta com `public` (visível ao jogador) e `evaluation` (privado ao servidor/motor), versionada no Git e validada por schema.
- Orquestrar a rodada por uma máquina de estados explícita com limites configuráveis de tentativas e estados de exceção.
- Julgar o palpite por equivalência semântica determinística contra resposta canônica e aliases, rejeitando respostas insuficientes.
- Prever uma interface opcional de fallback por LLM para ambiguidade, desligada por padrão e conservadora.
- Manter em memória o histórico de palpites rejeitados e enviá-lo como `rejectedGuesses`, sem qualquer dado da carta.
- Documentar a execução do projeto (modos mock e real, testes e privacidade).

## Fora de escopo

Persistência e banco de dados, pontuação, cronômetro, internacionalização, baralho ampliado, árbitro visual, análise de webcam pelo árbitro, UI, captura de frames e adaptadores de provedor (vivem na spec da PoC). A execução do fallback por LLM com um provedor real também fica fora: esta spec entrega apenas a interface injetável e a política conservadora.

## Atores

- **Motor da rodada:** orquestra estados, tentativas e histórico; nunca trata palpite correto como prova visual de execução.
- **Árbitro semântico:** compara texto do palpite com canônico e aliases; nunca analisa a webcam.
- **Baralho (dados):** fornece a carta com `public` e `evaluation`; não é um agente de IA.
- **Adivinhador (externo):** recebe frames e `rejectedGuesses`, nunca dados da carta.

## Histórias de usuário

### US-001 — Carregar a carta com fronteira entre público e avaliação (P1)

Como mantenedor, quero a carta separada em `public` e `evaluation` para que o adivinhador nunca receba a resposta.

**Teste independente:** carregar a carta Acenar e verificar que `public` e `evaluation` são acessíveis separadamente, validados por schema, e que `evaluation` não é exposto ao adivinhador.

**Critérios de aceitação:**

1. **Dado** a carta Acenar, **quando** carregada, **então** `public` e `evaluation` são acessíveis separadamente e validados.
2. **Dado** uma nova carta, **quando** adicionada, **então** o motor funciona sem alteração.

### US-002 — Orquestrar a rodada com limites de tentativas (P1)

Como jogador, quero que a rodada controle tentativas e estados para que o jogo seja justo e previsível.

**Teste independente:** simular uma sequência de tentativas e transições sem câmera real, cobrindo acerto, nova tentativa e erro de provedor.

**Critérios de aceitação:**

1. **Dado** um palpite incorreto, **quando** houver tentativas restantes, **então** a rodada permite nova tentativa sem repetir palpites rejeitados.
2. **Dado** um erro de provedor, **quando** uma tentativa falha, **então** o estado permanece íntegro e nenhum acerto é marcado.
3. **Dado** o limite de tentativas atingido, **quando** a última tentativa falha, **então** a rodada termina sem acerto.

### US-003 — Julgar o palpite sem confirmação manual (P1)

Como mantenedor, quero um árbitro determinístico para validar o palpite por significado, não por substring.

**Teste independente:** julgar palpites conhecidos contra a carta Acenar e verificar o veredito e o método.

**Critérios de aceitação:**

1. **Dado** a carta `acenar` e o palpite `dar tchau`, **quando** julgado, **então** é correto com método `alias`.
2. **Dado** o palpite `levantar a mão`, **quando** julgado, **então** é incorreto (insuficiente).
3. **Dado** `acenar` e `waving`, **quando** julgados, **então** ambos são aceitos.
4. **Dado** um palpite ambíguo e o fallback desligado, **quando** julgado, **então** o resultado é `undetermined`.

### US-004 — Evitar repetir palpites rejeitados (P1)

Como jogador, quero que novas tentativas não repitam palpites já recusados para que o modelo explore outras hipóteses.

**Teste independente:** acumular palpites rejeitados e verificar o conteúdo de `rejectedGuesses` enviado ao adivinhador.

**Critérios de aceitação:**

1. **Dado** um palpite rejeitado, **quando** houver nova tentativa, **então** ele é enviado em `rejectedGuesses` sem qualquer dado da carta.
2. **Dado** o histórico da rodada, **quando** a rodada termina, **então** o histórico é descartado (sem persistência).

## Requisitos funcionais

- **FR-001:** O núcleo DEVE definir `Card = { id, locale, public, evaluation }` versionada no Git, com `public` (palavra, dica, sugestão, dificuldade) e `evaluation` (resposta canônica, aliases, palpites insuficientes, critérios visuais futuros).
- **FR-002:** O núcleo DEVE validar a carta por schema e permitir adicionar cartas sem alterar o motor.
- **FR-003:** O núcleo NÃO DEVE expor `evaluation` ao adivinhador em nenhum caminho de código, com teste automatizado.
- **FR-004:** O motor DEVE implementar a máquina de estados `idle → card_revealed → camera_ready → capturing → guessing → judging → (correct | retry | finished)` com transições explícitas.
- **FR-005:** O motor DEVE impor limites configuráveis de tentativas e de tempo por rodada.
- **FR-006:** O motor DEVE tratar os estados de exceção `camera_denied`, `request_timeout`, `provider_error`, `invalid_model_response` e `user_cancelled` sem marcar acerto indevido. Os estados `request_timeout`, `provider_error` e `invalid_model_response` são recuperáveis: não consomem tentativa e permitem repetir a captura.
- **FR-007:** O árbitro DEVE normalizar o texto (minúsculas, acentos, pontuação, variantes triviais) antes de comparar.
- **FR-008:** O árbitro DEVE comparar o palpite com a resposta canônica e os aliases por equivalência de expressão, sem correspondência por substring, devolvendo `{ isCorrect, method, matchedAnswer? }`.
- **FR-009:** O árbitro DEVE rejeitar palpites insuficientes e devolver `undetermined` quando houver dúvida material.
- **FR-010:** O árbitro DEVE expor uma interface injetável de fallback por LLM, desligada por padrão, que retorna resposta estruturada; falha ou dúvida material resulta em `undetermined`, nunca em acerto inventado.
- **FR-011:** O árbitro DEVE registrar o método do veredito e um motivo resumido, inclusive quando o fallback é usado.
- **FR-012:** O motor DEVE manter em memória o histórico de palpites rejeitados do próprio modelo e enviá-lo como `rejectedGuesses` na entrada do adivinhador, sem qualquer dado da carta.
- **FR-013:** O repositório DEVE documentar a execução (instalação, modos mock e real, testes e privacidade) de modo que um colaborador rode o app em modo mock seguindo apenas o README.

## Requisitos não funcionais

- **NFR-001:** O núcleo DEVE ser TypeScript puro, sem framework e sem I/O (sem rede, disco ou persistência).
- **NFR-002:** O árbitro DEVE ser determinístico e reproduzível quando o fallback estiver desligado.
- **NFR-003:** O histórico de palpites rejeitados NÃO DEVE conter dados da carta nem ser persistido; é descartado ao fim da rodada.
- **NFR-004:** O comportamento do fallback por LLM DEVE falhar de forma segura (preferir `undetermined` a um acerto incorreto).

## Edge cases

- Palpite vazio, só pontuação ou só espaços: tratado como insuficiente/`undetermined`.
- Palpite que contém a resposta como substring de outra palavra: não conta como acerto.
- Limite de tentativas igual a zero ou tempo esgotado: rodada termina sem acerto.
- Erro de provedor em cadeia: estado permanece íntegro e recuperável.
- Fallback ligado mas indisponível: resultado `undetermined`.

## Hipóteses e dependências

- Depende do contrato `GuesserInput`/`GuesserResult` e da fronteira de informação definidos na spec da PoC.
- A execução do fallback por LLM com um provedor real é trabalho futuro; esta spec entrega apenas a interface e a política.
- O motor assume que a captura e o adivinhador são fornecidos por fora do núcleo (sem I/O no `packages/core`).

## Critérios mensuráveis de sucesso

- **SC-001:** A suíte de testes do árbitro cobre os casos `dar tchau` (correto por alias), `levantar a mão` (insuficiente), `acenar`/`waving` (aceitos) e ambíguo com fallback desligado (`undetermined`), toda verde.
- **SC-002:** Um teste automatizado falha se `evaluation` (palavra, dica, sugestão, canônico, aliases ou critérios) cruzar a fronteira do adivinhador ou entrar em `rejectedGuesses`.
- **SC-003:** A máquina de estados cobre, por teste, acerto, nova tentativa sem repetir rejeitados, erro de provedor e fim por limite de tentativas.
- **SC-004:** Um colaborador roda o app em modo mock seguindo apenas o README, sem credencial.

## Substituição

A carta com critério tipado de avaliação, a máquina de estados da rodada e o árbitro foram redefinidos para o fluxo por visão computacional; o árbitro semântico determinístico, o fallback por LLM e o histórico de palpites rejeitados saíram do código. O comportamento vigente está na spec [`2026-10-26-vision-hand-gesture-referee-replace-llm-guesser`](../2026-10-26-vision-hand-gesture-referee-replace-llm-guesser/spec.md); o histórico do Git preserva esta spec como referência.
