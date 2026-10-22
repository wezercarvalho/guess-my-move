import { z } from 'zod'

/** Provedores de adivinhação selecionáveis por configuração. */
export const GuesserProviderName = {
    Mock: 'mock',
    Codex: 'codex',
} as const
export type GuesserProviderName =
    (typeof GuesserProviderName)[keyof typeof GuesserProviderName]

/**
 * Inteiro positivo lido do ambiente. Variável vazia ou ausente usa o padrão;
 * texto que não é número inteiro positivo invalida a configuração.
 */
const positiveInt = (fallback: number) =>
    z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.coerce.number().int().min(1).default(fallback),
    )

/**
 * Variáveis de ambiente validadas na inicialização (Standard Schema do
 * `@nestjs/config`). Falha cedo, no boot, quando algo está fora do contrato.
 */
export const environmentSchema = z.object({
    PORT: positiveInt(3000),
    GUESSER_PROVIDER: z.enum(['mock', 'codex']).default('mock'),
    MAX_FRAMES: positiveInt(6),
    MAX_FRAME_BYTES: positiveInt(262144),
    MAX_TOTAL_BYTES: positiveInt(1572864),
    REQUEST_TIMEOUT_MS: positiveInt(15000),
    RATE_LIMIT_PER_MINUTE: positiveInt(20),
    COST_CEILING_ATTEMPTS_PER_HOUR: positiveInt(60),
    CODEX_MODEL: z.string().optional(),
    CODEX_REASONING_EFFORT: z.string().optional(),
    CODEX_BIN: z.string().optional(),
})

export type EnvironmentVariables = z.infer<typeof environmentSchema>
