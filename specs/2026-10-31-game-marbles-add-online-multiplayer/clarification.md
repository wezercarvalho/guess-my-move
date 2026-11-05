# Clarificação — 2026-10-31-game-marbles-add-online-multiplayer

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** 1.0.0
- **Iniciada em:** `2026-10-31`

## Log de decisões

### CQ-001 — Entrega e rastreabilidade

- **Data:** `2026-10-31`
- **Impacto:** alto
- **Pergunta:** uma única issue deve misturar revisão, jogabilidade e multiplayer?
- **Decisão:** usar a issue principal #111 e duas entregas filhas: #112 para convergência/jogabilidade e #113 para multiplayer. Tudo entra na branch `feat/111-marbles-multiplayer` e num único PR em rascunho.
- **Razão:** mantém resultados revisáveis sem obrigar branches ou PRs paralelos.
- **Alternativas rejeitadas:** uma issue monolítica dificulta o aceite; PRs separados contrariam o pedido de testar tudo junto.
- **Seções atualizadas em `spec.md`:** resumo, objetivos, FR-001 a FR-016 e SC-007.

### CQ-002 — O que reaproveitar do servidor removido

- **Data:** `2026-10-31`
- **Impacto:** alto
- **Pergunta:** restaurar `apps/server` do histórico?
- **Decisão:** criar um servidor novo e pequeno; reaproveitar apenas padrões de health check, validação de configuração e rate limit. Não restaurar provedores, benchmark, rota de IA ou código de frames.
- **Razão:** o servidor removido era HTTP para um árbitro por LLM, não tinha WebSocket nem multiplayer e foi excluído por custo, privacidade e falta de necessidade.
- **Alternativas rejeitadas:** reverter o commit `4d501b8` reintroduziria cerca de 5,5 mil linhas fora de escopo.
- **Seções atualizadas em `spec.md`:** problema, fora de escopo e NFR-001 a NFR-003.

### CQ-003 — Transporte

- **Data:** `2026-10-31`
- **Impacto:** alto
- **Pergunta:** usar WebSocket simples (`ws`) ou Socket.IO?
- **Decisão:** NestJS 12.3.2 com `@nestjs/websockets` e `@nestjs/platform-socket.io` 12.3.2; Socket.IO 4.8.4 com `transports: ['websocket']`.
- **Razão:** salas, confirmações, eventos tipados e reconexão reduzem código próprio; o transporte continua WebSocket e o gateway usa a integração oficial do NestJS.
- **Alternativas rejeitadas:** `ws` reduz protocolo, mas exigiria implementar sala, confirmação e retomada; polling do Socket.IO não é necessário nesta PoC.
- **Seções atualizadas em `spec.md`:** FR-006, FR-007, FR-011 e H-01.

### CQ-004 — Autoridade e privacidade

- **Data:** `2026-10-31`
- **Impacto:** crítico
- **Pergunta:** qual estado o cliente pode decidir ou enviar?
- **Decisão:** o servidor mantém e avança a única `MatchSession`. O cliente envia apenas `{ seq, velocity }`; câmera, landmarks e decisão de regra permanecem fora da rede. Snapshots vêm do servidor.
- **Razão:** impede divergência entre clientes e preserva a regra de processamento local da câmera.
- **Alternativas rejeitadas:** física em cada cliente exigiria reconciliação/rollback; enviar landmarks viola minimização e não é necessário.
- **Seções atualizadas em `spec.md`:** US-003, FR-009 a FR-014, NFR-001 e SC-002/SC-003/SC-006.

### CQ-005 — Sala, prontidão e retomada

- **Data:** `2026-10-31`
- **Impacto:** alto
- **Pergunta:** como uma PoC sem contas identifica duas pessoas e lida com uma queda curta?
- **Decisão:** código aleatório de seis caracteres, dois papéis estáveis, prontidão de ambos e credencial opaca por papel guardada em `sessionStorage`. Desconexão pausa por 60 segundos; expiração remove a sala.
- **Razão:** permite teste em abas/dispositivos sem coletar identidade e limita estado residual.
- **Alternativas rejeitadas:** nome/senha adiciona dado pessoal; reconectar só pelo código permite tomar o papel; encerrar imediatamente torna oscilações inviáveis.
- **Seções atualizadas em `spec.md`:** US-002, US-004, FR-008, FR-012 e SC-004.

