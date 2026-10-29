import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realTwoHandGestureLoader,
} from '../tracker/mediapipeTracker.js'
import { createThreeRenderer } from './cityRenderer.js'
import { fetchCity } from './loadCity.js'
import { SwingController, type SwingEnv, type SwingSnapshot } from './swingController.js'

/** Dependências injetáveis para teste; os padrões usam o navegador, o MediaPipe e o Three.js. */
export type SwingDeps = Partial<SwingEnv>

export interface UseSwingGameOptions {
    cameraActive: boolean
    videoRef: RefObject<HTMLVideoElement | null>
    overlayRef: RefObject<HTMLCanvasElement | null>
    sceneRef: RefObject<HTMLCanvasElement | null>
    effectsRef: RefObject<HTMLCanvasElement | null>
    /** Lidas só na montagem; trocar as dependências exige remontar a tela. */
    deps?: SwingDeps
}

export interface SwingGameView extends SwingSnapshot {
    restart: () => void
    resize: (width: number, height: number) => void
}

function resolveEnv(deps: SwingDeps | undefined): SwingEnv {
    return {
        createTracker:
            deps?.createTracker ??
            (() =>
                createMediaPipeHandTracker(
                    realTwoHandGestureLoader,
                    delegatePreferenceFromSearch(window.location.search),
                )),
        loadCity:
            deps?.loadCity ?? (() => fetchCity(`${import.meta.env.BASE_URL}swing/midtown.json`)),
        createRenderer: deps?.createRenderer ?? createThreeRenderer,
        requestFrame:
            deps?.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback)),
        cancelFrame: deps?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle)),
        now: deps?.now ?? (() => performance.now()),
        keys: deps?.keys ?? window,
    }
}

/** Camada fina sobre o `SwingController`: cria o controlador uma vez e assina as mudanças. */
export function useSwingGame(options: UseSwingGameOptions): SwingGameView {
    const { cameraActive, videoRef, overlayRef, sceneRef, effectsRef, deps } = options
    const [controller] = useState(() => new SwingController(resolveEnv(deps)))
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

    useEffect(() => {
        controller.attach({
            getVideo: () => videoRef.current,
            getOverlay: () => overlayRef.current,
            getScene: () => sceneRef.current,
            getEffects: () => effectsRef.current,
        })
        return () => {
            controller.detach()
        }
    }, [controller, videoRef, overlayRef, sceneRef, effectsRef])

    useEffect(() => {
        controller.setCamera(cameraActive)
    }, [controller, cameraActive])

    return { ...snapshot, restart: controller.restart, resize: controller.resize.bind(controller) }
}
