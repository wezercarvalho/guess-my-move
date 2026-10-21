import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { checkCatalog } from '../../scripts/sdd/check-catalog.mjs'

const id = '2026-10-05-quality-checker-verificar-catalogo'
const gate = (n) =>
    `## Gate ${n}\n\n- **Status:** aprovado\n- **Aprovador:** Maintainer\n- **Data:** 2026-10-05\n- **Artefatos aprovados:** ${n === 1 ? 'spec.md, clarification.md' : 'plan.md, tasks.md'}\n- **Referência:** resposta explícita da sessão\n- **${n === 1 ? 'Observações' : 'Exceções'}:** nenhuma\n`
const artifacts = {
    'checklists/specification.md':
        '# Checklist\n- [x] Revisado\n\n- **Resultado:** aprovado\n- **Revisor:** Codex\n- **Data:** 2026-10-05\n',
    'clarification.md': gate(1),
    'plan.md':
        '## Constitution Check — pré-design\nPASS\n\n## Constitution Check — pós-design\nPASS\n',
    'tasks.md':
        '- [x] T001 [FR-001] Verificar catálogo em scripts/sdd.\n\n## Análise de consistência\n- **Status:** aprovada\n- **Revisor:** Codex\n- **Data:** 2026-10-05\n- **Lacunas:** nenhuma\n\n' +
        gate(2),
    'validation.md':
        '## Estado\n- **Spec:** spec.md\n- **Status:** aprovado\n- **Constituição:** 1.0.0\n- **Data:** 2026-10-05\n- **Executor/revisor:** Codex\n- **Commit:** não disponível, revisão local\n\n## Evidências por requisito\n| Requisito | Tarefas | Evidência | Resultado |\n| --- | --- | --- | --- |\n| FR-001 | T001 | fixture observável | PASS |\n\n## Gate 3\n- **Veredito:** aprovado\n- **Aprovador:** Codex, revisão estrutural\n- **Data:** 2026-10-05\n- **Escopo aprovado:** FR-001 e artefatos\n- **Riscos aceitos:** nenhum\n- **Observações:** nenhuma\n',
}
const metadata = (name = id, status = 'draft') => ({
    id: name,
    title: 'Verificar catálogo',
    slug: name.slice(11),
    strategy: 'sdd',
    domain: 'quality',
    capability: 'checker',
    objective: 'verificar-catalogo',
    status,
    owners: ['maintainer'],
    reviewers: [],
    summary: 'Verificar o catálogo com diagnóstico.',
    aliases: [],
    code_paths: ['scripts/sdd/'],
    related_specs: [],
    supersedes: [],
    branch: null,
    constitution_version: '1.0.0',
    created_at: name.slice(0, 10),
    updated_at: name.slice(0, 10),
})
const specification = (data, suffix = '') =>
    `---\n${JSON.stringify(data, null, 2)}\n---\n# Verificar catálogo\n\n## Requisitos funcionais\n- **FR-001:** O checker DEVE verificar a estrutura.\n${suffix}`
async function fixture(t, status = 'draft', name = id) {
    const root = await mkdtemp(join(tmpdir(), 'gmm-sdd-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(join(root, 'docs/development-strategies/sdd'), {
        recursive: true,
    })
    await writeFile(
        join(root, 'docs/development-strategies/sdd/constitution.md'),
        '**Versão:** 1.0.0\n',
    )
    const directory = join(root, 'specs', name)
    await mkdir(join(directory, 'checklists'), { recursive: true })
    const data = metadata(name, status)
    await writeFile(join(directory, 'spec.md'), specification(data))
    if (status !== 'draft')
        for (const [file, value] of Object.entries(artifacts))
            await writeFile(join(directory, file), value)
    return {
        root,
        directory,
        data,
        save: async (suffix = '') =>
            writeFile(join(directory, 'spec.md'), specification(data, suffix)),
    }
}
const has = (errors, rule) =>
    errors.some((error) => error.rule === rule && error.file && error.message)

for (const status of [
    'draft',
    'specified',
    'clarified',
    'planned',
    'implementing',
    'validating',
    'validated',
])
    test(`estado válido: ${status}`, async (t) => {
        const f = await fixture(t, status)
        assert.deepEqual(await checkCatalog(f.root), [])
    })
for (const name of [
    '2000-02-29-quality-checker-verificar',
    '2026-10-05-quality-checker-outra',
    '2026-10-06-quality-checker-verificar-catalogo',
])
    test(`identidade válida ${name}`, async (t) => {
        const f = await fixture(t, 'draft', name)
        assert.deepEqual(await checkCatalog(f.root), [])
    })
