/**
 * Adaptadores do `GuesserProvider` da PoC Guess My Move.
 *
 * Fronteira de informação inviolável: nenhum provedor recebe dados da carta
 * (palavra, dica, sugestão, resposta canônica, aliases ou critérios). A entrada
 * é apenas `GuesserInput` (frames + palpites rejeitados).
 */
export {
    MockGuesserProvider,
    MockProviderError,
    type MockGuesserOptions,
} from './mock-provider.js'
export {
    CodexExecutionError,
    CodexGuesserProvider,
    type CodexProviderOptions,
    type CodexReasoningEffort,
    uniqueRunId,
} from './codex-provider.js'
export {
    createDefaultRegistry,
    GuesserProviderRegistry,
    type GuesserProviderFactory,
    type GuesserProviderName,
} from './registry.js'
export {
    guesserResultJsonSchema,
    InvalidProviderOutputError,
    parseGuesserResult,
} from './result-schema.js'
