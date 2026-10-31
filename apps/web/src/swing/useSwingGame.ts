import { DEFAULT_SWING, type City } from '@guess-my-move/swing'
import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realTwoHandGestureLoader,
} from '../tracker/mediapipeTracker.js'
import { createMediaPipeFaceTracker } from '../tracker/faceTracker.js'
import { type CityMap } from './cityCatalog.js'
import { createThreeRenderer } from './cityRenderer.js'
import { fetchCity } from './loadCity.js'
import { SwingController, type SwingEnv, type SwingSnapshot } from './swingController.js'

/** Dependências injetáveis para teste; `loadCity` recebe o mapa validado pelo catálogo. */
export type SwingDeps = Omit<Partial<SwingEnv>, 'loadCity'> & {
    loadCity?: (map: CityMap) => Promise<City>
}

export interface UseSwingGameOptions {
    map: CityMap
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
    recenterHead: () => void
    setLookMode: (mode: 'auto' | 'face') => void
    resize: (width: number, height: number) => void
}

function resolveEnv(map: CityMap, deps: SwingDeps | undefined): SwingEnv {
    return {
        config: deps?.config ?? { ...DEFAULT_SWING, spawnHeight: map.spawnHeight },
        createTracker:
            deps?.createTracker ??
            (() =>
                createMediaPipeHandTracker(
                    realTwoHandGestureLoader,
                    delegatePreferenceFromSearch(window.location.search),
                )),
        createFaceTracker:
            deps?.createFaceTracker ??
            (() => createMediaPipeFaceTracker(undefined, delegatePreferenceFromSearch(window.location.search))),
        loadCity: () =>
            deps?.loadCity ? deps.loadCity(map) : fetchCity(`${import.meta.env.BASE_URL}${map.file}`),
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
    const { map, cameraActive, videoRef, overlayRef, sceneRef, effectsRef, deps } = options
    const [controller] = useState(() => new SwingController(resolveEnv(map, deps)))
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

    return {
        ...snapshot,
        restart: controller.restart,
        recenterHead: controller.recenterHead,
        setLookMode: controller.setLookMode,
        resize: controller.resize.bind(controller),
    }
}
