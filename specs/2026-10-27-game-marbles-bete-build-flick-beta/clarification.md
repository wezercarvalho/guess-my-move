# Clarificação — 2026-10-27-game-marbles-bete-build-flick-beta

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-27`

As decisões CQ-001 a CQ-007 refletem as definições do maintainer para o modo de tiro por estalo (alpha) do bete, registradas na sessão do dashboard em 2026-10-27, com os Gates 1 e 2 aprovados de forma antecipada (antes da redação dos documentos). CQ-008 e CQ-009 são decisões técnicas do agente, derivadas da composição com o modo pinça, e revisáveis. Esta spec estende a `2026-10-27-game-marbles-bete-build-pinch-shot` e não a substitui: o modo pinça continua o padrão e não muda.

## Log de decisões

### CQ-001 — Segundo modo e seleção na tela

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** O estalo substitui a pinça ou convive com ela?
- **Decisão:** Convive. O bete solo passa a ter dois modos de tiro, escolhidos por um seletor na tela: Pinça (padrão, já entregue, não muda) e Estalo (alpha). Trocar de modo reinicia a rodada. O modo inicial pode vir de `?mode=estalo`.
- **Razão:** O modo pinça funciona e serve de referência; o estalo é experimental e precisa ser comparado lado a lado sem perder o que já existe.
- **Alternativas rejeitadas:** Substituir a pinça pelo estalo (perde o modo robusto e fecharia a issue #68 sem medição); dois jogos separados (duplica física e tela).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, US-002, FR-005.

### CQ-002 — O que é o estalo para a câmera

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como o estalo real é visto pelo rastreador de mão?
- **Decisão:** O estalo real (bolinha no indicador dobrado, polegar preso atrás disparando) é, para a câmera, uma pinça (polegar contra o indicador) que ABRE RÁPIDO. Armar é fechar a pinça; disparar é abrir num estalo rápido.
- **Razão:** O rastreador já lê bem o fechamento e a abertura da pinça; o estalo é a mesma geometria com uma abertura veloz, o que permite compor o detector de pinça existente.
- **Alternativas rejeitadas:** Modelar o dedo médio/indicador isoladamente (frágil no rastreador); detectar o estalo por um gesto novo do zero (sem base medida).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, FR-001, FR-002.

### CQ-003 — Armar, direção e disparo

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como o modo estalo arma, mira e dispara?
- **Decisão:** Arma ao fechar (razão <= 0,35, depois de vista aberta) e mostra a seta de direção a partir da bolinha de tiro. A direção é a orientação da mão no plano da imagem (vetor pulso→base do médio, x corrigido pela proporção e espelhado, normalizado), medida no INÍCIO da abertura. Dispara ao abrir (razão >= 0,55): início da subida = última amostra com razão <= 0,40; duração = do início da subida até cruzar 0,55; velocidade de abertura = pico da inclinação da razão por segundo.
- **Razão:** Medir a direção no início da abertura evita que o próprio estalo perturbe a leitura; o pico da inclinação capta a rapidez mesmo com poucas amostras.
- **Alternativas rejeitadas:** Direção pela trajetória da mão (perturbada pelo estalo); velocidade média em vez de pico (subestima estalos curtos).
- **Seções atualizadas em `spec.md`:** Resumo, US-001, FR-001, FR-002, FR-004.

### CQ-004 — Rápido vs. lento e força

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Quando o estalo conta como tiro e com que força?
- **Decisão:** É "rápido" quando duração <= 300 ms e velocidade de abertura >= 2 razão/s; senão é "lento" e o tiro é CANCELADO (sem contar tiro). A força é interpolação linear de 300 a 1100 unid/s quando a velocidade de abertura vai de 2 a 8 razão/s (limitada nos extremos). Um estalo rápido mas fraco também não dispara.
- **Razão:** Separar o estalo de uma abertura comum da mão e dar ao jogador controle de força pela rapidez; os limites são placeholders a calibrar.
- **Alternativas rejeitadas:** Disparar em qualquer abertura (falso disparo ao relaxar a mão); força fixa (perde o controle do tiro).
- **Seções atualizadas em `spec.md`:** US-001, FR-003, Edge cases, H-01.

### CQ-005 — Perda da mão

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** O que acontece quando a mão some no estalo?
- **Decisão:** Perder a mão por mais de 300 ms enquanto armado cancela o tiro; qualquer perda zera o estado armado do detector, de modo que voltar a abrir não dispara.
- **Razão:** O estalo é rápido e o detector tende a perder a mão por borrão; zerar o armado evita que uma reaquisição seja lida como disparo.
- **Alternativas rejeitadas:** Manter o armado através da perda (gera disparo espúrio na reaquisição).
- **Seções atualizadas em `spec.md`:** US-001, FR-001, FR-004, Edge cases, H-03.

### CQ-006 — Rótulo alpha e números do detector

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Como tratar a viabilidade desconhecida do estalo (issue #68)?
- **Decisão:** O modo é rotulado ALPHA e o painel de depuração do estalo mostra armado (sim/não), razão, velocidade de abertura do último estalo (razão/s), duração da subida (ms) e o resultado do último estalo (disparado, lento demais, fraco demais ou nenhum). Nenhum texto afirma desempenho ou viabilidade sem medição; a decisão da issue #68 é do maintainer após o teste manual.
- **Razão:** O estalo dura poucos quadros e sua detecção não foi medida; expor os números é o que permite ao maintainer decidir com honestidade de evidência.
- **Alternativas rejeitadas:** Entregar o estalo como modo estável (afirma viabilidade não medida); esconder os números (sem base para decidir).
- **Seções atualizadas em `spec.md`:** Resumo, US-003, FR-007, NFR-002, SC-002, SC-003.

### CQ-007 — Seletor, mensagens e parâmetro de URL

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Como o jogador escolhe e entende o modo?
- **Decisão:** Dois botões de rádio "Pinça" e "Estalo (alpha)" num `fieldset` com legenda "Modo de tiro"; mensagens de orientação em pt-BR por modo e por estado; o modo inicial vem de `?mode=estalo` (qualquer outro valor = pinça). A seta de direção aparece no campo enquanto armado no modo estalo.
- **Razão:** Um `fieldset` com legenda e rótulos atende a acessibilidade; o parâmetro de URL facilita o teste direto do estalo.
- **Alternativas rejeitadas:** Menu suspenso sem legenda (menos acessível); alternância por tecla (pouco descoberta).
- **Seções atualizadas em `spec.md`:** US-002, FR-005, FR-006, NFR-003.

### CQ-008 — Arquitetura da lógica do estalo

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Onde fica a lógica nova do estalo?
- **Decisão:** No pacote puro `packages/marbles`, em um módulo novo `flick.ts` com `handDirection`, `createFlickDetector` (compõe `createPinchDetector`, guarda histórico de 400 ms e emite `FlickReading`), `flickShot` e `DEFAULT_FLICK`; `round.ts` ganha `observeFlick` e `snapshot().flick`, e `fire` passa a receber a velocidade. O modo pinça e seus testes não mudam.
- **Razão:** Compor o detector de pinça existente reaproveita a histerese e a razão sem duplicá-las e mantém a lógica pura e testável em Node.
- **Alternativas rejeitadas:** Reescrever um detector independente (duplica a razão e a histerese); colocar a lógica no app web (perde o teste puro).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, FR-001, FR-003, FR-004, NFR-001.

### CQ-009 — Roteamento por modo no controlador e na tela

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como o app web alterna entre os detectores sem mexer no modo pinça?
- **Decisão:** O `MarblesController` ganha `mode` e `setMode(mode)` (a troca reinicia a rodada e os detectores) e roteia cada quadro para o detector do modo; o snapshot ganha `mode` e o debug do estalo; `fieldView.drawField` desenha a seta de direção; `MarblesScreen` ganha o seletor e as mensagens; o painel mostra as linhas do estalo.
- **Razão:** Centralizar o roteamento no controlador mantém a tela simples e preserva o caminho do modo pinça intacto.
- **Alternativas rejeitadas:** Dois controladores separados (duplica o laço de quadros); condicional espalhada pela tela (frágil e difícil de testar).
- **Seções atualizadas em `spec.md`:** FR-005, FR-006, FR-007, FR-009.

## Hipóteses remanescentes

- Todos os números do estalo são placeholders até a calibração com uso real (H-01); mitigado pelo painel de depuração e pelo teste do maintainer.
- A direção pela orientação da mão pode ficar degenerada com a mão apontada para a câmera (H-02); validada no teste do maintainer.
- O estalo dura poucos quadros e o detector pode perder a mão por borrão (H-03); e a webcam pode dar poucas amostras por estalo (H-04); ambos registrados como lacuna até a medição.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 e issue 68 do repositório.
- **Observações:** Aprovação antecipada no chat, antes da redação. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