for (const name of [
    '1900-02-29-quality-checker-verificar',
    '2026-04-31-quality-checker-verificar',
    '2026-13-01-quality-checker-verificar',
])
    test(`identidade rejeita calendário ${name}`, async (t) => {
        const f = await fixture(t, 'draft', name)
        assert.ok(has(await checkCatalog(f.root), 'identity'))
    })
test('identidade aceita mesma data e mesmo slug em datas diferentes', async (t) => {
    const f = await fixture(t)
    for (const name of [
        '2026-10-05-quality-checker-outra',
        '2026-10-06-quality-checker-verificar-catalogo',
    ]) {
        await mkdir(join(f.root, 'specs', name))
        await writeFile(join(f.root, 'specs', name, 'spec.md'), specification(metadata(name)))
    }
    assert.deepEqual(await checkCatalog(f.root), [])
})
for (const field of ['id', 'slug', 'created_at'])
    test(`identidade rejeita divergência ${field}`, async (t) => {
        const f = await fixture(t)
        f.data[field] = field === 'created_at' ? '2026-10-06' : 'outra'
        await f.save()
        assert.ok(has(await checkCatalog(f.root), 'identity'))
    })
test('identidade rejeita ID duplicado em diretórios diferentes', async (t) => {
    const f = await fixture(t)
    const other = join(f.root, 'specs', '2026-10-05-quality-checker-outra')
    await mkdir(other)
    await writeFile(join(other, 'spec.md'), specification(f.data))
    assert.ok(has(await checkCatalog(f.root), 'duplicate-id'))
})
for (const [field, value] of [
    ['title', 'TODO'],
    ['owners', []],
    ['related_specs', 'id'],
    ['updated_at', '2026-02-30'],
    ['constitution_version', '9.0.0'],
    ['branch', 4],
    ['code_paths', [2]],
    ['summary', '<resumo>'],
    ['status', 'done'],
])
    test(`metadata rejeita ${field}: ${JSON.stringify(value)}`, async (t) => {
        const f = await fixture(t)
        f.data[field] = value
        await f.save()
        assert.ok(has(await checkCatalog(f.root), 'metadata'))
    })
test('metadata rejeita frontmatter ausente e YAML malformado', async (t) => {
    const f = await fixture(t)
    for (const value of ['# sem YAML', '---\nfoo: [\n---\n']) {
        await writeFile(join(f.directory, 'spec.md'), value)
        assert.ok(has(await checkCatalog(f.root), 'frontmatter'))
    }
})
test('metadata verifica relações e aceita destino completo', async (t) => {
    const f = await fixture(t)
    f.data.related_specs = ['inexistente']
    await f.save()
    assert.ok(has(await checkCatalog(f.root), 'relation'))
    f.data.related_specs = [id]
    await f.save()
    assert.deepEqual(await checkCatalog(f.root), [])
})
test('versão anterior exige decisão formal de adoção constitucional', async (t) => {
    const f = await fixture(t)
    f.data.constitution_version = '0.9.0'
    await f.save()
    assert.ok(has(await checkCatalog(f.root), 'metadata'))
    await f.save(
        '## Adoção constitucional\n- **Status:** aprovado\n- **Versão preservada:** 0.9.0\n- **Aprovador:** Maintainer\n- **Data:** 2026-10-05\n- **Referência:** decisão humana registrada\n- **Justificativa:** preservação temporária da versão anterior durante a adoção.\n',
    )
    assert.deepEqual(await checkCatalog(f.root), [])
})
test('estado validado exige constituição coerente com o frontmatter', async (t) => {
    const f = await fixture(t, 'validated')
    await writeFile(
        join(f.directory, 'validation.md'),
        artifacts['validation.md'].replace('**Constituição:** 1.0.0', '**Constituição:** 9.0.0'),
    )
    assert.ok(has(await checkCatalog(f.root), 'validation-state'))
})
test('evidência PASS exige tarefa e prova preenchidas sem placeholders', async (t) => {
    const f = await fixture(t, 'validated')
    for (const row of [
        '| FR-001 | | fixture observável | PASS |',
        '| FR-001 | T001 | | PASS |',
        '| FR-001 | T001 | TODO | PASS |',
    ]) {
        await writeFile(
            join(f.directory, 'validation.md'),
            artifacts['validation.md'].replace(
                '| FR-001 | T001 | fixture observável | PASS |',
                row,
            ),
        )
        assert.ok(has(await checkCatalog(f.root), 'evidence-coverage'))
    }
})
test('checklist rejeita checkbox pendente em lista aninhada', async (t) => {
    const f = await fixture(t, 'specified')
    await writeFile(
        join(f.directory, 'checklists/specification.md'),
        artifacts['checklists/specification.md'] + '\n  - [ ] Critério pendente\n',
    )
    assert.ok(has(await checkCatalog(f.root), 'checklist'))
})
for (const [status, file] of [
    ['specified', 'checklists/specification.md'],
    ['clarified', 'clarification.md'],
    ['planned', 'plan.md'],
    ['implementing', 'tasks.md'],
    ['validating', 'validation.md'],
    ['validated', 'validation.md'],
])
    test(`estado ${status} exige ${file}`, async (t) => {
        const f = await fixture(t, status)
        await rm(join(f.directory, file))
        assert.ok(has(await checkCatalog(f.root), 'artifact'))
    })
