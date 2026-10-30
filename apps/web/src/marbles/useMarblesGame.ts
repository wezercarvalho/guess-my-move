import { type BotLevel, type Opponent } from '@guess-my-move/marbles'
import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realGestureLoader,
} from '../tracker/mediapipeTracker.js'
import {
    type MarblesEnv,
    MarblesController,
    type MarblesSnapshot,
    type ShotControl,
    shotControlFromSearch,
} from './marblesController.js'

/** Dependências injetáveis para teste; os padrões usam o navegador e o MediaPipe. */
export type MarblesDeps = Partial<MarblesEnv>

export interface UseMarblesGameOptions {
    cameraActive: boolean
    /** A câmera foi negada, está indisponível ou falhou. */
    cameraFailed: boolean
    videoRef: RefObject<HTMLVideoElement | null>
    overlayRef: RefObject<HTMLCanvasElement | null>
    /** Lidas só na montagem; trocar as dependências exige remontar a tela. */
    deps?: MarblesDeps
}

export interface MarblesGameView extends MarblesSnapshot {
    /** Escolha, só na tela inicial. */
    setMode: (modeId: string) => void
    setOpponent: (opponent: Opponent) => void
    setBotLevel: (level: BotLevel) => void
    setShotControl: (control: ShotControl) => void
    startMatch: () => void
    /** Fim de partida. */
    playAgain: () => void
    changeMode: () => void
}

/** Resolve as dependências, usando o navegador e o MediaPipe quando não injetadas. */
function resolveEnv(deps: MarblesDeps | undefined): MarblesEnv {
    return {
        createTracker:
            deps?.createTracker ??
            (() =>
                createMediaPipeHandTracker(
                    realGestureLoader,
                    delegatePreferenceFromSearch(window.location.search),
                )),
        requestFrame:
            deps?.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback)),
        cancelFrame: deps?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle)),
        now: deps?.now ?? (() => performance.now()),
        ...(deps?.createBot === undefined ? {} : { createBot: deps.createBot }),
        ...(deps?.seed === undefined ? {} : { seed: deps.seed }),
    }
}

/**
 * Camada fina sobre o `MarblesController`: cria o controlador uma vez, assina as
 * mudanças e informa a ele o estado da câmera.
 */
export function useMarblesGame(options: UseMarblesGameOptions): MarblesGameView {
    const { cameraActive, cameraFailed, videoRef, overlayRef, deps } = options
    const [controller] = useState(
        () => new MarblesController(resolveEnv(deps), shotControlFromSearch(window.location.search)),
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
        setMode: controller.setMode,
        setOpponent: controller.setOpponent,
        setBotLevel: controller.setBotLevel,
        setShotControl: controller.setShotControl,
        startMatch: controller.startMatch,
        playAgain: controller.playAgain,
        changeMode: controller.changeMode,
    }
}
