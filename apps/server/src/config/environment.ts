import { plainToInstance, Transform } from 'class-transformer'
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
    validateSync,
} from 'class-validator'

/** Provedor de adivinhação selecionado por configuração. */
export enum GuesserProviderName {
    Mock = 'mock',
    Codex = 'codex',
}

const toInt = ({ value }: { value: unknown }): unknown =>
    value === undefined || value === '' ? undefined : Number(value)

/**
 * Variáveis de ambiente validadas na inicialização. Falha cedo (crash no boot)
 * quando algo está fora do contrato, em vez de falhar em runtime.
 */
export class EnvironmentVariables {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Transform(toInt)
    PORT = 3000

    @IsEnum(GuesserProviderName)
    GUESSER_PROVIDER: GuesserProviderName = GuesserProviderName.Mock

    @IsInt()
    @Min(1)
    @Transform(toInt)
    MAX_FRAMES = 6

    @IsInt()
    @Min(1)
    @Transform(toInt)
    MAX_FRAME_BYTES = 262144

    @IsInt()
    @Min(1)
    @Transform(toInt)
    MAX_TOTAL_BYTES = 1572864

    @IsInt()
    @Min(1)
    @Transform(toInt)
    REQUEST_TIMEOUT_MS = 15000

    @IsInt()
    @Min(1)
    @Transform(toInt)
    RATE_LIMIT_PER_MINUTE = 20

    @IsInt()
    @Min(1)
    @Transform(toInt)
    COST_CEILING_ATTEMPTS_PER_HOUR = 60

    @IsOptional()
    @IsString()
    CODEX_MODEL?: string

    @IsOptional()
    @IsString()
    CODEX_REASONING_EFFORT?: string

    @IsOptional()
    @IsString()
    CODEX_BIN?: string
}

/**
 * Valida e normaliza as variáveis de ambiente. Lançada no boot via
 * `ConfigModule.forRoot({ validate })`.
 */
export function validateEnv(
    config: Record<string, unknown>,
): EnvironmentVariables {
    const validated = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: false,
    })
    const errors = validateSync(validated, {
        skipMissingProperties: false,
        whitelist: false,
    })
    if (errors.length > 0) {
        const detail = errors
            .map((error) => Object.values(error.constraints ?? {}).join(', '))
            .join('; ')
        throw new Error(`Configuração de ambiente inválida: ${detail}`)
    }
    return validated
}
