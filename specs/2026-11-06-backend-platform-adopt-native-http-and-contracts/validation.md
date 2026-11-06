# Validação — HTTP nativo, observabilidade e contratos públicos

## Estado

- Spec: `spec.md`.
- Status: validação técnica aprovada; aceite do maintainer pendente.
- Constituição: 1.0.0.
- Data: 2026-11-06.
- Executor: agente implementador.
- Base: `0e754c9` da `main`; evidências referentes às alterações desta entrega.

## Resumo do resultado

A aplicação e os testes usam NodeAdapter. O multiplayer preserva origem, capacidade, expiração, retomada e revanche. Métricas locais exigem credencial de operação; OpenAPI HTTP e schemas Socket.IO são exportáveis e conferidos contra os arquivos versionados. O coletor simulado recebeu traces HTTP e de comandos reais Socket.IO e métricas agregadas, sem as sentinelas privadas. Com o SDK desativado, não recebeu requisições.

T001–T005 concluídas tecnicamente. Gate 3 continua pendente; esta validação não autoriza merge nem ativação de um serviço externo.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                                                   | Resultado |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | Factory compartilhada com NodeAdapter; testes de plataforma e 10 testes e2e, incluindo origem, limites, expiração e partida.                                                                | PASS      |
| FR-002    | T002    | Endpoint 404 sem configuração, 401 sem/com token incorreto e 200 com token; métricas agregadas, operações limitadas e isolamento de falha do publicador.                                    | PASS      |
| FR-003    | T002    | Dois testes com coletor loopback: zero envio desativado; traces HTTP/Socket.IO e custom metrics com amostragem 1, sem sentinelas privadas. Ativação incompleta falha na configuração.       | PASS      |
| FR-004    | T003    | Capacidades consultadas por HTTP; OpenAPI 3.1 com segurança Bearer; endpoint do documento desativado por padrão e habilitado explicitamente; cobertura de rotas conferida por introspecção. | PASS      |
| FR-005    | T003    | Schemas JSON produzidos dos schemas de marbles; eventos, acknowledgements, retomada privada e restrições documentados; exportação sem React.                                                | PASS      |
| FR-006    | T004    | Exportação/conferência oficiais; snapshots no teste; alteração deliberada detectada; paths de contratos selecionam o gate de código no hook e workflow.                                     | PASS      |
| NFR-001   | T002    | Batches descomprimidos sem apelido, mídia, query, header, IP, segredo ou resumeToken sentinela; sem fonte, logs, profiling ou captura de argumentos/retornos.                               | PASS      |
| NFR-002   | T005    | Instalação imutável sem avisos de peer; Nest 12.3.3 alinhado, SDK 0.3.24 fixado; auditoria sem achados; testes completos sem serviço hospedado.                                             | PASS      |

## Histórias e critérios de aceitação

| História/critério | Demonstração                                                                                                                             | Resultado |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / SC-001   | Execução da suíte inteira; backend com conexões Socket.IO reais no mesmo adaptador de produção.                                          | PASS      |
| US-002 / SC-002   | Consulta HTTP de métricas protegidas e inspeção de batches de coletor local, inclusive erro interno e payload inválido.                  | PASS      |
| US-002 / SC-003   | Exportar, conferir, substituir temporariamente o documento por `{}` em cópia isolada e verificar recusa; restaurar e conferir novamente. | PASS      |

## Comandos executados

Todos em 2026-11-06, Node 26.12.1 e Yarn 4.18.1.

