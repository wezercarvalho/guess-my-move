# Clarificação

## Decisões

- Preservar o significado anterior de activeConnections como sessões de namespace e acrescentar activeTransports. MAX_CONNECTIONS e MAX_CONNECTIONS_PER_IP são tetos independentes para ambos, com os mesmos valores configurados.
- Reserva acontece antes do callback positivo de allowRequest; transporte WebSocket exclusivamente, sem polling. O fechamento do socket libera a reserva e o timeout Socket.IO de 45 segundos conserva o limite temporal pré-namespace.
- Regras, origens e proxy confiável são preservados; não há nova identidade de usuário.

## Gate 1 — Clarificação aprovada

- Status: aprovado
- Aprovador: wezercarvalho (maintainer)
- Data: 2026-11-06
- Artefatos aprovados: spec.md, clarification.md
- Referência: Autorização do maintainer nesta conversa em 2026-11-06: “Revisa as issues, adequa o que for preciso, coloca em ready e pode iniciar o desenvolvimento seguindo os passos adequados e padronizados.” Aplica-se à correção delimitada da issue #124 já descrita e aceita para iniciar; não autoriza merge nem Gate 3.

- Observações: decisões reversíveis dentro do escopo da issue #124; aceite final não presumido.
