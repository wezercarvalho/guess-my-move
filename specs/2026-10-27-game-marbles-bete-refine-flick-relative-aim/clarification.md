# Clarificação — 2026-10-27-game-marbles-bete-refine-flick-relative-aim

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-27`

As decisões CQ-001 a CQ-007 refletem o refino do modo estalo (alpha) do bete aprovado pelo maintainer na sessão do dashboard em 2026-10-27, depois de ler no painel os números do primeiro teste com a mão real. Os Gates 1 e 2 foram aprovados de forma antecipada ("pode fazer então, abre um PR"), antes da redação dos documentos. Esta spec substitui em parte a `2026-10-27-game-marbles-bete-build-flick-beta`: o que define direção e força no estalo muda, e a spec de criação passa a `superseded` apontando para esta (ver CQ-007 e a seção `## Substituição` daquela spec).

## Log de decisões

### CQ-001 — Mira relativa no estalo, substituindo a direção pela orientação da mão

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** De onde vêm a direção e a força do tiro no modo estalo?
- **Decisão:** Do arrasto relativo da mão, exatamente como no modo pinça. Ao fechar a pinça (vista aberta antes), a mira começa em qualquer ponto; a "pinça virtual" é a posição da bolinha de tiro mais o deslocamento da mão vezes `aimScale` (1,5). Direção e força vêm do arrasto (`computeShot`); a previsão do tiro (linha e seta) aparece como na pinça. A lógica da pinça virtual é reaproveitada, sem duplicar.
- **Razão:** No primeiro teste, a direção vinha da orientação da mão no plano da imagem e nenhum dos 8 tiros acertou o alvo (vetores apontando para cima e para a esquerda, alvo à direita); o modo pinça, que mira pelo arrasto relativo, acertou. A mira relativa não depende da profundidade, que a câmera não vê.
- **Alternativas rejeitadas:** Manter a direção pela orientação da mão (falhou no teste); corrigir a orientação por profundidade (a câmera não a vê).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, US-001, FR-001.

### CQ-002 — Abertura rápida como gatilho, não como força

- **Data:** `2026-10-27`
- **Impacto:** crítico
- **Pergunta:** Qual é o papel da abertura rápida no tiro?
- **Decisão:** Só o gatilho. Ao abrir, dispara o tiro JÁ PREVISTO pelo arrasto se a abertura for rápida (subida <= `slowMs` e velocidade >= `minOpenSpeed`) e houver tiro previsto; a velocidade e a direção do tiro vêm do arrasto, não da velocidade de abertura. A velocidade e a duração da abertura continuam medidas e mostradas no painel como dado, mas não definem a força.
- **Razão:** No teste, a velocidade de abertura foi de 9,1 a 199 razão/s, toda acima do teto de 8, então todos os tiros saíram na força máxima; a velocidade de abertura media o salto da razão por quadro, não a força do dedo. Separar gatilho de força resolve isso.
- **Alternativas rejeitadas:** Reescalar a conversão de velocidade de abertura em força (o teto seria sempre estourado numa webcam de poucos quadros); manter força por velocidade de abertura (não reflete a intenção do jogador).
- **Seções atualizadas em `spec.md`:** Resumo, US-001, US-002, FR-003, FR-004.

### CQ-003 — Endurecer o limite de abertura lenta

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Qual deve ser o limite de duração da subida para contar como estalo?
- **Decisão:** `slowMs` cai de 300 para 80 ms. Acima disso a abertura é lenta e o tiro é cancelado. `minOpenSpeed` segue em 2 razão/s.
- **Razão:** Duas aberturas de 103 e 192 ms contaram como tiro porque o limite era 300 ms; 13 das 15 aberturas ficaram em 37 ms ou menos. 80 ms separa o estalo de uma abertura comum com folga sobre os 37 ms observados e rejeita as duas lentas. É palpite de uma sessão (H-01).
- **Alternativas rejeitadas:** Manter 300 ms (deixa passar aberturas lentas); baixar para 40 ms (arriscaria cancelar estalos legítimos numa webcam lenta).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-002, FR-003, H-01.

### CQ-004 — O que sai do código e da spec vigente

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** O que deixa de existir com a mira relativa?
- **Decisão:** Saem do código e da spec vigente a orientação da mão (`handDirection`), o campo `direction` na leitura e na soltura, a seta de direção do estalo, `flickShot`, a conversão da velocidade de abertura em força e os parâmetros `maxOpenSpeed`, `minShotSpeed` e `maxShotSpeed`. O resultado `sem direção` do painel deixa de existir; entra `sem tiro` (arrasto curto demais).
- **Razão:** Com a mira vindo do arrasto, a orientação da mão e a conversão de força por velocidade de abertura não têm mais função; mantê-las seria código morto e texto contraditório.
- **Alternativas rejeitadas:** Manter `handDirection` como dado de painel (vira código sem uso); manter os parâmetros de força desligados (confunde a configuração).
- **Seções atualizadas em `spec.md`:** Resumo, Objetivos, US-004, FR-002, FR-006, FR-007.

