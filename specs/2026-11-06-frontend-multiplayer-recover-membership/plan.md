# Plano

## Design

Issues #125, #126 e #127. Swing recebe comando aditivo `swing:recover` com objeto vazio estrito: devolve somente no ACK privado o acesso da participação já vinculada ao socket chamador. Não consulta outra pessoa, não cria vaga, não renova atividade e não modifica snapshots. O cliente usa essa reconciliação quando create/join ou resume têm ACK perdido; mantém pendência até resposta definitiva. Em falha transitória, repete no máximo três vezes, com esperas canceláveis, antes de limpar ou preservar credenciais conforme a operação e mostrar falha. Não repete criação automaticamente. Ao abandonar estado desconhecido, envia leave no socket e encerra o transporte; expiração de 60 segundos limita uma vaga cujo abandono não pôde ser confirmado.

Retomada de ambos os jogos fica idempotente somente quando o mesmo socket já está associado à mesma vaga e apresenta o token correto. Outros sockets e tokens incorretos continuam recusados. Essa repetição permite convergir mesmo quando o servidor aplicou resume e o ACK se perdeu.

Bolinhas incrementa geração em queda/descarte e cancela comandos/timers/esperas de connect. Resume mantém connecting até confirmação; timeout transitório pode repetir, mas nunca libera tiros por um ACK não confirmado. A sequência de tiro e sessionStorage existentes são preservados.

## Alternativas

Limpar a UI sem tratar a participação no servidor deixa vagas órfãs. Repetir create sem idempotência cria divergência. Persistir novos segredos em disco ou expô-los no estado público é desnecessário. A consulta privada pelo próprio socket usa a autoridade já existente e mantém o protocolo aditivo.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                              |
| --------------- | --------- | ---------------------------------------------------------------------- |
| I. Intenção     | PASS      | Issues Ready e autorização explícita nesta conversa.                   |
| IV. Test-first  | PASS      | Regressões de ACK perdido e geração antes de produção.                 |
| VI. Privacidade | PASS      | Acesso somente em ACK privado; sem mídia, logs ou snapshots com token. |

## Validação

Node 26.12.1, Yarn 4.18.1, stack dos manifestos, sem dependência nova. Scripts oficiais: suítes web/server, check:all, contracts:export/check, SDD, docs, testes dos gates e auditoria. Usar ambiente isolado sem rede se cache SWC impedir execução no host. Demonstração real de Socket.IO para recover/idempotência e teste de UI sem remount para retomada.

## Constitution Check — pós-design

| Princípio/gate   | Resultado | Evidência                                                            |
| ---------------- | --------- | -------------------------------------------------------------------- |
| VIII. Incremento | PASS      | Somente recuperação e ciclo de comandos; mapas e regras preservados. |

## Riscos e rollback

Retries finitos; abandono pode aguardar expiração normal se nem leave for confirmado. Sem promessa de recuperação após reload do Swing, cuja credencial permanece em memória. Rollback por reversão da PR, sem migração de banco.

## Adequação da validação ao ambiente

A primeira execução integral em Docker foi interrompida com worker SIGKILL; a repetição com dois workers perdeu conexão com o daemon, confirmado indisponível em consultas posteriores. SWC no host falha por validação dos ancestrais do cache ou montagem noexec. A alternativa local mantém os scripts oficiais, recompila produção por contracts:check e executa server test com configuração explícita em evidence/compiled-vitest.mjs: apenas imports de src dos testes apontam ao dist recém-compilado pelo TypeScript, preservando metadados Nest. Não altera a configuração padrão do repositório. Suites web usam um worker após dois cenários de física excederem tempo com execução concorrente. CI remoto continua obrigatório ao sair de draft e usa a configuração padrão.

## Revisão adicional autorizada — isolamento de estados de bolinhas

A revisão solicitada pelo maintainer confirmou que onState aceita qualquer sala mesmo após leave. Primeiro demonstrar o estado tardio e ACK perdido por testes. Usar uma entrada provisória privada, por geração/código, até confirmar acesso; aceitar broadcasts normais só da sala vinculada. Limpar acesso/estado antes de esperar ACK de leave. Se a entrada termina sem confirmação confiável, descartar o provisório e fechar o transporte para liberar uma vinculação desconhecida; próxima tentativa conecta de novo, sem repetir criação automaticamente. Preservar o broadcast anterior ao ACK, ACK de erro visível, retomada e cancelamento. Não muda protocolo ou servidor. Alteração local ao incremento existente, dentro dos FR-003/FR-004 e autorização de revisão/adequação.

O contrato ClientSocket sai do módulo de bolinhas para realtime/clientSocket.ts, usado diretamente pelos dois clientes; reexport no caminho anterior preserva injeções existentes. Isso elimina a dependência de tipos Swing → bolinhas sem criar executor ou política genérica de retry.
