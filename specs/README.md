# Catálogo de specs

As specs são contratos vivos centralizados em `specs/YYYY-MM-DD-<domínio>-<capacidade>-<objetivo>/`. O frontmatter de `spec.md` é a fonte única dos metadados (id, título, domínio, status, aliases, resumo).

## Descoberta

Procure por título, domínio, capacidade, objetivo ou aliases no frontmatter de `specs/*/spec.md`.

## Manutenção

- Mantenha título, aliases, resumo e status atualizados no frontmatter.
- Não reutilize IDs removidos.
- Relacione substituições por `related_specs` e `supersedes`.
- Use os estados definidos em [`../docs/development-strategies/sdd/README.md`](../docs/development-strategies/sdd/README.md).

## Identidade

`id` é igual ao nome completo do diretório (`created_at` + slug). A data de criação é válida no calendário e imutável; atualização, aprovação e merge não alteram a identidade.

## Specs

| ID                                                                                                                               | Estado         | Resumo                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`2026-10-20-vision-gesture-recognition-validate-waving-poc`](2026-10-20-vision-gesture-recognition-validate-waving-poc/spec.md) | `implementing` | PoC visual (Fase 0): validar se um modelo multimodal gerenciado reconhece "acenar" a partir de frames da webcam.  |
| [`2026-10-21-game-engine-round-referee-build-core-loop`](2026-10-21-game-engine-round-referee-build-core-loop/spec.md)           | `implementing` | Núcleo do jogo: carta pública/privada, máquina de estados da rodada, árbitro semântico e histórico de rejeitados. |
