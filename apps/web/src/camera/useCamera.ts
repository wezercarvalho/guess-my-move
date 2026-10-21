import { useCallback, useEffect, useRef, useState } from 'react'

import {
    type CameraStatus,
    classifyCameraError,
    DEFAULT_CAMERA_CONSTRAINTS,
    type GetUserMedia,
    resolveGetUserMedia,
    stopStream,
} from './cameraService.js'

/** Opções do hook; `getUserMedia` é injetável para testes. */
export interface UseCameraOptions {
    getUserMedia?: GetUserMedia | null
    constraints?: MediaStreamConstraints
}

/** Valor retornado pelo hook de câmera. */
export interface UseCameraResult {
    status: CameraStatus
    /** Mensagem legível quando `status` é `denied`, `unavailable` ou `error`. */
    errorMessage: string | null
    /** Stream ativa (ou `null`); use para ligar ao `<video>`. */
    stream: MediaStream | null
    /** `true` enquanto a câmera está ativa (controla o indicador visível). */
    isActive: boolean
    /** Solicita a câmera. Sem efeito se já estiver `requesting`/`active`. */
    start: () => Promise<void>
    /** Encerra TODAS as tracks e volta ao estado `idle`. */
    stop: () => void
}

/**
 * Hook que gerencia o ciclo de vida da câmera local. Nunca faz requisição ao
 * modelo/servidor; apenas obtém e encerra a MediaStream. Limpa a stream ao
 * desmontar o componente.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
    const constraints = options.constraints ?? DEFAULT_CAMERA_CONSTRAINTS
    // Resolve a implementação uma vez: injetada nos testes, do navegador em
    // produção, ou `null` quando a API não existe.
    const getUserMediaRef = useRef<GetUserMedia | null>(
        options.getUserMedia === undefined
            ? resolveGetUserMedia()
            : options.getUserMedia,
    )

    const [status, setStatus] = useState<CameraStatus>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)

    const streamRef = useRef<MediaStream | null>(null)
    // Guarda de concorrência: evita aplicar o resultado de um start() obsoleto
    // (por exemplo, se stop() for chamado durante o pedido de permissão).
    const requestIdRef = useRef(0)

    const stop = useCallback(() => {
        requestIdRef.current += 1
        stopStream(streamRef.current)
        streamRef.current = null
        setStream(null)
        setStatus('idle')
        setErrorMessage(null)
    }, [])

    const start = useCallback(async () => {
        setStatus((current) =>
            current === 'requesting' || current === 'active'
                ? current
                : 'requesting',
        )

        const getUserMedia = getUserMediaRef.current
        if (!getUserMedia) {
            setStatus('unavailable')
            setErrorMessage(
                'A câmera não está disponível neste navegador. Use um navegador com suporte a getUserMedia em uma origem segura (HTTPS ou localhost).',
            )
            return
        }

        const requestId = (requestIdRef.current += 1)
        setErrorMessage(null)

        try {
            const nextStream = await getUserMedia(constraints)
            // start()/stop() mais recente venceu: descarta esta stream.
            if (requestId !== requestIdRef.current) {
                stopStream(nextStream)
                return
            }
            streamRef.current = nextStream
            setStream(nextStream)
            setStatus('active')
        } catch (error) {
            if (requestId !== requestIdRef.current) return
            const classified = classifyCameraError(error)
            setStatus(classified.status)
            setErrorMessage(classified.message)
        }
    }, [constraints])

    // Limpeza ao desmontar: encerra qualquer stream ativa.
    useEffect(() => {
        return () => {
            requestIdRef.current += 1
            stopStream(streamRef.current)
            streamRef.current = null
        }
    }, [])

    return {
        status,
        errorMessage,
        stream,
        isActive: status === 'active',
        start,
        stop,
    }
}
