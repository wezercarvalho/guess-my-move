---
id: 2026-10-31-game-marbles-add-online-multiplayer
summary: Bolinhas de gude com a entrega singleplayer convergida, melhorias de leitura da vez e partidas online de Bete, Triângulo e Cova para duas pessoas. Um servidor NestJS 12 com Socket.IO mantém salas efêmeras e a única sessão autoritativa; a web envia somente vetores de tiro e recebe snapshots. Câmera, vídeo, landmarks e gestos permanecem no navegador. Issues #111, #112 e #113; Gates 1 e 2 aprovados e Gate 3 autorizado antecipadamente pelo maintainer em 2026-10-31, condicionado à convergência e aos gates verdes.
title: Bolinhas de gude, revisão de jogabilidade e multiplayer online
slug: game-marbles-add-online-multiplayer
strategy: sdd
domain: game
capability: marbles
objective: add-online-multiplayer
status: implementing
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - multiplayer
    - WebSocket
    - Socket.IO
    - NestJS 12
    - sala
    - partida online
    - servidor autoritativo
    - bolinhas de gude
    - Bete
    - Triângulo
    - Cova
code_paths:
    - packages/marbles/
    - apps/server/
    - apps/web/src/marbles/
    - apps/web/vite.config.ts
related_specs:
    - 2026-10-29-game-marbles-modes-build-single-player-matches
    - 2026-10-27-game-marbles-bete-build-pinch-shot
    - 2026-10-27-game-marbles-bete-refine-flick-thumb-release
    - 2026-10-28-frontend-design-system-adopt-dark-gold
supersedes: []
branch: feat/111-marbles-multiplayer
constitution_version: 1.0.0
created_at: 2026-10-31
updated_at: 2026-11-04
---

# Bolinhas de gude, revisão de jogabilidade e multiplayer online

## Resumo

Esta entrega converge a spec singleplayer já integrada, corrige problemas de leitura da partida e acrescenta partidas online entre duas pessoas. O navegador continua processando câmera e gestos localmente e envia somente o vetor final do tiro. Um servidor NestJS 12 mantém salas efêmeras e é a única autoridade que avança a sessão, a física, as rodadas e o placar. Bete, Triângulo e Cova continuam disponíveis no modo local e passam a funcionar online sem bot. Issues #111, #112 e #113.

## Problema

O jogo atual permite jogar contra uma meta ou bot, mas mostra somente os tiros restantes do jogador, não mostra a intenção do adversário e faz um tiro arbitrário para a direita quando o bot não encontra alvo. A spec da entrega singleplayer também ficou em `implementing` apesar de o maintainer ter aceitado os riscos e autorizado o Gate 3.

O motor já separa câmera, mira, física, regras e fonte do tiro, porém ainda nomeia a segunda vez como `bot-turn` e só aceita disparo direto do primeiro competidor. Não há protocolo, sala ou servidor para duas pessoas. O servidor NestJS removido em 2026 atendia ao antigo fluxo de IA por HTTP; restaurá-lo traria código morto e não resolveria multiplayer.

## Objetivos

- Convergir a documentação da entrega singleplayer com o aceite explícito do maintainer.
- Melhorar a leitura de vez, tiros restantes e intenção do adversário sem alterar o resultado dos modos.
- Permitir que duas pessoas criem ou entrem numa sala efêmera e concluam partidas de Bete, Triângulo e Cova.
- Manter o servidor como autoridade única da sessão e rejeitar comandos inválidos, fora de ordem ou fora da vez.
- Preservar a privacidade: câmera, vídeo, gestos e landmarks nunca saem do navegador.
- Entregar documentação atualizada a cada fase e um único PR em rascunho.

## Fora de escopo

- Contas, perfis, autenticação externa ou dados pessoais além do apelido efêmero definido nesta revisão.
- Matchmaking público, chat, ranking, histórico, banco de dados ou replay persistido.
- Espectadores, mais de duas pessoas, Redis, múltiplas instâncias e migração de sala entre processos.
- Rollback, previsão local, compensação avançada de latência ou promessa de latência/fps.
- Envio de frames, vídeo, áudio, landmarks ou métricas biométricas.
- Recalibrar os valores de equilíbrio dos três modos sem teste de uso real.
- Restaurar os provedores de IA, benchmark ou rota `/api/guess` removidos.

## Atores

- **Pessoa anfitriã:** escolhe o modo, cria a sala e ocupa o papel `player`.
- **Pessoa convidada:** entra pelo código e ocupa o papel `opponent`.
- **Servidor de partida:** valida comandos, avança a única sessão e publica o estado autoritativo.
- **Cliente web:** processa câmera e mira localmente, envia somente o tiro e desenha snapshots.
- **Maintainer:** testa a entrega e aceitou antecipadamente os três gates e os riscos declarados.

