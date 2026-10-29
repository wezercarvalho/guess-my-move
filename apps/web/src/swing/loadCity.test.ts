import { describe, expect, it, vi } from 'vitest'

import { fetchCity } from './loadCity.js'

const valid = {
    version: 1,
    name: 'teste',
    attribution: 'crédito',
    bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
    buildings: [{ height: 10, ring: [0, 0, 1, 0, 1, 1] }],
    roads: [],
}

const respond = (body: unknown, ok = true, status = 200) =>
    vi.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response))

describe('fetchCity', () => {
    it('devolve a cidade quando o arquivo é válido', async () => {
        const fetchImpl = respond(valid)
        const city = await fetchCity('/swing/midtown.json', fetchImpl)
        expect(city.buildings).toHaveLength(1)
        expect(fetchImpl).toHaveBeenCalledWith('/swing/midtown.json')
    })

    it('falha com o status HTTP quando o servidor responde erro', async () => {
        await expect(fetchCity('/x', respond({}, false, 404))).rejects.toThrow(/HTTP 404/)
    })

    it('rejeita versão desconhecida', async () => {
        await expect(fetchCity('/x', respond({ ...valid, version: 2 }))).rejects.toThrow(/versão/)
    })

    it('rejeita arquivo sem prédios ou sem limites', async () => {
        await expect(fetchCity('/x', respond({ ...valid, buildings: 'x' }))).rejects.toThrow(/formato/)
        await expect(fetchCity('/x', respond({ ...valid, bounds: null }))).rejects.toThrow(/formato/)
    })
})
