// Prepara os arquivos do MediaPipe servidos pelo próprio app (sem CDN):
// copia o .wasm do pacote npm e baixa o modelo .task verificando o SHA-256.
// O modelo não é versionado no repositório; `public/mediapipe/` fica fora do Git.
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MODEL = {
    file: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
}

/** Reconhecedor de gestos do jogo das bolinhas (landmarks da mão mais o gesto pronto). */
export const GESTURE_MODEL = {
    file: 'gesture_recognizer.task',
    url: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
}

/** Detector de rosto do Arranha-Teia (matriz de transformação facial para o olhar da câmera). */
export const FACE_MODEL = {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
}

export function sha256Hex(bytes) {
    return createHash('sha256').update(bytes).digest('hex')
}

async function readIfExists(path) {
    try {
        return await readFile(path)
    } catch (cause) {
        if (cause.code === 'ENOENT') return null
        throw cause
    }
}

/** Garante o modelo em `dir`: reaproveita se o hash confere, senão baixa e verifica. */
export async function ensureModel({ dir, model = MODEL, fetchImpl = fetch }) {
    const target = join(dir, model.file)
    const existing = await readIfExists(target)
    if (existing !== null && sha256Hex(existing) === model.sha256) return 'cached'

    const response = await fetchImpl(model.url)
    if (!response.ok) {
        throw new Error(`Falha ao baixar o modelo (${model.url}): HTTP ${response.status}`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    const actual = sha256Hex(bytes)
    if (actual !== model.sha256) {
        throw new Error(
            `SHA-256 do modelo não confere: esperado ${model.sha256}, obtido ${actual}. O arquivo não foi gravado.`,
        )
    }
    await mkdir(dir, { recursive: true })
    const temporary = `${target}.download`
    await writeFile(temporary, bytes)
    await rename(temporary, target)
    return 'downloaded'
}

/** Copia os arquivos do WebAssembly do pacote para `to`, pulando os já idênticos em tamanho. */
export async function copyWasm({ from, to }) {
    await mkdir(to, { recursive: true })
    let copied = 0
    for (const name of await readdir(from)) {
        const source = join(from, name)
        const destination = join(to, name)
        const [sourceStat, destinationStat] = [
            await stat(source),
            await stat(destination).catch(() => null),
        ]
        if (destinationStat !== null && destinationStat.size === sourceStat.size) continue
        await copyFile(source, destination)
        copied++
    }
    return copied
}

async function main() {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const publicDir = join(root, 'public', 'mediapipe')
    const packageEntry = fileURLToPath(import.meta.resolve('@mediapipe/tasks-vision'))
    const wasmSource = join(dirname(packageEntry), 'wasm')

    const copied = await copyWasm({ from: wasmSource, to: join(publicDir, 'wasm') })
    const statuses = []
    for (const model of [MODEL, GESTURE_MODEL, FACE_MODEL]) {
        statuses.push(`${model.file} (${await ensureModel({ dir: publicDir, model })})`)
    }
    console.log(`MediaPipe: wasm (${copied} arquivo(s) copiado(s)), modelos ${statuses.join(', ')}.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
