# Plano

## Abordagem

FR-001: seleção de modo em SwingApp, preservando o catálogo de cidades. FR-002: gerador local determinístico de City v1 e campo visual opcional aurora; renderizador usa materiais básicos e adereços geométricos locais. FR-003 e FR-004: progresso puro cumulativo observado no controlador a cada quadro, exposto no snapshot e numa lista lateral. NFR-001 e NFR-002: sem dependência nova, câmera inalterada, recursos Three liberados no dispose.

## Constitution Check — pré-design

Intenção e privacidade preservadas; sem fronteira nova. Testes de comportamento antes da implementação. Dados de treino locais e sem persistência. Rollback pelo commit. Não há exceção de produto nem nova infraestrutura. NFR-003 exige evidência honesta do runtime e limites de câmera/visual.

## Riscos e validação

Pontes aéreas decorativas não servem de chão: plataformas transitáveis são telhados com a mesma colisão v1, adereços ficam fora do caminho. Testes cobrem primeira âncora e parede; desenho e gestos reais ficam com o maintainer. Executar check:all e gates de governança. Escolha rejeitada: alterar a física para pontes suspensas, pois aumentaria escopo.

## Constitution Check — pós-design

PASS: os requisitos convergem com o plano e o risco visual será revisado pelo maintainer; nenhuma nova captura, serviço, mídia ou dependência.

## Plano de correção — 2026-11-04

FR-005: usar contain no preview, consistente com a projeção existente do overlay; preservar espelhamento único. FR-006: estabilizar callback de resize entre publicações e evitar resize com dimensões repetidas; agrupar néon estático por material com instâncias, preservando transformações e descarte. FR-007: separar amostra nova da suavização por quadro, exigir janela de pose estável para o neutro e extrair direção frontal da matriz sem misturar roll; indicar calibração e impedir centralização sem leitura válida. SC-003: testes falhando antes das correções, gates oficiais, demonstração e contagens no navegador; câmera real ainda depende do maintainer.

Constitution Check pré/pós-design: correções no escopo de gesto/câmera autorizadas explicitamente pelo usuário em 2026-11-04; nenhuma transmissão/persistência de mídia, dependência, mudança de física ou serviço novo. Risco: calibração pode esperar mais com movimento; status deve explicar ao jogador. Não alterar ganho/deadzone por tentativa sem medição. Rejeitado diminuir qualidade visual como atalho; reduzir trabalho repetido preservando a cena.
