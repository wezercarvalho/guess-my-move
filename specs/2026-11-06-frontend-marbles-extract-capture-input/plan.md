# Plano

## Design

Issue #135 da iniciativa #128; segunda adoção da base #142. MarblesHandInput recebe mão processada, proporção, instante, atirador, permissão da vez e modo de controle. Possui pinch/flick/aim e feedback derivado; devolve somente o vetor quando há disparo. Não conhece MediaPipe, câmera, socket ou regras de pontuação.

Controller conserva sessão de jogo, bot, publicação e autoridade da vez; delega tradução da mão e posse do detector/quadros. Resets de turno preservam histórico de debug; resets de sessão/controle limpam esse histórico. Tipos são movidos e reexportados pelo caminho antigo. Fallback de erro de bolinhas é passado à utilidade para preservar mensagem do domínio.

Falha de inferência deve encerrar recurso e ficar em error; o código anterior sobrescrevia esse status com idle ao liberar. Adicionar regressão antes de corrigir, sem alterar limiares nem regras.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                 |
| --------------- | --------- | --------------------------------------------------------- |
| I. Escopo       | PASS      | Issue Ready e autorização do maintainer.                  |
| IV. Test-first  | PASS      | Casos de entrada e falha de inferência antes da extração. |
| VI. Privacidade | PASS      | Entrada é derivada local; sem mídia ou persistência nova. |

## Validação

Scripts test:marbles-input, test:marbles-controls, captura compartilhada e suíte web completa serial, tipos/lint e builds. Manter matriz própria vez por papel/modo, bot, revanche, câmera e cleanup. O servidor segue autoritativo e não recebe posição/landmarks.

## Constitution Check — pós-design

| Princípio/gate   | Resultado | Evidência                                                     |
| ---------------- | --------- | ------------------------------------------------------------- |
| VIII. Composição | PASS      | Não criar hierarquia de jogos ou partilhar regras diferentes. |

## Limites

Sem alterações de câmera real, calibragem, limiares, modelo, layout ou regras. Configuração de teste compilado do servidor e limites do ambiente são os da sequência anterior. Rollback por reversão do incremento.
