import { ModulesContainer } from '@nestjs/core'
import { RequestMethod } from '@nestjs/common'
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createServerApp } from '../src/app.setup.js'
import { loadServerConfig } from '../src/server-config.js'
import { BackendTelemetry } from '../src/observability/backend-telemetry.service.js'
import {
    observeOptions,
    observeHttpIgnored,
} from '../src/observability/observe.setup.js'
import {
    buildOpenApiDocument,
    buildMultiplayerContract,
    buildSwingContract,
} from '../src/contracts/documents.js'

describe('plataforma nativa e política de telemetria', () => {
    it('usa o mesmo adaptador nativo em testes e execução', async () => {
        const app = await createServerApp({ logger: false })
        try {
            expect(app.getHttpAdapter().constructor.name).toBe('NodeAdapter')
        } finally {
            await app.close()
        }
    })
    it('mantém coleta externa desligada e recusa ativação incompleta', () => {
        const options = observeOptions(loadServerConfig({}))
        expect(options.enabled).toBe(false)
        expect(options.forwardLogs).toBe(false)
        expect(options.http?.capture).toBe(false)
        expect(options.outgoing).toBe(false)
        expect(() => loadServerConfig({ OBSERVE_ENABLED: 'true' })).toThrow()
        expect(() => loadServerConfig({ METRICS_TOKEN: 'short' })).toThrow()
        expect(() => loadServerConfig({ OBSERVE_SAMPLE_RATE: '0' })).toThrow()
    })
    it('não instrumenta caminhos arbitrários, métricas ou parâmetros de query', () => {
        expect(observeHttpIgnored({ url: '/api/capabilities' })).toBe(false)
        expect(
            observeHttpIgnored({ url: '/api/capabilities?anything=secret' }),
        ).toBe(true)
        expect(observeHttpIgnored({ url: '/api/metrics' })).toBe(true)
        expect(observeHttpIgnored({ url: '/api/cards/rounds/private-id/observe' })).toBe(true)
        expect(observeHttpIgnored({ url: '/anything-secret' })).toBe(true)
    })
    it('define HTTP separadamente dos comandos de jogo', () => {
        const openapi = buildOpenApiDocument()
        expect(openapi.openapi).toBe('3.1.0')
        expect(openapi.paths['/api/health']).toBeDefined()
        expect(openapi.paths['/api/capabilities']).toBeDefined()
        expect('get' in openapi.paths['/api/metrics'] && openapi.paths['/api/metrics'].get.security).toEqual([
            { metricsToken: [] },
        ])
        const cardStart = openapi.paths['/api/cards/rounds']
        expect('post' in cardStart).toBe(true)
        expect(JSON.stringify(cardStart)).not.toMatch(/evaluation|criterion|amplitudeDeg|basePoints/)
        expect(openapi.components.securitySchemes.cardRoundToken.scheme).toBe('bearer')
        expect(JSON.stringify(openapi.paths)).not.toContain('room:create')
        const multiplayer = buildMultiplayerContract()
        expect(multiplayer.transport).toBe('socket.io')
        expect(multiplayer.clientEvents['room:create']).toBeDefined()
        expect(multiplayer.serverEvents['room:state']).toBeDefined()
    })
})

describe('contratos versionados', () => {
    for (const [name, build] of [
        ['http.openapi.json', buildOpenApiDocument],
        ['swing.socketio.json', buildSwingContract],
        ['multiplayer.socketio.json', buildMultiplayerContract],
    ] as const) {
        it(`mantém ${name} sincronizado com a implementação`, () => {
            const file = new URL(`../../../contracts/${name}`, import.meta.url)
            expect(readFileSync(file, 'utf8')).toBe(
                JSON.stringify(build(), null, 2) + '\n',
            )
        })
    }
})

describe('métricas de cardinalidade limitada', () => {
    it('recusa nomes arbitrários e conta duração e recusas sem armazenar dados da ação', () => {
        const telemetry = new BackendTelemetry()
        telemetry.record('untrusted-private-operation', true, 3)
        telemetry.record('room:create', true, 12)
        const snapshot = telemetry.snapshot(2, 1)
        expect(snapshot.operations).toEqual({
            'room:create': { count: 1, errors: 1, totalMs: 12, maxMs: 12 },
        })
    })
})

describe('cobertura HTTP do documento', () => {
    it('detecta endpoints novos ou removidos sem contrato correspondente', async () => {
        const app = await createServerApp({ logger: false })
        try {
            const paths: string[] = []
            for (const module of app.get(ModulesContainer).values())
                for (const wrapper of module.controllers.values()) {
                    const target: unknown = wrapper.metatype
                    if (typeof target !== 'function') continue
                    const prefix: unknown = Reflect.getMetadata(
                        PATH_METADATA,
                        target,
                    )
                    const prototype: unknown = Reflect.get(target, 'prototype')
                    if (!prototype || typeof prototype !== 'object') continue
                    for (const name of Object.getOwnPropertyNames(prototype)) {
                        const handler: unknown = Reflect.get(prototype, name)
                        if (typeof handler !== 'function') continue
                        const method: unknown = Reflect.getMetadata(
                            METHOD_METADATA,
                            handler,
                        )
                        if (method === undefined) continue
                        if (typeof method !== 'number') throw new Error('Método HTTP inválido.')
                        const verb = RequestMethod[method]?.toLowerCase()
                        if (!verb) throw new Error('Método HTTP desconhecido.')
                        const path: unknown = Reflect.getMetadata(
                            PATH_METADATA,
                            handler,
                        )
                        if (
                            typeof path !== 'string' ||
                            typeof prefix !== 'string'
                        )
                            throw new Error(
                                'Documentar rotas múltiplas antes de expor a operação.',
                            )
                        paths.push(
                            verb + ' /' +
                                [prefix, path]
                                    .join('/')
                                    .split('/')
                                    .filter(Boolean)
                                    .join('/').replace(/:([A-Za-z_]\w*)/g, '{$1}'),
                        )
                    }
                }
            expect(paths.sort()).toEqual(
                [
                    ...Object.entries(buildOpenApiDocument().paths).flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`)),
                    'get /api/openapi.json',
                ].sort(),
            )
        } finally {
            await app.close()
        }
    })
})

describe('isolamento de falhas do SDK', () => {
    it('preserva métricas locais e o resultado da operação se o publicador falhar', () => {
        const fail = () => {
            throw new Error('SdkPrivateFailure')
        }
        const telemetry = new BackendTelemetry({
            counter: fail,
            summary: fail,
            gauge: fail,
        })
        expect(() => telemetry.record('room:create', false, 3)).not.toThrow()
        const snapshot = telemetry.snapshot(1, 1)
        expect(snapshot.operations['room:create']).toMatchObject({
            count: 1,
            errors: 0,
        })
        expect(snapshot.telemetryFailures).toBe(2)
        expect(JSON.stringify(snapshot)).not.toContain('SdkPrivateFailure')
    })
})
