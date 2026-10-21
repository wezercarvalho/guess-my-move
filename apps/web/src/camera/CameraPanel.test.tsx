import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { CameraPanel } from './CameraPanel.js'
import { useCamera, type UseCameraOptions } from './useCamera.js'
import { createFakeStream, namedError } from '../test-utils/fakeMedia.js'

// jsdom não implementa play()/srcObject; fornecemos stubs para o preview.
beforeAll(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: vi.fn().mockResolvedValue(undefined),
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        configurable: true,
        writable: true,
        value: null,
    })
})

/** Pequeno host que liga o hook real ao painel, para um teste de integração. */
function Host(options: UseCameraOptions) {
    const camera = useCamera(options)
    return <CameraPanel camera={camera} />
}

describe('CameraPanel', () => {
    it('mostra o botão Ativar câmera e esconde o preview em idle', () => {
        render(<Host getUserMedia={vi.fn()} />)
        expect(
            screen.getByRole('button', { name: /ativar câmera/i }),
        ).toBeInTheDocument()
        expect(screen.getByTestId('camera-preview')).toHaveAttribute('hidden')
    })

    it('ativa, mostra preview, indicador e botão Parar câmera', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        render(<Host getUserMedia={getUserMedia} />)

        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /parar câmera/i }),
            ).toBeInTheDocument()
        })
        expect(
            screen.getByTestId('camera-active-indicator'),
        ).toBeInTheDocument()
        expect(screen.getByTestId('camera-preview')).not.toHaveAttribute(
            'hidden',
        )
        expect(screen.getByTestId('camera-status')).toHaveTextContent(
            /câmera ativa/i,
        )
    })

    it('parar encerra as tracks e remove o indicador', async () => {
        const { stream, tracks } = createFakeStream(2)
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        render(<Host getUserMedia={getUserMedia} />)

        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        await waitFor(() =>
            screen.getByRole('button', { name: /parar câmera/i }),
        )
        fireEvent.click(screen.getByRole('button', { name: /parar câmera/i }))

        expect(tracks.every((t) => t.stopped)).toBe(true)
        expect(
            screen.queryByTestId('camera-active-indicator'),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /ativar câmera/i }),
        ).toBeInTheDocument()
    })

    it('permissão negada mostra instruções para reabilitar', async () => {
        const getUserMedia = vi
            .fn()
            .mockRejectedValue(namedError('NotAllowedError'))
        render(<Host getUserMedia={getUserMedia} />)

        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(/negada/i)
        expect(alert).toHaveTextContent(/configurações do navegador/i)
        // Nenhum preview ativo, nenhum indicador.
        expect(
            screen.queryByTestId('camera-active-indicator'),
        ).not.toBeInTheDocument()
        expect(screen.getByTestId('camera-preview')).toHaveAttribute('hidden')
    })
})
