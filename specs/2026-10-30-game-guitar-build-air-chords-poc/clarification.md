# Clarificação — 2026-10-30-game-guitar-build-air-chords-poc

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-30`

## Log de decisões

### CQ-001 — Escopo da PoC e acordes

- **Data:** `2026-10-30`
- **Impacto:** alto
- **Pergunta:** quais acordes e que parte do fluxo entram na PoC?
- **Decisão:** Em, Am, D, C e G, nessa ordem de ensino, com formato da mão **e** batida da outra mão. O maintainer pediu uma PoC "mais complexa" e deixou o escopo ao agente.
- **Razão:** a pesquisa mostra que poucos acordes por vez e a ordem Em, Am, D, C, G é o consenso de ensino; a batida é o que fecha o ciclo "formar e tocar".
- **Alternativas rejeitadas:** só o formato do acorde (não toca nada); mais acordes (E, A, Dm) ficam como extensão de dado.
- **Seções atualizadas em `spec.md`:** Objetivos, FR-004.

### CQ-002 — Braço: orientação e posição

- **Data:** `2026-10-30`
- **Impacto:** alto
- **Pergunta:** como é o braço projetado e onde fica?
- **Decisão:** horizontal, com a pestana do lado da mão do braço, 6 cordas e casas 1 a 5, fixo na tela com ajuste de posição e tamanho na gaveta de depuração. A mão do braço é a do lado da pestana; canhoto espelha. A divisa entre as mãos é a borda do braço, com margem de histerese.
- **Razão:** a batida fica vertical e natural; fixo evita que um erro de pulso desloque o braço; o ajuste cobre diferentes distâncias da câmera.
- **Alternativas rejeitadas:** braço preso ao pulso; braço vertical.
- **Seções atualizadas em `spec.md`:** FR-005, FR-006, FR-017.

### CQ-003 — Contato do dedo sem profundidade e dedos extras

- **Data:** `2026-10-30`
- **Impacto:** crítico
- **Pergunta:** como saber que um dedo aperta a corda, se o z do MediaPipe não é confiável, e o que fazer com dedos extras?
- **Decisão:** "apertando" é a ponta ficar na mesma célula pelo tempo mínimo de permanência, com histerese de saída. Um dedo estável sobre uma corda que o acorde pede solta **conta como erro** ("tire o dedo"), porque muda o som de fato; o parâmetro `ignoreExtraFingers` permite ignorá-lo na calibração. A issue #95 dizia "extras ignorados por padrão" e foi corrigida para esta decisão, que segue o critério da #99.
- **Razão:** o z é aprendido só de dados sintéticos (research.md); o erro de falso positivo é conhecido e fica visível na depuração.
- **Alternativas rejeitadas:** usar z; usar curvatura do dedo (sem como medir aqui, sem câmera real).
- **Seções atualizadas em `spec.md`:** FR-007, FR-008, Edge cases, H-01, H-02.

### CQ-004 — Detecção da batida

- **Data:** `2026-10-30`
- **Impacto:** alto
- **Pergunta:** que sinal define a batida e quando ela dispara?
- **Decisão:** velocidade vertical do centro da palma da mão que não faz o acorde, normalizada pelo tamanho da mão, com histerese e período refratário. Dispara no **pico** (primeiro quadro em que a velocidade deixa de crescer acima do limiar), para ter direção e força, ao custo de cerca de um quadro. A batida só conta dentro da zona de batida, a faixa das cordas.
- **Razão:** o pico dá a força; o centro da palma treme menos que uma ponta.
- **Alternativas rejeitadas:** disparar no início do movimento (sem força); cruzamento de linha pela ponta do dedo.
- **Seções atualizadas em `spec.md`:** FR-011, H-03.

### CQ-005 — Som

- **Data:** `2026-10-30`
- **Impacto:** médio
- **Pergunta:** o que soa e como é gerado?
- **Decisão:** soa o que a mão está formando (casa detectada por corda), não o acorde alvo, com as cordas abafadas do alvo fora. Gerado por Karplus-Strong em `AudioBuffer` pré-calculado. Sem mão (teclado ou clique), soa o acorde alvo.
- **Razão:** formato errado precisa soar errado; sem arquivo de áudio, sem rede.
- **Alternativas rejeitadas:** tocar sempre o alvo; `AudioWorklet`; amostras gravadas.
- **Seções atualizadas em `spec.md`:** FR-012, FR-013, FR-014, FR-017.

### CQ-006 — Significado de alpha

- **Data:** `2026-10-30`
- **Impacto:** baixo
- **Pergunta:** o que "alpha" promete?
- **Decisão:** jogo em teste, sem promessa de precisão. O selo "Alpha" aparece no card do menu como componente do design system; a tela não repete a palavra além do título do card.
- **Razão:** o maintainer pediu o projeto "em alpha" e as bolinhas já usam "alpha" para o estalo.
- **Alternativas rejeitadas:** esconder o jogo atrás de um parâmetro de URL.
- **Seções atualizadas em `spec.md`:** FR-001, FR-003.

## Hipóteses remanescentes

- H-01 a H-04 de `spec.md` não foram verificadas: não há câmera nem mão real no ambiente do agente. A validação é o teste ao vivo do maintainer (Gate 3), com os números da gaveta de depuração.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** pedido do maintainer na sessão do dashboard em 2026-10-30 (06:16 UTC): "Faz uma revisão do estado da arte, e aí cria as issues. Após criar as issues, revisa e vai movendo para ready. Após isso pode desenvolver elas e me entrega um PR em draft consolidado no final para que eu teste."; issues 95 a 104 do repositório.
- **Observações:** aprovação antecipada **inferida** do pedido de desenvolver depois das issues estarem prontas; o maintainer não escreveu "considere os gates aprovados". Ele pode rejeitá-la na revisão da PR, e a spec volta ao primeiro estado afetado. CQ-001 a CQ-006 ficam resolvidas pelas decisões acima. O Gate 3 não é concedido pelo agente: depende do teste ao vivo do maintainer.

## Revisão do Gate 3

### CQ-007 — Fluxo livre, proporção do braço e leitura temporal

- **Data:** `2026-10-30`
- **Impacto:** crítico
- **Origem:** primeiro teste ao vivo do maintainer na PR #105.
- **Decisão:** o jogador não escolhe um acorde. O sistema reconhece Em, Am, D, C ou G pela combinação estável de corda e casa, independentemente do dedo usado; só então mostra o nome e o diagrama. O braço padrão passa de 40% para 18% da altura do vídeo, a câmera ocupa toda a largura útil e a zona restante fica para a batida. A batida exige velocidade e deslocamento acumulado na mesma direção, em vez de disparar por um pico isolado.
- **Razão:** o braço original era grosso demais para posicionar a mão, a área de execução era pequena e a seleção prévia invertia a proposta de reconhecimento. O pico isolado também convertia jitter rápido em batida.
- **Substitui:** as partes de CQ-002, CQ-003, CQ-004 e CQ-005 que exigiam acorde alvo, correção contra o alvo, disparo no pico e som de formato inválido.
- **Evidência:** seção 6 de `research.md`; testes de reconhecimento dos cinco acordes, independência do dedo, troca com permanência, jitter sem evento e câmera em largura total.
- **Gate 3:** continua pendente. O primeiro teste ao vivo rejeitou a ergonomia e o fluxo da versão anterior; a revisão precisa de novo teste do maintainer.
