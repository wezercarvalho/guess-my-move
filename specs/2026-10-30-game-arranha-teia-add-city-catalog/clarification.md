# Clarificação — 2026-10-30-game-arranha-teia-add-city-catalog

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** 1.0.0
- **Iniciada em:** `2026-10-30`

## Log de decisões

### CQ-001 — Realismo sem romper a física

- **Data:** `2026-10-30`
- **Impacto:** crítico
- **Pergunta:** Trocar o jogo para Unity/Unreal/Cesium ou evoluir o motor web existente?
- **Decisão:** Manter Three.js e separar dados de colisão locais da apresentação. Nesta entrega, melhorar o procedural; Cesium/tiles fotorrealistas ficam como experimento futuro.
- **Razão:** trocar a engine não resolve licença, custo, relevo ou alinhamento da colisão; reescreveria câmera, gestos e física. Tiles externos quebrariam a origem única e exigiriam uma geometria de colisão separada.
- **Alternativas rejeitadas:** Unity/Unreal (reescrita ampla e navegador mais complexo); Google/Cesium agora (token, terceiros, custo e termos ainda sem decisão).
- **Seções atualizadas em `spec.md`:** resumo, problema, fora de escopo, FR-007, NFR-001.

### CQ-002 — Cidades da primeira entrega

- **Data:** `2026-10-30`
- **Impacto:** alto
- **Pergunta:** Quais mapas entram sem sacrificar o funcionamento já aprovado?
- **Decisão:** Preservar Midtown e incluir Avenida Paulista. Não incluir Paris (0% dos raios acertaram parede a 60 m na amostra anterior) nem o Rio ainda (não existe relevo no motor).
- **Razão:** a pesquisa mediu a Paulista com perfil vertical mais próximo de Midtown e alta cobertura de alturas; cidade baixa ou Rio plano piorariam a jogabilidade ou a fidelidade.
- **Alternativas rejeitadas:** incluir todos os mapas só para aumentar a lista; entregar Rio plano; baixar o teto global e alterar a física de Midtown.
- **Seções atualizadas em `spec.md`:** objetivos, US-002, FR-004, hipóteses.

### CQ-003 — Fluxo da seleção

- **Data:** `2026-10-30`
- **Impacto:** médio
- **Pergunta:** Onde escolher o mapa e como voltar?
- **Decisão:** `swing.html` abre a seleção quando não há `?city=` válido; um card inicia o jogo; "Trocar mapa" desmonta o jogo e volta. O link direto é suportado sem derivar caminho de id desconhecido.
- **Razão:** atende "antes de ingressar no game" e preserva links diretos para teste.
- **Alternativas rejeitadas:** seletor dentro do HUD (o jogo já teria carregado); uma página HTML nova (duplicaria entrada e navegação).
- **Seções atualizadas em `spec.md`:** US-001, FR-002, FR-003, FR-008.

## Hipóteses remanescentes

- A extração nova da Paulista deve reproduzir a ordem de grandeza medida em 2026-10-29; diferenças do OSM serão registradas.
- O passe visual precisa ser conferido em Chromium; nenhuma melhoria será chamada de fotorrealista.
- O Rio e o Cesium continuam fora desta entrega e exigem decisão e spec próprias.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** mensagem no chat: "aplica da melhor forma possível mantendo o funcionamento que já possuímos ou até mesmo aperfeiçoando se possível. Esse é teu objetivo. Pode seguir no PR/branch que já existe para essa questão dos mapas."
- **Observações:** o agente escolheu a alternativa local e incremental já recomendada na conversa; o maintainer pediu execução e aviso para teste.

## Emenda CQ-001 — Santa Maria no catálogo

- **Data:** `2026-10-30`
- **Pedido:** adicionar Santa Maria, Rio Grande do Sul, como terceira opção na mesma branch.
- **Decisão:** reutilizar o pipeline OSM e o formato `City` v1 já aprovados, com um recorte central local e sem serviço externo durante o jogo.
- **Critério:** o recorte só entra no catálogo depois de passar pela validação de dados, carregar no índice de colisão e demonstrar uma área jogável; quantidade, tamanho e cobertura de alturas serão registrados sem prometer fidelidade.
- **Gate 1 da emenda:** aprovado por wezercarvalho na mensagem "Agora adicionar Santa Maria, Rio Grande do Sul como seleção de cidade também. Pode fazer na mesma branch."
- **Ambiguidades:** o maintainer não definiu um bairro; o agente escolhe um recorte central reversível e mede o resultado antes de fixá-lo.

## Emenda CQ-002 — placas de rua em Santa Maria

- **Data:** `2026-10-30`
- **Pedido:** colocar o nome das ruas em Santa Maria, como placas nas esquinas com uma seta indicando o sentido da rua ("a rua que sobe é a X e a que cruza é a Y"), e dizer se o mapa é a cidade toda ou só um trecho.
- **Decisão:** o nome vem da tag `name` do OSM, guardado em `CityRoad.name` (campo opcional, compatível com os mapas existentes). As esquinas são derivadas dos cruzamentos de vias com nomes diferentes. Cada placa é procedural, voltada para a câmera, com duas linhas e uma seta de duas pontas por rua, desenhada em relação à direção da câmera; a rua que segue para a frente fica na linha de cima.
- **Razão:** ruas de mão dupla não têm sentido único; a seta de duas pontas mostra o eixo da rua e é a única leitura correta para todas. Girar a seta com a câmera responde ao exemplo do maintainer ("a que sobe", "a que cruza") em qualquer direção de voo.
- **Alternativas rejeitadas:** nome desenhado no chão (ilegível em voo); placa fixa no mundo (some de lado); sentido único pela tag `oneway` (a maioria das ruas não é mão única); texto em cada via sem esquina.
- **Escopo:** só Santa Maria é regenerada com nomes; Midtown e Paulista não mudam.
- **Gate 1 da emenda:** aprovado por wezercarvalho na mensagem "Adiciona o nome das ruas para ficar mais fácil saber se localizar... uma plaquinha nas esquinas... com uma seta indicando o sentido que é a rua."
