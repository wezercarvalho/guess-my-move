# Validação — multiplayer cooperativo e backend modular

## Estado e resultado

- Data: 2026-11-06; Constituição 1.0.0.
- Executor: agente implementador com revisão paralela de backend e frontend.
- Base técnica: `db9d87d`, PR #118 ainda em rascunho. Branch dependente: `feat/swing-cooperative-multiplayer`.
- Implementação e validação técnica concluídas; T001–T005 concluídas. Aceite humano final pendente.
- Issues: iniciativa #119, fundação #120, servidor #121 e interface #122, com vínculos nativos pai/filhos.

O modo cooperativo funciona com duas conexões reais, física e objetivos autoritativos, sala compartilhada, retomada e nova partida bilateral. O backend mantém módulos dos jogos independentes, com orçamento agregado de salas, conexões e tentativas. Treino, Viajante e bolinhas mantiveram suas regressões. O SDK permanece desligado por padrão.

## Matriz de requisitos

| Requisito | Tarefas        | Evidência                                                                                                                                                                                                                             | Resultado |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001           | `realtime-foundation.test.ts`: orçamento global de salas em namespaces reais e limites por conexão/endereço; `swing.e2e.test.ts`: conexão direta com origem indevida e tentativas inválidas preservadas ao reconectar/trocar de jogo. | PASS      |
| FR-002    | T002           | Dois sockets reais e dois contextos Chromium criam/entram, exibem Ana/Bia e aguardam duas confirmações.                                                                                                                               | PASS      |
| FR-003    | T002           | Schemas estritos rejeitam posição/mídia/landmarks; serviço rejeita sequência/partida antiga e neutraliza input após 350 ms; movimento observado em snapshot autoritativo.                                                             | PASS      |
| FR-004    | T002           | `swing-traversal.test.ts`: física real coleta todos os objetivos nas quatro cidades; teste completo Socket.IO conclui Aurora nos dois clientes. `onlineScene.test.ts` verifica avatar, apelido, interpolação e recursos reutilizados. | PASS      |
| FR-005    | T002           | Relógio injetável comprova reserva de 60 s, expiração sem renovação por heartbeat neutro/prontidão idempotente; E2E comprova conclusão, voto unilateral, revanche bilateral e retomada com credencial original.                       | PASS      |
| FR-006    | T003           | Testes de UI/cliente/controller incluem StrictMode, expiração, ACK tardio, cleanup, estado antigo e preservação de renderer na revanche. Demonstração Chromium verifica teclado, pausa e retomada com WebGL real.                     | PASS      |
| FR-007    | T004           | Três documentos conferidos; capacidades HTTP ampliadas sem remover campos legados; métricas agregadas desacopladas dos gateways; batches do coletor incluem swing sem sentinelas privadas.                                            | PASS      |
| FR-008    | T005           | Issues #119–#122 criadas e segmentadas; entrega em branch dependente e PR em rascunho para revisão, sem merge automático.                                                                                                             | PASS      |
| NFR-001   | T002/T003/T004 | Validação de payloads, ausência de tokens em snapshots, credencial só em memória e inspeção dos batches de observabilidade e dos comandos no navegador.                                                                               | PASS      |
| NFR-002   | T001/T002/T003 | Inputs/snapshots limitados; geometrias e texturas reutilizadas e descartadas; timers/listeners cancelados e ACK tardio ignorado; testes de reconexão/StrictMode.                                                                      | PASS      |
| NFR-003   | T005           | Agregado completo aprovado, inclusive física, carta privada, bolinhas e detectores simulados. Sem benchmark ou afirmação de FPS/latência.                                                                                             | PASS      |

## Comandos oficiais executados

Todos em Node 26.12.1 e Yarn 4.18.1, em 2026-11-06.

