import { createHash } from 'node:crypto'
import { fork } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import {
    availableParallelism,
    cpus,
    totalmem,
    platform,
    release,
} from 'node:os'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { io } from 'socket.io-client'

const ownFile = fileURLToPath(import.meta.url)
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const percentile = (values, quantile) =>
    values.length
        ? [...values].sort((a, b) => a - b)[
              Math.min(
                  values.length - 1,
                  Math.ceil(values.length * quantile) - 1,
              )
          ]
        : null
const rounded = (value) =>
    value === null ? null : Math.round(value * 1000) / 1000
const summarize = (values) => ({
    count: values.length,
    p50: rounded(percentile(values, 0.5)),
    p95: rounded(percentile(values, 0.95)),
    max: values.length ? rounded(Math.max(...values)) : null,
})

async function serverChild() {
    if (!process.send)
        throw new Error(
            'The benchmark server requires its private parent IPC channel.',
        )
    process.env.OBSERVE_ENABLED = 'false'
    delete process.env.OBSERVE_APP_KEY
    delete process.env.OBSERVE_APP_SECRET
    delete process.env.OBSERVE_ENDPOINT
    delete process.env.METRICS_TOKEN
    process.env.ENABLE_API_DOCS = 'false'
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173'
    process.env.ALLOW_ORIGINLESS_CLIENTS = 'false'
    delete process.env.TRUSTED_PROXY_IPS
    // One loopback client process represents many users, without changing production defaults.
    process.env.MAX_CONNECTIONS_PER_IP = '100'
    process.env.ROOM_ATTEMPTS_PER_MINUTE = '1000'
    process.env.MAX_CONNECTIONS = '200'
    process.env.MAX_ROOMS = '100'
    const { createServerApp } = await import('../dist/app.setup.js')
    const { BackendTelemetry } =
        await import('../dist/observability/backend-telemetry.service.js')
    const { BackendMetrics } =
        await import('../dist/realtime/backend-metrics.service.js')
    const app = await createServerApp({ logger: false, abortOnError: false })
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address()
    const telemetry = app.get(BackendTelemetry)
    const metrics = app.get(BackendMetrics)
    let usage = process.cpuUsage(),
        started = performance.now(),
        peakRss = process.memoryUsage().rss
    const delay = monitorEventLoopDelay({ resolution: 10 })
    delay.enable()
    const rssTimer = setInterval(() => {
        peakRss = Math.max(peakRss, process.memoryUsage().rss)
    }, 50)
    process.on('message', async (message) => {
        if (message?.type === 'measure') {
            usage = process.cpuUsage()
            started = performance.now()
            peakRss = process.memoryUsage().rss
            telemetry.counters.maxTickDelayMs = 0
            delay.reset()
            process.send?.({ type: 'measuring' })
        } else if (message?.type === 'report') {
            const cpu = process.cpuUsage(usage),
                elapsedMs = performance.now() - started
            const totals = metrics.snapshot()
            process.send?.({
                type: 'report',
                stats: {
                    elapsedMs: rounded(elapsedMs),
                    peakRssBytes: peakRss,
                    cpuUserMs: rounded(cpu.user / 1000),
                    cpuSystemMs: rounded(cpu.system / 1000),
                    cpuPercentOneCore: rounded(
                        (cpu.user + cpu.system) / 10 / elapsedMs,
                    ),
                    eventLoopDelayMs: {
                        p95: rounded(delay.percentile(95) / 1e6),
                        max: rounded(delay.max / 1e6),
                    },
                    maxTickDelayMs: totals.maxTickDelayMs,
                    activeRooms: totals.activeRooms,
                    activeConnections: totals.activeConnections,
                    internalErrors: totals.internalErrors,
                    invalidCommands: totals.invalidCommands,
                    rateLimited: totals.rateLimited,
                },
            })
        } else if (message?.type === 'stop') {
            clearInterval(rssTimer)
            delay.disable()
            await app.close()
            process.exit(0)
        }
    })
    process.on('disconnect', () => {
        clearInterval(rssTimer)
        delay.disable()
        void app.close().finally(() => process.exit(0))
    })
    process.send({ type: 'ready', port: address.port })
}

