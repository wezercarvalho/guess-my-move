# Clarificação — 2026-10-27-game-marbles-bete-refine-flick-thumb-release

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-27`

As decisões CQ-001 a CQ-008 refletem o refino do modo estalo (alpha) do bete aprovado pelo maintainer wezercarvalho na sessão do dashboard em 2026-10-27, depois de ler no painel os números do primeiro teste com a mão real. Houve uma **correção de rumo** registrada em CQ-001: uma primeira versão deste refino tentou dar ao estalo a mira relativa da pinça (direção e força pelo arrasto); o maintainer corrigiu ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo"), porque isso apagava a diferença entre as duas mecânicas. Os Gates 1 e 2 foram aprovados de forma antecipada ("pode fazer então, abre um PR"), antes da redação dos documentos. Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta`: é a fonte vigente completa do modo estalo, e a spec de criação passa a `superseded` apontando para esta (ver CQ-008 e a seção `## Substituição` daquela spec).

## Log de decisões

### CQ-001 — Correção de rumo: pinça e estalo são mecânicas distintas

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** O estalo deve passar a mirar e regular a força pelo arrasto relativo, como a pinça?
- **Decisão:** NÃO. O estalo é uma mecânica própria, distinta da pinça, e o refino DEVE estruturar essa distinção e aplicá-la a cada modo. Na pinça, a força é regulada pela mão (arrasto, estilingue). No estalo, a força é regulada pelo movimento do polegar (velocidade de abertura) e a mecânica é mais complexa. Uma versão anterior deste refino apagou a diferença (direção e força pelo arrasto) e foi corrigida. Mantêm-se a direção pela orientação da mão e a força pela velocidade de abertura; o que muda é a escala de força (de linear para logarítmica) e o gatilho (mais rígido).
- **Razão:** Palavras do maintainer: "Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo". Reduzir o estalo à mira da pinça eliminaria a razão de existir de um segundo modo e descartaria o estalo real do polegar que a issue #72 quer avaliar.
- **Alternativas rejeitadas:** Mira e força pelo arrasto relativo (apaga a distinção entre os modos, rejeitada pelo maintainer); abandonar o modo estalo (a issue #72 pede torná-lo jogável, não removê-lo).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, Objetivos, Fora de escopo, FR-001, FR-009, seção `## Distinção entre os modos`.

### CQ-002 — Direção pela orientação da mão, não pelo arrasto

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** De onde vem a direção do tiro no modo estalo?
- **Decisão:** Da orientação da mão no plano da imagem (vetor do pulso, landmark 0, à base do dedo médio, landmark 9, com x pela proporção da imagem e espelhado, normalizado), medida no início da abertura. A tela mostra uma seta de direção a partir da bolinha enquanto armado. Sem direção medida (vetor degenerado), o estalo cancela como "sem direção".
- **Razão:** É a direção própria do estalo, independente do arrasto da mão; a seta de prévia deixa o jogador ajustar a mão antes de soltar. No teste os vetores apontaram para cima e para a esquerda e nenhum tiro acertou, mas isso é incerteza a medir (H-04), não motivo para trocar a fonte pela da pinça.
- **Alternativas rejeitadas:** Direção pelo arrasto relativo (apaga a distinção, CQ-001); corrigir por profundidade (a câmera não a vê); alternativas de orientação (inclinação do pulso, mão de lado) ficam como trabalho futuro, não entrega.
- **Seções atualizadas em `spec.md`:** Resumo, US-001, US-002, FR-001, FR-003, H-04.

### CQ-003 — Força pela velocidade de abertura numa escala logarítmica

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** Como a força do tiro do estalo é regulada, já que no teste ela saía sempre no máximo?
- **Decisão:** Pela velocidade de abertura do polegar (pico da inclinação da razão entre amostras consecutivas), convertida numa escala LOGARÍTMICA: `power = clamp(ln(v / powerLowSpeed) / ln(powerHighSpeed / powerLowSpeed), 0, 1)` com `powerLowSpeed` = 10 e `powerHighSpeed` = 200; a velocidade do tiro é `minShotSpeed + power × (maxShotSpeed − minShotSpeed)` com `minShotSpeed` = 300 e `maxShotSpeed` = 1100 unid/s. O parâmetro linear `maxOpenSpeed` (8) é removido.
- **Razão:** No teste, as 15 velocidades (9,1 a 199 razão/s) ficaram todas acima do teto linear de 8, saturando no máximo. A escala log espalha a faixa observada (10 a 200) entre força 0 e 1. A faixa vem só da amplitude observada; o maintainer não disse quais foram fracos ou fortes, então a variação de ~22 vezes pode ser em parte a força do dedo, não confirmada (H-02).
- **Alternativas rejeitadas:** Manter a escala linear com teto maior (continuaria saturando numa webcam de poucos quadros e não separa os estalos observados); trocar a força pelo arrasto (apaga a distinção, CQ-001).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, US-001, FR-002, H-02, seção `## Distinção entre os modos`.

### CQ-004 — Endurecer o limite de abertura lenta

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Qual deve ser o limite de duração da subida para contar como estalo?
- **Decisão:** `slowMs` cai de 300 para 80 ms. Acima disso a abertura é lenta e o tiro é cancelado. `minOpenSpeed` segue em 2 razão/s.
- **Razão:** Duas aberturas de 103 e 192 ms contaram como tiro porque o limite era 300 ms; 13 das 15 aberturas ficaram em 37 ms ou menos. 80 ms separa o estalo de uma abertura comum com folga sobre os 37 ms observados e rejeita as duas lentas. É palpite de uma sessão (H-01).
- **Alternativas rejeitadas:** Manter 300 ms (deixa passar aberturas lentas); baixar para 40 ms (arriscaria cancelar estalos legítimos numa webcam lenta).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-002, FR-003, H-01.

### CQ-005 — O que sai e o que entra na configuração

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Quais parâmetros mudam com a escala logarítmica?
- **Decisão:** Sai `maxOpenSpeed` (teto linear de 8, que não serve à escala log). Entram `powerLowSpeed` (10) e `powerHighSpeed` (200). Mantêm-se `minShotSpeed` (300), `maxShotSpeed` (1100), `minOpenSpeed` (2, corte de abertura fraca) e `slowMs` (agora 80). A direção pela orientação da mão (`handDirection`), a seta de direção e a medição de velocidade de abertura permanecem.
- **Razão:** A escala linear de 2 a 8 estava errada (saturava); a log precisa de dois pontos de referência (`powerLowSpeed`, `powerHighSpeed`) no lugar de um teto único. Nada que define a mecânica própria do estalo (direção da mão, força pela abertura) é removido.
- **Alternativas rejeitadas:** Manter `maxOpenSpeed` desligado (confunde a configuração); remover a medição de velocidade de abertura (é justamente a fonte da força).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, FR-002, FR-006.

### CQ-006 — Processar só quadros novos da câmera e mostrar a taxa real

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como medir a taxa real da câmera e não reprocessar quadros repetidos?
- **Decisão:** O laço processa o detector só quando a câmera entrega um quadro novo, com `requestVideoFrameCallback` quando disponível e recuo para a comparação de `video.currentTime` quando não (por exemplo no jsdom). O painel passa a mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s). Vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos. Registrada a hipótese (H-03) de que a taxa real pode ser menor que os 86/s processados.
- **Razão:** Foram processados cerca de 86 quadros/s, mais do que uma webcam comum (30/s); o laço `requestAnimationFrame` só pulava quando `currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo. Medir a taxa real é o que confirma ou refuta o reprocessamento, e numa abertura de um quadro a velocidade é limitada pela taxa de quadros (H-05).
- **Razão da escolha técnica:** `requestVideoFrameCallback` é a API específica para quadros de vídeo; o recuo por `currentTime` mantém os testes em jsdom funcionando sem a API.
- **Alternativas rejeitadas:** Confiar na taxa do `requestAnimationFrame` (não é a taxa da câmera); só comparar `currentTime` (menos preciso que rVFC quando disponível).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-003, FR-005, FR-006, H-03, H-05.

### CQ-007 — Rótulo alpha, textos, força e resultado do último estalo

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Como a tela orienta o gesto e o que o painel reporta?
- **Decisão:** A orientação do modo estalo passa a ser "feche a pinça com a mão apontada para o alvo e abra os dedos rápido; a força vem da velocidade com que o polegar solta"; o rótulo "Estalo (alpha)" é mantido. O painel mostra Armado, a velocidade da abertura, a duração da subida, a FORÇA do último estalo (0 a 100%) e o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem direção`. Nenhum texto afirma desempenho, correspondência da direção ao estalo real ou viabilidade sem medição; a decisão da issue #72 é do maintainer após o teste manual.
- **Razão:** O gesto é apontar e estalar (não arrastar); a tela precisa dizer isso e que a força vem do polegar. A força em porcentagem e o resultado `sem direção` dão ao maintainer o que calibrar. A viabilidade do estalo segue não testada com a mão.
- **Alternativas rejeitadas:** Remover o rótulo alpha (afirma estabilidade não medida); texto de arrasto de mira (descreveria a mecânica da pinça, não a do estalo).
- **Seções atualizadas em `spec.md`:** Resumo, US-004, FR-006, FR-007, NFR-002, NFR-003.

