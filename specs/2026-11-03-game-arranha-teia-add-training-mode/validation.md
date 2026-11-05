# Validação

## Entrega para teste

[PR #115 em rascunho](https://github.com/wezercarvalho/guess-my-move/pull/115), atribuída a `wezercarvalho`. Commit da implementação: `b5d836b`; sem merge ou publicação. Os gates locais passaram no Node 26. O CI remoto foi executado posteriormente; resultado registrado na revisão abaixo.

## Estado e intenção

Implementação disponível na branch `feat/108-arranha-teia-treino`, isolada da branch de bolinhas. A issue #108 foi executada conforme autorização do maintainer nesta conversa em 2026-11-03; Violão segue em standby. O usuário reservou para si a câmera real e o aceite de uso/visual.

## Implementação e regressões

- Seleção Treino/Viajante antes de jogar; Viajante preserva as cidades, links `?city=...` e o comportamento existente. `?mode=training` abre Aurora.
- Aurora é gerada em memória com colisão City v1, torres variadas, passarelas, néon, água e lua/planeta por geometria local. Não há mídia ou serviço externo nem dependência nova para o cenário.
- Spawn livre em `(0, 90, 0)`, primeira âncora alcançável/visível e parede larga, com testes de colisão e alcance. O teste usa o mesmo índice/seleção de âncora da aplicação.
- Exercícios cumulativos registrados por quadro antes do throttle do HUD; painel recolhível fora do centro. Reiniciar limpa o progresso. Não há tempo nem pontuação.
- Revisão independente do principal corrigiu vista inicial muito fechada e falso progresso de soltar ao entrar em agarre. Regressão cobre remoção automática de teia e agarre sem comando de liberação intencional.

## Test-first e comandos

Os testes de cenário/exercícios e seleção foram escritos antes da implementação. A primeira tentativa no host ficou bloqueada ao executar o wrapper Vitest porque o diretório temporário padrão é `noexec`; não se declara um vermelho comportamental que não foi observado nessa tentativa. O runtime e diretório temporário corretos foram configurados antes das validações posteriores.

- Ambiente principal de validação: imagem oficial `node:26.12.1-bookworm-slim`, Node 26.12.1, Corepack 0.36.0 e Yarn 4.18.1, com `yarn install --immutable` concluído. Nenhuma versão foi alterada.
- `yarn check:all` inicial passou: core 68, marbles 159, swing 227, web 412 Vitest + 78 auxiliares e build. Após o último ajuste de progresso/spawn, foram repetidos estáticos e os 12 testes direcionados de treino/seleção; o agregado final também passou: core 68, marbles 159, swing 227, web 413 Vitest + 78 auxiliares, typecheck, lint e build.
- O primeiro `test:gates` do contêiner falhou porque a imagem slim não tinha Git; não era falha do produto. O script passou no host (231 testes), e Git foi instalado no contêiner para repetir o gate na mesma configuração.
- `test:sdd` passou com 109 testes na execução inicial; a execução final também passou: `test:gates` 231, `test:sdd` 109, `sdd:check`, `docs:format:check` e `security:dependencies`, com nenhuma vulnerabilidade reportada.

## Resultado final

Todos os scripts oficiais aplicáveis passaram no Node 26.12.1: `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check` e `security:dependencies`. O teste de regressão que impede falso exercício de soltar faz parte da execução final.

[Resumo estruturado dos gates](evidence/node26-gates.json). O teste de câmera real permanece reservado ao maintainer e não é declarado executado.

## Demonstração e revisão visual

[Desktop](evidence/aurora-desktop.png), [mobile](evidence/aurora-mobile.png) e [resultado do navegador](evidence/browser-smoke.json).

Playwright/Chromium demonstrou treino com renderização WebGL, exercício esquerdo registrado pelo teclado, Viajante/cidades preservados e painel fora do centro. A página desktop de 1440 × 900 não tem rolagem global; a versão móvel empilha o conteúdo. Não houve erro de página nem requisição a terceiros no smoke. Isso é evidência em headless/teclado, não acurácia da câmera ou fps real.

## Pendências e teste do maintainer

- Testar `swing.html?mode=training` com câmera real e concluir cada exercício; conferir puxar/soltar, agarre, escalada pelo olhar e trava de direção.
- Avaliar cenário/cores e conforto dos vãos/âncoras; o visual final é decisão do maintainer.
- Conferir Viajante e links diretos das cidades, além de reiniciar e recolher o painel.

T006/Gate 3 aguardam esse aceite. A spec permanece `implementing`, conforme exigência do checker de que todas as tarefas estejam concluídas antes de `validating`/`validated`. Não houve merge nem publicação. Nenhuma afirmação de fps, latência ou precisão de gesto foi feita.

## Revisão antes da câmera — 2026-11-03

O [CI da PR #115](https://github.com/wezercarvalho/guess-my-move/actions/runs/41584346497) passou no commit `5c680a1f9b7e4d0c5372f079786da73c8dcf1abb`: `check:all`, governança e gate obrigatório verdes. A auditoria remota foi dispensada pelo filtro de paths, pois não houve mudança de dependências; a auditoria local anterior passou.

A revisão automatizada de 2026-11-03 de seleção/URLs, cenário/colisões e exercícios não identificou as regressões posteriormente relatadas no teste real de 2026-11-04. Ela não comprovava alinhamento ou fluidez da câmera. As evidências automatizadas e a demonstração de navegador acima cobrem SC-001. NFR-001–NFR-002 foram conferidos no código; SC-002/NFR-003 e T006 continuam aguardando câmera real e avaliação visual do maintainer.

A PR foi marcada pronta para executar o CI e retorna a rascunho para o teste reservado ao maintainer. Não houve merge nem publicação. Violão fica em standby até dezembro; os itens em triagem não foram antecipados nesta entrega.

## Correções após o teste com câmera — 2026-11-04

O maintainer encontrou deslocamento dos pontos, engasgos e dificuldade de olhar verticalmente. T006 permanece aberta para reteste; o aceite anterior não foi concedido. Bolinhas não foi alterado nesta correção e Violão segue em standby até dezembro.

### Causas reproduzidas e correções

- FR-005/T007: o CSS compacto usava `object-fit: cover`, mas mãos e rosto eram projetados com `containRect`. Restaurado `contain`, com o mesmo espelhamento do overlay. Vídeos 4:3 passam a ter barras laterais em vez de recorte/deslocamento.
- FR-006/T008: `resize.bind(controller)` criava callback novo em cada publicação do HUD. O efeito remontava o ResizeObserver e redimensionava WebGL/canvas sem mudar o palco. Callback agora é estável, e dimensões repetidas são ignoradas. O teste falhou com 23 observações em vez das 3 iniciais e passou após corrigir.
- FR-006/T008: os quatro detalhes de néon de cada prédio eram meshes separados. Agora são instâncias em três lotes por material, com as mesmas posições, escalas e colisões.
- FR-007/T009: calibração contava frames de tela repetindo a última leitura e não verificava estabilidade. Agora conta somente amostras novas, calcula o neutro médio numa janela estável e reinicia com movimento maior que 2°. A suavização continua a cada frame gráfico; não mudaram ganho, zona morta ou limites do olhar.
- FR-007/T009: extração de ângulos pelos elementos de eixos diferentes misturava roll com pitch/yaw. Agora usa o eixo frontal da matriz, removendo a escala; teste com rotação composta/escala preserva as direções e rejeita matrizes inválidas. O [formato MatrixData do MediaPipe](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/framework/formats/matrix_data.proto) define a ordem de coluna usada pelo adaptador.
- A tela orienta manter a cabeça parada durante a calibração e só permite Centralizar com orientação válida do rosto. O controlador também recusa centralização sem rosto; centralização não finge calibração sem leitura.

### Evidência e limites

Cinco regressões novas do núcleo falharam antes da implementação (227 anteriores passaram): quadro repetido, movimento durante calibração, centralização sem leitura, rotação composta e matriz inválida. O teste do ResizeObserver e o contrato do enquadramento também falharam antes das correções. Depois, a suíte do núcleo passou com 232 testes; testes direcionados de rosto/trava/escalada e tela passaram. O teste de tela cobre instrução de calibração e botão desativado sem rosto; o controlador cobre olhar para cima/baixo e calibração somente em imagens novas.

[Smoke de câmera no Chromium](evidence/camera-regression-smoke.json): vídeo local de canvas e detectores simulados demonstraram 640×480 e 1280×720, ponto verde no pixel esperado e caixas coincidentes de vídeo/overlay; olhar positivo/negativo, bloqueio sem rosto e centralização redefinindo o neutro. O renderer foi simulado nesse smoke para isolar a câmera; nenhum rosto, imagem pessoal ou landmark real foi salvo. As tentativas iniciais do harness usaram esperas fixas e amostragem separada de pixels; foram substituídas por observação atômica do quadro válido e espera pela calibração. Não representam teste da qualidade do MediaPipe real.

[Contagens gráficas](evidence/camera-regression-render-cost.json): WebGL real, headless, Aurora parada, viewport 1440×900. Antes do batching: 1245 chamadas/15 quadros = 83 por quadro; depois: 72/6 = 12 por quadro. O resize repetido observado na linha de base foi 18 vezes em 2 segundos, e cessou após estabilizar callback/dimensões. Essas são contagens desta cena; renderização por software e amostras curtas não medem fps do usuário, latência do detector ou ganho geral de desempenho.

As verificações anteriores não cobriam essas regressões; o relato do maintainer foi necessário para reproduzi-las. Não há alegação de fluidez ou precisão com câmera real até o reteste. A primeira execução agregada desta correção excedeu 5 s no teste preexistente de 3000 tiros do bot, enquanto o navegador e outros testes rodavam juntos. Não se mudou bolinhas nem timeout para contornar isso; execução final isolada registrada abaixo.

### Gates finais desta correção

- `yarn install --immutable` e `yarn check:all` passaram na imagem oficial `node:26.12.1-bookworm-slim` (Node 26.12.1, Corepack 0.36.0, Yarn 4.18.1): core 68, marbles 159, swing 232, web 417 Vitest + 79 auxiliares, typecheck, lint e build.
- O agregado do host continuou excedendo 5 s no teste preexistente de 3000 tiros de bolinhas, inclusive numa repetição sem navegador. A mesma árvore de aplicação passou no contêiner; nenhuma mudança foi feita em bolinhas, timeout ou dependências. Essa diferença de ambiente não é apresentada como correção daquele teste.
- `yarn test:gates` (231), `yarn test:sdd` (109), `yarn sdd:check` e `yarn security:dependencies` passaram no host com Node 26.12.1. Auditoria: todas as severidades zero. Formatação dos docs verificada pelo hook de pré-push.
- [Resumo estruturado desta correção](evidence/camera-regression-gates.json). Os avisos preexistentes de canvas no jsdom e chunk maior que 500 kB não falharam o agregado.
- A PR #115 permanece em rascunho; o workflow remoto ignora rascunhos. O CI verde de `6ccc9bc` acima é histórico, não valida este novo código; não houve novo ciclo de ready nem merge. A conclusão desta correção se apoia nos gates locais completos e na demonstração, não no CI antigo.

### Reteste reservado ao maintainer

Na branch `feat/108-arranha-teia-treino`, abrir `swing.html?mode=training` e recarregar completamente a página para substituir a instância antiga do controlador. Ativar a câmera, olhar para a tela e manter a cabeça parada até terminar a calibração. Conferir pontos sobre mãos e rosto; olhar para cima/baixo, clicar Centralizar numa posição confortável, testar trava e escalada. Comparar a fluidez com câmera desligada e ligada; repetir em uma cidade do modo Viajante. Informar se ainda houver engasgos, junto com navegador/dispositivo e em qual modo ocorrem. T006/SC-002 e o aceite de precisão/fluidez reais permanecem pendentes.

## Integração com a main — 2026-11-05

Após o merge da PR #114, a PR #115 apresentou conflito no catálogo `specs/README.md`: as duas iniciativas adicionaram entradas no mesmo ponto. A resolução preserva ambas em ordem cronológica e integra `origin/main` em `c09b6b1`, sem reescrever o histórico da branch. Não houve conflito em código de aplicação. O diff em relação à main foi conferido: servidor, bolinhas, protocolo, manifesto e lockfile permanecem iguais à base integrada; as alterações de treino/câmera do Arranha-Teia foram preservadas.

A instalação imutável foi repetida após incorporar o servidor e suas dependências. O agregado completo `yarn check:all` passou na imagem oficial Node 26.12.1, incluindo as duas frentes: core 68, marbles 174, servidor 27, swing 232, web 453 Vitest + 79 auxiliares, tipos, lint e build. `test:gates` (231) e `test:sdd` (109) também passaram; checker, formatação e auditoria são verificados no hook de pré-push. O aceite de câmera/visual T006 continua com o maintainer; esta integração não o antecipa.
