# Plano

## Design

Issue #134 da iniciativa #128; base de recursos #142. OnlineSwingSession recebe bridge tipada e world pelo método advance; não conhece detector nem React. Mantém janela de envio de 100 ms, deltas acumulados, previsão limitada e snapshot aplicado. Retorna apenas room/playerId para o renderer. Reset descarta contexto anterior, inclusive ao desmontar/remontar; troca de partida descarta deltas sem reusar a câmera.

SwingController continua fachada e orquestração de calibração/física local. Usa AsyncTrackerResource para mãos/rosto e VideoFrameGate em vez de controlar tokens e callbacks. Os resets de cabeça/gestos continuam no controlador. Derivação por lado recebe mãos, agarre e pulsos anteriores e devolve sinais/debug/deltas; geometria/limiares são os mesmos. Tipos públicos ficam em módulo de contratos e são reexportados pelo caminho anterior.

## Constitution Check — pré-design

| Princípio/gate  | Resultado | Evidência                                                                                          |
| --------------- | --------- | -------------------------------------------------------------------------------------------------- |
| I. Intenção     | PASS      | Issue Ready refinada e autorização do maintainer.                                                  |
| IV. Test-first  | PASS      | Novos testes do adaptador/derivação antes de extrair; regressões existentes caracterizam a câmera. |
| VI. Privacidade | PASS      | Sem mídia/landmarks fora da captura local; bridge só recebe intents.                               |

## Validação

Node/stack dos manifestos. Scripts test:swing-session, test:swing-controls e suíte web serial, tipos/lint e build. Comparar mesmo vídeo alimentando mãos/rosto, descarte de carga atrasada, calibração, teias e escalada. Câmera/GPU física continuam para validação humana; nenhuma afirmação de FPS.

## Constitution Check — pós-design

| Princípio/gate   | Resultado | Evidência                                                                                 |
| ---------------- | --------- | ----------------------------------------------------------------------------------------- |
| VIII. Composição | PASS      | Recursos e regras de jogo separados; nenhuma superclasse ou detector no adaptador online. |

## Riscos

Não duplicar leitura do vídeo nem alterar ordem dos resets; callback de frame cancelado não pode rearmar. Calibração e gestos preservados com testes existentes. Rollback por reversão deste incremento sem mudar protocolos.