### CQ-008 — Relação com a spec de criação do estalo (substituição)

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta` ou só se relaciona com ela?
- **Decisão:** Substitui. Como `spec.md` é a única fonte vigente do comportamento e este refino redefine a escala de força, o gatilho e o processamento de quadros do modo estalo, a spec de criação deixa de ser a fonte vigente. Por isso esta spec é a **fonte vigente completa** do modo estalo: declara também o que vem da spec de criação e continua valendo (seletor "Modo de tiro", rótulo alpha, `?mode=estalo`, troca de modo reinicia a rodada, armar ao fechar a pinça vista aberta antes, perda de mão > 300 ms cancela, privacidade, direção pela orientação da mão). O validador estrutural (`scripts/sdd/check-state.mjs`) permite marcar a antiga como `superseded` desde que ela traga `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres); ambos atendidos. A antiga passa a `superseded` apontando para esta, esta declara `supersedes: [2026-10-27-game-marbles-bete-build-flick-beta]` e o `specs/README.md` é atualizado. A spec do modo pinça (`build-pinch-shot`) continua `validated` e entra só em `related_specs`.
- **Razão:** Marcar a antiga como `superseded` mantém uma única fonte vigente (Princípio II) e não quebra `yarn sdd:check`. Deixá-la `validated` manteria dois textos divergentes (escala linear x logarítmica, gatilho de 300 x 80 ms).
- **Alternativas rejeitadas:** Deixar a antiga `validated` e só relacionar (texto vigente contraditório); reescrever a antiga no lugar (apagaria o histórico da decisão de criação, que o Git deve preservar).
- **Seções atualizadas em `spec.md`:** frontmatter (`supersedes`, `related_specs`), Resumo, FR-010; e a spec antiga (`status`, `related_specs`, seção `## Substituição`) e `specs/README.md`.

## Hipóteses remanescentes

- Os limiares do gatilho (`slowMs` = 80 ms, `minOpenSpeed` = 2 razão/s, histerese herdada) são palpites de uma sessão de cerca de 40 s (H-01).
- A faixa 10 a 200 da escala de força vem só da amplitude observada; não se sabe quais estalos foram fracos ou fortes (H-02).
- A taxa de 86 quadros/s pode ser maior que a taxa real da câmera (H-03); o painel de quadros novos por segundo é o que mede isso.
- A direção pela orientação da mão pode não corresponder ao estalo real (H-04); mantida porque a seta de prévia deixa ajustar a mão; alternativas ficam como pergunta aberta.
- Numa abertura de um quadro, a velocidade é limitada pela taxa de quadros (H-05); uma webcam de 30 quadros/s pode dar poucas amostras por estalo.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("Tu precisa estruturar essas distinções e aplicar adequadamente a cada modo" e "pode fazer então, abre um PR") e issue 72 do repositório.
- **Observações:** Aprovação antecipada no chat, após a correção de rumo (CQ-001), a partir dos números do primeiro teste lidos no painel. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
