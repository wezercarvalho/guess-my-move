import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type CityCatalog } from './cityCatalog.js'
import { SwingApp } from './SwingApp.js'

const catalog: CityCatalog = {
    version: 1,
    maps: [
        {
            id: 'midtown',
            name: 'Midtown Manhattan',
            region: 'Nova York, Estados Unidos',
            description: 'Torres altas e avenidas largas.',
            file: 'swing/midtown.json',
            spawnHeight: 90,
            attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
            recommended: true,
        },
        {
            id: 'paulista',
            name: 'Avenida Paulista',
            region: 'São Paulo, Brasil',
            description: 'Torres modernas numa avenida densa.',
            file: 'swing/paulista.json',
            spawnHeight: 55,
            attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
        },
    ],
}

const city = (name: string) => ({
    version: 1 as const,
    name,
    attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
    bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    buildings: [{ height: 300, ring: [-10, -50, 10, -50, 10, -40, -10, -40] }],
    roads: [],
})

function deps() {
    const loadCity = vi.fn((map: { name: string }) => Promise.resolve(city(map.name)))
    const dispose = vi.fn()
    return {
        loadCity,
        dispose,
        value: {
            createTracker: () => Promise.reject(new Error('não usado')),
            createFaceTracker: () => Promise.reject(new Error('não usado')),
            loadCity,
            createRenderer: () => ({ resize: vi.fn(), render: vi.fn(), project: vi.fn(), dispose }),
            requestFrame: () => 1,
            cancelFrame: () => undefined,
            now: () => 1000,
            keys: new EventTarget(),
        },
    }
}

afterEach(() => {
    window.history.replaceState(null, '', '/swing.html')
    vi.restoreAllMocks()
})

describe('SwingApp: seleção antes do jogo', () => {
    it('mostra os mapas antes de montar a partida', async () => {
        const game = deps()
        render(<SwingApp loadCatalog={() => Promise.resolve(catalog)} deps={game.value} />)
        expect(await screen.findByRole('heading', { name: /escolha o mapa/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Midtown Manhattan' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Avenida Paulista' })).toBeInTheDocument()
        expect(game.loadCity).not.toHaveBeenCalled()
    })

    it('escolhe a Paulista, monta a partida com seu arquivo e permite trocar', async () => {
        const game = deps()
        render(<SwingApp loadCatalog={() => Promise.resolve(catalog)} deps={game.value} />)
        fireEvent.click(await screen.findByRole('button', { name: /viajar pela avenida paulista/i }))
        await waitFor(() => expect(game.loadCity).toHaveBeenCalledWith(catalog.maps[1]))
        expect(screen.getByRole('heading', { level: 1, name: 'Arranha-Teia' })).toBeInTheDocument()
        expect(screen.getByText(/Avenida Paulista · São Paulo, Brasil/)).toBeInTheDocument()
        expect(new URL(window.location.href).searchParams.get('city')).toBe('paulista')

        fireEvent.click(screen.getByRole('button', { name: /trocar mapa/i }))
        expect(await screen.findByRole('heading', { name: /escolha o mapa/i })).toBeInTheDocument()
        expect(game.dispose).toHaveBeenCalled()
        expect(new URL(window.location.href).searchParams.get('city')).toBeNull()
    })

    it('abre diretamente um id válido da URL', async () => {
        window.history.replaceState(null, '', '/swing.html?city=midtown')
        const game = deps()
        render(<SwingApp loadCatalog={() => Promise.resolve(catalog)} deps={game.value} />)
        await waitFor(() => expect(game.loadCity).toHaveBeenCalledWith(catalog.maps[0]))
        expect(screen.queryByRole('heading', { name: /escolha o mapa/i })).not.toBeInTheDocument()
    })

    it('id desconhecido na URL volta à seleção sem derivar um caminho', async () => {
        window.history.replaceState(null, '', '/swing.html?city=../../secret')
        const game = deps()
        render(<SwingApp loadCatalog={() => Promise.resolve(catalog)} deps={game.value} />)
        expect(await screen.findByRole('heading', { name: /escolha o mapa/i })).toBeInTheDocument()
        expect(game.loadCity).not.toHaveBeenCalled()
    })

    it('mostra falha curta quando o catálogo não carrega e permite tentar novamente', async () => {
        let calls = 0
        const loadCatalog = vi.fn(() => {
            calls++
            return calls === 1 ? Promise.reject(new Error('HTTP 500')) : Promise.resolve(catalog)
        })
        render(<SwingApp loadCatalog={loadCatalog} deps={deps().value} />)
        expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar os mapas/i)
        fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
        expect(await screen.findByRole('heading', { name: /escolha o mapa/i })).toBeInTheDocument()
    })
})
