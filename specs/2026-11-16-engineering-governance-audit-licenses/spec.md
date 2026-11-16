---
id: 2026-11-16-engineering-governance-audit-licenses
title: Auditar licenças e avisos de terceiros
summary: Inventariar resoluções, preservar avisos distribuídos e documentar evidências e bloqueios de release.
slug: engineering-governance-audit-licenses
strategy: sdd
domain: engineering
capability: governance
objective: audit-licenses
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - licenciamento
    - avisos de terceiros
    - issue 177
code_paths:
    - scripts/lib/license-inventory.mjs
    - test/security/
    - apps/web/
    - docs/development-context/security/
    - package.json
related_specs:
    - 2026-11-16-engineering-governance-open-source
supersedes: []
branch: chore/177-third-party-licenses
constitution_version: 1.0.0
created_at: 2026-11-16
updated_at: 2026-11-16
---

# Auditar licenças e avisos de terceiros

## Resumo

Mapear origens, licenças e avisos dos componentes e ativos, com inventário reproduzível, registro das limitações e política de não distribuir builds públicos enquanto as obrigações não estiverem resolvidas. [Issue #177](https://github.com/wezercarvalho/guess-my-move/issues/177).

## Problema

O código é MIT, mas dados, fontes, pacotes e modelos possuem seus próprios termos. Lockfile não informa licenças e os avisos de fonte não acompanham explicitamente o artefato web. Não há confirmação integral de licenças dos arquivos .task.

## Objetivos

- Identificar resoluções e metadados locais verificáveis, escopos e pendências.
- Registrar origem e evidências oficiais dos ativos.
- Preservar avisos no artefato web, oferecer acesso às licenças e não tratar inventário como licença de distribuição.

## Fora de escopo

- Relicenciar o código, alterar gameplay, dependências/lockfile, fazer deploy, publicar modelos, atualizar configurações administrativas ou envolver serviços pagos.
- Emitir parecer jurídico ou afirmar conformidade completa sem evidências.
- Codex, Work e merge pelo agente.

## Atores

- **Mantenedor:** revisa licenças e decide liberação de distribuição.
- **Contribuidor:** identifica origem, termos e avisos ao introduzir ativos.
- **Usuário:** encontra créditos e avisos no build web.

## Histórias de usuário

### US-001 — Inventário rastreável (P1)

Como mantenedor, quero localizar uma resolução, seu escopo e metadados e identificar lacunas sem presumir direitos.

**Teste independente:** fixture com versões distintas e dependências diretas e transitivas; pacote instalado com e sem aviso.

### US-002 — Atribuições no build (P1)

Como usuário, quero encontrar avisos de fontes, mapas e componentes sem sair do app para conhecer sua origem.

**Teste independente:** teste do link no menu, crédito OSM e leitura dos avisos gerados pelo build.

## Requisitos funcionais

- **FR-001:** Inventariar cada locator do lockfile com versão, origem, escopo conservador e evidência de licença/avisos instalados ou pendência explícita.
- **FR-002:** Registrar fontes, licenças documentadas, ambiguidades e política de não distribuir publicamente artefatos sem conferência.
- **FR-003:** Preservar avisos MIT, OFL, ODbL e avisos encontrados nos candidatos instalados web, com índice e acesso no menu e crédito do mapa; testar integração.
- **FR-004:** Evidenciar checks, sincronizar spec #175 e preparar aceite na mesma PR, condicionado ao merge.

## Requisitos não funcionais

- **NFR-001:** Preservar MIT, contratos, gameplay e privacidade; sem novas dependências, serviços pagos ou deploy.
- **NFR-002:** Diferenciar licença declarada, texto presente, lacuna e verificação de obrigações. Não prometer conformidade completa.

## Edge cases

- Pacote de plataforma ausente ou licença/aviso faltante: registrar pendência; não inferir licença.
- Peers e múltiplas versões: classificação conservadora, sem alegar inclusão exata no bundle.
- Modelo sem licença integral confirmada: não liberar distribuição pública.
- Build: verificar presença e bytes dos avisos copiados.

## Hipóteses e dependências

- Yarn node-modules e manifests/lock atuais; CI fornece instalação para auditoria.
- Não há investigação binária local nem confirmação jurídica integral neste ambiente.

## Critérios mensuráveis de sucesso

- **SC-001:** Inventário reproduzível e relatório do CI para cada resolução, com status e escopos.
- **SC-002:** Política e fontes documentadas, ambiguidades e responsável explícitos.
- **SC-003:** Build web contém avisos/índice e teste de links e paridade passa.
- **SC-004:** CI e reconciliação na PR; aceite condicionado ao merge humano.
