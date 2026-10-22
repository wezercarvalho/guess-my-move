import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '@guess-my-move/core'

import {
    guesserResultJsonSchema,
    InvalidProviderOutputError,
    parseGuesserResult,
} from './result-schema.js'

/** Esforços de raciocínio aceitos pelo Codex CLI para o adaptador. */
export type CodexReasoningEffort = 'none' | 'low' | 'high'

/** Configuração do adaptador `codex`, derivada de variáveis de ambiente. */
export interface CodexProviderOptions {
    /** Binário do Codex CLI (`CODEX_BIN`, padrão `codex`). */
    bin?: string
    /** Modelo (`CODEX_MODEL`, ex.: `gpt-6-luna`). */
    model: string
    /** Esforço de raciocínio (`CODEX_REASONING_EFFORT`). */
    reasoningEffort?: CodexReasoningEffort
    /** Timeout por execução em ms. */
    timeoutMs?: number
    /** Extensão dos frames temporários (padrão jpg). */
    frameExtension?: string
}

/**
 * Prompt GENÉRICO: pede a descrição da ação predominante nos frames em ordem
 * cronológica. Nunca contém palavra-alvo, dica, sugestão ou aliases da carta.
 */
const GENERIC_PROMPT = [
    'Você recebe uma sequência de quadros (frames) de uma webcam, em ordem',
    'cronológica, espaçados por cerca de 400 ms. Observe o movimento da pessoa',
    'ao longo dos quadros e responda com a ação humana predominante como UM',
    'verbo no infinitivo, em uma ou duas palavras, sem artigos, sem',
    'complementos e sem descrever o cenário (formato, por exemplo: "correr").',
    'Não liste rótulos possíveis nem adivinhe palavras de um jogo. Pessoa',
    'parada, sentada ou apenas olhando para a tela NÃO é uma ação: nesse caso,',
    'e sempre que não houver evidência suficiente de uma ação clara, responda',
    'com guess "nenhuma" e insufficientEvidence true. Responda SOMENTE no',
    'formato JSON exigido pelo schema:',
    '{ "guess": "<verbo no infinitivo>", "insufficientEvidence": <bool> }.',
].join(' ')

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Adaptador do primeiro provedor real: chama o Codex CLI (`codex exec`) em modo
 * não interativo com os frames como imagens ordenadas. Garantias:
 * - uma execução por vez (fila serial por instância);
 * - diretório de trabalho temporário VAZIO, somente leitura, fora de um repo;
 * - timeout com kill do processo;
 * - limpeza SEMPRE dos arquivos temporários (sucesso, erro ou timeout);
 * - saída estruturada validada por schema.
 *
 * Desligado por padrão: só é instanciado quando `GUESSER_PROVIDER=codex`. A
 * entrada é apenas `GuesserInput` — nenhum dado de carta chega aqui.
 */
export class CodexGuesserProvider implements GuesserProvider {
    readonly id = 'codex'

    private readonly bin: string
    private readonly model: string
    private readonly reasoningEffort?: CodexReasoningEffort
    private readonly timeoutMs: number
    private readonly frameExtension: string
    /** Mutex: encadeia as execuções para garantir uma por vez. */
    private queue: Promise<unknown> = Promise.resolve()

    constructor(options: CodexProviderOptions) {
        this.bin = options.bin ?? 'codex'
        this.model = options.model
        if (options.reasoningEffort) {
            this.reasoningEffort = options.reasoningEffort
        }
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        this.frameExtension = options.frameExtension ?? 'jpg'
    }

    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult> {
        // Serializa: a próxima execução só começa quando a anterior termina.
        const run = this.queue.then(
            () => this.runOnce(input, signal),
            () => this.runOnce(input, signal),
        )
        this.queue = run.catch(() => undefined)
        return run
    }

    private async runOnce(
        input: GuesserInput,
        signal?: AbortSignal,
    ): Promise<GuesserResult> {
        const workdir = await mkdtemp(join(tmpdir(), 'codex-guess-'))
        const framesDir = join(workdir, 'frames')
        const schemaPath = join(workdir, 'schema.json')
        const outputPath = join(workdir, 'output.json')
        try {
            await mkdir(framesDir)
            const imagePaths = await this.writeFrames(input, framesDir)
            await writeFile(
                schemaPath,
                JSON.stringify(guesserResultJsonSchema),
                'utf8',
            )
            const args = this.buildArgs(imagePaths, schemaPath, outputPath, workdir)
            await this.execCodex(args, signal)
            const raw = await readFile(outputPath, 'utf8')
            return parseGuesserResult(extractJson(raw))
        } finally {
            // Limpeza SEMPRE: frames, schema e saída não sobrevivem à tentativa.
            await rm(workdir, { recursive: true, force: true })
        }
    }

