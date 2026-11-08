---
id: 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback
summary: Refina a tela do Arranha-Teia em duas frentes. Layout fluido, sem rolagem da página em janelas de computador (a partir de 960 px de largura e 560 px de altura), com cabeçalho compacto, palco que preenche o espaço e coluna lateral com a altura da janela; em janelas menores o layout empilha e a página rola. Mensagens sobre o jogo, na base do palco e nunca no centro da visão, com estados persistentes (direção travada, agarrado, contagem regressiva e barra até começar a subir ou descer, subindo, descendo, dica de parede, rosto fora do quadro) e avisos curtos de evento (direção liberada, soltou da parede, teia presa ou solta, rosto detectado), derivados por funções puras e testadas. A depuração vira uma gaveta sobre o jogo. Sem mudar física, gestos, cidades nem a tela das bolinhas. Issue #109; Gates 1 e 2 aprovados pelo maintainer em 2026-10-31; Gate 3 pendente do teste ao vivo.
title: Arranha-Teia, layout sem rolagem e mensagens na tela
slug: game-arranha-teia-refine-fluid-layout-and-feedback
strategy: sdd
domain: game
capability: arranha-teia
objective: refine-fluid-layout-and-feedback
status: validating
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - layout
    - sem rolagem
    - mensagens na tela
    - feedback na tela
    - chips de estado
    - avisos de evento
    - direção travada
    - contagem de escalada
    - gaveta de depuração
code_paths:
    - apps/web/src/swing/
    - apps/web/src/styles.css
    - apps/web/swing.html
related_specs:
    - 2026-10-28-game-arranha-teia-build-first-person-web-swing
    - 2026-10-29-game-arranha-teia-add-head-tracking-camera
    - 2026-10-29-game-arranha-teia-add-wall-climb
    - 2026-10-30-game-arranha-teia-add-city-catalog
supersedes: []
branch: feat/109-layout-e-feedback-na-tela
constitution_version: 1.0.0
created_at: 2026-10-31
updated_at: 2026-10-31
---

# Arranha-Teia, layout sem rolagem e mensagens na tela

## Resumo

Testando o Arranha-Teia, o maintainer apontou que o conteúdo fica numa faixa estreita no meio da janela, com muito espaço vazio nas laterais e uma rolagem longa, e que o estado da trava do olhar, o agarre e a contagem até começar a escalar aparecem no painel lateral, abaixo da dobra. Para saber se travou ele precisa tirar os olhos do jogo e rolar a página. Esta mudança faz a tela do jogo ocupar o espaço disponível sem rolagem em janelas de computador e leva os avisos essenciais para dentro da área do jogo, fora do centro da visão.

## Problema

1. O Arranha-Teia usa o contêiner largo dos jogos (até 1360 px) com um palco 16:9 limitado pela altura da janela. Em janelas largas sobram faixas vazias nos dois lados e o cabeçalho, o crédito, a gaveta de depuração e os painéis laterais empurram a página para baixo.
2. O estado da trava da direção, a contagem regressiva até começar a subir ou descer, o agarre e o aviso de rosto fora do quadro ficam em painéis laterais. Eventos como soltar da parede ou direção liberada não têm nenhum aviso.

## Objetivos

- Em janelas de computador, a página do jogo cabe na janela sem rolagem; o palco preenche o espaço restante.
- Mensagens curtas aparecem sobre o jogo, na base do palco e fora do centro da visão: estados persistentes e avisos de evento.
- A contagem até começar a escalar aparece sobre o jogo, com texto e barra.
- Em janelas pequenas o layout empilha e a página rola normalmente.

## Fora de escopo