| Comando                                                       | Resultado | Evidência                                                                                                                                                                              |
| ------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn install --immutable`                                    | PASS      | Lockfile consistente, sem avisos de peer.                                                                                                                                              |
| `node scripts/git-hooks/install.mjs`                          | PASS      | Hook local conferido antes do push.                                                                                                                                                    |
| `yarn check:all`                                              | PASS      | Tipos e lint sem erros/avisos; core 68, marbles 174, swing 234, servidor 75, web 465 e scripts web 79 testes; builds concluídos. Reexecutado após ajuste visual do painel cooperativo. |
| `yarn workspace @guess-my-move/server test`                   | PASS      | 76 testes após acrescentar o ciclo E2E completo de coleta/revanche. Nenhuma alteração de produção posterior ao agregado.                                                               |
| `yarn contracts:export` e `yarn contracts:check`              | PASS      | HTTP, bolinhas e swing exportados/conferidos sem porta pública nem telemetria.                                                                                                         |
| `yarn sdd:check`                                              | PASS      | Catálogo, estados, links e artefatos conferidos.                                                                                                                                       |
| `yarn test:sdd`                                               | PASS      | 109 testes.                                                                                                                                                                            |
| `yarn docs:format:check`                                      | PASS      | Documentação no formato canônico.                                                                                                                                                      |
| `yarn test:gates`                                             | PASS      | 231 testes.                                                                                                                                                                            |
| `yarn security:dependencies`                                  | PASS      | info=0, low=0, moderate=0, high=0, critical=0.                                                                                                                                         |
| `yarn dev:server` em cópia sem `dist` de server/marbles/swing | PASS      | Recompilou ambos os núcleos e iniciou o Nest sem imports ausentes; processo encerrado por timeout controlado de 15 s (código 124 esperado).                                            |

O agregado rodou em cópia isolada do checkout e dependências instaladas, em container sem rede externa, por restrição do cache SWC no host. Instalação, auditoria, builds de contratos e pré-push rodaram no host. Uma cópia inicial do container continha uma pasta aninhada duplicada de testes exploratórios; a árvore isolada foi limpa e sincronizada antes da execução aprovada. Isso não alterou o checkout.

Avisos conhecidos de canvas no DOM simulado e bundle web acima de 500 kB não bloquearam os checks. Auditoria de dependências não certifica ausência de falhas no runtime Node.

## Demonstração exploratória em navegador

Não é um novo gate de CI. O script [browser-smoke.cjs](evidence/browser-smoke.cjs) usa Playwright/Chromium disponíveis no ambiente, servidor e Vite reais, com duas sessões independentes e câmera desligada. Pode ser executado com `node specs/2026-11-06-game-swing-add-cooperative-multiplayer/evidence/browser-smoke.cjs`, configurando `NODE_PATH`/`PLAYWRIGHT_BROWSERS_PATH` conforme a instalação da ferramenta. `GMM_BROWSER_BASE_URL` é opcional.

O [registro sanitizado](evidence/browser-smoke.json) confirma criação/entrada, nomes, prontidão, WebGL, movimento por teclado, pausa por conexão offline, retomada da mesma sala, saída liberando vaga, ausência de erros de página e ausência de requisições a terceiros ou mídia nos comandos.

A inspeção visual detectou um painel de sala que consumia altura excessiva; foi substituído por uma barra compacta. A demonstração final verificou barra de aproximadamente 98 px e palco de 751 px numa janela de 1440 × 1000, sem rolagem horizontal em 390 × 844. São medidas desse layout, não benchmark de FPS. O teste aguarda o primeiro input reconhecido em vez de presumir tempo fixo de processamento no Chromium com renderização por software.

- [Lobby da dupla](evidence/cooperative-lobby.png).
- [Cidade com painel compacto](evidence/cooperative-city.png).
- [Layout de celular](evidence/cooperative-mobile.png).

O novo E2E completo usa dois sockets e física reais com relógio acelerado somente no teste: não teleporta jogadores, não altera objetivos/snapshots nem cria uma API de teste em produção. Comprova a coleta, a conclusão recebida por ambos, a votação bilateral, o reinício de objetivos e a retomada após nova partida. Os quatro testes de percurso comprovam alcançabilidade em Aurora, Midtown, Paulista e Santa Maria.

## Convergência e decisões necessárias

- Nest core/plataforma 12.3.3 e Observe 0.3.24 foram confirmados no registro npm oficial; não havia atualização de versão a fazer. A evolução foi modular e operacional.
- Namespaces separados preservam bolinhas; origem e capacidade ficam na infraestrutura compartilhada, incluindo `MAX_ROOMS` agregado.
- Validação explícita com ACK sanitizado foi mantida; pipes WebSocket padrão mudariam o canal de erro e poderiam ecoar o payload rejeitado.
- A geometria de Aurora foi compartilhada para evitar divergência entre navegador e servidor. Objetivos livres porém isolados em Santa Maria foram corrigidos com busca limitada por componente caminhável; percurso real das quatro cidades passou.
- Heartbeats neutros, prontidão e voto idempotentes não renovam atividade. Pausa preserva a janela inteira de reconexão.
- A revisão encontrou e corrigiu reaproveitamento do cliente no StrictMode, limpeza de sala expirada e manutenção da câmera/renderer na revanche.
- SDK continua opcional e sem envio por padrão; novos traces foram inspecionados com coletor loopback e amostragem completa, sem apelidos, tokens, mídia, IPs, headers privados ou credenciais.

## Constitution Check e limitações

Intenção e gates de implementação foram autorizados expressamente pelo maintainer. Privacidade, fronteira da carta, contratos, regressões e documentação têm evidências automatizadas. A fundação registrou teste vermelho antes da implementação; não há log de execução vermelha para cada incremento paralelo. A compensação é a revisão adversarial, suíte integral, novo E2E completo e demonstração real em duas sessões; esse limite de processo permanece visível para o aceite humano.

Não foram testados câmera real, GPU física, rede móvel real ou múltiplas instâncias. A renderização exploratória usou Chromium com SwiftShader. A integração continua efêmera numa instância e requer os assets JSON de cidades na estrutura do monorepo. Reload perde a credencial do swing, mantida apenas em memória; a reconexão automática exige que a página continue aberta. Nenhum serviço externo, banco, Redis ou telemetria hospedada foi ativado. A PR depende da integração da PR #118.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-011, NFR-001–NFR-003 e SC-001–SC-004.
- Observações: os gates de desenvolvimento foram aprovados previamente pelo maintainer; não presumir aceite final, merge ou aceite dos limites acima.

## Complemento — recuperação e medição local

Escopo adicional autorizado pelo maintainer em “Pode fazer então”: FR-009–FR-011, sem alteração dos limites ou das regras de partida.

| Requisito | Evidência                                                                                                                                                                                                                            | Resultado |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-009    | Testes de desconexão durante criação e ACK de retomada atrasado: gerações anteriores não alteram a nova sessão; timers pendentes são cancelados imediatamente.                                                                       | PASS      |
| FR-010    | Watchdog de 2 segundos, snapshots repetidos/obsoletos, pausa, expiração e descarte. Teste de UI preserva montagem; navegador real bloqueia somente snapshots, mantém transporte conectado e comprova recuperação com o mesmo canvas. | PASS      |
| FR-011    | Seis perfis concluídos (duas réplicas para 2/10/20 salas). Hash do roteiro confere com JSON. [Método, números e limites](load-results.md), incluindo máximos e execução preliminar.                                                  | PASS      |

Os novos testes foram executados antes da implementação: cinco falhas e 25 aprovações na suíte focada. Após a correção, `yarn workspace @guess-my-move/web test:swing-network` aprovou os 30 testes. O script oficial evita encaminhar argumentos ao teste Node que acompanha a suíte web completa.

A execução exploratória do navegador foi repetida com duas sessões, teclado, perda/retomada de conexão e interrupção apenas dos snapshots. O [registro atualizado](evidence/browser-smoke.json) confirma `stalledServerFeedback` e `recoversWithoutRemount`. A [captura de espera](evidence/cooperative-waiting-server.png) mostra o feedback visível. Câmera real continua pendente de validação pelo maintainer.

Decisões: o watchdog mede progresso da simulação e só atua na fase de jogo; não tenta abrir outra sala nem reiniciar câmera/renderer. Ao aguardar, para de enviar controles; o servidor já neutraliza controles antigos. Credenciais continuam somente em memória. O benchmark inicia exclusivamente um servidor filho em loopback e não aceita destino externo; ajustes de admissão são exclusivos desse processo. Medição curta não justifica elevar limites de produção.

Verificação final deste complemento: `yarn check:all` aprovado em cópia isolada sem rede, com tipos, lint, builds e core 68, marbles 174, swing 234, servidor 76, web 470 e scripts web 79 testes. `yarn install --immutable`, instalação do hook, `yarn test:sdd` (109), `yarn test:gates` (231) e `yarn security:dependencies` (zero achados) também aprovados. Um primeiro lint apontou quatro assertions desnecessárias nos novos testes; foram removidas antes do agregado aprovado. Não houve alteração de produção depois dessa execução. Permanecem os avisos conhecidos de canvas/React no DOM simulado e tamanho de bundle.
