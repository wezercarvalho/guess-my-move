# Desenvolvimento local

## Requisitos

- Node.js 26.12.1 ou superior da linha 26 (`.node-version`) e Yarn 4.18 via Corepack. O Node 26 não distribui o Corepack: rode `npm install --global corepack@0.36.0` e depois `corepack enable`.
- Instalação das dependências na raiz: `yarn install --immutable` instala a raiz e todos os workspaces (`apps/web`, `packages/core`) de uma vez.

## Verificações locais antes do push

O repositório não tem workflow de CI por `push` em branches de trabalho; quem faz a verificação rápida é o hook de Git `.githooks/pre-push`, um launcher `sh` que chama `node scripts/git-hooks/pre-push.mjs`. Ele usa só Node e Git e não adiciona dependência. O `AGENTS.md` manda instalá-lo antes do primeiro push.

**Instalação.** Na raiz, uma vez por clone: `node scripts/git-hooks/install.mjs`. O comando configura `core.hooksPath` para `.githooks` e é idempotente.

**O que o hook roda.** Ele calcula os arquivos do intervalo enviado (em branch nova, contra o merge-base com `origin/main`) e roda, por escopo afetado, os mesmos comandos do `pr-gate`, na ordem:

1. `sdd`: `yarn test:sdd` e `yarn sdd:check` (como os passos do job de governança `sdd`);
2. `root-docs`: `yarn docs:format:check`, Prettier com o estilo de `/.prettierrc` em `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` e `specs/`;
3. `tooling`: `yarn test:gates`, testes do hook, do auditor e dos workflows;
4. `code`: `yarn check:static` (typecheck + lint) por padrão, ou `yarn check:all` (typecheck + lint + test + build) no `--mode full`, quando o PR toca `apps/`, `packages/`, manifesto/lockfile, `tsconfig*.json`, `.oxlintrc.json` ou `.env.example`;
5. `audit`: `yarn security:dependencies`, se os arquivos casarem o padrão de auditoria do `pr-gate`.

Um push sem arquivos nesses escopos termina em segundos, sem rodar nada. Falha em qualquer passo barra o push, com a mensagem do passo. O gate remoto roda sempre o `yarn check:all` do escopo de código; o hook roda `check:static` por padrão para falhar rápido.

**Auditoria de dependências.** Ela roda `yarn npm audit` na sua máquina (uma vez por ambiente, produção e tooling), não consome minutos de Actions e usa rede (consulta o registry). Vulnerabilidade High ou Critical barra o push e a saída do auditor aparece. Se o registry ou a rede falhar, o auditor imprime `registry-indisponivel` e diz que o problema não é vulnerabilidade: o hook só avisa, não barra, e informa que o `pr-gate` fará a verificação. A política está em [auditoria de dependências](../security/dependency-audit.md).

**Requisito.** As dependências precisam estar instaladas. Sem `node_modules`, o hook barra o push e informa o comando (`yarn install --immutable`).

**Sob demanda.** `node scripts/git-hooks/local-checks.mjs` roda o mesmo núcleo do hook para o que mudou em relação ao merge-base com `origin/main` mais o working tree. Aceita `--mode static|full` (o escopo de código roda `yarn check:static` em `static` e `yarn check:all` em `full`) e `--files <arquivos>`.

**Contorno.** `git push --no-verify` ignora o hook. Ele é opcional por natureza: o `pr-gate` remoto continua valendo e barra o merge se falhar.

