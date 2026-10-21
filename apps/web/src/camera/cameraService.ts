/**
 * Serviço de câmera da PoC.
 *
 * Encapsula o acesso a `navigator.mediaDevices.getUserMedia` atrás de uma
 * dependência injetável (`GetUserMedia`), para que os testes possam simular a
 * permissão concedida, negada ou indisponível sem um navegador real. O serviço
 * não faz nenhuma requisição ao modelo/servidor: ele só gerencia a MediaStream
 * local e sua limpeza.
 */

/** Função que obtém uma MediaStream; injetável para testes. */
export type GetUserMedia = (
    constraints: MediaStreamConstraints,
) => Promise<MediaStream>

/**
 * Estados possíveis da câmera:
 * - `idle`: nada solicitado ainda.
 * - `requesting`: permissão pedida, aguardando resposta do usuário.
 * - `active`: stream obtida e em uso.
 * - `denied`: usuário (ou política) negou a permissão.
 * - `unavailable`: API de câmera indisponível neste ambiente/navegador.
 * - `error`: falha inesperada ao obter a câmera.
 */
export type CameraStatus =
    | 'idle'
    | 'requesting'
    | 'active'
    | 'denied'
    | 'unavailable'
    | 'error'

/** Erro classificado do serviço de câmera. */
export interface CameraError {
    status: Extract<CameraStatus, 'denied' | 'unavailable' | 'error'>
    message: string
}

/** Restrições padrão: só vídeo, sem áudio (a PoC não usa microfone). */
export const DEFAULT_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
    video: true,
    audio: false,
}

/**
 * Resolve a função `getUserMedia` a partir do `navigator`, ou retorna `null`
 * quando a API não existe (ambiente sem suporte). A função é religada ao
 * `navigator.mediaDevices` para preservar o `this` esperado pela API.
 */
export function resolveGetUserMedia(
    nav: Navigator | undefined = typeof navigator === 'undefined'
        ? undefined
        : navigator,
): GetUserMedia | null {
    const mediaDevices = nav?.mediaDevices
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
        return null
    }
    return (constraints) => mediaDevices.getUserMedia(constraints)
}

/**
 * Classifica um erro lançado por `getUserMedia` nos estados do serviço.
 *
 * `NotAllowedError`/`PermissionDeniedError`/`SecurityError` indicam permissão
 * negada; `NotFoundError`/`OverconstrainedError` indicam ausência de câmera
 * (tratada como `unavailable`); o restante vira `error` genérico.
 */
export function classifyCameraError(error: unknown): CameraError {
    const name =
        typeof error === 'object' && error !== null && 'name' in error
            ? String(error.name)
            : ''

    if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError'
    ) {
        return {
            status: 'denied',
            message:
                'Permissão de câmera negada. Reative a câmera nas configurações do navegador (ícone de cadeado na barra de endereço) e tente novamente.',
        }
    }

    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return {
            status: 'unavailable',
            message:
                'Nenhuma câmera foi encontrada neste dispositivo. Conecte uma câmera e tente novamente.',
        }
    }

    return {
        status: 'error',
        message:
            'Não foi possível acessar a câmera. Verifique se nenhum outro aplicativo a está usando e tente novamente.',
    }
}

/** Encerra todas as tracks de uma MediaStream (idempotente). */
export function stopStream(stream: MediaStream | null | undefined): void {
    if (!stream) return
    for (const track of stream.getTracks()) {
        track.stop()
    }
}