function receive(child, type) {
    return new Promise((done, reject) => {
        const cleanup = () => {
            clearTimeout(timer)
            child.off('message', onMessage)
            child.off('exit', onExit)
        }
        const onMessage = (value) => {
            if (value?.type === type) {
                cleanup()
                done(value)
            } else if (value?.type === 'failed') {
                cleanup()
                reject(new Error('Isolated benchmark server failed.'))
            }
        }
        const onExit = () => {
            cleanup()
            reject(
                new Error('Isolated benchmark server exited before reporting.'),
            )
        }
        const timer = setTimeout(() => {
            cleanup()
            reject(new Error('Isolated benchmark IPC timed out.'))
        }, 10_000)
        child.on('message', onMessage)
        child.once('exit', onExit)
    })
}
async function connect(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error('Invalid private loopback port.')
    const socket = io(`http://127.0.0.1:${port}/swing`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        extraHeaders: { Origin: 'http://localhost:5173' },
        timeout: 5000,
    })
    await new Promise((done, reject) => {
        socket.once('connect', done)
        socket.once('connect_error', () => {
            socket.disconnect()
            reject(new Error('Loopback benchmark connection failed.'))
        })
    })
    return socket
}
function command(socket, event, payload) {
    return new Promise((done, reject) =>
        socket
            .timeout(2000)
            .emit(event, payload, (error, ack) =>
                error
                    ? reject(new Error('Benchmark acknowledgement timed out.'))
                    : done(ack),
            ),
    )
}
function ensure(ack) {
    if (!ack?.ok) throw new Error('Benchmark room setup command was refused.')
    return ack
}

async function profile(roomCount, replicate, warmupMs, durationMs) {
    const child = fork(ownFile, ['--server-child'], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { ...process.env, OBSERVE_ENABLED: 'false' },
    })
    child.on('error', () => {})
    const sockets = [],
        timers = []
    let measuring = false
    const ackMs = [],
        intervals = [],
        failures = {
            acknowledgementTimeouts: 0,
            rejectedCommands: 0,
            disconnects: 0,
            serverErrors: 0,
        },
        completed = { acks: 0, snapshots: 0, phaseSkippedInputs: 0 }
    try {
        const ready = await receive(child, 'ready')
        for (let room = 0; room < roomCount; room++) {
            const one = await connect(ready.port)
            sockets.push(one)
            const two = await connect(ready.port)
            sockets.push(two)
            let latestRound = 1,
                latestStatus = 'waiting'
            for (const [player, socket] of [one, two].entries()) {
                let previous = null,
                    seq = 0,
                    lastRematch = 0
                socket.on('swing:state', (state) => {
                    latestRound = state.round
                    latestStatus = state.status
                    const now = performance.now()
                    if (measuring) {
                        completed.snapshots++
                        if (previous !== null) intervals.push(now - previous)
                    }
                    previous = now
                    if (
                        state.status === 'finished' &&
                        lastRematch !== state.round
                    ) {
                        lastRematch = state.round
                        void command(socket, 'swing:rematch', {
                            round: state.round,
                        }).catch(() => {
                            if (measuring) failures.acknowledgementTimeouts++
                        })
                    }
                })
                socket.on('swing:error', () => {
                    if (measuring) failures.serverErrors++
                })
                socket.on('disconnect', () => {
                    if (measuring) failures.disconnects++
                })
                const timer = setInterval(() => {
                    if (latestStatus !== 'playing') {
                        if (measuring) completed.phaseSkippedInputs++
                        return
                    }
                    const start = performance.now()
                    const input = {
                        held:
                            Math.floor(seq / 20) % 2 === 0
                                ? { center: true }
                                : {},
                        yawRate: Math.sin(seq / 30 + player) * 0.35,
                        pitchRate: 0,
                        lookActive: true,
                    }
                    void command(socket, 'swing:input', {
                        round: latestRound,
                        seq: seq++,
                        input,
                    }).then(
                        (ack) => {
                            if (!measuring) return
                            completed.acks++
                            ackMs.push(performance.now() - start)
                            if (!ack?.ok) failures.rejectedCommands++
                        },
                        () => {
                            if (measuring) failures.acknowledgementTimeouts++
                        },
                    )
                }, 100)
                timers.push(timer)
            }
            const created = ensure(
                await command(one, 'swing:create', {
                    cityId: 'aurora',
                    nickname: 'Participante A',
                }),
            )
            ensure(
                await command(two, 'swing:join', {
                    roomCode: created.access.roomCode,
                    nickname: 'Participante B',
                }),
            )
            ensure(await command(one, 'swing:ready', { ready: true }))
            ensure(await command(two, 'swing:ready', { ready: true }))
        }
        await wait(warmupMs)
        const started = receive(child, 'measuring')
        child.send({ type: 'measure' })
        await started
        measuring = true
        await wait(durationMs)
        measuring = false
        const reported = receive(child, 'report')
        child.send({ type: 'report' })
        const report = await reported
        return {
            rooms: roomCount,
            players: roomCount * 2,
            replicate,
            warmupMs,
            requestedDurationMs: durationMs,
            ...report.stats,
            acknowledgements: { ...completed, latencyMs: summarize(ackMs) },
            snapshotIntervalMs: summarize(intervals),
            failures,
        }
    } finally {
        measuring = false
        for (const timer of timers) clearInterval(timer)
        for (const socket of sockets) socket.disconnect()
        if (child.connected) child.send({ type: 'stop' }, () => {})
        await new Promise((done) => {
            if (child.exitCode !== null) {
                done()
                return
            }
            const timer = setTimeout(() => {
                child.kill('SIGKILL')
                done()
            }, 3000)
            child.once('exit', () => {
                clearTimeout(timer)
                done()
            })
        })
    }
}

