# Plano — 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback

## Resumo técnico

Duas mudanças independentes na camada web do Arranha-Teia, sem tocar a física: (1) um layout em que a tela do jogo preenche a janela e só rola onde precisa; (2) uma camada de mensagens sobre o palco, derivada por funções puras do snapshot do controlador e desenhada por um componente pequeno.

## Contexto técnico

- **Runtime/versões:** Node >=26.12.1 <27; TypeScript 7.0.2; React 19.3.1; Vite 8.3.4.
- **Dependências:** nenhuma nova.
- **Provedores externos:** nenhum.
- **Persistência:** nenhuma.
- **Testes:** Vitest e React Testing Library; Chromium para medir o layout; scripts oficiais do `package.json`.
- **Restrições:** não mudar física, gestos, cidades nem a tela das bolinhas (que também usa `app-wide`).

## Constitution Check — pré-design

| Princípio/gate                      | Resultado | Evidência ou exceção                                                       |
| ----------------------------------- | --------- | -------------------------------------------------------------------------- |
| I. Intenção antes da implementação  | PASS      | Spec e clarificação escritas antes do código; maintainer aprovou os gates. |
| II. Uma fonte vigente               | PASS      | Esta spec governa; as specs relacionadas não são alteradas.                |
| III. Rastreabilidade                | PASS      | FR-001 a FR-008 mapeados abaixo e nas tarefas.                             |
| IV. Test-first                      | PASS      | Funções puras e componente começam por teste falhando.                     |
| V. Evidência honesta                | PASS      | Layout medido só nos tamanhos testados; sem afirmar fps.                   |
| VI. Privacidade e segredos          | PASS      | Nenhum dado novo; câmera intocada.                                         |
| VIII. Preservação e operação segura | PASS      | Mudança restrita ao Arranha-Teia; branch nova a partir da `main`.          |
| Gate 1 e Gate 2                     | PASS      | Aprovação do maintainer registrada em `clarification.md` e `tasks.md`.     |

## Pesquisa e decisões

Ver `research.md`. Decisão: layout por CSS (classe `swing-page` no `body`, contêiner `app-fill`), feedback por função pura mais componente.

## Estrutura afetada

- `apps/web/src/swing/feedback.ts` (novo): `deriveChips`, `feedbackEvents`.
- `apps/web/src/swing/SwingFeedback.tsx` (novo): desenha chips e avisos.
- `apps/web/src/swing/SwingScreen.tsx`: nova estrutura (cabeçalho compacto, palco, coluna lateral com seções, gaveta).
- `apps/web/src/swing/swing.css`, `apps/web/src/styles.css`, `apps/web/swing.html`, `apps/web/src/swing/SwingApp.tsx`: layout.
- Testes: `feedback.test.ts`, `SwingFeedback.test.tsx`, ajustes em `SwingScreen.test.tsx`.

## Design

### Componentes e responsabilidades

- **`deriveChips(input)`**: devolve a lista de chips `{ id, text, tone, progress? }` do estado atual; vazia fora de `playing`.
- **`feedbackEvents(prev, next)`**: devolve os textos dos avisos pela mudança entre dois estados.
- **`SwingFeedback`**: guarda o estado anterior, gera avisos, controla o tempo (1,6 s, até três) e desenha chips e avisos num contêiner `aria-live`.
- **`SwingScreen`**: monta a entrada de `FeedbackInput` a partir do snapshot e coloca `SwingFeedback` dentro do palco.

### Contratos e dados

`FeedbackInput`: `phase`, `cameraActive`, `lookMode`, `faceTrackerStatus`, `faceVisible`, `lockMode`, `gripped`, `headClimb`, `cue`, `webSides`. Tudo já existe no snapshot.

### Layout

- `swing.html`: `<body class="swing-page">`. `swing-page` limita `body` a `100dvh` em coluna; `#root` ocupa o restante com `min-height: 0`.
- A partir de 960 × 560 px: `.app-fill` com `height: 100%`; grade de duas colunas (palco `1fr`, lateral `19rem`); o palco com `flex: 1`; lateral com `overflow-y: auto`.
- Abaixo disso: coluna única e `#root` com rolagem.
- Gaveta: `position: fixed`, canto superior direito, rolagem própria.

## Mapeamento de requisitos

| Requisito | Componente           | Teste/evidência                                           |
| --------- | -------------------- | --------------------------------------------------------- |
| FR-001    | CSS e `swing.html`   | medição em Chromium (1440×900, 1280×720); teste da classe |
| FR-002    | CSS                  | medição em 390×844                                        |
| FR-003    | `SwingScreen`, CSS   | `SwingScreen.test.tsx`; medição com a gaveta aberta       |
| FR-004    | `feedback.ts`        | `feedback.test.ts`                                        |
| FR-005    | `feedback.ts`        | `feedback.test.ts`                                        |
| FR-006    | `SwingFeedback`, CSS | `SwingFeedback.test.tsx`; captura no Chromium             |
| FR-007    | `SwingScreen`        | `SwingScreen.test.tsx`                                    |
| FR-008    | suíte completa       | `check:all` verde                                         |

## Estratégia test-first

1. Escrever os testes de `deriveChips` e `feedbackEvents`; ver falhar; implementar.
2. Escrever os testes de `SwingFeedback` (fake timers); ver falhar; implementar.
3. Ajustar `SwingScreen.test.tsx` para a nova estrutura; ver falhar; reestruturar a tela e o CSS.
4. Medir no Chromium e ajustar o CSS.

## Riscos, rollout e rollback

| Risco                                        | Mitigação                                              | Rollback/contingência       |
| -------------------------------------------- | ------------------------------------------------------ | --------------------------- |
| `body` fixo em altura afeta outras telas     | Classe só em `swing.html`; teste de regressão          | Remover a classe do `body`. |
| Coluna lateral longa em janela baixa         | Rolagem própria da coluna e limiar de altura           | Subir o limiar de altura.   |
| Avisos poluem a visão                        | Base do palco, no máximo três, 1,6 s, sem estado duplo | Reduzir tipos de aviso.     |
| Renderizador com proporção diferente de 16:9 | A câmera já usa o aspecto da tela; verificar visual    | Limitar a razão do palco.   |

## Constitution Check — pós-design

| Princípio/gate                         | Resultado | Evidência ou exceção                                             |
| -------------------------------------- | --------- | ---------------------------------------------------------------- |
| Intenção, rastreabilidade e test-first | PASS      | Plano e tarefas cobrem FR-001 a FR-008; testes antecedem código. |
| Privacidade, segredos e informação     | PASS      | Sem dado novo, serviço ou alteração na carta/câmera.             |
| Preservação e reversibilidade          | PASS      | Commits de lógica, componente e layout separáveis.               |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
