import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { GuesserInput } from '@guess-my-move/core'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
    CodexExecutionError,
    CodexGuesserProvider,
} from '../src/codex-provider.js'
import { InvalidProviderOutputError } from '../src/result-schema.js'
import { forbiddenCardTerms, wavingCardFixture } from './support/card-boundary.js'

// Executável SIMULADO do Codex CLI, gravado em disco em tempo de teste (fora da
// árvore lintada/tipada). Nunca contata rede nem o Codex real. Lê `-o <arquivo>`
// e grava ali a "última mensagem do agente". Comportamento por env:
//   FAKE_CODEX_MODE = success | invalid | exit-nonzero | slow | empty
//   FAKE_CODEX_DELAY_MS, FAKE_CODEX_LOG
const FAKE_CODEX_SOURCE = `#!/usr/bin/env node
import { writeFileSync, appendFileSync } from 'node:fs'
const argv = process.argv.slice(2)
const mode = process.env.FAKE_CODEX_MODE || 'success'
if (process.env.FAKE_CODEX_LOG) appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify(argv) + '\\n')
function flagValue(name){ const i = argv.indexOf(name); return i>=0?argv[i+1]:undefined }
function variadicImages(){ const i = argv.indexOf('-i'); if(i<0) return []; const out=[]; for(let k=i+1;k<argv.length;k++){ if(argv[k].startsWith('-')) break; out.push(argv[k]) } return out }
const outputPath = flagValue('-o') || flagValue('--output-last-message')
const images = variadicImages()
process.stdin.resume(); process.stdin.on('data', () => {})
function emit(b){ if(outputPath) writeFileSync(outputPath, b) }
function finish(){
  if(mode==='exit-nonzero') process.exit(3)
  if(mode==='empty'){ emit(''); process.exit(0) }
  if(mode==='invalid'){ emit('isto não é json'); process.exit(0) }
  const insufficient = images.length === 0
  emit(JSON.stringify({ guess: insufficient ? '' : 'acenar', insufficientEvidence: insufficient }))
  process.exit(0)
}
if(mode==='slow'){ setTimeout(finish, Number(process.env.FAKE_CODEX_DELAY_MS||'10000')) } else { finish() }
`

let fakeDir: string
let fakeCodex: string

const input: GuesserInput = {
    frames: [
        { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
        { timestampMs: 400, mimeType: 'image/jpeg', data: 'BBBB' },
        { timestampMs: 800, mimeType: 'image/jpeg', data: 'CCCC' },
    ],
}

function makeProvider(timeoutMs = 5_000): CodexGuesserProvider {
    return new CodexGuesserProvider({
        bin: fakeCodex,
        model: 'gpt-6-luna',
        reasoningEffort: 'low',
        timeoutMs,
    })
}

async function tempDirCount(): Promise<number> {
    const entries = await readdir(tmpdir())
    return entries.filter((e) => e.startsWith('codex-guess-')).length
}

describe('CodexGuesserProvider (executável simulado)', () => {
    beforeAll(() => {
        fakeDir = mkdtempSync(join(tmpdir(), 'fake-codex-'))
        fakeCodex = join(fakeDir, 'fake-codex.mjs')
        writeFileSync(fakeCodex, FAKE_CODEX_SOURCE)
        chmodSync(fakeCodex, 0o755)
    })

    afterAll(() => {
        rmSync(fakeDir, { recursive: true, force: true })
    })

    beforeEach(() => {
        delete process.env.FAKE_CODEX_MODE
        delete process.env.FAKE_CODEX_DELAY_MS
        delete process.env.FAKE_CODEX_LOG
    })

    afterEach(() => {
        delete process.env.FAKE_CODEX_MODE
        delete process.env.FAKE_CODEX_DELAY_MS
        delete process.env.FAKE_CODEX_LOG
    })

    it('devolve um palpite validado no caminho feliz', async () => {
        process.env.FAKE_CODEX_MODE = 'success'
        const result = await makeProvider().guess(input)
        expect(result).toEqual({ guess: 'acenar', insufficientEvidence: false })
    })

    it('converte código de saída ≠ 0 em CodexExecutionError', async () => {
        process.env.FAKE_CODEX_MODE = 'exit-nonzero'
        await expect(makeProvider().guess(input)).rejects.toBeInstanceOf(
            CodexExecutionError,
        )
    })

    it('rejeita saída fora de formato com InvalidProviderOutputError', async () => {
        process.env.FAKE_CODEX_MODE = 'invalid'
        await expect(makeProvider().guess(input)).rejects.toBeInstanceOf(
            InvalidProviderOutputError,
        )
    })

    it('rejeita saída vazia', async () => {
        process.env.FAKE_CODEX_MODE = 'empty'
        await expect(makeProvider().guess(input)).rejects.toBeInstanceOf(
            InvalidProviderOutputError,
        )
    })

    it('aplica timeout e mata o processo', async () => {
        process.env.FAKE_CODEX_MODE = 'slow'
        process.env.FAKE_CODEX_DELAY_MS = '5000'
        await expect(makeProvider(150).guess(input)).rejects.toBeInstanceOf(
            CodexExecutionError,
        )
    })

    it('limpa os diretórios temporários mesmo após erro', async () => {
        process.env.FAKE_CODEX_MODE = 'exit-nonzero'
        const before = await tempDirCount()
        await makeProvider()
            .guess(input)
            .catch(() => undefined)
        const after = await tempDirCount()
        expect(after).toBeLessThanOrEqual(before)
    })

    it('executa uma por vez (fila serial)', async () => {
        process.env.FAKE_CODEX_MODE = 'success'
        const provider = makeProvider()
        const results = await Promise.all([
            provider.guess(input),
            provider.guess(input),
            provider.guess(input),
        ])
        expect(results).toHaveLength(3)
        for (const r of results) {
            expect(r.guess).toBe('acenar')
        }
    })

    it('não passa nenhum dado da carta ao processo externo', async () => {
        process.env.FAKE_CODEX_MODE = 'success'
        const logPath = join(fakeDir, `log-${Date.now()}.txt`)
        process.env.FAKE_CODEX_LOG = logPath
        await makeProvider().guess(input)
        const logged = readFileSync(logPath, 'utf8').toLowerCase()
        for (const term of forbiddenCardTerms(wavingCardFixture)) {
            // "acenar" é o palpite legítimo da resposta, não um termo enviado.
            if (term.toLowerCase() === 'acenar') {
                continue
            }
            expect(logged).not.toContain(term.toLowerCase())
        }
    })
})