### CQ-005 — Processar só quadros novos da câmera e mostrar a taxa real

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Como medir a taxa real da câmera e não reprocessar quadros repetidos?
- **Decisão:** O laço processa o detector só quando a câmera entrega um quadro novo, com `requestVideoFrameCallback` quando disponível e recuo para a comparação de `video.currentTime` quando não (por exemplo no jsdom). O painel passa a mostrar "Quadros novos da câmera/s" (contagem em janela de 1 s). Vale para os dois modos; o modo pinça só muda por não reprocessar quadros repetidos. Registrada a hipótese (H-02) de que a taxa real pode ser menor que os 86/s processados.
- **Razão:** Foram processados cerca de 86 quadros/s, mais do que uma webcam comum (30/s); o laço `requestAnimationFrame` só pulava quando `currentTime` não mudava, o que pode não marcar quadros novos em fluxos ao vivo. Medir a taxa real é o que confirma ou refuta o reprocessamento.
- **Razão da escolha técnica:** `requestVideoFrameCallback` é a API específica para quadros de vídeo; o recuo por `currentTime` mantém os testes em jsdom funcionando sem a API.
- **Alternativas rejeitadas:** Confiar na taxa do `requestAnimationFrame` (não é a taxa da câmera); só comparar `currentTime` (menos preciso que rVFC quando disponível).
- **Seções atualizadas em `spec.md`:** Resumo, Problema, US-003, FR-005, FR-006, H-02, H-03.

### CQ-006 — Rótulo alpha, textos e resultado do último estalo

- **Data:** `2026-10-27`
- **Impacto:** médio
- **Pergunta:** Como a tela orienta o novo gesto e o que o painel reporta?
- **Decisão:** A orientação do modo estalo passa a ser "feche a pinça, arraste a mão para longe do alvo e abra os dedos rápido para atirar"; o rótulo "Estalo (alpha)" é mantido. O painel mostra o resultado do último estalo como `disparado`, `lento demais`, `fraco demais` ou `sem tiro`. Nenhum texto afirma desempenho ou viabilidade sem medição; a decisão da issue #72 é do maintainer após o teste manual.
- **Razão:** O gesto mudou (agora há um arrasto de mira antes do estalo) e a tela precisa dizer isso; o resultado `sem tiro` cobre o novo caso de arrasto curto demais. A viabilidade do estalo em si segue não testada com a mão.
- **Alternativas rejeitadas:** Remover o rótulo alpha (afirma estabilidade não medida); manter o texto antigo (não descreve o arrasto de mira).
- **Seções atualizadas em `spec.md`:** Resumo, US-004, FR-006, FR-007, NFR-002, NFR-003.

### CQ-007 — Relação com a spec de criação do estalo (substituição)

- **Data:** `2026-10-27`
- **Impacto:** alto
- **Pergunta:** Esta spec substitui a `2026-10-27-game-marbles-bete-build-flick-beta` ou só se relaciona com ela?
- **Decisão:** Substitui em parte. Como `spec.md` é a única fonte vigente do comportamento e este refino troca o que define direção e força do estalo e remove a orientação da mão, a seta e `flickShot`, a spec de criação deixa de descrever o comportamento vigente do estalo. O validador estrutural (`scripts/sdd/check-state.mjs`) permite marcar a spec antiga como `superseded` desde que ela traga `related_specs` não vazio e uma seção `## Substituição` substantiva (>= 20 caracteres); esses dois requisitos são atendidos. Por isso a spec antiga passa a `superseded` apontando para esta, esta declara `supersedes: [2026-10-27-game-marbles-bete-build-flick-beta]` e o `specs/README.md` é atualizado. A spec do modo pinça (`build-pinch-shot`) continua `validated` e entra só em `related_specs`, pois seu comportamento não muda (salvo o não reprocessar quadros repetidos).
- **Razão:** Marcar a antiga como `superseded` mantém uma única fonte vigente do comportamento do estalo (Princípio II) e não quebra `yarn sdd:check`, que verifiquei nos scripts antes de decidir. Deixá-la `validated` manteria dois textos divergentes sobre direção e força do estalo.
- **Alternativas rejeitadas:** Deixar a antiga `validated` e registrar só `related_specs` (manteria texto vigente contraditório sobre direção e força); reescrever a spec antiga no lugar (apagaria o histórico da decisão de criação, que o Git deve preservar).
- **Seções atualizadas em `spec.md`:** frontmatter (`supersedes`, `related_specs`), Resumo, FR-010; e a spec antiga (`status`, `related_specs`, seção `## Substituição`) e `specs/README.md`.

## Hipóteses remanescentes

- Todos os limiares (novos e mantidos) são palpites de uma sessão de cerca de 40 s (H-01); mitigados pelo painel e pelo teste do maintainer.
- A taxa de 86 quadros/s pode ser maior que a taxa real da câmera (H-02); o painel de quadros novos por segundo é o que mede isso.
- Uma webcam de 30 quadros/s pode dar poucas amostras por estalo (H-03), degradando a medição da subida.
- O estalo real de lado, com a câmera baixa, pode não ser seguido pelo detector (H-04); está fora do escopo.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-27`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** Mensagem do maintainer na sessão do dashboard em 2026-10-27 ("pode fazer então, abre um PR") e issue 72 do repositório.
- **Observações:** Aprovação antecipada no chat, antes da redação, a partir dos números do primeiro teste lidos no painel. O Gate 3 continua dependendo do teste manual do maintainer no Chrome desktop.