| Comando oficial                                                                 | Resultado     | Evidência/observação                                                                                                                     |
| ------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn install --immutable`                                                      | PASS          | Instalação host, lockfile preservado, sem avisos de peer.                                                                                |
| `node scripts/git-hooks/install.mjs`                                            | PASS          | Hook local instalado/conferido.                                                                                                          |
| `yarn check:all`                                                                | PASS          | Typecheck e lint sem erros/avisos; core 68, marbles 174, server 54, swing 232, web 453 testes e 79 testes de scripts; builds concluídos. |
| `yarn contracts:export`                                                         | PASS          | Dois documentos exportados sem instanciar a aplicação.                                                                                   |
| `yarn contracts:check`                                                          | PASS          | Ambos os documentos conferidos; repetido após restaurar o contrato no ensaio negativo.                                                   |
| `yarn workspace @guess-my-move/server contracts:check` com documento adulterado | FAIL esperado | Recusou `http.openapi.json` divergente; arquivo restaurado imediatamente em cópia isolada.                                               |
| `yarn sdd:check`                                                                | PASS          | Catálogo, estrutura e links conferidos.                                                                                                  |
| `yarn test:sdd`                                                                 | PASS          | 109 testes.                                                                                                                              |
| `yarn test:gates`                                                               | PASS          | 231 testes.                                                                                                                              |
| `yarn docs:format:check`                                                        | PASS          | Documentação em formato canônico.                                                                                                        |
| `yarn security:dependencies`                                                    | PASS          | info=0, low=0, moderate=0, high=0, critical=0.                                                                                           |

O agregado completo rodou em uma cópia do checkout com dependências já instaladas, em container Node 26.12.1 sem rede externa. Isso evita a restrição de criação de cache nativo SWC do host. Não foi declarada uma instalação imutável sem rede dentro do container. Instalação e auditoria rodaram no host. Os avisos conhecidos do ambiente DOM sobre canvas e do bundle web acima de 500 kB não reprovaram os testes/build e não são medições de desempenho.

## Convergência e demonstração

O primeiro ensaio de tracing detectou ausência de spans Socket.IO: interceptores globais de HTTP também envolviam os eventos e deixavam a execução adiada fora do contexto do trace. A medição e a serialização foram limitadas aos controllers HTTP. A suíte passou a exigir um trace de comando real, além de métricas, mantendo a inspeção de privacidade. Uma execução adicional do servidor compilado confirmou traces HTTP e Socket.IO no coletor loopback.

O teste de gates também detectou a ausência do comando literal de instalação do hook no README; a instrução foi restaurada. As falhas foram corrigidas e os comandos afetados reexecutados.

## Validações estruturais e documentais

- Catálogo e guias vinculam a spec e os contratos; texto preservado em UTF-8.
- Os schemas de resposta HTTP usados pelo serializer também alimentam o OpenAPI. Os schemas Socket.IO vêm dos contratos de marbles, com regras de magnitude/normalização descritas separadamente.
- O teste de fronteira da carta passou no core. Nenhuma câmera real foi usada, nem se alterou reconhecimento de gestos ou física.
- Telemetria tem nomes limitados e proteção contra falha do publicador. Os testes inspecionam o conteúdo dos batches, sem usar credenciais reais.
- A dependência do adaptador Express foi removida; não houve atualização desnecessária do runtime Node nesta entrega.

## Constitution Check final

| Princípio/gate                        | Resultado | Evidência                                                               |
| ------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Intenção e contratos antes da entrega | PASS      | Spec, clarificação, plano e tarefas vinculados ao pedido do maintainer. |
| Fronteira de informação e privacidade | PASS      | Testes da carta e do coletor, token de operação fora do frontend.       |
| Gates executáveis e evidência honesta | PASS      | Resultados acima; falhas transitórias e limitações registradas.         |
| Aceite humano e integração            | PENDENTE  | PR deve permanecer em rascunho para conferência do maintainer.          |

## Limitações e riscos residuais

- Não houve benchmark de capacidade, câmera ou fluidez; a troca do adaptador não comprova ganho de desempenho.
- O coletor local comprova o payload produzido pelo SDK, não a configuração de uma conta, painel ou retenção de dados do serviço hospedado. Nenhuma conta foi ativada.
- A instância continua efêmera e única; métricas reiniciam com o processo e não substituem persistência, disponibilidade distribuída ou readiness.
- OpenAPI cobre HTTP. Integração de partidas exige Socket.IO 4 com transporte websocket; o contrato de eventos é separado.
- O módulo Swagger disponível declara peer incompatível com TypeScript 7. O documento OpenAPI foi gerado dos schemas Zod, sem introduzir esse peer e sem UI Swagger hospedada.
- A auditoria de dependências não certifica ausência de falhas no runtime Node nem substitui atualizações de segurança futuras.

## Gate 3 — Convergência validada

- Veredito: pendente.
- Aprovador: maintainer, após conferir a PR.
- Escopo técnico disponível: FR-001–FR-006, NFR-001–NFR-002 e SC-001–SC-003.
- Riscos aceitos: nenhum aceite humano presumido.
- Observações: manter PR em rascunho; não mesclar nem ativar telemetria externa automaticamente.
