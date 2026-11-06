# Medição local de carga do multiplayer cooperativo

## Escopo e método

O roteiro `apps/server/scripts/load-swing.mjs` cria um servidor NestJS compilado em processo separado, vinculado exclusivamente a `127.0.0.1` em porta efêmera. Os clientes Socket.IO também ficam no ambiente local; o roteiro não aceita URL de servidor externo. Cada sala Aurora tem duas conexões WebSocket reais, comandos de movimento a 10 Hz por jogador e snapshots nominais a 10 Hz. Os controles são enviados somente na fase `playing`, alternam lançamento/soltura da teia e giro limitado; não são reproduções de sessões humanas.

Há dois processos principais, gerador de clientes e servidor. A CPU, o RSS e o atraso do event loop são medidos no processo do servidor. Os dois processos competem pela mesma cota do contêiner, o que integra o custo local do gerador à pressão sobre os recursos disponíveis. Não há navegador, câmera, detector, renderização WebGL, rede externa, Redis ou múltiplas instâncias nesta medição.

Cada perfil usa um servidor novo, 3 segundos de aquecimento depois de todas as salas iniciarem e 15 segundos de coleta. São duas réplicas para 2, 10 e 20 salas simultâneas, respectivamente 4, 20 e 40 jogadores. O roteiro encerra sockets, intervalos e processo do servidor ao final de cada réplica.

O processo filho força `OBSERVE_ENABLED=false`, remove credenciais e endpoint de observabilidade e desativa os documentos HTTP. Não há telemetria externa. Nomes sintéticos, códigos de salas e credenciais existem somente na memória das conexões e não são gravados na evidência.

## Isolamento e reprodução

A execução registrada usa a imagem `node:26.12.1-bookworm-slim`, com `--network none --cpus 2 --memory 2g`. A cota é compartilhada entre servidor e clientes; não equivale a duas CPUs reservadas exclusivamente ao servidor. O ambiente local também pode competir com outras cargas do host. Hardware reportado: AMD EPYC 9354P, arquitetura x64, dois processadores disponíveis ao ambiente, Linux 7.0.0-38-generic. As cotas efetivas registradas são `cpu.max = 200000 100000` e `memory.max = 2147483648`. Software do backend: NestJS 12.3.3, Socket.IO 4.8.4 e SDK Observe 0.3.24 desativado. A base de código é o commit `e0c0f6e1a35a6cb1bf34504c30813247313d8360`, acrescido do roteiro de medição nesta alteração.

Antes da medição é necessário compilar `@guess-my-move/marbles`, `@guess-my-move/swing` e `@guess-my-move/server`. O processo recebe os arquivos compilados e as dependências já instaladas; não baixa pacotes durante a execução. O roteiro aceita Node >=26.12.1 e <27 e registra o patch efetivamente usado; a evidência desta execução usa exatamente 26.12.1. Permite apenas os perfis fixos de salas, uma ou duas réplicas e intervalos de coleta limitados.

```sh
yarn workspace @guess-my-move/marbles build
yarn workspace @guess-my-move/swing build
yarn workspace @guess-my-move/server build
yarn workspace @guess-my-move/server load:swing --output /tmp/swing-load.json
```

O limite de conexões por IP é ajustado **somente no processo de benchmark** para 100 e o de tentativas de sala por minuto para 1.000, porque todos os participantes sintéticos compartilham loopback. Os limites globais continuam em 200 conexões e 100 salas. Esta execução não altera os valores padrão de produção e não avalia proteção contra abuso distribuído.

## Definições das medidas

- **ACK p95:** percentil 95 do tempo entre emitir um comando de movimento e receber seu acknowledgement, no gerador de clientes. Inclui ida, processamento e volta no loopback; não representa latência de internet.
- **Intervalo de snapshot p95:** percentil 95 do intervalo entre snapshots sucessivos em cada conexão, agregado entre os clientes durante a coleta. O alvo nominal é 100 ms; isto mede cadência de publicação, não fluidez de renderização.
- **CPU:** tempo de CPU do processo do servidor dividido pelo tempo real de coleta, em porcentagem de um núcleo. Pode ultrapassar 100% quando há trabalho em mais de um núcleo.
- **RSS de pico:** maior RSS observado em amostragem a cada 50 ms; picos mais curtos podem escapar à amostra.
- **Event loop p95:** histograma nativo do Node com resolução de 10 ms; o custo da resolução faz parte da medida.
- **Atraso máximo de tick:** contador agregado existente do backend, zerado após o aquecimento. Inclui os timers dos domínios registrados, não apenas Swing.
- **Falhas:** timeouts e recusas de ACK, desconexões durante a coleta e eventos públicos de erro. Os contadores internos do servidor também são registrados. `phaseSkippedInputs` contabiliza oportunidades de envio fora da fase de jogo, evitando confundir transições de lobby/revanche com recusas por capacidade.

## Resultados

As seis réplicas concluíram com zero timeouts, recusas, desconexões ou erros públicos/internos. Evidência completa: [load-swing-2cpu-2g.json](evidence/load-swing-2cpu-2g.json). O SHA-256 registrado coincide com o roteiro entregue.

| Salas / jogadores | ACK p95 (ms) | Snapshot p95 (ms) | CPU (% de um núcleo) | RSS de pico (MiB) |
| ----------------- | ------------ | ----------------- | -------------------- | ----------------- |
| 2 / 4             | 2.81–3.46    | 102.00–102.87     | 4.92–4.93            | 134.50–134.99     |
| 10 / 20           | 2.39–4.16    | 101.81–102.93     | 11.17–11.87          | 135.14–136.28     |
| 20 / 40           | 1.51–1.64    | 101.53–101.92     | 19.07–19.64          | 136.74–137.52     |

Os intervalos mostram as duas réplicas, sem combinar percentis. O maior ACK foi 121.028 ms; o maior intervalo de snapshot foi 137.472 ms; o maior atraso de tick foi 79 ms. Esses máximos permanecem na análise mesmo com p95 baixo. Nenhum limite de produção foi aumentado.

## Validação do roteiro

As opções `--url https://example.invalid`, `--replicas nope` e `--duration-ms NaN` foram recusadas com saída 1 antes da criação do processo servidor. A evidência está em [load-cli-validation.json](evidence/load-cli-validation.json). O endpoint usado na execução normal vem apenas do IPC do filho criado pelo próprio roteiro; o endereço é sempre loopback.

Uma execução preliminar completa foi preservada em [load-swing-2cpu-2g-initial.json](evidence/load-swing-2cpu-2g-initial.json), antes da melhoria que restringe inputs à fase de jogo, aceita novos patches da linha 26 e inclui o hash do roteiro. O hash SHA-256 do roteiro dessa execução preliminar era `4184059a756c963a75f0051e11174c9402c00c1c380ae3bf9c2b2940af1c5536`. Ela não é combinada com as duas réplicas finais na tabela principal. Apresentou zero erros, mas houve um intervalo máximo de snapshot de 308,607 ms e ACK máximo de 250,571 ms em uma réplica de duas salas; esses valores permanecem na evidência, sem descartar outliers.

## Limites de interpretação

Duas réplicas curtas servem para registrar um ponto de referência local e identificar atrasos evidentes. Não constituem um ensaio prolongado, garantia de capacidade, SLA, demonstração de 100 salas ou medida do desempenho de câmera e interface. Um ambiente de produção, uma rede real e equipamentos dos jogadores precisam de validação própria. A decisão sobre limites deve considerar essas diferenças e medições posteriores, sem extrapolar linearmente este resultado.
