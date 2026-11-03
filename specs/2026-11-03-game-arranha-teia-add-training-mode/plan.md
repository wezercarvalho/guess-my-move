# Plano

## Abordagem

FR-001: seleção de modo em SwingApp, preservando o catálogo de cidades. FR-002: gerador local determinístico de City v1 e campo visual opcional aurora; renderizador usa materiais básicos e adereços geométricos locais. FR-003 e FR-004: progresso puro cumulativo observado no controlador a cada quadro, exposto no snapshot e numa lista lateral. NFR-001 e NFR-002: sem dependência nova, câmera inalterada, recursos Three liberados no dispose.

## Constitution Check — pré-design

Intenção e privacidade preservadas; sem fronteira nova. Testes de comportamento antes da implementação. Dados de treino locais e sem persistência. Rollback pelo commit. Não há exceção de produto nem nova infraestrutura. NFR-003 exige evidência honesta do runtime e limites de câmera/visual.

## Riscos e validação

Pontes aéreas decorativas não servem de chão: plataformas transitáveis são telhados com a mesma colisão v1, adereços ficam fora do caminho. Testes cobrem primeira âncora e parede; desenho e gestos reais ficam com o maintainer. Executar check:all e gates de governança. Escolha rejeitada: alterar a física para pontes suspensas, pois aumentaria escopo.

## Constitution Check — pós-design

PASS: os requisitos convergem com o plano e o risco visual será revisado pelo maintainer; nenhuma nova captura, serviço, mídia ou dependência.
