# API, contratos e observabilidade do backend

O backend usa NestJS com `NodeAdapter`, diretamente sobre o HTTP do Node.js. A factory compartilhada por produção e testes mantém as configurações de headers, CORS, encerramento e instrumentação. O multiplayer continua usando Socket.IO.

## HTTP para outros frontends

O contrato [OpenAPI 3.1 versionado](../../../contracts/http.openapi.json) pode ser importado em ferramentas de documentação e geração de clientes de qualquer linguagem. Configure a URL base do cliente para a origem do backend; o documento não fixa um domínio de produção.

| Método e caminho                 | Uso                                                                          | Acesso                                                              |
| -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/health`                | Vida do processo; não comprova capacidade ou readiness.                      | Público.                                                            |
| `GET /api/capabilities`          | Modos disponíveis, versão do protocolo e configuração pública do transporte. | Público.                                                            |
| `GET /api/contracts/multiplayer` | Contrato dos eventos e acknowledgements Socket.IO.                           | Público, apenas schemas; sem dados de salas.                        |
| `GET /api/metrics`               | Contadores e durações agregadas desde a inicialização.                       | Bearer token exclusivo de operação; desativado sem `METRICS_TOKEN`. |

Com `ENABLE_API_DOCS=true`, `GET /api/openapi.json` serve o mesmo documento HTTP. Sem essa opção, a rota devolve 404. O artefato versionado continua disponível para integrações e CI.

Os interceptores de medição e serialização são aplicados somente aos controllers HTTP. Isso mantém eventos Socket.IO fora de uma cadeia HTTP e preserva o contexto de tracing até a execução do comando. As respostas de health, capacidades e métricas passam pelo `StandardSchemaSerializerInterceptor` do Nest e pelos schemas Zod usados para produzir o OpenAPI. Respostas inválidas falham em vez de publicar silenciosamente um formato divergente. O gate compara documentos e verifica a cobertura das rotas HTTP reais.

CORS aceita as origens de `ALLOWED_ORIGINS`, com HTTP GET/HEAD/POST e headers Content-Type/Authorization. Para um frontend em outra origem, inclua a origem exata na configuração. CORS não é autenticação; métricas continuam exigindo token, e os eventos continuam sujeitos à política de origem e aos limites de admissão.

## Cartas competitivas

O OpenAPI também descreve início, observação escalar e cancelamento em `POST /api/cards/rounds`, `POST /api/cards/rounds/{id}/observe` e `POST /api/cards/rounds/{id}/cancel`. Os mesmos schemas de `packages/core` validam os corpos e serializam as respostas. O token de rodada é privado e efêmero, distinto do token de métricas; nunca aparece no snapshot público. Estado, tempo e pontos são calculados no servidor. Limites, privacidade e restrições de integridade no [guia das cartas](../../games.md#cartas-de-gestos).

## Eventos de jogo

O [contrato Socket.IO versionado](../../../contracts/multiplayer.socketio.json) deriva dos schemas compartilhados de `packages/marbles`. Ele identifica transporte, namespace, caminho, mensagens de entrada e saída e formato do acknowledgement. **Use um cliente Socket.IO compatível com a versão 4 e transporte `websocket`**; WebSocket puro não implementa esse protocolo.

O OpenAPI descreve as operações HTTP da tabela. Criar sala, entrar, ficar pronto, retomar, pedir revanche, atirar e sair são eventos Socket.IO, não rotas REST.

Um frontend pode seguir este fluxo:

1. Consultar `/api/capabilities` para obter modos e metadados públicos.
2. Conectar o cliente Socket.IO à origem do backend, no caminho e namespace declarados.
3. Enviar `room:create` ou `room:join`, com modo/apelido ou código/apelido, e tratar o acknowledgement.
4. Ouvir `room:state` e `protocol:error`; confirmar prontidão e enviar tiros apenas na própria vez.
5. Guardar a credencial de retomada somente no contexto da própria pessoa. `access` pertence ao acknowledgement privado: nunca publicar ou retransmitir `resumeToken`.
6. Ao terminar, confirmar `room:rematch` com o número da partida atual; as duas confirmações iniciam outra partida na mesma sala.

Os schemas JSON descrevem a estrutura dos dados. A seção `constraints` e a descrição de normalização registram regras adicionais: limite da magnitude do vetor, tamanho da mensagem, orçamento de comandos e comprimento do apelido após NFKC, trim e colapso de espaços. Regras de vez, fase e sequência também são verificadas pelo servidor. A validação no cliente complementa a validação autoritativa.

Em clientes TypeScript do monorepo, os tipos e schemas de `@guess-my-move/marbles` continuam compartilhados. Outros clientes podem usar os arquivos JSON e suas ferramentas de JSON Schema sem importar React, câmera ou o código da interface.

## Exportação e revisão de compatibilidade

Na raiz, após a instalação das dependências:

```sh
yarn contracts:export
yarn contracts:check
```

Os comandos compilam as dependências necessárias e exportam ou conferem os documentos sem iniciar uma porta pública, instanciar a aplicação ou enviar telemetria. A geração é determinística e não inclui configuração privada nem valores de sessões.

Mudanças em `contracts/` selecionam o gate de código. Os testes do backend detectam arquivos ausentes/divergentes e endpoints HTTP sem representação. O gate detecta divergência, mas não substitui a revisão de compatibilidade: ao mudar um protocolo, revise os consumidores e o diff dos contratos antes do merge.

## Métricas locais

Defina um token aleatório de pelo menos 32 caracteres no ambiente do processo e consulte `/api/metrics` com `Authorization: Bearer <token>`. A credencial pertence à operação, não ao frontend público ou ao jogador. Não a coloque em query string, código versionado, bundle web ou logs. Sem token configurado, o endpoint responde 404; token incorreto ou ausente responde 401 quando o endpoint está habilitado.

O retrato agrega os dois jogos e contém conexões e salas ativas, recusas, expirações, falhas internas, maior atraso observado do ciclo e estatísticas por operação conhecida: quantidade, erros/recusas, soma das durações e duração máxima. São agregados desde o início do processo; não são histórico persistido nem uma promessa de latência. A lista de operações é limitada para impedir cardinalidade por dados do cliente. Não há nomes, códigos de sala, tokens, IPs, mídia ou landmarks.

Os resumos estruturados locais continuam funcionando com a coleta externa desativada. Dimensione limites com observação e testes de carga no ambiente real antes de publicar.

## Integração opcional com Nest Observe

O SDK oficial é ligado pelo hook de instrumentação do Nest. `OBSERVE_ENABLED=false` é o padrão, inclusive em produção: nenhum envio depende implicitamente de `NODE_ENV`. Nessa configuração, não há requisições ao coletor e não são necessárias credenciais.

Para uma ativação posterior pelo operador, são necessários `OBSERVE_ENABLED=true`, `OBSERVE_APP_KEY` e `OBSERVE_APP_SECRET`. O backend falha no boot se a ativação estiver incompleta. O endpoint padrão é o serviço hospedado oficial; `OBSERVE_ENDPOINT` pode apontar para um proxy HTTPS ou um stub de teste em loopback. Nenhum serviço, conta ou plano é ativado por esta entrega. Consulte o [SDK oficial](https://docs.nestjs.com/observability/sdk) para configurar sua conta e avaliar o uso.

A política da aplicação limita o que pode sair:

- Sem encaminhamento de logs, captura de corpo/headers, identificação de usuário, código-fonte de erros ou instrumentação de chamadas externas.
- Somente controllers HTTP e o gateway explicitamente revisados produzem spans de método, sem captura de argumentos ou retornos. Serviços de domínio, configuração e telemetria ficam excluídos. Operações usam nomes fixos; métricas customizadas usam contadores e durações.
- URLs com query e caminhos arbitrários não são instrumentados; o endpoint de métricas fica fora do tracing HTTP. IDs de correlação HTTP são gerados pelo servidor.
- Mensagens e stacks arbitrários de erro são integralmente redigidos antes do envio. Dados de câmera não chegam ao backend.
- `OBSERVE_SAMPLE_RATE` aceita de `0.001` a `1`, com padrão `0.1`. As métricas agregadas não dependem da amostragem de traces. `0` é recusado para evitar a semântica do SDK que o interpreta como padrão.
- Métricas de runtime são agregadas; profiling não é habilitado. O encerramento dá ao SDK um orçamento limitado para flush.

Os testes usam um coletor HTTP local simulado, inspecionam os batches descomprimidos, verificam o modo desativado e procuram sentinelas privadas sob amostragem completa. Eles não comprovam a configuração de uma conta ou painel real.

## Recursos do Nest adotados nesta entrega

| Recurso                      | Aplicação no projeto                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| HTTP nativo                  | Mesmo adaptador na execução, inicialização e testes Socket.IO.                       |
| Serialização Standard Schema | Respostas HTTP conferidas contra os schemas publicados.                              |
| Instrumentação e SDK Observe | Integração opcional com política de coleta restrita e métricas locais independentes. |
| Diagnóstico de rotas         | Duplicatas são erro de inicialização; sobreposição gera aviso.                       |
| Encerramento HTTP            | Recusa de novas requisições durante fechamento e fechamento de conexões HTTP.        |

Filas, outbox, workflows duráveis e locks distribuídos precisam de uma demanda de produto ou operação antes de entrar neste backend efêmero de uma instância. A troca do adaptador não constitui medição de desempenho nem correção de reconhecimento de câmera.

## Contrato cooperativo do Arranha-Teia

`GET /api/contracts/swing` e `contracts/swing.socketio.json` descrevem o namespace `/swing`. `GET /api/capabilities` mantém os campos legados de bolinhas e adiciona `games`, com namespace, contrato, cidades e cooperação de dois participantes. Os scripts de exportação/conferência incluem os três documentos.

Eventos `swing:create/join/resume/ready/input/rematch/leave` recebem schemas estritos; `swing:state` publica o snapshot e `swing:error` comunica expiração. Inputs contêm partida, sequência e controles; o cliente não envia posições ou resultados. ACKs de acesso são privados. O servidor neutraliza input antigo após 350 ms; snapshots são publicados a 10 Hz e há limite de 20 comandos/s. Atualizações de lobby podem ser imediatas. Operações `swing:*` entram na lista limitada de métricas e na instrumentação revisada do gateway; a inspeção de batches inclui esse domínio.

A credencial do swing permanece só em memória, diferentemente do armazenamento por aba usado pelas bolinhas. Clientes devem ignorar snapshots de outra sala, partida anterior ou tick anterior; após expiração devem limpar acesso e voltar ao lobby. Não tratar o schema de estado como autorização para transmitir estado: somente o servidor publica `swing:state`.

### Recuperação do cliente cooperativo

Desconexões invalidam a geração de comandos em andamento e cancelam seus timers; ACKs de conexões anteriores não podem restaurar acesso ou sobrescrever uma retomada nova. Um snapshot recebido antes do ACK de criação/entrada ainda não confirma acesso: se houver queda, esse estado provisório é descartado. Credenciais já confirmadas permanecem somente em memória para a retomada.

Enquanto conectado e jogando, o cliente observa progresso de partida/tick. Após 2 s sem progresso, mostra espera pelo servidor e suspende intents; snapshots duplicados, obsoletos ou de outra sala não renovam essa janela. Um estado novo remove o aviso e retoma o envio. Pausa, saída, expiração e desmontagem limpam o watchdog. Esse prazo é um limiar de feedback, não SLA de rede nem medição de latência.

## Reconciliação de participação após perda de ACK

`swing:recover` recebe `{}` estrito e devolve no ACK privado somente o acesso da participação já associada ao socket chamador. Não recebe código de sala nem token de outra pessoa, não cria sala e não renova inatividade. Estado público e métricas continuam sem credenciais. O cliente usa essa consulta após ACK perdido de create/join, sem repetir automaticamente a criação.

Retomada pode ser repetida pelo mesmo socket com o mesmo token sem modificar a atividade; outro socket conectado ou token incorreto continuam recusados. Os clientes invalidam respostas de gerações anteriores e limitam as tentativas automáticas. Após falha persistente, o cooperativo mantém credencial conhecida e oferece retomada explícita; uma entrada sem identidade é abandonada com leave e encerramento do transporte, sujeita à janela normal de expiração se o abandono também não puder ser confirmado.

## Capacidade do transporte e dos namespaces

O handshake Engine.IO reserva capacidade antes de autorizar o WebSocket. `MAX_CONNECTIONS` e `MAX_CONNECTIONS_PER_IP` limitam, separadamente, transportes físicos e sessões de namespace, com os mesmos valores configurados. `activeTransports` conta conexões físicas, inclusive as que ainda não enviaram CONNECT; `activeConnections` preserva o significado de sessões admitidas nos namespaces. Um transporte multiplexado nos dois jogos conta uma vez em `activeTransports` e duas em `activeConnections`. `acceptedConnections` continua contando admissões de namespace; recusas de capacidade no handshake também incrementam `rejectedConnections`.

O fechamento físico libera a reserva, inclusive após falha de upgrade e timeout. Socket.IO encerra transportes que não entram em namespace em 45 segundos; esse prazo não é a janela de reconexão de 60 segundos da sala. Cabeçalhos de endereço só são considerados quando o peer é proxy explicitamente confiável. WebSocket é exclusivo; habilitar polling exigirá revisar a reserva por socket TCP. Esses tetos são por processo e não protegem TCP anterior ao handshake nem abuso distribuído.
