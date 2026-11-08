# Plano

## Constitution Check — pré-design

Escopo autorizado e contratos explícitos antes de código. Nenhuma captura, transmissão de mídia, conta ou publicação. Segredos só no ambiente; credenciais nunca entram no documento público.

## Abordagem

FR-001: instalar plataforma nativa compatível, passar adaptador na factory compartilhada por produção e testes; habilitar recusa durante encerramento e diagnóstico de conflito de rotas. FR-002: extrair serviço de telemetria de operações e snapshot agregado, protegido por token em header. FR-003: módulo do SDK com configuração validada, instrument hook e política restrita, desativado por padrão; exercitar coletor local. FR-004–FR-006: OpenAPI 3.1 para HTTP derivado de schemas Zod compartilhados e definição explícita de operações, exportação determinística e schemas Socket.IO derivados do Zod, snapshots e gate por paths. Documentar fronteiras e consumo sem React.

## Alternativas e riscos

Rejeitados: recriar comandos de jogo como HTTP, ativar SaaS automaticamente, acoplar todo frontend ao bundle React ou migrar para um novo transporte. SDK tem coleta automática: conferir tipos e implementação, limitar captura e testar sentinelas. A versão disponível do módulo Swagger declara peer TypeScript 5/6, enquanto o projeto usa 7. Evitar introduzir dependência com peer incompatível: gerar OpenAPI 3.1 diretamente dos schemas Zod e testar as operações contra o servidor real. A UI Swagger hospedada não é requisito; oferecer documento JSON e exemplos de geração de clientes. Recursos não aplicáveis do Nest ficam registrados como candidatos, sem código especulativo.

## Constitution Check — pós-design

PASS: testes de privacidade e compatibilidade antecedem implementação; telemetria externa opcional e desligada. Contratos versionados tornam mudanças observáveis. Sem exceção de fronteira de informação ou dependência de provedor pago.
