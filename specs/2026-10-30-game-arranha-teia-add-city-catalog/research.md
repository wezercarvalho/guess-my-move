# Pesquisa — 2026-10-30-game-arranha-teia-add-city-catalog

## Fontes

A base detalhada está em `docs/research/city-maps-for-arranha-teia.md` (pesquisa da issue #82). Esta spec reaproveita os achados medidos e acrescenta a decisão de implementação.

## Achados aplicados

- **Midtown atual:** 556 prédios, 177 vias, 88% com altura explícita; mediana/máxima 18/366 m; 29% dos raios horizontais a 60 m acertaram paredes na amostra de 40×40.
- **Avenida Paulista (consulta de 2026-10-29):** 960 prédios, 186 vias, 96% com altura explícita; mediana/máxima 12/102 m; 23% dos raios a 60 m acertaram paredes. O JSON tinha 153.212 bytes.
- **Marais:** 0% dos raios a 60 m acertaram paredes; não entra nesta entrega.
- **OSM/Overpass:** ODbL exige atribuição e share-alike; as consultas devem ser pequenas. A rede só existe no build manual da cidade, nunca no jogo.
- **`3d-tiles-renderer`:** pode desenhar Google/Cesium/3D Tiles dentro de Three.js, mas o realismo vem dos dados. Não resolve sozinho colisão, licença, custo nem relevo.
- **Google Photorealistic:** termos proíbem armazenamento/offline fora das exceções e uso de extração; exige terceiros em tempo de jogo. Não entra.
- **Rio:** precisa de relevo. O motor atual assume chão plano; entregar Rio com essa limitação seria visualmente enganoso.

## Decisão técnica

1. Catálogo local como contrato de descoberta.
2. Arquivo `City` local continua sendo o contrato único da física e renderização.
3. Conversor OSM recebe configuração explícita (nome, bbox, rotação), e o build escolhe uma fonte cadastrada.
4. Apresentação procedural melhora por materiais e iluminação locais; sem textura externa.
5. Rio e uma camada fotorrealista são próximos incrementos independentes.

## Valores a medir nesta entrega

- Bytes, prédios, vias, altura mediana/máxima e cobertura de altura explícita do novo `paulista.json`.
- Requisições em tempo de jogo e erros de console.
- Larguras 390, 900 e 1440 px.
- fps só será citado se realmente medido numa GPU real; o Chromium headless por software não prova desempenho.
