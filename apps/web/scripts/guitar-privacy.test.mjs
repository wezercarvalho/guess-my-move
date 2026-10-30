import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(webRoot, '..', '..')

/** Pastas do Violão no Ar: o pacote puro e a tela. */
const roots = [join(repoRoot, 'packages', 'guitar', 'src'), join(webRoot, 'src', 'guitar')]

/** Arquivos de código de produção (os testes ficam de fora). */
export function sourceFiles(directory = roots) {
    const files = []
    for (const root of Array.isArray(directory) ? directory : [directory]) {
        for (const name of readdirSync(root)) {
            const path = join(root, name)
            if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
            else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) files.push(path)
        }
    }
    return files
}

/**
 * Padrões proibidos: rede, armazenamento, leitura de pixels, gravação e arquivos de áudio de
 * terceiros. O Violão no Ar só lê os landmarks que o MediaPipe devolve e nunca guarda nada.
 */
export const FORBIDDEN = [
    { name: 'requisição de rede', pattern: /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/ },
    { name: 'armazenamento', pattern: /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/ },
    { name: 'leitura ou exportação de pixels', pattern: /\b(toDataURL|toBlob|getImageData|createImageBitmap|captureStream)\b/ },
    { name: 'gravação de mídia', pattern: /\b(MediaRecorder|ImageCapture)\b/ },
    { name: 'registro em log', pattern: /\bconsole\./ },
    { name: 'URL de terceiros', pattern: /https?:\/\// },
    { name: 'arquivo de áudio', pattern: /\.(wav|mp3|ogg|flac|m4a|aac)\b/i },
]

/** Procura os padrões proibidos no texto e devolve o que achou. */
export function violations(text) {
    return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name)
}

/** Tira comentários de bloco e de linha (sem tocar em strings; suficiente para estes arquivos). */
export function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('Violão no Ar: privacidade e recursos de terceiros (NFR-001 e NFR-002)', () => {
    const files = sourceFiles()

    it('encontra os arquivos de produção do pacote e da tela', () => {
        assert.ok(files.length >= 15, `poucos arquivos: ${files.length}`)
        assert.ok(files.some((file) => file.endsWith('guitarController.ts')))
        assert.ok(files.some((file) => file.endsWith('synth.ts')))
    })

    it('nenhum arquivo faz rede, guarda dados, lê pixels, grava mídia, registra log ou usa áudio de terceiros', () => {
        for (const file of files) {
            assert.deepEqual(
                violations(readFileSync(file, 'utf8')),
                [],
                `${relative(repoRoot, file)} usa algo proibido`,
            )
        }
    })

    it('o detector prova que enxerga cada padrão proibido (o teste não é vacuoso)', () => {
        assert.deepEqual(violations('await fetch(url)'), ['requisição de rede'])
        assert.deepEqual(violations('localStorage.setItem()'), ['armazenamento'])
        assert.deepEqual(violations('canvas.toDataURL()'), ['leitura ou exportação de pixels'])
        assert.deepEqual(violations('new MediaRecorder(stream)'), ['gravação de mídia'])
        assert.deepEqual(violations('console.log(frame)'), ['registro em log'])
        assert.deepEqual(violations('src="https://cdn.exemplo.com/x.js"'), ['URL de terceiros'])
        assert.deepEqual(violations("new Audio('nota.mp3')"), ['arquivo de áudio'])
        assert.deepEqual(violations('const total = 1 + 2'), [])
    })

    it('o pacote puro não importa DOM, MediaPipe nem Web Audio', () => {
        for (const file of files.filter((path) => path.includes(join('packages', 'guitar')))) {
            // só o código conta: um comentário pode explicar que o módulo NÃO toca no AudioContext
            const code = stripComments(readFileSync(file, 'utf8'))
            assert.doesNotMatch(
                code,
                /@mediapipe|AudioContext|document\.|window\.|HTMLElement|navigator\./,
                relative(repoRoot, file),
            )
        }
    })

    it('stripComments remove comentários de bloco e de linha, mas não o código', () => {
        assert.equal(stripComments('a /* AudioContext */ b // window.x\nc').replace(/\s+/g, ' '), 'a b c')
        assert.match(stripComments('const ctx = new AudioContext()'), /AudioContext/)
    })

    it('a tela só obtém áudio pelo tocador e não carrega modelos novos', () => {
        const screenFiles = files.filter((path) => path.includes(join('apps', 'web', 'src', 'guitar')))
        const withAudioContext = screenFiles.filter((path) => /\bAudioContext\b/.test(readFileSync(path, 'utf8')))
        assert.deepEqual(
            withAudioContext.map((path) => relative(webRoot, path)),
            [join('src', 'guitar', 'audioPlayer.ts')],
        )
        for (const path of screenFiles) {
            assert.doesNotMatch(readFileSync(path, 'utf8'), /\.task\b|modelAssetPath/, relative(webRoot, path))
        }
    })
})
