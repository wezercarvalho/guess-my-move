# Clarificação

Centralizar significa recalibrar o neutro da cabeça; não teletransportar/reiniciar o personagem. A trava conserva a direção visual e permite reposicionar a cabeça; ao liberar, a pose atual é o neutro, evitando somar movimento feito durante a trava. A opção tem escopo da tela/sessão, sem armazenamento. Mantemos zona morta, calibração inicial e escalada; a sensibilidade multiplica somente o desvio aplicado à câmera dentro dos limites atuais.

## Gate 1 — Clarificação aprovada

- Status: aprovado
- Aprovador: wezercarvalho (maintainer)
- Data: 2026-11-07
- Artefatos aprovados: spec.md, clarification.md
- Referência: Autorização explícita do maintainer nesta conversa: abrir a issue, colocar em Ready, implementar, considerar os gates aprovados e avisar com PR em draft. Autoriza fases de execução; revisão final e merge continuam com o maintainer.

- Observações: autorização de implementação e gates de execução registrada; aceite final e merge continuam com o maintainer.

## Emenda do teste do maintainer

O maintainer solicitou centralizar em ângulo estabilizado e observou velocidade ausente na escalada. Interpretação adotada: botão nivela horizonte e rumo contextual, sem mover posição; velocidade inclui deslocamento vertical e não vira impulso ao soltar. A pergunta sobre altura é respondida pelos parâmetros da conferência inicial: âncora virtual então limitada a 220 m inclusive; prédios dentro de 160 m de alcance continuam válidos acima disso. Pedido autoriza a implementação nesta PR; aceite final continua pendente.

O maintainer em seguida solicitou explicitamente ampliar a âncora virtual a 500 m para jogar entre os prédios de Manhattan. Este é o limite vigente pretendido, inclusive; preservam-se as âncoras em prédios acima dele. Pedido autoriza a emenda de FR-006/T007.