**O que só o CI cobre.** O `pr-gate / gate` como decisão de merge e a rotina quinzenal de auditoria na `main`. Para o desenho completo, ver [Pipeline de CI](../delivery/ci-pipeline.md#o-que-roda-onde).

## Scripts de governança

| Script                       | O que faz                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `yarn sdd:check`             | Verificação estrutural do catálogo de specs, estados, gates e links.           |
| `yarn test:sdd`              | Testes do checker do SDD e da consolidação de resultados do gate.              |
| `yarn docs:format:check`     | Prettier `--check` nos documentos da raiz.                                     |
| `yarn docs:format:fix`       | Prettier `--write` nos mesmos documentos (escreve arquivos; nunca roda no CI). |
| `yarn test:gates`            | Testes do hook, do auditor de dependências e da estrutura dos workflows.       |
| `yarn security:dependencies` | Auditoria de dependências (usa rede).                                          |

## Bolinhas multiplayer em desenvolvimento

Execute `yarn dev:server` e `yarn dev:web` em terminais separados. O servidor usa `PORT=3000`, `MAX_ROOMS=100` e `SERVER_TICK_MS=33` por padrão; o proxy Vite de `/socket.io` (WebSocket) e `/api` aponta para `127.0.0.1:3000`. Se alterar `PORT`, alinhe o proxy local. Abra `/marbles.html` em dois contextos de navegador: Online → criar/entrar por código → prontidão. Cada aba guarda a credencial de retomada em `sessionStorage`; sair da sala a limpa. Queda pausa por 60 s, reload retoma; reiniciar o servidor perde as salas.

Para executar o compilado: `yarn build` e `yarn workspace @guess-my-move/server start`. O build não inicia nem publica o servidor. Teste a rede local antes de expor uma instância; nenhuma imagem ou landmark deve aparecer nos frames WebSocket. O modo local independe do servidor.

## Arranha-Teia cooperativo em desenvolvimento

Os mesmos comandos e proxy atendem `/swing.html` → **Cooperativo online**. Use duas abas/contextos, crie uma sala com apelido/cidade e entre com código; ambas confirmam prontidão. Aurora e os três mapas reais estão disponíveis. Somente inputs derivados de controles são enviados; o servidor mantém física e objetivos. A credencial de retomada existe apenas em memória: reconnect automático funciona enquanto a página existe, reload não recupera a vaga. Prontidão repetida e inputs neutros não renovam o prazo de inatividade.

`dev:server` compila e acompanha tanto marbles quanto swing antes de iniciar o servidor. O backend lê os JSON de cidades em `apps/web/public/swing`; preserve essa estrutura ao empacotar o monorepo. Não aceita paths fornecidos pelo cliente. Para verificar outra origem, configure `ALLOWED_ORIGINS`; Engine.IO valida inclusive a primeira conexão direta a `/swing`.

## Limites e operação do multiplayer

`yarn dev:server` compila primeiro `packages/core`, `packages/marbles`, `packages/swing` e o servidor, e acompanha alterações desses workspaces. Nenhum build anterior precisa existir. Se um compilador falhar no preparo, o comando encerra com erro; só o frontend continua independente do servidor.

A configuração de exemplo está em [`apps/server/.env.example`](../../../apps/server/.env.example). O servidor lê o ambiente do processo; esse arquivo não é carregado automaticamente. Exporte as variáveis no terminal ou configure-as no gerenciador do processo. Valores inválidos impedem a inicialização.

| Variável                   | Padrão                                        | Significado                                                                                   |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ROOM_WAITING_TIMEOUT_MS`  | `300000`                                      | Inatividade em sala esperando entrada ou prontidão.                                           |
| `ROOM_IDLE_TIMEOUT_MS`     | `900000`                                      | Inatividade durante uma partida.                                                              |
| `ROOM_FINISHED_TIMEOUT_MS` | `300000`                                      | Janela de inatividade após o resultado, para revanche.                                        |
| `MAX_CONNECTIONS`          | `200`                                         | Total de conexões admitidas no namespace.                                                     |
| `MAX_CONNECTIONS_PER_IP`   | `10`                                          | Total simultâneo por endereço de origem.                                                      |
| `ROOM_ATTEMPTS_PER_MINUTE` | `20`                                          | Orçamento agregado de criação, entrada e retomada por endereço, inclusive comandos inválidos. |
| `MAX_TRACKED_ADDRESSES`    | `10000`                                       | Teto das chaves do orçamento; novas chaves são recusadas enquanto não houver capacidade.      |
| `ALLOWED_ORIGINS`          | `http://localhost:5173,http://127.0.0.1:5173` | Origens HTTP(S) exatas aceitas no handshake. Sem caminhos, barra final ou curingas.           |
| `ALLOW_ORIGINLESS_CLIENTS` | `false`                                       | Aceitar clientes sem cabeçalho de origem apenas se explicitamente habilitado.                 |
| `TRUSTED_PROXY_IPS`        | omitida                                       | Lista de IPs explícitos dos proxies confiáveis, separada por vírgulas.                        |

Leituras, pings, comandos recusados e confirmações idempotentes não renovam a atividade da sala. Jogadas em movimento e ações válidas renovam o prazo. A pausa conserva a janela de reconexão de 60 segundos; retomar validamente renova a atividade. Ao expirar, o servidor informa aos participantes e libera a sala. Revanche continua exigindo as duas confirmações, dentro da janela configurada.

O limite por endereço pode afetar várias pessoas na mesma rede. Dimensione-o para o uso previsto. Sem proxy confiável configurado, vale somente o endereço da conexão direta. Atrás de proxy, cadastre somente os IPs dos intermediários sob seu controle e configure-os para sobrescrever/anexar corretamente `X-Forwarded-For`. A aplicação percorre a cadeia a partir do peer até o primeiro endereço não confiável; cadeias inválidas são ignoradas. Não habilite confiança irrestrita em cabeçalhos do cliente. Um proxy não cadastrado faz todos os jogadores parecerem vir do mesmo endereço.

A política de origem restringe navegadores; programas externos podem enviar uma origem permitida. Ela não substitui os limites de conexão, o orçamento de comandos nem proteção na borda. A capacidade é em memória e por instância: não é proteção contra abuso distribuído. Conexões de transporte antes da admissão do namespace também devem ser limitadas no proxy público. HTTPS, cabeçalhos da origem que serve o frontend e proteção de rede precisam ser configurados na hospedagem; esta entrega não publica uma instância.

Erros inesperados geram apenas evento, operação conhecida e correlação aleatória; não incluem mensagem bruta, stack, mídia, apelidos, tokens, IP ou payload. Um resumo por minuto apresenta contadores agregados de conexões, recusas, expirações e maior atraso observado do ciclo. O endpoint `/api/health` segue sendo liveness, sem expor salas ou métricas; ele não comprova capacidade nem prontidão para tráfego público.

## Contratos e observabilidade

Veja [API e observabilidade](../contracts/backend-api.md) para os scripts de contratos, `ENABLE_API_DOCS`, `METRICS_TOKEN` e as opções `OBSERVE_*`. Métricas locais exigem token próprio; o SDK externo fica desativado por padrão.

`MAX_ROOMS` é um orçamento agregado entre bolinhas e Arranha-Teia. Conexões e tentativas também são agregadas entre namespaces. O máximo não é uma medição de capacidade: valide carga e uso de memória no ambiente real antes de dimensionar produção.

## Medição exploratória de carga cooperativa

`yarn load:swing` compila as dependências e inicia um backend isolado em porta aleatória de loopback, com clientes Socket.IO locais. Não recebe URL de servidor externo nem mede uma instância de produção. O padrão usa 2/10/20 salas, duas pessoas por sala, duas réplicas, aquecimento de 3 s e medição de 15 s por rodada. `yarn workspace @guess-my-move/server load:swing --output /tmp/swing-load.json` pode salvar agregados após os builds.

O experimento desativa o SDK externo e ajusta limites por IP somente no processo filho porque todos os participantes simulados usam loopback. Não modifica defaults de produção. Inclui CPU/RSS do servidor, atraso do event loop, intervalo de snapshots, ACKs e falhas; exclui câmera, WebGL, internet e cidades reais. Consulte o [resultado e as condições da amostra](../../../specs/2026-11-06-game-swing-add-cooperative-multiplayer/load-results.md) antes de interpretar números como capacidade.

### Integração real do lobby de bolinhas

`yarn workspace @guess-my-move/server test:lobby` executa o cliente `MultiplayerClient` do frontend contra Nest e Socket.IO reais em uma porta temporária. Não requer navegador, câmera ou servidor iniciado à parte. A suíte faz parte do `test` do servidor e de `yarn check:all`.

Os quatro cenários cobrem broadcast antes da confirmação privada, confirmação perdida com abandono/expiração, desconexão/retomada/saída e partida completa com revanche bilateral. O harness apenas adia/descarta ACKs e avança o relógio da simulação; não fabrica estados nem altera regras. Timeouts são reais, limitados a 20 s por cenário e 5 s de limpeza. No ambiente registrado na [validação](../../../specs/2026-11-08-frontend-marbles-test-real-lobby/validation.md), a execução isolada levou cerca de 9 s, dos quais 5 s são o timeout real de um ACK perdido. Esse custo complementa os testes de unidade e os E2E que usam sockets diretamente; não mede fluidez nem reconhecimento na câmera.