    private async writeFrames(
        input: GuesserInput,
        framesDir: string,
    ): Promise<string[]> {
        const paths: string[] = []
        for (let i = 0; i < input.frames.length; i++) {
            const index = String(i).padStart(3, '0')
            const file = join(framesDir, `frame-${index}.${this.frameExtension}`)
            await writeFile(file, Buffer.from(input.frames[i].data, 'base64'))
            paths.push(file)
        }
        return paths
    }

    private buildArgs(
        imagePaths: string[],
        schemaPath: string,
        outputPath: string,
        workdir: string,
    ): string[] {
        const args = ['exec', '--skip-git-repo-check', '--ephemeral']
        args.push('-s', 'read-only')
        args.push('-C', workdir)
        args.push('-m', this.model)
        if (this.reasoningEffort) {
            args.push('-c', `model_reasoning_effort=${this.reasoningEffort}`)
        }
        args.push('--output-schema', schemaPath)
        args.push('-o', outputPath)
        // Imagens ordenadas por último: `-i` é variádico (`<FILE>...`), então o
        // prompt NÃO pode vir depois dele (seria tratado como mais uma imagem).
        // O prompt é enviado por stdin em `execCodex`.
        args.push('-i', ...imagePaths)
        return args
    }

    private execCodex(args: string[], signal?: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (signal?.aborted) {
                reject(abortError())
                return
            }
            const child = spawn(this.bin, args, {
                stdio: ['pipe', 'ignore', 'pipe'],
            })
            let stderr = ''
            child.stderr?.on('data', (chunk: Buffer) => {
                // Guardamos só o fim do stderr para diagnóstico; nunca mídia.
                stderr = (stderr + chunk.toString('utf8')).slice(-2000)
            })
            // Prompt genérico por stdin (sem palavra-alvo/dica/sugestão).
            child.stdin?.end(GENERIC_PROMPT)
            let settled = false
            const finish = (fn: () => void): void => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                signal?.removeEventListener('abort', onAbort)
                fn()
            }
            const timer = setTimeout(() => {
                child.kill('SIGKILL')
                finish(() =>
                    reject(
                        new CodexExecutionError(
                            'tempo esgotado ao chamar o Codex CLI',
                        ),
                    ),
                )
            }, this.timeoutMs)
            const onAbort = (): void => {
                child.kill('SIGKILL')
                finish(() => reject(abortError()))
            }
            signal?.addEventListener('abort', onAbort, { once: true })
            child.on('error', (err) => {
                finish(() =>
                    reject(
                        new CodexExecutionError(
                            `falha ao iniciar o Codex CLI: ${err.message}`,
                        ),
                    ),
                )
            })
            child.on('close', (code) => {
                if (code === 0) {
                    finish(resolve)
                } else {
                    const detail = stderr.trim()
                    finish(() =>
                        reject(
                            new CodexExecutionError(
                                `Codex CLI terminou com código ${String(code)}` +
                                    (detail ? `: ${detail}` : ''),
                            ),
                        ),
                    )
                }
            })
        })
    }
}

/** Erro de execução do processo externo (código ≠ 0, timeout, falha de spawn). */
export class CodexExecutionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'CodexExecutionError'
    }
}

function abortError(): Error {
    const error = new Error('execução do Codex cancelada')
    error.name = 'AbortError'
    return error
}

/**
 * Extrai o objeto JSON do conteúdo do arquivo de saída. O Codex grava a última
 * mensagem do agente; isolamos o primeiro bloco `{...}` para tolerar espaços ou
 * cercas de código ao redor. Rejeita conteúdo sem JSON.
 */
function extractJson(raw: string): unknown {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
        throw new InvalidProviderOutputError('saída do Codex vazia')
    }
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end < start) {
        throw new InvalidProviderOutputError(
            'saída do Codex não contém um objeto JSON',
        )
    }
    try {
        return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
        throw new InvalidProviderOutputError(
            'saída do Codex não é um JSON válido',
        )
    }
}

/** Gera um nome único (útil para testes de isolamento de diretório). */
export function uniqueRunId(): string {
    return randomUUID()
}
