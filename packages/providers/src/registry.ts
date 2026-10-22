import type { GuesserProvider } from '@guess-my-move/core'

import { type MockGuesserOptions, MockGuesserProvider } from './mock-provider.js'

/** Nomes de provedor suportados pela PoC, selecionados por configuração. */
export type GuesserProviderName = 'mock' | 'codex'

/** Fábrica de um provedor a partir da configuração de ambiente. */
export type GuesserProviderFactory = () => GuesserProvider

/**
 * Registro de provedores disponíveis. A seleção é por configuração
 * (`GUESSER_PROVIDER`); trocar de provedor é configuração + um adaptador novo,
 * sem tocar na rota nem na UI. O `codex` é registrado pelo chamador apenas
 * quando habilitado, mantendo-o desligado por padrão.
 */
export class GuesserProviderRegistry {
    private readonly factories = new Map<
        GuesserProviderName,
        GuesserProviderFactory
    >()

    register(name: GuesserProviderName, factory: GuesserProviderFactory): this {
        this.factories.set(name, factory)
        return this
    }

    has(name: GuesserProviderName): boolean {
        return this.factories.has(name)
    }

    /** Instancia o provedor selecionado; lança se ele não estiver registrado. */
    create(name: GuesserProviderName): GuesserProvider {
        const factory = this.factories.get(name)
        if (!factory) {
            throw new Error(
                `Provedor "${name}" não está registrado ou está desabilitado`,
            )
        }
        return factory()
    }
}

/**
 * Cria um registro com o `mock` já disponível (sempre, sem credencial). O
 * `codex` é adicionado pelo chamador via `register('codex', ...)` apenas quando
 * `GUESSER_PROVIDER=codex`, preservando o padrão desligado.
 */
export function createDefaultRegistry(
    options: { mock?: MockGuesserOptions } = {},
): GuesserProviderRegistry {
    return new GuesserProviderRegistry().register(
        'mock',
        () => new MockGuesserProvider(options.mock),
    )
}
