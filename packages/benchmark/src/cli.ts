#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'

import type { GuesserProvider } from '@guess-my-move/core'
import {
    type CodexReasoningEffort,
    CodexGuesserProvider,
    MockGuesserProvider,
} from '@guess-my-move/providers'

import { renderReport } from './report.js'
import { loadManifest } from './runner.js'
import { runBenchmark } from './runner.js'

interface CliArgs {
    manifest?: string
    provider: string
    out?: string
    cost?: number
    timeoutMs?: number
    codexModel?: string
    codexEffort?: string
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = { provider: 'mock' }
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i]
        const value = argv[i + 1]
        switch (key) {
            case '--manifest':
                args.manifest = value
                i++
                break
            case '--provider':
                args.provider = value
                i++
                break
            case '--out':
                args.out = value
                i++
                break
            case '--cost':
                args.cost = Number(value)
                i++
                break
            case '--timeout':
                args.timeoutMs = Number(value)
                i++
                break
            case '--codex-model':
                args.codexModel = value
                i++
                break
            case '--codex-effort':
                args.codexEffort = value
                i++
                break
            default:
                break
        }
    }
    return args
}

function parseEffort(value: string | undefined): CodexReasoningEffort | undefined {
    if (value === 'none' || value === 'low' || value === 'high') {
        return value
    }
    return undefined
}

function buildProvider(args: CliArgs): GuesserProvider {
    if (args.provider === 'codex') {
        if (!args.codexModel) {
            throw new Error('--provider codex exige --codex-model')
        }
        const options: ConstructorParameters<typeof CodexGuesserProvider>[0] = {
            model: args.codexModel,
            frameExtension: 'png',
        }
        if (args.timeoutMs) {
            options.timeoutMs = args.timeoutMs
        }
        const effort = parseEffort(args.codexEffort)
        if (effort) {
            options.reasoningEffort = effort
        }
        return new CodexGuesserProvider(options)
    }
    return new MockGuesserProvider()
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    if (!args.manifest) {
        process.stderr.write(
            [
                'uso: guess-benchmark --manifest <caminho/manifest.json> ' +
                    '[--provider mock|codex] [--out relatorio.md] ' +
                    '[--cost <US$/tentativa>] [--timeout <ms>] ' +
                    '[--codex-model <id>] [--codex-effort none|low|high]',
                '',
                'O manifesto e os clipes ficam em um diretório LOCAL fora do ' +
                    'Git. Sem dados reais, o harness não produz números.',
                '',
            ].join('\n'),
        )
        process.exitCode = 1
        return
    }

    const provider = buildProvider(args)
    const { manifest, baseDir } = await loadManifest(args.manifest)
    const runOptions: Parameters<typeof runBenchmark>[3] = {}
    if (typeof args.cost === 'number' && !Number.isNaN(args.cost)) {
        runOptions.costPerAttemptUsd = args.cost
    }
    if (args.timeoutMs) {
        runOptions.timeoutMs = args.timeoutMs
    }
    const outcomes = await runBenchmark(provider, manifest, baseDir, runOptions)
    const report = renderReport({
        providerId: provider.id,
        manifest,
        outcomes,
        viaCodexCli: args.provider === 'codex',
    })
    if (args.out) {
        await writeFile(args.out, report, 'utf8')
        process.stdout.write(`Relatório escrito em ${args.out}\n`)
    } else {
        process.stdout.write(report + '\n')
    }
}

void main().catch((error: unknown) => {
    process.stderr.write(
        `Erro no benchmark: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
})
