---
id: 2026-11-06-engineering-runtime-monitor-security-releases
title: Monitorar correções publicadas do runtime Node
summary: Detectar correções de segurança publicadas e fim de suporte do Node pinado, mantendo uma rotina rastreável até a atualização humana.
slug: engineering-runtime-monitor-security-releases
strategy: sdd
domain: engineering
capability: runtime
objective: monitor-security-releases
status: validating
owners:
    - wezercarvalho
reviewers: []
aliases: []
code_paths:
    - scripts/
    - .github/workflows/
    - test/security/
related_specs: []
supersedes: []
branch: chore/node-runtime-monitor
constitution_version: 1.0.0
created_at: 2026-11-06
updated_at: 2026-11-06
---

# Monitorar correções publicadas do runtime Node

## Resumo

Detectar correções de segurança publicadas e fim de suporte do Node pinado, mantendo uma rotina rastreável até a atualização humana.

## Problema

Issues da revisão pós-merge definem comportamentos reproduzidos e limites de manutenção; executar apenas o incremento explicitado no plano.

## Objetivos

- Entregar resultado observável e rastreável com comportamento anterior preservado fora da correção.

## Fora de escopo

- Merge, deploy, Violão, mídia externa, contas e nova persistência.

## Atores

- Jogador: sessão consistente e controles preservados.
- Mantenedor: componentes e evidências revisáveis.

## Histórias de usuário

### US-001 — Incremento verificável (P1)

Como mantenedor, quero o comportamento descrito pelos requisitos para revisar e integrar sem misturar regras de outros jogos.

**Teste independente:** executar a regressão dirigida do requisito e o agregado adequado.

**Critérios de aceitação:** dado o cenário da issue, quando a operação ou extração acontece, então os requisitos abaixo são demonstráveis e regressões permanecem aprovadas.

## Requisitos funcionais

- **FR-001:** Comparar o pin exato com versões estáveis publicadas da mesma major e suporte oficial; falhar se houver correção de segurança posterior ou suporte encerrado, sem confundir release comum com patch de segurança.
- **FR-002:** Consultar somente fontes oficiais fixas, com timeout e limite de resposta; falhar sem veredito em erro de rede, formato inválido ou pin desconhecido, sem alterar arquivos ou instalar versões.
- **FR-003:** Disponibilizar comando oficial, verificação diária/manual e em PR/hook quando o runtime ou seu auditor muda, com responsável e procedimento documentados. Patch futuro continua dependente da publicação e não encerra #132.

## Requisitos não funcionais

- **NFR-001:** preservar fronteira da carta, mídia local, segredos somente nos canais privados e telemetria externa desativada por padrão.
- **NFR-002:** não modificar regras, limites, mapas ou formatos sem requisito explícito; preferir composição a hierarquia genérica.

## Edge cases

- Falhas e descarte durante operação assíncrona; respostas repetidas ou antigas; uso por ambos os jogos.

## Hipóteses e dependências

- Somente dependências já instaladas, salvo indicação explícita no plano; sem serviços externos nos testes.

## Critérios mensuráveis de sucesso

- **SC-001:** cada requisito tem teste/demonstração e tarefa vinculada, com regressões adequadas aprovadas.
