# Plano

## Design

Adicionar suíte de integração separada em apps/server/integration, com config Vitest que reutiliza SWC/metadados do servidor. Importar MultiplayerClient diretamente do frontend, injetando Socket.IO real e storage em memória. Tsconfig específico permite a fronteira entre os projetos sem ampliar o build de produção. Script test:lobby entra no agregado test do servidor, sem dependência nova.

Um wrapper mínimo do transporte adia ou descarta somente callbacks de ACK. Eventos e payloads passam pelos contratos de produção, sem fabricar broadcasts. Estados públicos são observados por subscribe/getSnapshot. Servidor usa createServerApp e porta 0. Timeouts explícitos e afterEach destroem clientes, sockets e aplicação, mesmo após falha.

Para concluir a partida em tempo de CI, pausar ticker do gateway e avançar RoomService.tick, publicando somente seus estados reais pelo servidor Socket.IO. Tiros passam pelo cliente/gateway normais; nenhum estado ou regra é alterado. Respeitar rate limit real entre tiros. Não usar fake timers nos sockets. No teste de ACK perdido, injetar Date.now com offset antes de criar a aplicação; após desconexão, avançar somente esse relógio além da janela de reconexão e esperar o ticker real expirar a reserva. Isso cobre inclusive a perda de leave junto com a queda, em vez de pressupor entrega garantida.

## Alternativas

Playwright adicionaria navegador sem necessidade para testar a sincronização. Duplicar eventos/rules em cliente artificial perderia a regressão desejada. Usar portas fixas ou câmera tornaria o teste frágil. Simular estado finished não comprovaria revanche real.

## Constitution Check — pré-design

- I: PASS — intenção e autorização registradas no Gate 1.
- IV: exceção justificada — mudança adiciona cobertura, sem novo comportamento de produção; teste é escrito antes do script e executado contra produção existente. Não é necessário introduzir defeito artificial para obter vermelho.
- VI: PASS — sem mídia, serviços externos ou logs de credenciais.

## Validação

Node e Yarn dos manifestos. Scripts oficiais test:lobby, typecheck, test, check:all, sdd:check, docs:format:check e gates locais. Registrar duração da suíte e cenário que ela cobre além dos testes isolados.

## Constitution Check — pós-design

- VIII: PASS — incremento de cobertura sem contratos ou regras novos; rollback por reversão da PR.
