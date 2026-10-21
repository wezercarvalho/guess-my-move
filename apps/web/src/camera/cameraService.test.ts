import { describe, expect, it, vi } from 'vitest'

import {
    classifyCameraError,
    DEFAULT_CAMERA_CONSTRAINTS,
    resolveGetUserMedia,
    stopStream,
} from './cameraService.js'
import { createFakeStream, namedError } from '../test-utils/fakeMedia.js'

describe('cameraService', () => {
    describe('classifyCameraError', () => {
        it('classifica permissão negada como denied', () => {
            for (const name of [
                'NotAllowedError',
                'PermissionDeniedError',
                'SecurityError',
            ]) {
                expect(classifyCameraError(namedError(name)).status).toBe(
                    'denied',
                )
            }
        })

        it('classifica ausência de câmera como unavailable', () => {
            for (const name of ['NotFoundError', 'OverconstrainedError']) {
                expect(classifyCameraError(namedError(name)).status).toBe(
                    'unavailable',
                )
            }
        })

        it('classifica o restante como error genérico', () => {
            expect(classifyCameraError(namedError('AbortError')).status).toBe(
                'error',
            )
            expect(classifyCameraError('qualquer coisa').status).toBe('error')
            expect(classifyCameraError(null).status).toBe('error')
        })

        it('fornece mensagem legível em português para cada caso', () => {
            expect(classifyCameraError(namedError('NotAllowedError')).message)
                .toMatch(/negada/i)
            expect(classifyCameraError(namedError('NotFoundError')).message)
                .toMatch(/câmera/i)
        })
    })

    describe('resolveGetUserMedia', () => {
        it('retorna null quando mediaDevices não existe', () => {
            expect(resolveGetUserMedia({} as Navigator)).toBeNull()
            expect(
                resolveGetUserMedia({
                    mediaDevices: {},
                } as unknown as Navigator),
            ).toBeNull()
        })

        it('retorna uma função ligada a mediaDevices quando existe', async () => {
            const { stream } = createFakeStream()
            const getUserMedia = vi.fn().mockResolvedValue(stream)
            const nav = {
                mediaDevices: { getUserMedia },
            } as unknown as Navigator

            const resolved = resolveGetUserMedia(nav)
            expect(resolved).not.toBeNull()
            await resolved?.(DEFAULT_CAMERA_CONSTRAINTS)
            expect(getUserMedia).toHaveBeenCalledWith(
                DEFAULT_CAMERA_CONSTRAINTS,
            )
        })
    })

    describe('stopStream', () => {
        it('encerra todas as tracks', () => {
            const { stream, tracks } = createFakeStream(3)
            stopStream(stream)
            expect(tracks.every((t) => t.stopped)).toBe(true)
        })

        it('é tolerante a null/undefined', () => {
            expect(() => stopStream(null)).not.toThrow()
            expect(() => stopStream(undefined)).not.toThrow()
        })
    })

    it('usa restrições só de vídeo por padrão', () => {
        expect(DEFAULT_CAMERA_CONSTRAINTS).toEqual({ video: true, audio: false })
    })
})
