import { useEffect, useRef } from 'react'

import { type UseCameraResult } from './useCamera.js'

/** Props do painel de câmera: recebe o resultado do hook `useCamera`. */
export interface CameraPanelProps {
    camera: UseCameraResult
}

/**
 * Painel de câmera: botão para ativar/parar, preview local mudo, indicador
 * visível de câmera ativa e instruções quando a permissão é negada ou a câmera
 * está indisponível. Nenhuma requisição ao modelo/servidor acontece aqui.
 */
export function CameraPanel({ camera }: CameraPanelProps) {
    const { status, errorMessage, stream, isActive, start, stop } = camera
    const videoRef = useRef<HTMLVideoElement>(null)

    // Liga a stream ao elemento <video> quando ela muda.
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        if (stream) {
            // `play()` pode rejeitar se o elemento for desmontado; ignoramos.
            void video.play().catch(() => undefined)
        }
    }, [stream])

    const requesting = status === 'requesting'

    return (
        <section aria-labelledby="camera-heading" className="camera-panel">
            <h2 id="camera-heading">Câmera</h2>

            <div className="camera-preview-wrapper">
                <video
                    ref={videoRef}
                    className="camera-preview"
                    muted
                    playsInline
                    // Rótulo acessível para o preview da câmera.
                    aria-label="Pré-visualização da sua câmera"
                    data-testid="camera-preview"
                    hidden={!isActive}
                />
                {isActive && (
                    <span
                        className="camera-indicator"
                        role="status"
                        data-testid="camera-active-indicator"
                    >
                        <span className="camera-indicator-dot" aria-hidden="true" />
                        Câmera ativa
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
                        {requesting ? 'Solicitando câmera…' : 'Ativar câmera'}
                    </button>
                ) : (
                    <button type="button" onClick={stop}>
                        Parar câmera
                    </button>
                )}
            </div>

            {/* Estado anunciado a tecnologias assistivas. */}
            <p className="sr-only" aria-live="polite" data-testid="camera-status">
                {statusLabel(status)}
            </p>

            {errorMessage && (
                <div className="camera-error" role="alert">
                    <p>{errorMessage}</p>
                    {status === 'denied' && (
                        <p className="camera-error-hint">
                            Depois de reativar a permissão, clique em “Ativar
                            câmera” novamente. Enquanto a câmera estiver negada,
                            nenhum dado é enviado a provedores externos.
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}

/** Rótulo textual de cada estado, para o anúncio em `aria-live`. */
function statusLabel(status: UseCameraResult['status']): string {
    switch (status) {
        case 'idle':
            return 'Câmera desativada.'
        case 'requesting':
            return 'Solicitando permissão de câmera.'
        case 'active':
            return 'Câmera ativa.'
        case 'denied':
            return 'Permissão de câmera negada.'
        case 'unavailable':
            return 'Câmera indisponível.'
        case 'error':
            return 'Erro ao acessar a câmera.'
    }
}
