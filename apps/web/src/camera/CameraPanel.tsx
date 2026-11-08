import { useI18n } from '../i18n/locale.js'
import { type ReactNode, type RefObject, useEffect, useRef } from 'react'

import { type UseCameraResult } from './useCamera.js'

/** Props do painel de câmera: recebe o resultado do hook `useCamera`. */
export interface CameraPanelProps {
    camera: UseCameraResult
    /**
     * Ref externa opcional para o `<video>`, de modo que o componente pai
     * (ex.: a rodada) possa ler frames do mesmo elemento.
     */
    videoRef?: RefObject<HTMLVideoElement | null>
    /** Conteúdo sobreposto ao vídeo (ex.: o esqueleto da mão), dentro do mesmo quadro. */
    overlay?: ReactNode
}

/**
 * Painel de câmera: botão para ativar/parar, preview local mudo, indicador
 * visível de câmera ativa e instruções quando a permissão é negada ou a câmera
 * está indisponível. Nenhuma requisição ao modelo/servidor acontece aqui.
 */
export function CameraPanel({ camera, videoRef: externalRef, overlay }: CameraPanelProps) {
    const { t, locale } = useI18n()
    const { status, errorMessage, stream, isActive, start, stop } = camera
    const internalRef = useRef<HTMLVideoElement>(null)
    const videoRef = externalRef ?? internalRef

    // Liga a stream ao elemento <video> quando ela muda.
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        if (stream) {
            // `play()` pode rejeitar se o elemento for desmontado; ignoramos.
            void video.play().catch(() => undefined)
        }
    }, [stream, videoRef])

    const requesting = status === 'requesting'

    return (
        <section aria-labelledby="camera-heading" className="camera-panel">
            <h2 id="camera-heading">{t.camera}</h2>

            <div className="camera-preview-wrapper">
                <video
                    ref={videoRef}
                    className="camera-preview"
                    muted
                    playsInline
                    // Rótulo acessível para o preview da câmera.
                    aria-label={t.cameraPreview}
                    data-testid="camera-preview"
                    hidden={!isActive}
                />
                {overlay}
                {isActive && (
                    <span
                        className="camera-indicator"
                        role="status"
                        data-testid="camera-active-indicator"
                    >
                        <span className="camera-indicator-dot" aria-hidden="true" />
                        {t.cameraActive}
                    </span>
                )}
            </div>

            <div className="camera-actions">
                {!isActive ? (
                    <button
                        type="button"
                        onClick={() => void start()}
                        disabled={requesting}
                    >
                        {requesting ? t.cameraRequest : t.cameraEnable}
                    </button>
                ) : (
                    <button type="button" onClick={stop}>
                        {t.cameraStop}
                    </button>
                )}
            </div>

            {/* Estado anunciado a tecnologias assistivas. */}
            <p className="sr-only" aria-live="polite" data-testid="camera-status">
                {statusLabel(status, t)}
            </p>

            {errorMessage && (
                <div className="camera-error" role="alert">
                    <p>{locale === 'pt-BR' ? errorMessage : statusLabel(status, t)}</p>
                    {status === 'denied' && (
                        <p className="camera-error-hint">
                            {t.cameraRetry}
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}

/** Rótulo textual de cada estado, para o anúncio em `aria-live`. */
function statusLabel(status: UseCameraResult['status'], t: ReturnType<typeof useI18n>['t']): string {
    switch (status) {
        case 'idle':
            return t.cameraIdle
        case 'requesting':
            return t.cameraRequesting
        case 'active':
            return t.cameraActiveStatus
        case 'denied':
            return t.cameraDenied
        case 'unavailable':
            return t.cameraUnavailable
        case 'error':
            return t.cameraError
    }
}
