import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { declaredLicense, lockRows, scanInstalled } from '../../scripts/lib/license-inventory.mjs'

test('inventário diferencia runtime direto, transitivo, tooling e versões resolvidas', () => {
    const source = JSON.stringify({
        __metadata: { version: 8 },
        'web@workspace:apps/web': { version: '0.0.0', resolution: 'web@workspace:apps/web', dependencies: { a: 'npm:^1', tool: 'npm:1' } },
        'server@workspace:apps/server': { version: '0.0.0', resolution: 'server@workspace:apps/server', dependencies: { a: 'npm:^2' } },
        'a@npm:^1': { version: '1.0.0', resolution: 'a@npm:1.0.0', dependencies: { b: 'npm:1' } },
        'a@npm:^2': { version: '2.0.0', resolution: 'a@npm:2.0.0' },
        'b@npm:1': { version: '1.0.0', resolution: 'b@npm:1.0.0' },
        'tool@npm:1': { version: '1.0.0', resolution: 'tool@npm:1.0.0' },
    })
    const manifests = {
        'apps/web': { dependencies: { a: '^1' }, devDependencies: { tool: '1' } },
        'apps/server': { dependencies: { a: '^2' } },
    }
    const rows = lockRows(source, manifests)
    const row = (locator) => rows.find((item) => item.locator === locator)
    assert.deepEqual(row('a@npm:1.0.0').scope, ['web-candidate'])
    assert.deepEqual(row('a@npm:2.0.0').scope, ['server-candidate'])
    assert.deepEqual(row('b@npm:1.0.0').scope, ['web-candidate'])
    assert.deepEqual(row('b@npm:1.0.0').direct, [])
    assert.deepEqual(row('tool@npm:1.0.0').scope, ['dev-or-other'])
    assert.deepEqual(row('tool@npm:1.0.0').direct, ['apps/web:dev'])
    assert.throws(() => lockRows(source, { ...manifests, 'apps/web': { dependencies: { missing: '1' } } }), /Descriptor não encontrado/)
})

test('inspeção distingue licença declarada de arquivo de aviso e preserva versões', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gmm-licenses-'))
    try {
        const a = join(dir, 'node_modules/a')
        const b = join(a, 'node_modules/a')
        mkdirSync(b, { recursive: true })
        writeFileSync(join(a, 'package.json'), JSON.stringify({ name: 'a', version: '1', license: 'MIT' }))
        writeFileSync(join(a, 'LICENSE'), 'notice')
        writeFileSync(join(b, 'package.json'), JSON.stringify({ name: 'a', version: '2' }))
        const records = scanInstalled(dir, ['.'])
        assert.equal(records.get('a@1')[0].declaredLicense, 'MIT')
        assert.equal(records.get('a@1')[0].notices[0].file, 'LICENSE')
        assert.match(records.get('a@1')[0].notices[0].sha256, /^[0-9a-f]{64}$/)
        assert.equal(records.get('a@2')[0].declaredLicense, null)
        assert.deepEqual(records.get('a@2')[0].notices, [])
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('licenças legadas inequívocas são reconhecidas e conflitos continuam em revisão', () => {
    assert.equal(declaredLicense({ licenses: [{ type: 'MIT', url: 'https://example.org' }] }), 'MIT')
    assert.equal(declaredLicense({ license: 'MIT', licenses: [{ type: 'MIT' }] }), 'MIT')
    assert.equal(declaredLicense({ license: 'MIT', licenses: [{ type: 'Apache-2.0' }] }), null)
    assert.equal(declaredLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] }), null)
    assert.equal(declaredLicense({ licenses: [{ url: 'https://example.org' }] }), null)
    assert.equal(declaredLicense({ license: '', licenses: [{ type: 'MIT' }] }), null)
    assert.equal(declaredLicense({ license: 'Apache-2.0 AND MIT' }), 'Apache-2.0 AND MIT')
})