for (const [file, from, to, rule] of [
    ['clarification.md', 'aprovado', 'pendente', 'gate-1'],
    ['tasks.md', '## Gate 2', '## Outra seção', 'gate-2'],
    ['tasks.md', '**Status:** aprovada', '**Status:** pendente', 'consistency'],
    ['checklists/specification.md', '[x]', '[ ]', 'checklist'],
    ['plan.md', '## Constitution Check — pós-design', '## Outra seção', 'constitution-check'],
    ['validation.md', '**Veredito:** aprovado', '**Veredito:** pendente', 'gate-3'],
    [
        'validation.md',
        '**Commit:** não disponível, revisão local',
        '**Commit:** TODO',
        'validation-state',
    ],
])
    test(`estado rejeita ${rule}`, async (t) => {
        const f = await fixture(t, 'validated')
        await writeFile(join(f.directory, file), artifacts[file].replace(from, to))
        assert.ok(has(await checkCatalog(f.root), rule))
    })
test('campos de gate são obrigatórios e fences não aprovam', async (t) => {
    const f = await fixture(t, 'clarified')
    for (const value of [gate(1).replace('Maintainer', 'TBD'), '```md\n' + gate(1) + '```\n']) {
        await writeFile(join(f.directory, 'clarification.md'), value)
        assert.ok(has(await checkCatalog(f.root), 'gate-1'))
    }
})
for (const status of ['superseded', 'abandoned'])
    test(`estado ${status} exige justificativa fora de fence`, async (t) => {
        const f = await fixture(t, status)
        const title = status === 'superseded' ? 'Substituição' : 'Abandono'
        f.data.related_specs = status === 'superseded' ? [id] : []
        await f.save('```md\n## ' + title + '\nUma justificativa suficientemente explícita.\n```')
        assert.ok(has(await checkCatalog(f.root), 'justification'))
        await f.save(
            '## ' + title + '\nA mudança foi interrompida por decisão de priorização documentada.',
        )
        assert.deepEqual(await checkCatalog(f.root), [])
    })
test('tarefas narrativas não cobrem FR e validando exige concluídas', async (t) => {
    const f = await fixture(t, 'validating')
    await writeFile(
        join(f.directory, 'tasks.md'),
        artifacts['tasks.md'].replace('- [x] T001 [FR-001]', 'Narrativa T001 FR-001'),
    )
    assert.ok(has(await checkCatalog(f.root), 'task-coverage'))
    await writeFile(join(f.directory, 'tasks.md'), artifacts['tasks.md'].replace('[x]', '[ ]'))
    assert.ok(has(await checkCatalog(f.root), 'task-completion'))
})
test('checklist aceita o Status formal da seção Resultado', async (t) => {
    const f = await fixture(t, 'specified')
    await writeFile(
        join(f.directory, 'checklists/specification.md'),
        artifacts['checklists/specification.md'].replace(
            '- **Resultado:** aprovado',
            '## Resultado\n- **Status:** aprovado',
        ),
    )
    assert.deepEqual(await checkCatalog(f.root), [])
})
test('tarefas aceitam grupos formais de FRs sem aceitar narrativa fora de tags', async (t) => {
    const f = await fixture(t, 'planned')
    await writeFile(
        join(f.directory, 'tasks.md'),
        artifacts['tasks.md'].replace('[FR-001]', '[FR-002, FR-001, NFR-001]'),
    )
    assert.deepEqual(await checkCatalog(f.root), [])
    await writeFile(
        join(f.directory, 'tasks.md'),
        artifacts['tasks.md'].replace('[FR-001]', '[NFR-001] narrativa FR-001'),
    )
    assert.ok(has(await checkCatalog(f.root), 'task-coverage'))
})
for (const value of ['FAIL', 'PASS |\n| FR-001 | T001 | duplicada | PASS'])
    test(`evidência exige uma linha final PASS: ${value}`, async (t) => {
        const f = await fixture(t, 'validated')
        await writeFile(
            join(f.directory, 'validation.md'),
            artifacts['validation.md'].replace(
                'fixture observável | PASS',
                'fixture observável | ' + value,
            ),
        )
        assert.ok(has(await checkCatalog(f.root), 'evidence-coverage'))
    })
