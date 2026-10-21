import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MockGuesserProvider } from '@guess-my-move/providers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { renderReport } from '../src/report.js'
import {
    loadManifest,
    ManifestError,
    parseManifest,
    runBenchmark,
} from '../src/runner.js'

// 1x1 PNG mínimo (base64) usado como frame sintético.
const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
)

let dir: string

function manifestJson(): string {
    return JSON.stringify({
        version: 1,
        sample: { people: 2, environments: 1, lightingConditions: 1 },
        clips: [
            {
                id: 'p1-001',
                scenario: 'P1',
                expected: 'positive',
                variant: '6f',
                frames: ['f0.png', 'f1.png'],
            },
            {
                id: 'n1-001',
                scenario: 'N1',
                expected: 'negative',
                variant: '6f',
                frames: ['f0.png'],
            },
        ],
    })
}

describe('parseManifest', () => {
    it('aceita um manifesto válido', () => {
        const m = parseManifest(manifestJson())
        expect(m.clips).toHaveLength(2)
        expect(m.sample?.people).toBe(2)
    })

    it('rejeita version ausente', () => {
        expect(() => parseManifest('{"clips":[]}')).toThrow(ManifestError)
    })

    it('rejeita cenário desconhecido', () => {
        const bad = JSON.stringify({
            version: 1,
            clips: [{ scenario: 'Z9', expected: 'positive', frames: ['a'] }],
        })
        expect(() => parseManifest(bad)).toThrow(/cenário desconhecido/)
    })

    it('rejeita JSON inválido', () => {
        expect(() => parseManifest('{nope')).toThrow(ManifestError)
    })
})

describe('benchmark ponta a ponta (mock, dados sintéticos)', () => {
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'bench-'))
        writeFileSync(join(dir, 'f0.png'), PNG_1x1)
        writeFileSync(join(dir, 'f1.png'), PNG_1x1)
        writeFileSync(join(dir, 'manifest.json'), manifestJson())
    })

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    it('roda contra o mock e classifica os clipes', async () => {
        const { manifest, baseDir } = await loadManifest(
            join(dir, 'manifest.json'),
        )
        // mock devolve "acenar": positivo vira acerto, negativo vira FP.
        const provider = new MockGuesserProvider({ guess: 'acenar' })
        const outcomes = await runBenchmark(provider, manifest, baseDir)
        expect(outcomes).toHaveLength(2)
        const positive = outcomes.find((o) => o.scenario === 'P1')
        const negative = outcomes.find((o) => o.scenario === 'N1')
        expect(positive?.matchedWaving).toBe(true)
        expect(negative?.matchedWaving).toBe(true)
        expect(outcomes.every((o) => !o.technicalFailure)).toBe(true)
    })

    it('gera um relatório Markdown sem taxa de acerto geral', async () => {
        const { manifest, baseDir } = await loadManifest(
            join(dir, 'manifest.json'),
        )
        const provider = new MockGuesserProvider({ guess: 'acenar' })
        const outcomes = await runBenchmark(provider, manifest, baseDir, {
            costPerAttemptUsd: 0.0003,
        })
        const report = renderReport({
            providerId: provider.id,
            manifest,
            outcomes,
            viaCodexCli: false,
            generatedAt: '2026-10-21T00:00:00.000Z',
        })
        expect(report).toContain('Relatório do benchmark')
        expect(report).toContain('IC95%')
        expect(report).toContain('## Limitações')
        expect(report).toContain('US$ 0.00030')
        expect(report).not.toMatch(/taxa de acerto geral do produto\b(?!\.)/)
        // nunca afirma uma taxa geral; menciona apenas a ausência dela.
        expect(report).toContain('Sem taxa de acerto geral')
    })

    it('marca falha técnica quando o provedor erra, sem interromper', async () => {
        const { manifest, baseDir } = await loadManifest(
            join(dir, 'manifest.json'),
        )
        const provider = new MockGuesserProvider({
            error: new Error('falha simulada'),
        })
        const outcomes = await runBenchmark(provider, manifest, baseDir)
        expect(outcomes.every((o) => o.technicalFailure)).toBe(true)
    })
})
