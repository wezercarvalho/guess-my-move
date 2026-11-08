# Clarificação

## Decisões

Manter Socket.IO como transporte de jogo. OpenAPI descreve apenas endpoints HTTP reais; exportar também os schemas dos eventos. Nest Observe fica desativado por padrão, e só um coletor local simulado participa dos testes. Métricas locais são protegidas por token próprio e não são recursos de jogador. Não adicionar identidade, banco ou hospedagem.

## Gate 1 — Clarificação aprovada

- Status: aprovado
- Aprovador: wezercarvalho (maintainer)
- Data: 2026-11-06
- Artefatos aprovados: spec.md, clarification.md
- Referência: pedido nesta conversa para realizar a migração nativa e observabilidade após o merge, ampliado pelo pedido de contratos OpenAPI para outros frontends.
- Observações: detalhes reversíveis de integração e configuração são decisões técnicas; nenhum serviço externo será ativado nesta entrega. A aprovação final permanece com o maintainer.