## Histórias de usuário

### US-001 — Entender a partida atual (P1)

Como pessoa jogadora, quero ver de quem é a vez, quantos tiros essa pessoa ainda tem e para onde o adversário pretende atirar, para acompanhar a partida sem interpretar detalhes internos.

**Teste independente:** simular uma partida contra bot, alternar a vez e verificar contador, rótulo, intenção e diferenciação visual.

**Critérios de aceitação:**

1. **Dado** qualquer competidor na vez, **quando** a tela mostra os tiros restantes, **então** identifica o dono e usa o valor desse competidor.
2. **Dado** um tiro do bot planejado, **quando** ele ainda não foi disparado, **então** a intenção aparece no campo por um intervalo curto.
3. **Dado** que não existe alvo válido, **quando** o bot recebe a vez, **então** ele passa sem disparar um vetor arbitrário.
4. **Dado** o campo com os dois competidores, **quando** é desenhado, **então** cor e contorno/forma diferenciam os dois.

### US-002 — Criar e entrar numa sala (P1)

Como pessoa jogadora, quero criar uma sala ou entrar por um código curto, para jogar com alguém conhecido sem conta nem matchmaking público.

**Teste independente:** dois clientes Socket.IO criam e entram na mesma sala, recebem papéis diferentes e veem o mesmo modo e estado de presença.

**Critérios de aceitação:**

1. **Dado** um dos três modos, **quando** a anfitriã cria uma sala, **então** recebe código de seis caracteres e credencial efêmera de retomada.
2. **Dado** um código válido com uma vaga, **quando** a convidada entra, **então** ocupa o segundo papel e ambas veem duas pessoas conectadas.
3. **Dado** código inexistente, sala cheia ou payload inválido, **quando** alguém tenta entrar, **então** recebe erro curto e estável sem afetar a sala.
4. **Dado** duas pessoas conectadas, **quando** ambas marcam prontidão, **então** a partida começa uma vez no modo escolhido pela anfitriã.

### US-003 — Jogar uma partida autoritativa (P1)

Como pessoa em uma sala, quero que somente o tiro válido de quem está na vez altere a partida, para as duas telas permanecerem coerentes.

**Teste independente:** completar uma partida de cada modo com dois clientes de teste e comparar versão e snapshot recebidos.

**Critérios de aceitação:**

1. **Dado** o papel da conexão e o snapshot, **quando** chega um tiro com sequência nova, vetor finito e velocidade permitida na vez correta, **então** o servidor o aplica uma vez.
2. **Dado** tiro duplicado, fora da vez, durante rolagem ou acima do teto, **quando** chega, **então** o servidor rejeita sem mudar a versão da partida.
3. **Dado** um tiro aceito, **quando** a física avança, **então** as duas pessoas recebem snapshots do mesmo servidor até a próxima vez, rodada ou fim.
4. **Dado** fim de rodada, **quando** passa a pausa curta, **então** o servidor inicia a próxima rodada; nenhum cliente decide isso sozinho.

### US-004 — Retomar uma conexão curta (P1)

Como pessoa que perdeu a conexão por instantes, quero voltar à mesma sala e papel, para uma oscilação da rede não encerrar a partida imediatamente.

**Teste independente:** desconectar um cliente, manter a sala pausada, retomar com a credencial dentro de 60 segundos e receber o snapshot atual.

**Critérios de aceitação:**

1. **Dado** uma pessoa desconectada, **quando** a janela de 60 segundos ainda está ativa, **então** a partida pausa e a outra tela informa a espera.
2. **Dado** a credencial correta, **quando** a pessoa retoma dentro da janela, **então** recupera o papel e a partida continua do mesmo snapshot.
3. **Dado** credencial errada, expirada ou reutilizada por outra conexão ativa, **quando** tenta retomar, **então** é rejeitada.
4. **Dado** o fim da janela, **quando** a pessoa não retorna, **então** a sala termina e é removida sem persistência.

### US-005 — Escolher local ou online sem regressão (P1)

Como pessoa jogadora, quero escolher `Local` ou `Online` antes da partida, para continuar usando meta/bot ou jogar com outra pessoa.

**Teste independente:** iniciar os fluxos local e online na tela e provar que câmera, pinça, estalo e os três modos continuam disponíveis.

**Critérios de aceitação:**

1. **Dado** `Local`, **quando** a partida começa, **então** o fluxo atual contra meta ou bot continua sem servidor.
2. **Dado** `Online`, **quando** a pessoa cria ou entra numa sala, **então** a tela mostra código, presença, prontidão, papel e estado de conexão em linguagem curta.
3. **Dado** a própria vez online, **quando** a mira produz um tiro, **então** somente o vetor é enviado; fora da própria vez, a câmera não envia comandos de jogo.
4. **Dado** a vez remota, **quando** chega a intenção/snapshot, **então** a tela identifica `Você` e `Outra pessoa` sem chamar o adversário de bot.

