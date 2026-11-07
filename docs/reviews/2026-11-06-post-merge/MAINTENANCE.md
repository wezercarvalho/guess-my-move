# Revisão final e manutenção

Entrega consolidada em revisão: PR #146 para main, em rascunho. A pedido do maintainer, as PRs #133, #139, #140, #141, #143, #144 e #145 foram substituídas pela consolidada, preservando branches, commits e evidências. Não é mais necessário integrar em sequência. Base integrada antes destes incrementos: 889d7650582c5562ff9807c612748e15c15ab47e. Revisão adicional autorizada pelo maintainer em 06/11/2026: revisar, adequar e organizar aperfeiçoamentos. Nenhum merge, deploy ou aceite humano foi executado pelo agente.

## O que foi conferido e adequado

| Área                   | Verificação e resultado                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admissão realtime      | Limites no handshake, duração da reserva até fechar o transporte e composição por processo; as proteções não foram movidas para uma superclasse de gateway.                                                                                                  |
| Recuperação de sessão  | Retentativas limitadas, segredo só no ACK privado e cancelamento por geração. Revisão adicional encontrou broadcasts de bolinhas aceitos sem identidade/depois da saída; PR #140 corrige o ciclo de estado provisório e acrescenta regressões.               |
| Fronteiras de frontend | Captura/quadros são compartilhados; entrada de cada jogo permanece própria; sessão Swing não conhece câmera/calibração. O contrato de transporte ClientSocket agora fica num módulo neutro, com reexport compatível, eliminando importação Swing → bolinhas. |
| Backend                | Projeções sem mutação e geração de objetivos por funções próprias; políticas compartilhadas por composição, sem executor genérico que misture erros dos jogos. Nenhuma mudança adicional de regra foi necessária nesta revisão.                              |
| Legibilidade           | Lobby Swing foi formatado para tornar visíveis formulários, estados e ações. A extração existente já separa decisões de rede, detectores e sinais; não se usa contagem de linhas como critério de qualidade.                                                 |
| Segurança do runtime   | O monitor verifica release publicada/suporte, tem fontes fixas e falha fechado; não confunde npm com binário Node nem instala versão futura. Trocar o pin seleciona testes de código e auditoria.                                                            |

A entrada de bolinhas passa a guardar o broadcast anterior ao ACK em estado privado e só o publica junto do acesso confirmado. Saída limpa a apresentação e o storage imediatamente; ACK/estado antigos não reabrem uma sala nem desconectam outra sessão. Entrada incerta tenta sair e fecha o transporte sem repetir criação automaticamente. Se o pacote de saída também se perder, a reserva desconectada segue o prazo do servidor; não há promessa de remoção instantânea nesse caso.

As evidências e comandos da correção ficam na spec 2026-11-06-frontend-multiplayer-recover-membership e na PR #140. A composição final é revalidada na última branch, incluindo os controladores extraídos. CI remoto fica pendente até a PR consolidada sair de draft; teste automatizado com detector simulado não equivale a câmera/GPU física ou medição de fluidez.

## Pendências organizadas

| Prioridade e natureza          | Resultado esperado                                                                                                                                                                                                       | Responsável / referência                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Aceite desta entrega           | Revisão da PR consolidada, CI ao sair de draft e decisão explícita do Gate 3; só então merge pelo maintainer.                                                                                                            | @wezercarvalho, PR #146 consolidada.                                               |
| Validação física desta entrega | Conferir pontos/espelhamento, olhar vertical, calibração e comportamento em partida com câmera real. Registrar ambiente e reprodução se houver falha.                                                                    | Maintainer, checklist abaixo.                                                      |
| P1, dependência de publicação  | Conferir patch Node anunciado para 11/11/2026 ou após, ler CVEs e aplicar/testar a versão real. Monitor/procedimento entregues não encerram a atualização do binário.                                                    | @wezercarvalho, [#132](https://github.com/wezercarvalho/guess-my-move/issues/132). |
| P2, aperfeiçoamento em triagem | Cobrir lobby/retomada/revanche de bolinhas com duas instâncias reais do cliente e servidor, complementando os transportes simulados. Escopo/aceite e limitações definidos, sem iniciar outra implementação do protocolo. | @wezercarvalho, [#148](https://github.com/wezercarvalho/guess-my-move/issues/148). |
| P2, investigação em triagem    | Medir carregamento e avaliar fracionamento do chunk 3D. O aviso de tamanho no build não demonstra causa de engasgos durante a partida.                                                                                   | @wezercarvalho, [#147](https://github.com/wezercarvalho/guess-my-move/issues/147). |

As duas melhorias P2 têm objetivo, escopo e critérios observáveis nas issues; não foram promovidas a Ready nem apresentadas como correções obrigatórias ainda não realizadas. Não há migração de framework, superclasse de jogos ou nova dependência proposta sem necessidade demonstrada. Violão continua em standby até dezembro; itens futuros em triagem mantêm seus prazos.

## Checklist de teste físico

- Câmera em resoluções/proporções diferentes: rosto e mãos devem coincidir com o vídeo contido, inclusive nas bordas; confirmar espelhamento e ausência de deslocamento lateral.
- Calibrar olhando ao centro, mover o olhar para cima/baixo e lados, recentralizar e alternar o modo de olhar. Conferir que perda temporária do rosto não mantém comando preso.
- Desligar e religar a câmera, inclusive durante carga do detector; navegar para fora e voltar. Não deve haver detector/callback antigo controlando a nova sessão.
- Online com duas pessoas: apelidos, presença e prontidão; pausa por queda, retomada da mesma vaga e nova partida na mesma sala. Em bolinhas, conferir a própria vez e ausência de disparo ao reconectar.
- Se houver engasgo, registrar jogo/modo, navegador, dispositivo, delegate, resolução e cenário, sem capturar/persistir mídia por padrão. Separar carregamento inicial, inferência e renderização antes de atribuir causa.

## Teste local da entrega consolidada

A PR #146 reaproveita a branch chore/node-runtime-monitor, que já contém todos os heads das sete entregas anteriores. O nome da branch é preservado para evitar cópias e manter rastreabilidade. Para baixar usando GitHub CLI, execute na raiz do clone, preservando antes qualquer alteração local:

```sh
git fetch origin
gh pr checkout 146
```

Usar o Node fixado em .node-version, instalar com yarn install --immutable e seguir docs/development-context/operations/local-development.md para iniciar web/servidor. Os comandos de referência para testar o multiplayer são yarn build, yarn dev:server e, em outro terminal, yarn dev:web. A API usa a porta 3000 e o Vite encaminha /api e /socket.io; conferir configuração de origens para outros dispositivos. Para câmera fora de localhost, o navegador exige contexto seguro. Não descartar mudanças locais nem usar reset/clean para trocar de branch.

As PRs anteriores são encerradas como substituídas, não como mescladas; suas branches são preservadas. Isso não depende do modo de merge da consolidada (merge commit, squash ou rebase). A descrição da PR #146 reúne os vínculos Closes das issues concluídas. #132, #147 e #148 continuam abertas; aceite formal SDD e validação física permanecem com o maintainer.
