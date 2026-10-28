# Validação — 2026-10-28-frontend-design-system-adopt-dark-gold

## Estado

- **Spec:** `spec.md`
- **Status:** aprovado com risco aceito
- **Constituição:** 1.0.0
- **Data:** `2026-10-28`
- **Executor/revisor:** kirocrew (agente); aprovação do maintainer wezercarvalho pelo merge do PR da issue #74
- **Commit:** merge do PR da issue #74 na `main`

## Resumo do resultado

A entrega adota um design system pequeno (tokens CSS e componentes base React) com a identidade escura com dourado do site de referência do maintainer e refaz a tela das bolinhas. Os tokens vivem em `apps/web/src/design/tokens.css` (cores, tipografia Space Grotesk/DM Sans com fallback, escala de 4px, tamanhos fluidos com `clamp`, raio 0, movimento 0.2s, elevação -3px, foco outline 2px `--gold-bright` offset 5px, borda de controle `--control-border` #77756d); as fontes próprias (`dm-sans-latin.woff2`, `space-grotesk-latin.woff2`) são servidas pelo app por `@font-face` com `font-display: swap` e caminho relativo, com os avisos `OFL-DM-Sans.txt` e `OFL-Space-Grotesk.txt` ao lado. Os componentes base são `Button` (primary/secondary/text), `Panel`, `Eyebrow`, `Notice`, `Steps`, `SegmentedControl` e a gaveta `DrawerToggle` + `DrawerPanel` com o hook `useDrawer`, exportados por `index.ts`. O `apps/web/src/styles.css` importa os três CSS do design e redireciona as variáveis antigas `--cor-*` e `--raio` para os tokens, de modo que o menu inicial e o jogo de cartas herdam paleta e fontes sem mudar de layout nem de comportamento. A tela das bolinhas foi refeita com campo grande à esquerda (largura limitada pela altura da janela, 4:3), coluna lateral estreita com câmera pequena, contador, status, aviso de privacidade como `Notice` e o guia de etapas pelo `Steps`, o seletor de modo como `SegmentedControl` e a depuração recolhida por padrão, aberta pelo botão "Depuração" na barra do campo.

As licenças OFL 1.1 das duas fontes foram lidas na fonte e permitem versionar e redistribuir os binários pelo app com o aviso ao lado (H-02 fechada). O token de borda de controle foi fixado e medido (H-04 fechada). A verificação visual foi feita em Chromium headless com câmera simulada nas larguras 1440, 900 e 390 e registrada como texto em `research.md`. Os gates automatizados passam. **A aparência ao vivo no Chrome desktop do maintainer NÃO foi verificada antes do merge:** o maintainer pediu para considerar os gates aprovados e conferir o PR, e o Gate 3 foi concedido pelo merge, com o risco aceito, como no PR #73.

## Conclusão das tarefas

- **Concluídas:** 15 (T001 a T015)
- **Pendentes:** 0 (T014 fechada pelo Gate 3 concedido no merge, sem teste manual ao vivo)
- **Evidência:** `tasks.md`

## Evidências por requisito

| Requisito | Tarefas          | Evidência                                                                                                                                                                                                                                                                                  | Resultado |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T001, T002, T012 | `apps/web/scripts/design-tokens.test.mjs` (13 asserções): variáveis semânticas exigidas presentes em `tokens.css`, raio 0, foco e movimento, e contrastes recalculados pela fórmula da WCAG (texto 4,5:1; borda e foco 3:1)                                                                | PASS      |
| FR-002    | T003, T012       | `design-tokens.test.mjs`: cada `@font-face` aponta para arquivo existente e nenhum `url()` tem `http`/`https`; os woff2 e os avisos OFL versionados em `apps/web/src/design/fonts/`; SHA-256 conferidos em `research.md`                                                                   | PASS      |
| FR-003    | T006, T007, T012 | testes existentes de `home` e do jogo de cartas (`round`/`card`) verdes em `yarn check:all`; `styles.css` importa os tokens e redireciona `--cor-*` e `--raio`; verificação visual: menu e cartas herdam paleta e fontes                                                                   | PASS      |
| FR-004    | T004, T005, T012 | 18 testes de componente em `apps/web/src/design` (`Button`, `Panel`, `Eyebrow`, `Notice`, `Steps`, `SegmentedControl`, gaveta `DrawerToggle`/`DrawerPanel`/`useDrawer`): variantes, foco, reduced-motion, teclado e `aria`                                                                 | PASS      |
| FR-005    | T008, T009, T012 | `MarblesScreen.test.tsx`: cabeçalho sem marca, duas colunas em tela larga e uma em tela estreita sem rolagem, `SegmentedControl` no modo, botão "Depuração" abre a gaveta recolhida; verificação visual nas larguras 1440, 900, 390                                                        | PASS      |
| FR-006    | T007, T010, T012 | testes de lógica das bolinhas (`packages/marbles`) e do jogo de cartas (`packages/core`) verdes sem regressão em `yarn check:all`; busca no código sem requisição a terceiros                                                                                                              | PASS      |
| FR-007    | T004, T005, T012 | testes de componente: foco visível pelo token em cada controle, ordem previsível, `SegmentedControl` por teclado e gaveta com `aria-expanded`/`aria-controls`; o teste de tokens exige foco e borda de controle 3:1                                                                        | PASS      |
| FR-008    | T015             | `guideSteps.test.tsx` e testes de tela: frase de apoio, status de uma linha com a próxima ação, guia "Como jogar" nos dois modos com a etapa atual por `aria-current`, dicas curtas, aviso de privacidade com a mesma redação nas três telas e nenhum nome da referência de design na tela | PASS      |

## Histórias e critérios de aceitação

| História/cenário                       | Demonstração                                                                                   | Resultado |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| US-001 / campo grande e câmera pequena | `MarblesScreen.test.tsx` e verificação visual em 1440/900/390 sem rolagem horizontal           | PASS      |
| US-002 / depuração por botão           | `Drawer.test.tsx` e `MarblesScreen.test.tsx` (recolhida por padrão; abre e recolhe pelo botão) | PASS      |
| US-003 / identidade em todo o app      | `design-tokens.test.mjs`, testes de menu/cartas e verificação visual                           | PASS      |
| US-004 / foco visível por teclado      | `Button.test.tsx`, `SegmentedControl.test.tsx`, `Drawer.test.tsx`                              | PASS      |
| US-005 / movimento reduzido            | `basics.test.tsx`/`Button.test.tsx` (sem elevação em `prefers-reduced-motion`)                 | PASS      |
| US-006 / nada a terceiros              | `design-tokens.test.mjs` (sem `http`/`https` em `url()`) e inspeção de rede no Chromium        | PASS      |

O critério que depende da aparência ao vivo no desktop do maintainer (SC-003 na janela real dele) fica no risco aceito do Gate 3.

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                 |
| ---------------------------- | ---------- | --------- | -------------------------------------------------------------------- |
| `yarn docs:format:check`     | 2026-10-28 | PASS      | todos os documentos no estilo do Prettier                            |
| `yarn sdd:check`             | 2026-10-28 | PASS      | catálogo, estados, gates, cobertura e links válidos                  |
| `yarn test:sdd`              | 2026-10-28 | PASS      | verificação estrutural somente leitura                               |
| `yarn check:all`             | 2026-10-28 | PASS      | typecheck, lint, testes (core 68, marbles 111, web 163 + 24 no node) |
| `yarn test:gates`            | 2026-10-28 | PASS      | 231 testes                                                           |
| `yarn security:dependencies` | 2026-10-28 | PASS      | nenhuma vulnerabilidade em nenhum nível                              |

## Medições e evidência visual (registradas como texto)

- **Contrastes (WCAG):** a tabela de `research.md` é recalculada pelo `design-tokens.test.mjs`, que exige 4,5:1 para texto e 3:1 para borda de controle e foco, e passa. O dourado #c99400 sobre papel (2,47:1) é proibido como texto; a borda de controle #77756d fica em 4,31/4,06/3,77 sobre tinta/superfície/superfície elevada.
- **Verificação visual (Chromium headless, câmera simulada, build de produção por `http.server` em `127.0.0.1`; sem mão real):** 1440x900 sem rolagem horizontal (`scrollWidth` 1425, `clientWidth` 1425), campo 773x580 inteiro na janela (topo y=287), câmera lateral 280 de largura, depuração recolhida (`aria-expanded` false) abrindo com 15 linhas; 900x900 sem rolagem (885), câmera abaixo do campo com 288; 390x844 sem rolagem (390), campo 292x219. `document.fonts.check` verdadeiro para "DM Sans" e "Space Grotesk"; fundo do body `rgb(9, 9, 9)`.
- **Rede:** 45 requisições na tela das bolinhas, todas GET para a própria origem (`127.0.0.1`), fontes de `/assets/*.woff2`; 28 no menu e 41 no jogo de cartas, todas GET para a própria origem.
- **Licenças OFL 1.1:** lidas na fonte (arquivos `OFL.txt` do repositório `google/fonts`): DM Sans "Copyright 2014 The DM Sans Project Authors"; Space Grotesk "Copyright 2020 The Space Grotesk Project Authors"; a cláusula de permissão autoriza versionar, embarcar e redistribuir com o aviso ao lado (feito).
- **Não medido:** aparência com câmera e mão reais no desktop do maintainer; leitores de tela reais; Firefox e Safari (o `:has()` do controle segmentado exige navegador recente; só o Chromium foi exercitado); contraste do texto sobre o campo marrom do canvas e do canvas em si (fora dos tokens); comparação byte a byte dos woff2 do site com os do repositório `google/fonts`.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passa; `specs/README.md` lista esta spec como `validated`.
- **Cobertura:** os oito FR têm tarefa formal e uma linha de evidência PASS própria (matriz acima); `sdd:check` valida cobertura e links.
- **Privacidade e fronteira:** nenhum `url()` com `http`/`https` nos CSS do design; fontes servidas pela própria origem; a entrega muda apresentação e layout, não regras de jogo; `apps/` e `packages/` de código não foram alterados nesta entrega documental.
- **UTF-8 e acentuação:** conferidos.
- **Nomes dos componentes:** o texto original falava em "DebugDrawer"; os nomes reais (`DrawerToggle`, `DrawerPanel`, `useDrawer`) foram corrigidos em `tasks.md` e em `spec.md` (FR-004).

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                                                                          |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antecipadamente; clarificação (CQ-001 a CQ-006) e plano registrados antes do código.                            |
| II. Uma fonte vigente                       | PASS      | Esta spec é a fonte vigente desta entrega; catálogo atualizado para `validated`.                                                      |
| III. Rastreabilidade                        | PASS      | Matriz cobre os oito FR; `sdd:check` valida cobertura e links.                                                                        |
| IV. Test-first e incremental                | PASS      | Teste de tokens e testes de componente escritos falhando antes da implementação (T001, T004); 18 de componente e 13 em Node.          |
| V. Evidência honesta                        | PASS      | Nada afirma acessibilidade comprovada, desempenho ou aparência final; a falta de teste ao vivo e os itens não medidos são declarados. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para terceiros; fontes servidas pelo app; sem persistência nem chave; licenças OFL lidas antes de versionar.                 |
| VII. Neutralidade e contexto sob demanda    | PASS      | README, guia de arquitetura e PROJECT_SPEC atualizados; nenhum outro projeto do maintainer citado além do site da referência.         |
| VIII. Clareza, preservação, operação segura | PASS      | Menu e jogo de cartas preservados (só herdam paleta e fontes); comportamento de jogo inalterado; sem push direto na `main`.           |

## Convergência

- **Divergências encontradas:** a primeira versão da tela deixava o campo abaixo da dobra a 1440x900; na verificação visual o contador, o status e "Nova rodada" passaram para a coluna lateral e a largura do campo foi limitada pela altura da janela (100dvh menos 20rem, 4:3). Os nomes de componente do plano/tarefas ("DebugDrawer") foram corrigidos para os reais (`DrawerToggle`, `DrawerPanel`, `useDrawer`).
- **Artefatos reabertos:** `spec.md` (status, H-02, H-04, FR-004), `clarification.md` (CQ-001, hipóteses), `research.md` (licenças OFL, decisão de layout, verificação visual), `tasks.md` (T001 a T014, nomes dos componentes, notas) e este `validation.md`.
- **Reexecuções:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` rodaram de novo depois da atualização dos documentos.

## Limitações e riscos residuais

| Limitação/risco                                                                          | Impacto                                                                        | Responsável | Aceite                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- | ---------------------------------------- |
| Aparência ao vivo no Chrome desktop do maintainer não verificada antes do merge          | A aparência real pode diferir da verificação em Chromium headless              | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Só o Chromium foi exercitado (o `:has()` do controle segmentado exige navegador recente) | Firefox e Safari não verificados                                               | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Tokens lidos do CSS publicado do site em uma sessão (H-01)                               | Podem divergir se o site for atualizado                                        | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Sem comparação byte a byte dos woff2 do site com os do repositório `google/fonts`        | São as mesmas famílias pelos nomes e pelo `@font-face`, não provadas idênticas | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Contraste sobre o campo marrom do canvas e do canvas em si não medido                    | Fora dos tokens; não coberto pela tabela de contrastes                         | maintainer  | aceito por wezercarvalho em `2026-10-28` |
| Acessibilidade com leitores de tela reais não exercitada                                 | `aria` conferido por teste, não com tecnologia assistiva real                  | maintainer  | aceito por wezercarvalho em `2026-10-28` |

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer), pelo merge do PR da issue #74 na `main`
- **Data:** `2026-10-28`
- **Escopo aprovado:** FR-001 a FR-008 e os artefatos da spec, com o código em `apps/web/` (tokens, fontes próprias, componentes base em `apps/web/src/design/` e a tela das bolinhas refeita); menu e jogo de cartas herdam só paleta e fontes
- **Riscos aceitos:** a aparência ao vivo no Chrome desktop do maintainer não foi verificada antes do merge; só o Chromium foi exercitado (Firefox e Safari não verificados); os tokens vêm de uma leitura do site; os woff2 não foram comparados byte a byte com o repositório `google/fonts`; o contraste sobre o campo do canvas e a acessibilidade com leitores de tela reais não foram medidos
- **Observações:** o Gate 3 foi concedido pelo merge, sem teste manual ao vivo, a pedido do maintainer ("pode considerar os gates aprovados"), como no PR #73. As licenças OFL 1.1 das fontes foram lidas na fonte e permitem a redistribuição (H-02 fechada); o token de borda de controle foi fixado e medido (H-04 fechada). A convergência aprovada é entre código, spec e testes (incluindo a verificação visual em Chromium headless), não a aparência final ao vivo. A issue #74 fecha, nesta primeira entrega, com este registro; o redesenho de layout do menu e do jogo de cartas segue fora de escopo.