## Requisitos funcionais

- **FR-001:** A spec `2026-10-29-game-marbles-modes-build-single-player-matches` DEVE ser promovida a `validated` com T031 e Gate 3 aprovados pelo maintainer em 2026-10-31, preservando os riscos aceitos e sem alegar equilíbrio, diversão ou fps.
- **FR-002:** `MatchSnapshot` DEVE expor tiros restantes por `Competitor`; a fase da segunda pessoa DEVE usar nome neutro, não específico de bot; chamadas legadas do jogador local DEVEM continuar compatíveis.
- **FR-003:** O bot DEVE devolver `null` quando não houver campo/alvo e a sessão DEVE passar a vez sem tiro arbitrário; quando houver tiro, a camada web DEVE poder mostrar sua intenção antes do disparo.
- **FR-004:** A apresentação DEVE identificar competidores por cor e também por contorno/forma; o texto do contador DEVE nomear o competidor da vez.
- **FR-005:** O modo local DEVE preservar meta, bot, níveis, três modos, pinça, estalo, placar, ajuda e privacidade sem depender do servidor.
- **FR-006:** O protocolo compartilhado DEVE declarar eventos e schemas Zod estritos para criar, entrar, retomar, prontidão, tiro e estado, recusando campos desconhecidos.
- **FR-007:** O servidor NestJS 12 DEVE expor `GET /api/health` e um gateway Socket.IO na mesma origem, forçando transporte WebSocket e limitando cada payload a 8 KiB.
- **FR-008:** Salas DEVEM ser efêmeras, ter código aleatório de seis caracteres, no máximo dois papéis estáveis (`player` e `opponent`), modo fixado pela anfitriã e limite configurável de salas ativas.
- **FR-009:** A sala DEVE começar só com duas pessoas prontas; o servidor DEVE criar uma única `MatchSession` com adversário remoto e ser o único processo que dispara, avança física e muda rodada.
- **FR-010:** O tiro DEVE conter sequência inteira crescente e vetor finito com módulo entre o mínimo jogável e 1100 unid/s; o servidor DEVE validar papel, prontidão, fase, vez e sequência antes de aplicar.
- **FR-011:** O servidor DEVE publicar estado com versão monotônica, presença, prontidão, pausa/resultado e `MatchSnapshot`; mensagens inválidas DEVEM produzir código e texto estáveis sem expor stack.
- **FR-012:** Ao desconectar, a sala DEVE pausar por 60 segundos; uma credencial aleatória opaca DEVE permitir retomar o mesmo papel dentro da janela; expiração remove a sala.
- **FR-013:** A tela DEVE oferecer `Local` e `Online`; no online, criar/entrar, normalizar código, copiar/mostrar o código, marcar prontidão, sair e comunicar conexão/espera/erro; a câmera só alimenta a mira na própria vez.
- **FR-014:** Somente eventos, vetores e snapshots serializáveis DEVEM trafegar. Frames, vídeo, áudio, landmarks, gestos brutos, credenciais de provedor e conteúdo de cartas NÃO DEVEM fazer parte dos schemas, logs ou estado do servidor.
- **FR-015:** O Vite DEVE encaminhar `/socket.io` ao servidor no desenvolvimento; nenhuma URL de servidor DEVE ser fixada no bundle, e a ausência do servidor DEVE manter o modo local utilizável.
- **FR-016:** Testes DEVEM cobrir motor, schemas, sala, gateway com dois clientes reais, reconexão, fluxo web e regressão local; o PR DEVE permanecer em rascunho para teste do maintainer.

## Requisitos não funcionais

- **NFR-001:** Regras e física continuam somente em `@guess-my-move/marbles`; servidor e web não duplicam decisões de modo.
- **NFR-002:** O servidor opera em uma única instância, memória local, sem banco, Redis, fila, segredo ou serviço externo.
- **NFR-003:** Sala, código e credencial são temporários; nada é gravado em arquivo ou logado em claro além de contagens e códigos de erro sanitizados.
- **NFR-004:** Cada conexão fica limitada a 20 comandos em 1 segundo; excesso e payload acima de 8 KiB falham sem derrubar outras salas.
- **NFR-005:** Nenhuma afirmação de latência, capacidade, fps ou qualidade de rede sem medição registrada; testes locais com duas conexões não provam internet real.
- **NFR-006:** A implementação segue teste falhando → mínimo → verde por fase e registra progresso em `tasks.md` e `validation.md` antes do próximo bloco.
- **NFR-007:** Os scripts oficiais aplicáveis DEVEM passar, incluindo `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check` e `security:dependencies`.

