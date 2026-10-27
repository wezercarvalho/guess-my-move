# Clarificação — 2026-10-27-game-marbles-bete-build-pinch-shot

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-27`

As decisões CQ-001 a CQ-006 refletem as definições do maintainer para o bete solo com tiro por pinça, registradas na sessão do dashboard em 2026-10-27, com os Gates 1 e 2 aprovados de forma antecipada (antes da redação dos documentos). CQ-007 e CQ-008 são decisões técnicas do agente, derivadas do reaproveitamento da spec do árbitro por visão e revisáveis.

## Log de decisões

### CQ-001 — Mecânica e escopo do jogo

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** Qual mecânica e qual recorte entram na primeira entrega do bete?
- **Decisão:** Bete solo, uma bolinha de tiro e um alvo parado, tiros ilimitados; a rodada termina no primeiro contato e mostra o número de tiros; o erro volta tudo ao início.
- **Razão:** Mecânica mínima, jogável e testável sem câmera na parte de física e tiro.
- **Alternativas rejeitadas:** Triângulo, cova e multijogador (complexidade sem necessidade agora); pontuação além do contador de tiros.
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, Fora de escopo, US-001, US-002, FR-002, FR-005.

### CQ-002 — Gesto de tiro

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como o jogador dispara a bolinha?
- **Decisão:** Pinça (polegar e indicador) como estilingue: fechar perto da bolinha, arrastar para trás e abrir para disparar; o estalo real fica para a issue #68.
- **Razão:** A pinça é robusta no rastreador de mão e mapeia bem para o estilingue; o estalo exige detecção de gesto mais fina.
- **Alternativas rejeitadas:** Estalo do dedo na primeira entrega (issue #68, fora de escopo); apontar e clicar (perde o caráter de gesto).
- **Seções atualizadas em `spec.md`:** Resumo, Fora de escopo, US-001, FR-003, FR-004.

### CQ-003 — Parâmetros do campo e do tiro

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Quais valores de campo, bolinhas e tiro valem como ponto de partida?
- **Decisão:** Campo 800 x 600, raio 14, tiro em (150, 300), alvo em (550, 300); pega a até 70 unidades, velocidade 5x o arrasto, limite de arrasto 220, cancelamento abaixo de 30, perda da mão acima de 300 ms. Todos placeholders de calibração.
- **Razão:** Proporção 4:3 compatível com a webcam; valores iniciais suficientes para jogar e calibrar.
- **Alternativas rejeitadas:** Fixar valores como definitivos sem medição (contraria a Constituição V).
- **Seções atualizadas em `spec.md`:** Resumo, FR-001, FR-004, FR-005, H-01.

### CQ-004 — Física

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Qual modelo de física?
- **Decisão:** Arcade determinística com passo fixo de 1/120 s: círculos, atrito constante 700, parada abaixo de 8, restituição 0,8 nas paredes e 1,0 elástica entre bolinhas de massas iguais.
- **Razão:** Determinismo permite teste automático sem câmera; arcade basta para a mecânica.
- **Alternativas rejeitadas:** Física contínua não determinística (difícil de testar); 3D (fora de escopo).
- **Seções atualizadas em `spec.md`:** FR-001, FR-002, Edge cases.

### CQ-005 — Alvo e privacidade

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Qual navegador e qual regra de privacidade?
- **Decisão:** Chrome desktop, uma mão; privacidade igual à spec do árbitro por visão: nenhum quadro sai do navegador, é gravado ou registrado.
- **Razão:** Reduz a matriz de teste e mantém a regra de privacidade do projeto.
- **Alternativas rejeitadas:** Celular e outros navegadores na primeira entrega.
- **Seções atualizadas em `spec.md`:** Fora de escopo, US-004, FR-009.

### CQ-006 — Depuração

- **Data:** `2026-10-27`
- **Impacto:** baixo
- **Pergunta:** O que o painel de depuração mostra?
- **Decisão:** Como no jogo de cartas: delegate, estado, razão da pinça, pinça fechada, mão visível, quadros processados, latências mediana e p95.
- **Razão:** O ajuste dos limiares da pinça depende de ver o que o detector lê.
- **Alternativas rejeitadas:** Só o veredito do jogo (sem como calibrar).
- **Seções atualizadas em `spec.md`:** US-003, FR-008.

### CQ-007 — Arquitetura da página

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** App novo ou página extra no app atual?
- **Decisão:** Página extra no mesmo app (segunda entrada do Vite, `marbles.html`), reaproveitando câmera e rastreador sem extrair um pacote compartilhado nem mexer no jogo de cartas.
- **Razão:** Reaproveita a infraestrutura existente com o menor acoplamento; o jogo de cartas permanece isolado.
- **Alternativas rejeitadas:** App novo (duplica câmera e rastreador); extrair pacote compartilhado agora (complexidade antecipada).
- **Seções atualizadas em `spec.md`:** Resumo, FR-007, FR-010.

### CQ-008 — Pacote da lógica

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Onde fica a lógica pura do bete?
- **Decisão:** Pacote novo `packages/marbles` (`@guess-my-move/marbles`), puro, sem DOM, sem MediaPipe e sem depender de `@guess-my-move/core`, com tipos de ponto próprios e estruturais `{x, y}` compatíveis com os landmarks.
- **Razão:** Mantém a física, a pinça, o tiro e a rodada testáveis em Node e independentes do núcleo do jogo de cartas.
- **Alternativas rejeitadas:** Colocar a lógica em `@guess-my-move/core` (acopla ao jogo de cartas); misturar no app web (perde o teste puro).
- **Seções atualizadas em `spec.md`:** FR-010, NFR-001.

## Hipóteses remanescentes

- Limiares da pinça, raio de pega, ganho e limites são placeholders até a calibração com uso real (H-01); mitigado pelo painel de depuração e pelo teste do maintainer.
- O mapeamento do quadro inteiro ao campo pode exigir ajuste de sensibilidade (H-02); validado no teste do maintainer.
- A perda da mão em movimento rápido pode cancelar tiros legítimos (H-03); mitigado pelo arrasto lento por desenho.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 e issue 67 do repositório.
- **Observações:** Aprovação antecipada dos Gates 1 e 2, dada no chat antes da redação dos documentos. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