- Modo treino e cenário futurista (issue #108).
- Som, vibração, mudanças de física, gestos, câmera pela cabeça, escalada ou cidades.
- A tela das bolinhas e a seleção de mapas.
- Afirmar desempenho (fps) ou o layout em tamanhos de janela não testados.

## Atores

- **Jogador**, que joga com câmera e mãos ou só com o teclado.
- **Maintainer**, que testa a usabilidade ao vivo.

## Histórias de usuário

### US-001 — Ver o jogo sem rolar (P1)

Como jogador, quero que a tela do jogo ocupe a janela, para jogar sem rolar a página.

**Teste independente:** em Chromium com janelas 1440×900 e 1280×720, a altura do documento não passa da altura da janela e o palco ocupa a maior parte da largura.

**Critérios de aceitação:**

1. **Dado** uma janela com pelo menos 960 px de largura e 560 px de altura, **quando** o jogo abre, **então** a página não tem rolagem e o palco ocupa o espaço restante.
2. **Dado** o painel lateral mais alto que a janela, **quando** a janela é baixa, **então** só a coluna lateral rola, nunca a página.
3. **Dado** uma janela menor, **quando** o jogo abre, **então** o layout empilha e a página rola.

### US-002 — Saber o que aconteceu sem tirar os olhos do jogo (P1)

Como jogador, quero ver sobre o jogo quando a direção travou, quando agarrei e quanto falta para subir, para não olhar para o painel lateral.

**Teste independente:** componentes e funções puras com estados simulados; no navegador, o teclado produz o agarre e a teia.

**Critérios de aceitação:**

1. **Dado** a direção travada, **quando** o gesto vale, **então** aparece "Direção travada" sobre o jogo; ao soltar, o aviso "Direção liberada" aparece por instantes.
2. **Dado** o agarre, **quando** agarra, **então** o estado aparece sobre o jogo; com o olhar de escalada, o texto da contagem e uma barra de progresso aparecem sobre o jogo; ao soltar, o aviso "Soltou da parede".
3. **Dado** uma teia que prende ou solta, **quando** o estado muda, **então** um aviso curto diz qual mão.
4. **Dado** o rosto que sai do quadro (modo Rosto), **quando** ocorre, **então** o estado aparece; ao voltar, o aviso "Rosto detectado".

### US-003 — Mensagens que não atrapalham (P1)

Como jogador, quero que as mensagens não cubram o centro da visão nem peguem os cliques.

**Critérios de aceitação:**

1. **Dado** qualquer mensagem, **quando** aparece, **então** fica na base do palco, centralizada na horizontal e sem pegar o mouse.
2. **Dado** vários avisos, **quando** chegam juntos, **então** no máximo três ficam na tela e cada um some sozinho.

### US-004 — Depurar sem alargar a página (P2)

Como mantenedor, quero abrir a depuração sobre o jogo sem a página crescer.

**Critérios de aceitação:**

1. **Dado** a gaveta fechada, **quando** a tela carrega, **então** não ocupa espaço.
2. **Dado** a gaveta aberta, **quando** aparece, **então** flutua sobre o jogo, com rolagem própria, e a página continua sem rolagem.

## Requisitos funcionais

- **FR-001:** A tela do Arranha-Teia DEVE preencher a janela, sem rolagem da página, quando a largura é de pelo menos 960 px e a altura de pelo menos 560 px: cabeçalho compacto em uma linha, palco que ocupa o espaço restante (sem proporção fixa) e coluna lateral com a altura da janela e rolagem própria se o conteúdo não couber. A restrição vale só para a tela do jogo; a seleção de mapas e a tela das bolinhas NÃO DEVEM mudar.
- **FR-002:** Abaixo desse tamanho, o layout DEVE empilhar (palco acima, coluna abaixo) e a página DEVE rolar normalmente.
- **FR-003:** O botão "Depuração" DEVE ficar no cabeçalho e a gaveta DEVE flutuar sobre o jogo, com rolagem própria e fechada por padrão, sem aumentar a altura da página.
- **FR-004:** Uma função pura (`deriveChips`) DEVE derivar do estado do jogo os estados persistentes mostrados sobre o jogo: direção travada; agarrado e, no modo Rosto com rosto à vista, a escalada pelo olhar (texto da espera com segundos restantes e barra de progresso, subindo, descendo); dica de parede; rosto fora do quadro. Os textos DEVEM ser curtos e reaproveitar os de `guide.ts` onde já existem.
- **FR-005:** Uma função pura (`feedbackEvents`) DEVE derivar, da mudança entre dois estados, os avisos de evento: "Direção liberada", "Soltou da parede", "Teia presa: esquerda|direita|as duas", "Teia solta" e "Rosto detectado". Só vale com o jogo rodando e, para o rosto, com a câmera ativa no modo Rosto.
- **FR-006:** Um componente (`SwingFeedback`) DEVE desenhar os estados e os avisos dentro do palco, na base e centralizado na horizontal, com `pointer-events: none`, `aria-live="polite"`, no máximo três avisos ao mesmo tempo, cada um por 1,6 s (valor de jogo). NENHUMA mensagem DEVE ficar sobre o centro da visão.
- **FR-007:** O painel "Direção do olhar" NÃO DEVE repetir o título (o rótulo do grupo basta); o status e os textos de dica dos painéis laterais DEVEM continuar existindo.
- **FR-008:** Física, gestos, textos de status, legenda de teclado sempre visível, privacidade, seleção de mapas e a tela das bolinhas NÃO DEVEM regredir.

## Requisitos não funcionais

- **NFR-001:** A lógica de derivação DEVE ser pura e testada antes do código (test-first); o componente só desenha.
- **NFR-002:** Nenhuma dependência nova, nenhum recurso de terceiros e nenhuma requisição externa.
- **NFR-003:** Nenhuma afirmação de fps ou de layout em tamanhos de janela não testados; as medições de layout em Chromium headless DEVEM ser registradas como texto, com os tamanhos usados.
- **NFR-004:** Os gates oficiais DEVEM ficar verdes: `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check` e `security:dependencies`.

## Edge cases

- Fase de carregamento ou erro: nenhum aviso é mostrado.
- Sem câmera: só aparecem os estados do teclado (agarrado, dica de parede, teia presa ou solta).
- Modo Automática: sem avisos de rosto nem de escalada pelo olhar; o agarre mostra a dica das mãos.
- Estado oscilando entre dois quadros: o aviso de evento é gerado só na mudança e some sozinho; os estados persistentes acompanham o estado atual.
- Janela muito baixa (menos de 560 px de altura): vale o layout empilhado.

## Hipóteses e dependências

- **H-01:** O contêiner `body` pode ser limitado à altura da janela só na página do Arranha-Teia por uma classe no `body` (`swing-page`), sem afetar as demais páginas.
- **D-01:** O modo treino (#108) reutiliza este feedback.

## Critérios mensuráveis de sucesso

- **SC-001:** Em Chromium com 1440×900 e 1280×720, a altura do documento não passa da altura da janela com a tela do jogo aberta (medido e registrado).
- **SC-002:** Testes automatizados de `deriveChips`, `feedbackEvents`, `SwingFeedback` e da tela cobrem FR-004 a FR-007, escritos antes do código.
- **SC-003:** Nenhum teste existente regride (FR-008).

## Adoção constitucional

- **Versão preservada:** 1.0.0
- **Status:** aprovado
- **Aprovador:** Wezer (@wezercarvalho)
- **Data:** 2026-10-31
- **Referência:** mensagem do maintainer na sessão de 2026-10-31 ("Vamos melhorar o layout da tela. Podemos ocupar melhor o espaço da tela do game... Poderiam aparecer mensagens na tela quando a direção travar ou eventos relevantes... Pode considerar os gates aprovados. Me avisa quando eu puder testar.")
- **Justificativa:** adota a constituição vigente 1.0.0 sem emenda.
