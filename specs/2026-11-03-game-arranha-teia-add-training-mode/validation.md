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

A revisão adicional de seleção/URLs (FR-001), cenário/colisões/alcance (FR-002), exercícios e painel (FR-003–FR-004) não identificou nova correção necessária. As evidências automatizadas e a demonstração de navegador acima cobrem SC-001. NFR-001–NFR-002 foram conferidos no código; SC-002/NFR-003 e T006 continuam aguardando câmera real e avaliação visual do maintainer.

A PR foi marcada pronta para executar o CI e retorna a rascunho para o teste reservado ao maintainer. Não houve merge nem publicação. Violão fica em standby até dezembro; os itens em triagem não foram antecipados nesta entrega.
