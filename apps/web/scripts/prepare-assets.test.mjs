import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { GESTURE_MODEL, MODEL, copyWasm, ensureModel, sha256Hex } from './prepare-assets.mjs'

const bytes = Buffer.from('conteudo-do-modelo')
const model = { file: 'm.task', url: 'https://exemplo.invalid/m.task', sha256: sha256Hex(bytes) }

function fakeFetch(body, { ok = true, status = 200 } = {}) {
    const calls = []
    const impl = async (url) => {
        calls.push(url)
        return { ok, status, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) }
    }
    return { impl, calls }
}

let dir
beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gmm-assets-'))
})
afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
})

describe('ensureModel', () => {
    it('baixa quando o arquivo não existe e confere o hash', async () => {
        const fetcher = fakeFetch(bytes)
        const status = await ensureModel({ dir, model, fetchImpl: fetcher.impl })
        assert.equal(status, 'downloaded')
        assert.deepEqual(fetcher.calls, [model.url])
        assert.deepEqual(await readFile(join(dir, model.file)), bytes)
    })

    it('reaproveita o arquivo quando o hash confere', async () => {
        await writeFile(join(dir, model.file), bytes)
        const fetcher = fakeFetch(bytes)
        assert.equal(await ensureModel({ dir, model, fetchImpl: fetcher.impl }), 'cached')
        assert.equal(fetcher.calls.length, 0)
    })

    it('baixa de novo quando o arquivo existente está corrompido', async () => {
        await writeFile(join(dir, model.file), 'corrompido')
        const fetcher = fakeFetch(bytes)
        assert.equal(await ensureModel({ dir, model, fetchImpl: fetcher.impl }), 'downloaded')
        assert.deepEqual(await readFile(join(dir, model.file)), bytes)
    })

    it('falha e não grava quando o hash baixado não confere', async () => {
        const fetcher = fakeFetch(Buffer.from('outro-conteudo'))
        await assert.rejects(
            ensureModel({ dir, model, fetchImpl: fetcher.impl }),
            /SHA-256 do modelo não confere/,
        )
        assert.deepEqual(await readdir(dir), [])
    })

    it('falha com status HTTP de erro', async () => {
        const fetcher = fakeFetch(bytes, { ok: false, status: 404 })
        await assert.rejects(ensureModel({ dir, model, fetchImpl: fetcher.impl }), /HTTP 404/)
    })
})

describe('copyWasm', () => {
    it('copia os arquivos e pula os já idênticos em tamanho', async () => {
        const from = join(dir, 'origem')
        const to = join(dir, 'destino')
        await mkdir(from)
        await writeFile(join(from, 'a.wasm'), 'aaaa')
        await writeFile(join(from, 'b.js'), 'bb')

        assert.equal(await copyWasm({ from, to }), 2)
        assert.deepEqual((await readdir(to)).sort(), ['a.wasm', 'b.js'])
        assert.equal(await copyWasm({ from, to }), 0)

        await writeFile(join(from, 'b.js'), 'bbbbb')
        assert.equal(await copyWasm({ from, to }), 1)
        assert.equal(await readFile(join(to, 'b.js'), 'utf8'), 'bbbbb')
    })
})

describe('modelos preparados', () => {
    it('o detector de mão e o reconhecedor de gestos têm arquivo, URL do Google e SHA-256 próprios', () => {
        for (const entry of [MODEL, GESTURE_MODEL]) {
            assert.match(entry.file, /\.task$/)
            assert.match(entry.url, /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//)
            assert.match(entry.sha256, /^[0-9a-f]{64}$/)
        }
        assert.notEqual(MODEL.file, GESTURE_MODEL.file)
        assert.notEqual(MODEL.sha256, GESTURE_MODEL.sha256)
    })
})
