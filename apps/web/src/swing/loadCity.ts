import { type City } from '@guess-my-move/swing'

type FetchLike = (url: string) => Promise<Response>

/** Lê e confere o arquivo da cidade, que sai do próprio app (nunca de terceiros). */
export async function fetchCity(
    url: string,
    fetchImpl: FetchLike = (input) => fetch(input),
): Promise<City> {
    const response = await fetchImpl(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as Partial<City> | null
    if (data?.version !== 1) throw new Error('versão do arquivo da cidade não suportada')
    if (!Array.isArray(data.buildings) || !Array.isArray(data.roads) || !data.bounds) {
        throw new Error('formato do arquivo da cidade inválido')
    }
    return data as City
}
