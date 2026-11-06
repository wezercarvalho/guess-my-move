# Plano

## Design

Base pequena da iniciativa #128, usada nas extrações #134/#135. AsyncTrackerResource possui o detector, geração da carga e erro; load recebe factory e callbacks da fachada, release invalida/fecha e fail registra erro sem reter um detector inválido. Não conhece React, regras ou landmarks.

VideoFrameGate possui somente observação de requestVideoFrameCallback, sinal pendente e fallback currentTime. O chamador continua dono do vídeo e da captura; não há getUserMedia nem processamento dentro da utilidade. Callback opcional de contagem preserva FPS observado do controlador de bolinhas, sem inventar medição de desempenho.

Callbacks atrasados não rearmam vídeo cancelado nem reinstalam detector. Adoção ocorre em PRs separadas por jogo, usando composição; não criar hierarquia de controladores. Assinaturas públicas dos jogos continuam estáveis.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                          |
| --------------- | --------- | ------------------------------------------------------------------ |
| I. Escopo       | PASS      | Desdobramento da iniciativa #128 explicitado antes de implementar. |
| IV. Test-first  | PASS      | Testes de ciclo/quadros antes das utilidades.                      |
| VI. Privacidade | PASS      | Não captura, persiste ou transmite mídia.                          |

## Validação

Script oficial test:capture, suíte web e regressões dos controladores durante adoção, tipos/lint, build, SDD, docs e gates. Testes usam recursos fecháveis e vídeos simulados, sem câmera real ou rede.

## Constitution Check — pós-design

| Princípio/gate     | Resultado | Evidência                                                                                                         |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| VIII. Simplicidade | PASS      | Duas responsabilidades existentes em três cargas de detectores e dois vídeos; sem política de jogo compartilhada. |

## Limites

Nenhuma alteração de limiares, geometria, calibragem, câmera do usuário ou regras. Rollback por reversão da adoção e da base. A base isolada não encerra a issue até demonstrar uso real nos controladores.
