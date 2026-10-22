import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    type CodexReasoningEffort,
    CodexGuesserProvider,
    createDefaultRegistry,
    GuesserProviderRegistry,
} from '@guess-my-move/providers'

import type { EnvironmentVariables } from '../config/environment.js'
import { GuesserProviderName } from '../config/environment.js'
import { GuessController } from './guess.controller.js'
import { GUESSER_REGISTRY, GuessService } from './guess.service.js'
import { GuessMetricsLogger } from './metrics.js'

const CODEX_EFFORTS: readonly CodexReasoningEffort[] = ['none', 'low', 'high']

function parseReasoningEffort(
    value: string | undefined,
): CodexReasoningEffort | undefined {
    if (value && (CODEX_EFFORTS as readonly string[]).includes(value)) {
        return value as CodexReasoningEffort
    }
    return undefined
}

/**
 * Lê `MOCK_GUESSES` (lista separada por vírgula). Itens vazios são ignorados;
 * sem a variável, o mock mantém o palpite padrão.
 */
export function parseMockGuesses(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')
}

/**
 * Monta o registro de provedores a partir da configuração. Exportado para
 * teste direto: o `mock` está sempre disponível; o `codex` só é registrado
 * quando `GUESSER_PROVIDER=codex`, mantendo-o desligado por padrão.
 */
export function buildGuesserRegistry(
    config: ConfigService<EnvironmentVariables, true>,
): GuesserProviderRegistry {
    const mockGuesses = parseMockGuesses(
        config.get('MOCK_GUESSES', { infer: true }),
    )
    const registry = createDefaultRegistry(
        mockGuesses.length > 0 ? { mock: { guesses: mockGuesses } } : {},
    )
    const selected = config.get('GUESSER_PROVIDER', { infer: true })
    if (selected === GuesserProviderName.Codex) {
        const model = config.get('CODEX_MODEL', { infer: true })
        const bin = config.get('CODEX_BIN', { infer: true })
        const effort = config.get('CODEX_REASONING_EFFORT', { infer: true })
        const timeoutMs = config.get('REQUEST_TIMEOUT_MS', { infer: true })
        if (!model) {
            throw new Error(
                'GUESSER_PROVIDER=codex exige CODEX_MODEL configurado',
            )
        }
        registry.register('codex', () => {
            const options: ConstructorParameters<
                typeof CodexGuesserProvider
            >[0] = { model, timeoutMs }
            if (bin) {
                options.bin = bin
            }
            const parsed = parseReasoningEffort(effort)
            if (parsed) {
                options.reasoningEffort = parsed
            }
            return new CodexGuesserProvider(options)
        })
    }
    return registry
}

/**
 * Módulo da rota de adivinhação. O registro de provedores é montado a partir da
 * configuração: o `mock` está sempre disponível; o `codex` só é adicionado
 * quando `GUESSER_PROVIDER=codex`, mantendo-o desligado por padrão.
 */
@Module({
    controllers: [GuessController],
    providers: [
        GuessService,
        GuessMetricsLogger,
        {
            provide: GUESSER_REGISTRY,
            inject: [ConfigService],
            useFactory: buildGuesserRegistry,
        },
    ],
})
export class GuessModule {}
