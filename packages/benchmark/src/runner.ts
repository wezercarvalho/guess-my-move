import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import type {
    CapturedFrame,
    GuesserInput,
    GuesserProvider,
} from '@guess-my-move/core'

import {
    type BenchmarkManifest,
    type ClipEntry,
    scenarioById,
} from './scenarios.js'
import { matchesWaving } from './semantics.js'
import type { ClipOutcome } from './stats.js'

/** Erro de manifesto inválido (estrutura ou cenário desconhecido). */
export class ManifestError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ManifestError'
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Valida e carrega um manifesto a partir do texto JSON. */
export function parseManifest(json: string): BenchmarkManifest {
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch {
        throw new ManifestError('manifesto não é um JSON válido')
    }
    if (!isRecord(parsed) || parsed.version !== 1) {
        throw new ManifestError('manifesto precisa de "version": 1')
    }
    if (!Array.isArray(parsed.clips) || parsed.clips.length === 0) {
        throw new ManifestError('manifesto precisa de "clips" não vazio')
    }
    const clips: ClipEntry[] = parsed.clips.map((raw, index) => {
        if (!isRecord(raw)) {
            throw new ManifestError(`clip ${index} inválido`)
        }
        const { id, scenario, expected, frames, variant } = raw
        if (typeof scenario !== 'string' || !scenarioById(scenario)) {
            throw new ManifestError(
                `clip ${index}: cenário desconhecido "${String(scenario)}"`,
            )
        }
        if (expected !== 'positive' && expected !== 'negative') {
            throw new ManifestError(`clip ${index}: expected inválido`)
        }
        if (
            !Array.isArray(frames) ||
            frames.length === 0 ||
            !frames.every((f) => typeof f === 'string')
        ) {
            throw new ManifestError(`clip ${index}: frames inválido`)
        }
        const entry: ClipEntry = {
            id: typeof id === 'string' ? id : `${scenario}-${String(index)}`,
            scenario,
            expected,
            frames,
        }
        if (typeof variant === 'string') {
            entry.variant = variant
        }
        return entry
    })
    const manifest: BenchmarkManifest = { version: 1, clips }
    if (isRecord(parsed.sample)) {
        const raw = parsed.sample
        const sample: NonNullable<BenchmarkManifest['sample']> = {}
        if (typeof raw.people === 'number') {
            sample.people = raw.people
        }
        if (typeof raw.environments === 'number') {
            sample.environments = raw.environments
        }
        if (typeof raw.lightingConditions === 'number') {
            sample.lightingConditions = raw.lightingConditions
        }
        if (typeof raw.notes === 'string') {
            sample.notes = raw.notes
        }
        manifest.sample = sample
    }
    return manifest
}

/** Lê um manifesto de um arquivo e resolve os caminhos de frame. */
export async function loadManifest(
    manifestPath: string,
): Promise<{ manifest: BenchmarkManifest; baseDir: string }> {
    const text = await readFile(manifestPath, 'utf8')
    return { manifest: parseManifest(text), baseDir: dirname(manifestPath) }
}

const EXT_MIME: Record<string, CapturedFrame['mimeType']> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
}

function mimeFor(path: string): CapturedFrame['mimeType'] {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    return EXT_MIME[ext] ?? 'image/jpeg'
}

/** Monta o `GuesserInput` de um clipe, lendo os frames como base64. */
export async function buildInput(
    clip: ClipEntry,
    baseDir: string,
): Promise<GuesserInput> {
    const frames = await Promise.all(
        clip.frames.map(async (rel, index) => {
            const abs = isAbsolute(rel) ? rel : resolve(baseDir, rel)
            const bytes = await readFile(abs)
            return {
                timestampMs: index * 400,
                mimeType: mimeFor(abs),
                data: bytes.toString('base64'),
            }
        }),
    )
    return { frames }
}

/** Opções de execução do benchmark. */
export interface RunOptions {
    /** Custo por tentativa (US$), quando conhecido (API paga). */
    costPerAttemptUsd?: number
    /** Timeout por clipe (ms). */
    timeoutMs?: number
}

/**
 * Executa um clipe contra o provedor e classifica o resultado. Nunca lança:
 * uma falha técnica vira um `ClipOutcome` com `technicalFailure: true`, para o
 * benchmark seguir medindo os demais clipes.
 */
export async function runClip(
    provider: GuesserProvider,
    clip: ClipEntry,
    baseDir: string,
    options: RunOptions = {},
): Promise<ClipOutcome> {
    const input = await buildInput(clip, baseDir)
    const controller = new AbortController()
    const timer =
        options.timeoutMs && options.timeoutMs > 0
            ? setTimeout(() => controller.abort(), options.timeoutMs)
            : undefined
    const startedAt = Date.now()
    try {
        const result = await provider.guess(input, controller.signal)
        const latencyMs = Date.now() - startedAt
        const insufficientEvidence = result.insufficientEvidence === true
        const matchedWaving = insufficientEvidence
            ? false
            : matchesWaving(result.guess).matched
        const outcome: ClipOutcome = {
            id: clip.id,
            scenario: clip.scenario,
            expected: clip.expected,
            guess: result.guess,
            insufficientEvidence,
            matchedWaving,
            latencyMs,
            technicalFailure: false,
        }
        if (clip.variant) {
            outcome.variant = clip.variant
        }
        if (typeof options.costPerAttemptUsd === 'number') {
            outcome.costUsd = options.costPerAttemptUsd
        }
        return outcome
    } catch {
        const latencyMs = Date.now() - startedAt
        const outcome: ClipOutcome = {
            id: clip.id,
            scenario: clip.scenario,
            expected: clip.expected,
            guess: '',
            insufficientEvidence: false,
            matchedWaving: false,
            latencyMs,
            technicalFailure: true,
        }
        if (clip.variant) {
            outcome.variant = clip.variant
        }
        return outcome
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }
}

/** Executa todos os clipes em série (respeita provedores seriais, ex.: codex). */
export async function runBenchmark(
    provider: GuesserProvider,
    manifest: BenchmarkManifest,
    baseDir: string,
    options: RunOptions = {},
): Promise<ClipOutcome[]> {
    const outcomes: ClipOutcome[] = []
    for (const clip of manifest.clips) {
        outcomes.push(await runClip(provider, clip, baseDir, options))
    }
    return outcomes
}
