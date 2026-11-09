# Plano

## Design

Baralho em core/card com categorias públicas e traduções por id, metadados privados de tempo/pontos. Manter o critério hand-angle-oscillation; cartas novas representam movimentos oscilatórios em contextos diferentes. Seleção por dados, sem ampliar o detector ou prometer interpretação semântica.

Servidor: módulo de rodadas de cartas com armazenamento efêmero e núcleo createRound. Início usa id/locale, nunca uma carta fornecida pelo cliente. Operações autenticadas por token aleatório da própria rodada, sequência monotônica e limite de frequência. Tempo deriva exclusivamente de relógio monotônico do servidor. TTL e capacidade limitados, sem mídia, logs de amostra ou ranking. Schemas Zod compartilhados nos contratos exportados.

Frontend: seletor e mensagens pt-BR/en-US, treino preservado. Competitivo explícito usa controlador separado com captura local reutilizável e envio limitado de ângulos; estado/resultado/pontos vêm do servidor. Cancelar/desmontar invalida respostas pendentes, fecha detector e libera câmera. Interface informa transmissão escalar e limitações antes de iniciar.

## Alternativas

Confiar no score, timestamps ou resultado enviado pelo navegador não atende a autoridade exigida. Enviar vídeo ou landmarks aumenta exposição e está fora do escopo. Novos classificadores gestuais mudariam a finalidade de #18; o baralho amplia dados do critério existente. Ranking persistente exigiria identidade/antifraude e fica fora.

## Constitution Check — pré-design

- I: PASS — autorização de implementação e defaults explícitos no Gate 1.
- IV: PASS — escrever primeiro regressões de baralho/tradução e autoridade/limites/expiração do servidor; implementar por incrementos.
- VI: PASS — avaliação privada na API; só ângulo escalar com aviso explícito, sem imagem/landmark/logs.

## Validação

Scripts oficiais core/server/web, typecheck, lint, check:all, contratos, SDD, docs e gates. Testes determinísticos de relógio, núcleo real e HTTP real; navegador sem câmera para seleção/idioma, detector simulado para integração. Não alegar acurácia visual.

## Constitution Check — pós-design

- VIII: PASS — somente fluxo de cartas, sem mudanças nos outros jogos. Rollback por reversão da PR; estado efêmero sem migração.
