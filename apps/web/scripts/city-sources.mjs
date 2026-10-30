export const CITY_SOURCES = [
    {
        id: 'midtown',
        name: 'Midtown Manhattan',
        output: 'midtown.json',
        bbox: { minLat: 40.754, maxLat: 40.762, minLon: -73.99, maxLon: -73.9805 },
        rotationDeg: 29,
    },
    {
        id: 'paulista',
        name: 'Avenida Paulista',
        output: 'paulista.json',
        // Trecho central: Consolação até Brigadeiro, com quarteirões dos dois lados.
        bbox: { minLat: -23.5645, maxLat: -23.5595, minLon: -46.658, maxLon: -46.6505 },
        // Eixo da avenida (NO–SE) alinhado ao eixo Z do jogo.
        rotationDeg: -46,
    },
]

export function citySource(id) {
    const source = CITY_SOURCES.find((candidate) => candidate.id === id)
    if (!source) throw new Error(`cidade desconhecida: ${id}`)
    return source
}