async function optionalFile(path) {
    try {
        return (await readFile(path, 'utf8')).trim()
    } catch {
        return null
    }
}
async function main() {
    const argv = process.argv.slice(2)
    let output = null,
        replicas = 2,
        warmupMs = 3000,
        durationMs = 15000
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index],
            value = argv[index + 1]
        if (!value) throw new Error('Every benchmark option requires a value.')
        if (key === '--output') output = resolve(value)
        else if (key === '--replicas') replicas = Number(value)
        else if (key === '--warmup-ms') warmupMs = Number(value)
        else if (key === '--duration-ms') durationMs = Number(value)
        else
            throw new Error(
                'Unknown benchmark option; external URLs are never accepted.',
            )
    }
    if (
        ![1, 2].includes(replicas) ||
        !Number.isInteger(warmupMs) ||
        warmupMs < 1000 ||
        warmupMs > 10000 ||
        !Number.isInteger(durationMs) ||
        durationMs < 1000 ||
        durationMs > 60000
    )
        throw new Error('Invalid bounded benchmark settings.')
    const [major, minor, patch] = process.versions.node.split('.').map(Number)
    if (major !== 26 || minor < 12 || (minor === 12 && patch < 1))
        throw new Error(
            'Use supported Node >=26.12.1 <27; evidence records the actual patch.',
        )
    const document = {
        version: 2,
        scriptSha256: createHash('sha256')
            .update(await readFile(ownFile))
            .digest('hex'),
        generatedAt: new Date().toISOString(),
        scenario: 'isolated-loopback-swing-aurora',
        runtime: {
            node: process.version,
            platform: platform(),
            kernel: release(),
            architecture: process.arch,
            availableParallelism: availableParallelism(),
            cpuModel: cpus()[0]?.model ?? null,
            hostMemoryBytes: totalmem(),
            cgroupCpuMax: await optionalFile('/sys/fs/cgroup/cpu.max'),
            cgroupMemoryMax: await optionalFile('/sys/fs/cgroup/memory.max'),
        },
        methodology: {
            profiles: [2, 10, 20],
            replicas,
            warmupMs,
            durationMs,
            inputHzPerPlayer: 10,
            nominalSnapshotHz: 10,
            serverProcessSeparateFromClients: true,
            rssSamplingMs: 50,
            eventLoopHistogramResolutionMs: 10,
            externalTelemetry: false,
            cameraOrWebGL: false,
            localAdmissionOverrides: {
                maxConnectionsPerIp: 100,
                roomAttemptsPerMinute: 1000,
            },
            globalLimits: { maxConnections: 200, maxRooms: 100 },
        },
        results: [],
    }
    for (const rooms of [2, 10, 20])
        for (let replicate = 1; replicate <= replicas; replicate++) {
            const result = await profile(rooms, replicate, warmupMs, durationMs)
            document.results.push(result)
            process.stdout.write(
                JSON.stringify({
                    rooms,
                    replicate,
                    ackP95Ms: result.acknowledgements.latencyMs.p95,
                    snapshotP95Ms: result.snapshotIntervalMs.p95,
                    failures: result.failures,
                }) + '\n',
            )
        }
    const serialized = JSON.stringify(document, null, 2) + '\n'
    if (output) {
        await mkdir(dirname(output), { recursive: true })
        await writeFile(output, serialized, 'utf8')
    } else process.stdout.write(serialized)
}
if (process.argv[2] === '--server-child') {
    await serverChild().catch(() => {
        process.send?.({ type: 'failed' })
        process.exitCode = 1
    })
} else
    await main().catch((error) => {
        process.stderr.write(
            `${error instanceof Error ? error.message : 'Benchmark failed.'}\n`,
        )
        process.exitCode = 1
    })
