import { type Card } from '@guess-my-move/core'
import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realMediaPipeLoader,
} from '../tracker/mediapipeTracker.js'
import {
    type GestureEnv,
    GestureController,
    type GestureSnapshot,
} from './gestureController.js'

/** Dependências injetáveis para teste; os padrões usam o navegador e o MediaPipe. */
export type GestureRoundDeps = Partial<GestureEnv>

export interface UseGestureRoundOptions {
    card: Card
    cameraActive: boolean
    /** A câmera foi negada, está indisponível ou falhou. */
    cameraFailed: boolean
    videoRef: RefObject<HTMLVideoElement | null>
    overlayRef: RefObject<HTMLCanvasElement | null>
    /** Lidas só na montagem; trocar a carta ou as dependências exige remontar a tela. */
    deps?: GestureRoundDeps
}

export interface GestureRoundView extends GestureSnapshot {
    start: () => void
    cancel: () => void
    newRound: () => void
}

/** Resolve as dependências, usando o navegador e o MediaPipe quando não injetadas. */
function resolveEnv(deps: GestureRoundDeps | undefined): GestureEnv {
    return {
        createTracker:
            deps?.createTracker ??
            (() =>
                createMediaPipeHandTracker(
                    realMediaPipeLoader,
                    delegatePreferenceFromSearch(window.location.search),
                )),
        requestFrame:
            deps?.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback)),
        cancelFrame: deps?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle)),
        now: deps?.now ?? (() => performance.now()),
    }
}

/**
 * Camada fina sobre o `GestureController`: cria o controlador uma vez, assina
 * as mudanças e informa a ele o estado da câmera.
 */
export function useGestureRound(options: UseGestureRoundOptions): GestureRoundView {
    const { card, cameraActive, cameraFailed, videoRef, overlayRef, deps } = options
    const [controller] = useState(
        () =>
            new GestureController({ card, env: resolveEnv(deps) }),
    )
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

    useEffect(() => {
        controller.attach({
            getVideo: () => videoRef.current,
            getOverlay: () => overlayRef.current,
        })
        return () => {
            controller.detach()
        }
    }, [controller, videoRef, overlayRef])

    useEffect(() => {
        controller.setCamera(cameraActive, cameraFailed)
    }, [controller, cameraActive, cameraFailed])

    return {
        ...snapshot,
        start: controller.start,
        cancel: controller.cancel,
        newRound: controller.newRound,
    }
}
