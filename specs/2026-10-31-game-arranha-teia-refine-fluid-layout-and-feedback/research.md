# Pesquisa — 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback

## Achados do código atual

- `SwingApp` monta `<main className="app app-wide">`; `.app.app-wide` limita a 1360 px e aplica padding e rolagem normal da página (`styles.css`).
- `.swing-stage` tem largura `min(100%, (100dvh - 14rem) * 16/9)` e proporção 16:9, o que deixa faixas vazias nos dois lados em janelas largas.
- O link "← Menu" (`back-link`) está fora do `#root`, no `body`, e soma altura à página.
- A gaveta de depuração (`DrawerPanel`) fica no fluxo, abaixo do conteúdo.
- O estado da trava, o agarre e a contagem de escalada saem de `headStatusLine` e `gripStatusLine`, exibidos só nos painéis laterais.
- O renderizador reage ao tamanho do palco por `ResizeObserver` e `renderer.resize`, e a câmera usa `aspect = largura / altura`, então um palco sem proporção fixa funciona.

## Decisão técnica

1. Classe `swing-page` no `body` de `swing.html` e `#root` como item flexível; o contêiner `app-fill` ocupa 100% da altura restante.
2. Palco com `flex: 1` e `min-height: 0`; coluna lateral com `overflow-y: auto`.
3. `feedback.ts` com `deriveChips` e `feedbackEvents` puras; `SwingFeedback` desenha e controla o tempo dos avisos.
4. Gaveta de depuração com `position: fixed` e rolagem própria.

## Valores a medir

- Altura do documento contra a altura da janela em 1440×900, 1280×720 e 390×844.
- Posição dos avisos relativa ao palco (base, centralizada).
- fps não será citado: o Chromium headless por software não prova desempenho.
