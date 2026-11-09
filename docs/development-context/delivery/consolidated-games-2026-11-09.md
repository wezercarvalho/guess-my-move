# Entrega consolidada dos jogos — 2026-11-09

O maintainer solicitou reunir as PRs #105, #151, #152, #153 e #154 em uma única PR em draft para testar e realizar um único merge. A branch `codex/consolidate-game-deliveries` parte da main `b9335d5` e preserva, por merges locais, os cinco históricos de desenvolvimento.

## Escopo e procedência

| Origem | Commit incorporado                         | Entrega                                                                |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------- |
| #105   | `d1e040ec8cb3bf6f104b6bb677566f8d24d2c67e` | Violão no Ar alpha, cinco acordes, captura, áudio, CSP e depuração     |
| #151   | `5b97ff64d5a049b2f4b153493628bf8054d68462` | Cliente e servidor reais no teste de integração do lobby de bolinhas   |
| #152   | `26d2a98db52304fc9f1fb034e2768aac5d3f03b2` | Estudo reproduzível do bundle 3D; build de produção preservado         |
| #153   | `dea7f65d31e8c2fe61a80f19687f2781d459d828` | Documentação dos lançamentos futuros de Node e TypeScript              |
| #154   | `5c8a2d444d1a09a6c750adad2401d8ff206104d0` | Baralho, idiomas, competitivo com tempo/pontos no servidor e contratos |

## Decisões de integração

- Unir os scripts web: preservar testes de privacidade do Violão, testes/smoke de cartas e typecheck/build/perfil experimental do 3D.
- Preservar a integração real do lobby no agregado do servidor, seu typecheck próprio e o smoke do servidor compilado ao final de `check:all`.
- Manter as entradas das cinco páginas, o proxy HTTP/Socket.IO e o pacote guitar junto das dependências core/marbles/swing.
- Corrigir a tabela do README para incluir o quarto jogo na mesma tabela; atualizar a descrição do menu para o baralho ampliado.
- Sem alteração de regras, limiares, contratos ou pins de runtime como parte da consolidação. As decisões de produto continuam nas specs de origem.

## Validação do conjunto

A instalação imutável foi executada no worktree novo e no ambiente Linux isolado (Node 26.12.1, Yarn 4.18.1); o hook de pré-push foi instalado. O código foi conferido sobre a main `b9335d5`, que permanecia atual antes da publicação. Todos os cinco commits da tabela são ancestrais da branch consolidada.

| Verificação                                       | Resultado                                                                                                                                                                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn check:all`                                  | PASS: tipos, lint, testes, build de todos os workspaces e smoke do servidor compilado                                                                                                                                                                    |
| Testes da aplicação/scripts                       | **1.400 passando**: 71 core, 84 guitar, 174 marbles, 264 swing, 104 server + 4 lobby real, 612 web + 87 scripts Node                                                                                                                                     |
| Backend compilado                                 | DI/metadados, health 200, início de cartas 201, payload inválido 400 e cancelamento 200                                                                                                                                                                  |
| `yarn contracts:check`                            | OpenAPI HTTP e contratos Socket.IO de bolinhas/Swing sincronizados                                                                                                                                                                                       |
| `yarn workspace @guess-my-move/web build:profile` | Build experimental do estudo 3D continua compilando com todas as entradas                                                                                                                                                                                |
| SDD e formatação                                  | `sdd:check`, `docs:format:check`, 109 testes SDD e 241 testes de gates aprovados                                                                                                                                                                         |
| Segurança                                         | Dependências: zero ocorrências em todas as severidades; runtime aprovado segundo releases publicadas, sem trocar pins                                                                                                                                    |
| Navegador: cartas                                 | Chromium 156, seleção/categorias, português/inglês, preferência após reload, câmera sintética/MediaPipe real, API compilada, timeout com zero pontos e parada da câmera; 40 requisições no fluxo conferido                                               |
| Navegador: Violão                                 | Primeiro clique agenda seis cordas e o segundo mais seis; câmera para/reativa, vídeo/overlay alinhados, três colunas desktop/uma estreita, sem overflow nos estados conferidos, sem erros JavaScript; CSP bloqueia duas tentativas de telemetria externa |

Resultados numéricos: [cartas](evidence/consolidated-2026-11-09-cards.json) e [Violão](evidence/consolidated-2026-11-09-guitar.json). Nenhum desses artefatos contém imagens, áudio, tokens ou amostras de sinais de pessoas. Os testes de navegador usam câmera sintética e WebGL por software, sem medir precisão com mãos reais, FPS em GPU física ou latência acústica.

O aviso de chunk grande do Arranha-Teia e os avisos de canvas/`act` no ambiente de testes permanecem registrados; não são falhas dos comandos. A decisão de manter o bundle continua restrita às medições históricas do estudo, sem prometer ganho de fluidez pela consolidação. O CI remoto aguarda a saída de draft.

## Revisão e fechamento

Depois de a PR consolidada estar aberta e conferida em draft, as cinco PRs de origem são encerradas como substituídas, com referência à entrega vigente e sem remover branches. O fechamento evita depender de merge versus squash para recolher PRs antigas. O maintainer faz apenas o merge da consolidada na main.

A descrição da PR vigente transfere os vínculos de fechamento das issues #18, #19, #96–#104, #147 e #148. As issues permanecem abertas até o merge.

- #95 permanece aberta para o registro do reteste com mãos/câmera reais e aceite do Violão (SC-003). Aprovação dos gates de desenvolvimento não é evidência física.
- #52 e #132 permanecem abertas: esta entrega documenta acompanhamento, sem instalar versões futuras nem afirmar que os lançamentos pendentes foram entregues.
- O `pr-gate` remoto roda quando a PR sair de draft. O maintainer aguarda o gate e realiza o merge; esta consolidação não faz deploy nem merge na main.

## Conferência rápida pelo maintainer

1. Instalar dependências com `yarn install --immutable` e iniciar web/backend conforme o README.
2. Conferir os quatro jogos no menu e navegar entre páginas.
3. No Violão, testar cinco acordes, troca, batidas para cima/baixo, mão esquerda/direita, parada/reinício de câmera e ajuste do braço.
4. Em cartas, testar seleção, português/inglês, treino e competitivo, prazo/pontos e cancelamento.
5. Em bolinhas, conferir entrada da dupla, identidade, prontidão, vez, reconexão e revanche. O teste de integração cobre protocolo real, não câmera física/rede pública.
6. No Arranha-Teia, conferir seleção/treino/cooperativo. A investigação de bundle não promete aumento de FPS nem altera a configuração de produção.