test('links inline, por referência, fragmentos e SHA', async (t) => {
    const f = await fixture(t)
    await f.save(
        '[local](spec.md#requisitos-funcionais)\n[ref][fonte]\n[fonte]: spec.md\n[histórico](https://github.com/owner/repo/blob/012345/file.md)\n',
    )
    assert.deepEqual(await checkCatalog(f.root), [])
    for (const suffix of [
        '[quebrado](missing.md)',
        '[quebrado](spec.md#inexistente)',
        '[quebrado][missing]',
        '[x][bad]\n[bad]: missing.md',
    ]) {
        await f.save(suffix)
        assert.ok(has(await checkCatalog(f.root), 'link'))
    }
})
test('links não escapam da raiz por caminho ou symlink', async (t) => {
    const f = await fixture(t)
    await symlink(tmpdir(), join(f.directory, 'outside'))
    await f.save('[x](outside/)')
    assert.ok(has(await checkCatalog(f.root), 'link'))
})
test('checker verifica links nos guias canônicos e documentos extras', async (t) => {
    const f = await fixture(t)
    await writeFile(join(f.root, 'docs/development-strategies/sdd/README.md'), '[x](missing.md)')
    assert.ok(has(await checkCatalog(f.root), 'link'))
    await writeFile(
        join(f.root, 'docs/development-strategies/sdd/README.md'),
        '[x](constitution.md)',
    )
    await writeFile(join(f.root, 'changed.md'), '[x](missing.md)')
    assert.ok(has(await checkCatalog(f.root, { extraFiles: ['changed.md'] }), 'link'))
})
test('artefato da spec não pode ser symlink para fora da raiz', async (t) => {
    const f = await fixture(t)
    await rm(join(f.directory, 'spec.md'))
    await symlink(
        join(f.root, 'docs/development-strategies/sdd/constitution.md'),
        join(f.directory, 'spec.md'),
    )
    assert.ok(has(await checkCatalog(f.root), 'artifact'))
})
test('documento extra não pode escapar por um diretório symlink', async (t) => {
    const f = await fixture(t)
    const outside = await mkdtemp(join(tmpdir(), 'gmm-sdd-outside-'))
    t.after(() => rm(outside, { recursive: true, force: true }))
    await writeFile(join(outside, 'source.md'), '# Documento externo\n')
    await symlink(outside, join(f.root, 'outside'), 'junction')
    assert.ok(has(await checkCatalog(f.root, { extraFiles: ['outside/source.md'] }), 'artifact'))
})
test('artefato obrigatório não pode escapar por diretório symlink', async (t) => {
    const f = await fixture(t, 'specified')
    const outside = await mkdtemp(join(tmpdir(), 'gmm-sdd-outside-'))
    t.after(() => rm(outside, { recursive: true, force: true }))
    await writeFile(join(outside, 'specification.md'), artifacts['checklists/specification.md'])
    await rm(join(f.directory, 'checklists'), { recursive: true })
    await symlink(outside, join(f.directory, 'checklists'), 'junction')
    assert.ok(has(await checkCatalog(f.root), 'artifact'))
})
test('checker não escreve arquivos e não exige code_paths futuros', async (t) => {
    const f = await fixture(t)
    f.data.code_paths = ['apps/web/src/future.ts']
    await f.save()
    async function hashes(directory) {
        const result = {}
        for (const item of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, item.name)
            if (item.isDirectory()) Object.assign(result, await hashes(path))
            else
                result[path] = createHash('sha256')
                    .update(await readFile(path))
                    .digest('hex')
        }
        return result
    }
    const before = await hashes(f.root)
    assert.deepEqual(await checkCatalog(f.root), [])
    assert.deepEqual(await hashes(f.root), before)
})
test('CLI retorna erro diagnosticado e código não zero', async (t) => {
    const f = await fixture(t)
    f.data.title = 'TBD'
    await f.save()
    const result = spawnSync(
        process.execPath,
        [
            fileURLToPath(new URL('../../scripts/sdd/check-specs.mjs', import.meta.url)),
            '--root',
            f.root,
        ],
        { encoding: 'utf8' },
    )
    assert.equal(result.status, 1)
    assert.match(result.stdout + result.stderr, /spec\.md.*metadata/)
})
