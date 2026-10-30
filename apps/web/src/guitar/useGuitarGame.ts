import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realTwoHandLoader,
} from '../tracker/mediapipeTracker.js'
import { createAudioPlayer } from './audioPlayer.js'
import { GuitarController, type GuitarEnv, type GuitarSnapshot } from './guitarController.js'

/** Dependências injetáveis para teste; os padrões usam o navegador e o MediaPipe. */
export type GuitarDeps = Partial<GuitarEnv>

export interface UseGuitarGameOptions {
    cameraActive: boolean
    videoRef: RefObject<HTMLVideoElement | null>
    overlayRef: RefObject<HTMLCanvasElement | null>
    /** Lidas só na montagem; trocar as dependências exige remontar a tela. */
    deps?: GuitarDeps
}

export interface GuitarGameView extends GuitarSnapshot {
    controller: GuitarController
}

function resolveEnv(deps: GuitarDeps | undefined): GuitarEnv {
    return {
        createTracker:
            deps?.createTracker ??
            (() =>
                createMediaPipeHandTracker(
                    realTwoHandLoader,
                    delegatePreferenceFromSearch(window.location.search),
                )),
        createAudio: deps?.createAudio ?? (() => createAudioPlayer()),
        requestFrame:
            deps?.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback)),
        cancelFrame: deps?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle)),
        now: deps?.now ?? (() => performance.now()),
        keys: deps?.keys ?? window,
    }
}

/** Camada fina sobre o `GuitarController`: cria o controlador uma vez e assina as mudanças. */
export function useGuitarGame(options: UseGuitarGameOptions): GuitarGameView {
    const { cameraActive, videoRef, overlayRef, deps } = options
    const [controller] = useState(() => new GuitarController(resolveEnv(deps)))
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
        controller.setCamera(cameraActive)
    }, [controller, cameraActive])

    // o primeiro clique em qualquer lugar libera o áudio (o navegador exige um gesto)
    useEffect(() => {
        const unlock = () => {
            controller.unlockAudio()
        }
        window.addEventListener('pointerdown', unlock)
        return () => {
            window.removeEventListener('pointerdown', unlock)
        }
    }, [controller])

    return { ...snapshot, controller }
}