## Edge cases

- Código em minúsculas ou com espaços é normalizado; caracteres fora de A–Z/2–9 são rejeitados.
- Uma terceira pessoa recebe `ROOM_FULL`; duas criações nunca compartilham um código ativo.
- Prontidão enviada duas vezes é idempotente; tiro com a mesma sequência nunca é aplicado duas vezes.
- Vetor com `NaN`, infinito, módulo abaixo do mínimo ou acima de 1100 é rejeitado.
- Desconexão durante rolagem pausa o avanço no snapshot atual; a retomada não repete o tiro.
- Recarregar a aba usa a credencial em `sessionStorage`; fechar a sala ou expirar limpa a retomada.
- Sala ou servidor indisponível não bloqueia uma partida local.
- Resultado é sempre exposto do ponto de vista de `player`; a tela inverte vitória/derrota para `opponent`.

## Hipóteses e dependências

- **H-01:** NestJS 12.3.2, Socket.IO 4.8.4, Node 26.12.1 e TypeScript 7.0.2 compilam e executam juntos neste monorepo; a compatibilidade é provada pelos gates, não presumida por documentação externa.
- **H-02:** Atualizações autoritativas em até 30 Hz são suficientes para o primeiro teste local; nenhuma suavidade é prometida sem medição.
- **H-03:** Um código aleatório de seis caracteres e limite de salas reduzem colisão e abuso para a PoC; não constituem autenticação.
- **D-01:** O modo online depende de duas abas ou dispositivos alcançarem a mesma instância do servidor.

## Critérios mensuráveis de sucesso

- **SC-001:** Testes do pacote provam tiros por competidor, fase neutra, disparo remoto válido uma vez e ausência de tiro arbitrário.
- **SC-002:** Testes de protocolo recusam campos desconhecidos, mídia, vetores não finitos, velocidade fora do intervalo e sequência inválida.
- **SC-003:** Teste de integração com dois clientes Socket.IO cria sala, entra, fica pronto, aplica um tiro, recebe o mesmo snapshot/version e rejeita tiro duplicado/fora da vez.
- **SC-004:** Teste com relógio controlado pausa na desconexão, retoma antes de 60 segundos e remove após expiração.
- **SC-005:** Testes da tela cobrem Local/Online, criação/entrada, espera, própria vez, vez remota e falha de conexão sem regressão local.
- **SC-006:** Revisão estrutural prova que os schemas e logs não contêm frames, vídeo, landmarks, gestos brutos ou carta.
- **SC-007:** Todos os gates oficiais aplicáveis passam e o PR em rascunho referencia `Closes #111`, `Closes #112` e `Closes #113`.

## Adoção constitucional

- **Versão preservada:** 1.0.0
- **Status:** aprovado
- **Aprovador:** Wezer (@wezercarvalho)
- **Data:** 2026-10-31
- **Referência:** mensagem do maintainer nesta sessão: "Pode considerar todos os gates aceitos, se precisar pode segmentar em issues. Ao final, pode abrir um PR contendo tudo e deixar em draft".
- **Justificativa:** adota a constituição vigente sem emenda; a aprovação antecipada não autoriza declarar evidência que ainda não foi produzida.

## Usabilidade online após teste do maintainer — 2026-11-04

O maintainer solicitou identificação por nickname, participantes visíveis, vez atual/próxima e nova partida sem recriar sala.

- FR-017: antes de criar/entrar, escolher apelido de 2–20 caracteres (letras, números, espaços, ponto, hífen ou sublinhado), normalizado e distinto do outro na sala. Sem conta; preservar apelidos ao reconectar/recarregar e descartá-los ao encerrar a sala. Comandos sem apelido recebem Jogador 1/2; cliente e servidor desta revisão são atualizados juntos; apelido nunca é interpretado como HTML nem logado.
- FR-018: listar duas vagas com apelidos, marca Você, presença e prontidão/espera. Mostrar Agora e Na sequência com nomes, tiros por jogador e rótulos sem depender apenas de cores. Próxima vez vem do motor autoritativo; antes do fim do tiro é condicional à continuação da rodada, nunca promessa de uma vez que pode não acontecer.
- FR-019: após o resultado, permitir que cada jogador confirme/cancele uma revanche na mesma sala. Preservar código, papéis e nomes; iniciar uma única partida nova quando ambos confirmarem conectados. Não aceitar revanche durante partida/pausa, nem comandos atrasados de outra partida. Preservar resultado até ambos confirmarem e manter sair disponível.
- SC-008: testes de protocolo, sala, motor, cliente e tela mais demonstração com dois contextos provam identidade, turnos, pausas e revanche; modo local permanece funcional.
