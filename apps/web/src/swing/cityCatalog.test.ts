import { describe, expect, it, vi } from 'vitest'

import { fetchCityCatalog, parseCityCatalog, resolveCityMap } from './cityCatalog.js'

const valid = {
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
        {
            id: 'santa-maria',
            name: 'Santa Maria',
            region: 'Rio Grande do Sul, Brasil',
            description: 'Centro urbano no coração do Rio Grande do Sul.',
            file: 'swing/santa-maria.json',
            spawnHeight: 20,
            attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
        },
    ],
}

const response = (body: unknown, ok = true, status = 200) =>
    vi.fn(() => Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response))

describe('parseCityCatalog', () => {
    it('aceita catálogo v1 com mapas locais e preserva os campos', () => {
        const catalog = parseCityCatalog(valid)
        expect(catalog.maps.map((map) => map.id)).toEqual(['midtown', 'paulista', 'santa-maria'])
        expect(catalog.maps[0]?.recommended).toBe(true)
    })

    it.each([
        ['https://tiles.example/city.json'],
        ['//tiles.example/city.json'],
        ['/swing/city.json'],
        ['swing/../secret.json'],
        ['city.json'],
    ])('rejeita caminho que não é um JSON local dentro de swing/: %s', (file) => {
        expect(() => parseCityCatalog({ ...valid, maps: [{ ...valid.maps[0], file }] })).toThrow(/caminho/i)
    })

    it('rejeita versão, id inseguro, id duplicado e campos vazios', () => {
        expect(() => parseCityCatalog({ ...valid, version: 2 })).toThrow(/versão/i)
        expect(() => parseCityCatalog({ ...valid, maps: [{ ...valid.maps[0], id: '../rio' }] })).toThrow(/id/i)
        expect(() => parseCityCatalog({ ...valid, maps: [valid.maps[0], valid.maps[0]] })).toThrow(/duplicado/i)
        expect(() => parseCityCatalog({ ...valid, maps: [{ ...valid.maps[0], name: '' }] })).toThrow(/nome/i)
        expect(() => parseCityCatalog({ ...valid, maps: [{ ...valid.maps[0], spawnHeight: 0 }] })).toThrow(/altura inicial/i)
    })
})

describe('resolveCityMap', () => {
    const catalog = parseCityCatalog(valid)

    it('resolve somente ids presentes no catálogo', () => {
        expect(resolveCityMap(catalog, 'paulista')?.name).toBe('Avenida Paulista')
        expect(resolveCityMap(catalog, 'rio')).toBeNull()
        expect(resolveCityMap(catalog, null)).toBeNull()
    })
})

describe('fetchCityCatalog', () => {
    it('busca da própria origem e valida o corpo', async () => {
        const fetchImpl = response(valid)
        const catalog = await fetchCityCatalog('/swing/cities.json', fetchImpl)
        expect(fetchImpl).toHaveBeenCalledWith('/swing/cities.json')
        expect(catalog.maps).toHaveLength(3)
    })

    it('inclui o status HTTP no erro', async () => {
        await expect(fetchCityCatalog('/swing/cities.json', response({}, false, 404))).rejects.toThrow(/HTTP 404/)
    })
})
