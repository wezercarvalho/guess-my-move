# Tarefas — 2026-10-28-frontend-design-system-adopt-dark-gold

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `validated`. CQs resolvidas, plano, tarefas e checklists prontos, Gates 1 e 2 aprovados antecipadamente pelo maintainer; o código foi implementado e a verificação visual registrada em `validation.md`, com o Gate 3 concedido pelo merge do PR (risco aceito), como no PR #73. Todas as tarefas abaixo estão concluídas `[x]`.
- Nota de nomes: no texto original das tarefas a gaveta de depuração aparece como "DebugDrawer"; os nomes reais implementados são `DrawerToggle` + `DrawerPanel` (em `Drawer.tsx`) e o hook `useDrawer` (em `useDrawer.ts`). Os textos abaixo já usam os nomes reais.
- Nota de layout: durante a verificação visual, o campo ficava abaixo da dobra a 1440x900; o contador, o status e "Nova rodada" passaram para a coluna lateral e a largura do campo foi limitada pela altura da janela (100dvh menos 20rem, 4:3). Registrado em `research.md`.

## Fase 1 — Tokens, fontes e teste de tokens (apps/web/src/design)

- [x] T001 [US-003] [FR-001] [NFR-001] Escrever `apps/web/scripts/design-tokens.test.mjs` falhando: exige as variáveis de `tokens.css` (`--ink`, `--surface`, `--surface-raised`, `--paper`, `--paper-text-muted`, `--gold`, `--gold-bright`, `--gold-hover`, `--muted`, `--line`, `--control-border`, `--success`, `--danger`, foco, raio, movimento e famílias); nenhum `url()` com `http`/`https` em `tokens.css`, `fonts.css` e `design.css`; cada `@font-face` apontando para um arquivo existente; e os contrastes calculados pela fórmula oficial da WCAG (texto >= 4,5:1; borda de controle e foco >= 3:1), confirmando a falha esperada
- [x] T002 [US-003] [FR-001] Implementar `apps/web/src/design/tokens.css` com os tokens semânticos (cores, tipografia Space Grotesk/DM Sans com fallback, escala de 4px, tamanhos fluidos com clamp, raio 0, movimento 0.2s e elevação -3px, foco outline 2px `--gold-bright` offset 5px, `--control-border` #77756d), e confirmar a parte de variáveis e contrastes do teste verde
- [x] T003 [US-006] [FR-002] [NFR-004] Versionar `apps/web/src/design/fonts/dm-sans-latin.woff2` (SHA-256 9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543) e `space-grotesk-latin.woff2` (SHA-256 0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d) com o aviso OFL ao lado; ler as licenças OFL 1.1 na fonte e registrar o resultado em `research.md` (H-02); implementar `apps/web/src/design/fonts.css` com `@font-face` (woff2 variável 400 a 700, subset latin, `font-display: swap`) apontando por caminho relativo, e confirmar a parte de `@font-face`/`url()` do teste verde

## Fase 2 — Componentes base com testes (apps/web/src/design)

- [x] T004 [US-004] [FR-004] [FR-007] [NFR-002] [NFR-003] Escrever os testes de componente falhando (Vitest) em `apps/web/src/design/`: `Button` (variantes primary/secondary/text, foco visível, sem elevação em `prefers-reduced-motion`), `Panel`, `Eyebrow`, `Notice`, `Steps` (lista ordenada, etapa atual por `aria-current`), `SegmentedControl` (`fieldset`/`legend`/`radio`s acessíveis por teclado) e a gaveta `DrawerToggle`/`DrawerPanel` com o hook `useDrawer` (recolhida por padrão, conteúdo fora da árvore acessível quando fechada, `aria-expanded`/`aria-controls`, teclado, sem persistência), confirmando a falha esperada
- [x] T005 [US-004] [FR-004] [FR-007] [NFR-002] [NFR-003] Implementar os componentes base e `apps/web/src/design/design.css` usando só os tokens, com `index.ts` exportando a API, e confirmar os testes de componente verdes

## Fase 3 — styles.css e herança do menu e das cartas (apps/web)

- [x] T006 [US-003] [FR-003] Fazer `apps/web/src/styles.css` importar `tokens.css`, `fonts.css` e `design.css` e redirecionar as variáveis antigas (`--cor-fundo`→`--ink`, `--cor-superficie`→`--surface`, `--cor-texto`→`--paper`, `--cor-texto-suave`→`--muted`, `--cor-acento`→`--gold-bright`, `--cor-acento-texto`→`--ink`, `--cor-erro`→`--danger`, `--cor-ativo`→`--success`, `--raio`→0) e o `body` para DM Sans com fallback
- [x] T007 [US-003] [FR-003] [FR-006] Confirmar que o menu inicial (`apps/web/src/home`) e o jogo de cartas (`apps/web/src/round`, `card`, `cards.html`) herdam só paleta e fontes, sem mudança de layout nem de comportamento, com os testes existentes deles verdes

## Fase 4 — Tela das bolinhas e testes (apps/web/src/marbles)

- [x] T008 [US-001] [US-002] [FR-005] Escrever/atualizar os testes falhando em `apps/web/src/marbles` (`MarblesScreen.test.tsx`): cabeçalho com o título; duas colunas em tela larga (campo grande + coluna estreita com câmera pequena, contador, status, guia e ações) e uma coluna em tela média/estreita sem rolagem horizontal; `SegmentedControl` no seletor de modo; botão "Depuração" na barra do campo que abre a gaveta (`DrawerToggle`/`DrawerPanel`) recolhida por padrão; os testes existentes que leem o painel passam a clicar no botão antes; aviso de privacidade como `Notice`; confirmar a falha esperada
- [x] T009 [US-001] [US-002] [FR-005] Implementar a tela refeita em `apps/web/src/marbles` com os componentes base e a `CameraPanel` compacta só por CSS (sem alterar o componente compartilhado com o jogo de cartas), e confirmar os testes verdes
- [x] T010 [US-006] [FR-006] [NFR-004] Confirmar que o comportamento de jogo (bolinhas e cartas) e os testes de lógica seguem verdes sem regressão, e verificar por busca no código que nenhuma requisição (inclusive fontes) vai a domínio de terceiros

## Fase 5 — Verificação visual e documentação

- [x] T011 [US-001] [US-005] [SC-003] [NFR-005] Rodar a inspeção visual em Chromium headless com câmera simulada nas larguras 1440, 900 e 390 (campo grande e câmera pequena em 1440, sem rolagem horizontal em nenhuma largura, depuração recolhida por padrão, sem movimento em `prefers-reduced-motion`) e registrar o resultado como TEXTO em `validation.md`, sem salvar imagens no repositório
- [x] T012 [FR-001] [FR-002] [FR-003] [FR-004] [FR-005] [FR-006] [FR-007] [NFR-006] Atualizar o `README.md` da raiz, o guia de arquitetura `docs/development-context/architecture/architecture-guide.md`, o `docs/product/PROJECT_SPEC.md` e o `specs/README.md` para descrever o design system (tokens, fontes próprias, componentes base) e a tela das bolinhas refeita, declarando as pendências sem medição (licenças OFL, aparência ao vivo), e incluir `apps/web/scripts/design-tokens.test.mjs` no script `test` de `apps/web/package.json`

## Fase 6 — Textos enxutos e sem o nome da referência (CQ-007)

- [x] T015 [US-001] [FR-008] [FR-005] Reescrever os textos das telas: frase de apoio no topo da tela das bolinhas, status de uma linha com a próxima ação, guia "Como jogar" com as etapas de cada modo (`guideSteps.ts`, `ShotGuide.tsx`) e dicas curtas, aviso de privacidade único (`PrivacyNotice`) no menu, nas cartas e nas bolinhas, cartões do menu com uma frase; remover o nome da referência de design da tela, do código e dos documentos (inclusive o nome desta pasta); atualizar os testes (`guideSteps.test.tsx`, `MarblesScreen.test.tsx`, `HomePage.test.tsx`, `GestureScreen.test.tsx`)

## Fase final — Convergência

- [x] T013 [SC-001] [SC-002] [SC-004] [SC-005] [SC-006] [NFR-007] Executar `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` e, com o código implementado, também `yarn check:all`, `yarn test:gates` e `yarn security:dependencies`, e registrar `validation.md` (estado, evidência por requisito)
- [x] T014 [SC-003] [NFR-006] Fechar o Gate 3 sem o teste do maintainer no Chrome desktop antes do merge: o maintainer pediu para considerar os gates aprovados e conferir o PR, então o Gate 3 foi registrado como "aprovado com risco aceito pelo merge do PR" (como no PR #73), com o texto honesto de que a aparência ao vivo no desktop dele NÃO foi verificada antes do merge; veredito, escopo aprovado, riscos aceitos (aparência ao vivo; licenças OFL já lidas na fonte, ver `research.md`) e observações em `validation.md`

## Cobertura

| Requisito | Tarefas          | Evidência esperada                                    |
| --------- | ---------------- | ----------------------------------------------------- |
| FR-001    | T001, T002, T012 | `design-tokens.test.mjs`                              |
| FR-002    | T003, T012       | `design-tokens.test.mjs`                              |
| FR-003    | T006, T007, T012 | testes existentes de menu e cartas; teste visual      |
| FR-004    | T004, T005, T012 | testes de componente (Vitest)                         |
| FR-005    | T008, T009, T012 | `MarblesScreen.test.tsx`; teste visual nas 3 larguras |
| FR-006    | T007, T010, T012 | testes de lógica e de componente verdes               |
| FR-007    | T004, T005, T012 | testes de componente; teste de tokens (foco >= 3:1)   |
| FR-008    | T015             | `guideSteps.test.tsx`; testes de tela                 |

Somente referências presentes nas linhas formais de tarefa contam como cobertura.

## Dependências e paralelismo

- A Fase 1 (tokens e fontes) antes da Fase 2 (componentes, que usam os tokens) e da Fase 3 (styles).
- T002 antes de T006 (o redirecionamento usa os tokens); T003 pode andar em paralelo com T002.
- A Fase 2 e a Fase 3 antes da Fase 4 (a tela usa os componentes e a herança).
- T007 depende de T006; T010 depende de T009.
- A Fase 5 (verificação visual e documentação) depois da Fase 4; T013 e T014 fecham a entrega, com o Gate 3 após o teste do maintainer.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação antecipada do maintainer wezercarvalho
- **Data:** `2026-10-28`
- **Lacunas:** nenhuma. Todos os oito FR têm tarefa formal (FR-001 em T001/T002, FR-002 em T003, FR-003 em T006/T007, FR-004 em T004/T005, FR-005 em T008/T009/T015, FR-008 em T015, FR-006 em T007/T010, FR-007 em T004/T005). SC-001 e SC-002 são cobertos pelo teste de tokens (T001) e pelos testes de componente (T004/T005); SC-003 pela verificação visual (T011); SC-004 pelos testes de lógica verdes (T010); SC-005 pelos gates (T013); SC-006 pela tabela de contrastes e pelo mapa de variáveis em `research.md`. NFR-001 pela medição de contraste no teste de tokens, NFR-002/NFR-003 pelos testes de componente (reduced-motion, teclado, `aria`), NFR-004 pela ausência de `url()` http/https e pela busca no código, NFR-005 pela verificação visual registrada como texto, NFR-006 pelas pendências declaradas e NFR-007 pelos comandos finais. As tarefas de código ficam `[ ]` porque o maintainer implementa; esta entrega documental fecha os Gates 1 e 2 e deixa o Gate 3 para depois do código e do teste visual.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-28`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem do maintainer na sessão do dashboard em 2026-10-28 ("pode considerar os gates aprovados"), aprovando antecipadamente os Gates 1 e 2 e aceitando as recomendações de CQ-001 a CQ-006; issue 74 do repositório (ver `spec.md`).
- **Exceções:** nenhuma. Aprovação antecipada no chat. O Gate 3 segue dependente do teste do maintainer no Chrome desktop e da leitura das licenças OFL (H-02), registrados em `validation.md` ao fim.
