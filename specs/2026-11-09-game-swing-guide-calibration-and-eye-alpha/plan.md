# Plano

## Contexto técnico

React/Vite, MediaPipe local, núcleo puro de swing. Máquina de estados pura consome frames novos e controla preparação; controlador bloqueia ações; tela renderiza snapshot. No online manter SwingScreen montada da espera ao jogo com callback de prontidão.

Ocular reutiliza íris do FaceLandmarker, normaliza posição por cantos/pálpebras e ajusta transformação afim para posição no cenário. Nove alvos com média estável e quatro de validação. Suspender fora de ±10° da pose calibrada evita extrapolação. Geometria relativa remove translação comum; não garante precisão ocular. WebGazer é alternativa rejeitada neste alpha por adicionar modelo/ciclo de inferência/dependência; não afirmamos superioridade. Fontes Google Research MediaPipe Iris e WebGazer consultadas nesta conversa em 2026-11-09.

## Constitution Check pré-design

- PASS: autorização explícita; escopo delimitado; sem mídia externa nem mudança de carta.

## Estratégia de validação

Testes puros vermelhos → implementação → integração e regressões → gates oficiais → roteiro manual e PR draft. FR-001/FR-002 no núcleo; FR-003/FR-004 UI/guardas; FR-005 lobby; FR-006/FR-007 ocular; FR-008 documentação.

## Riscos e rollback

Câmera real não é simulada como evidência de precisão; entregar roteiro. Ocular começa desligado. Revert da PR restaura fluxo anterior. Sem mudança de protocolo.

## Constitution Check pós-design

- PASS: captura única, funções testáveis, parâmetros em memória, aprovação registrada; nenhuma exceção ao test-first.