### CQ-006 — Melhorias do jogo atual

- **Data:** `2026-10-31`
- **Impacto:** médio
- **Pergunta:** o que significa "melhorar" sem inventar novo modo ou recalibrar regras?
- **Decisão:** corrigir contador por competidor, nome neutro da segunda vez, ausência de alvo do bot, intenção antes do tiro e distinção por cor mais contorno. Não mudar limites de tiros, força, física ou vitória.
- **Razão:** resolve problemas verificáveis da auditoria e prepara a linguagem para a segunda pessoa.
- **Alternativas rejeitadas:** mudar equilíbrio sem teste real produziria novos palpites; redesenhar toda a tela ampliaria o risco.
- **Seções atualizadas em `spec.md`:** US-001, FR-001 a FR-005.

### CQ-007 — Gates antecipados

- **Data:** `2026-10-31`
- **Impacto:** alto
- **Pergunta:** como interpretar "todos os gates aceitos" antes de existir validação final?
- **Decisão:** Gate 1 e Gate 2 ficam aprovados para avançar sem nova pausa. Gate 3 fica aprovado com risco aceito, mas só promove a spec a `validated` depois que implementação, tarefas, evidências e gates convergirem. Falha real continua bloqueando a promoção.
- **Razão:** respeita a autorização do maintainer sem transformar aprovação em evidência inexistente.
- **Alternativas rejeitadas:** marcar `validated` antes de implementar violaria a constituição.
- **Seções atualizadas em `spec.md`:** adoção constitucional, NFR-006/NFR-007 e SC-007.

## Hipóteses remanescentes

- Node 26 e TypeScript 7 satisfazem os `engines` publicados, mas não aparecem na matriz explícita de teste do NestJS 12; a prova desta entrega será compilação, testes e execução local.
- Atualização em até 30 Hz e janela de 60 segundos são valores iniciais de produto, não medições de rede.
- Teste em duas abas prova o protocolo local, não comportamento na internet nem escala.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** mensagem do maintainer nesta sessão: "Pode considerar todos os gates aceitos, se precisar pode segmentar em issues".
- **Observações:** o maintainer autorizou avançar até o PR draft. Valores e hipóteses do agente permanecem ajustáveis no teste e não são apresentados como medidos.

## CQ-005 — Concluir validação automatizada e reservar a câmera real ao maintainer

- **Data:** `2026-11-03`
- **Autor:** wezercarvalho (maintainer)
- **Referência verificável:** mensagem nesta conversa: "Entendi, pode fazer então. Ao final eu faço os testes com câmera real. Pode abrir em paralelo arranha-teia. Pode atualizar o node se precisar."
- **Decisão:** concluir os gates automatizados no Node 26 exigido, iniciar Arranha-Teia em checkout separado e reservar câmera real/avaliação de uso ao maintainer. Não ampliar as regras do multiplayer nem alterar o Violão no Ar.
- **Execução:** Node 26.12.1 instalado em runtime isolado; checksum oficial conferido. O cache SWC do host continuou bloqueado, então a validação completa usa a imagem oficial `node:26.12.1-bookworm-slim`, com instalação imutável e sem mudança de versões do projeto.
- **Consequência:** T025 concluída após todos os gates verdes; T023/T027 aguardam o teste/aceite do maintainer. Estado `implementing`; a aprovação antecipada do Gate 3 continua condicionada à convergência, sem registrar como executado um teste humano ainda pendente.

## Revisão de usabilidade — 2026-11-04

Autorização do maintainer nesta conversa: “Pode revisar esses pontos de usabilidade e feedback de tela para auxiliar na compreensão do que está acontecendo.” Inclui explicitamente nickname, quem entrou, vez atual/próxima e jogar novamente sem criar sala. Mantêm-se duas vagas, modo fixo, mesma sala e privacidade da câmera. Revanche exige confirmação de ambos, com cancelamento; a ordem ainda não resolvida pelo tiro é apresentada como condicional. Detalhes reversíveis de UX/protocolo definidos pelo agente para executar a solicitação; aceite de uso continua com o maintainer.
