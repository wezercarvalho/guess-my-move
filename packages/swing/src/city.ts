/**
 * Formato da cidade (versão 1): coordenadas em metros num plano local, já
 * rotacionadas para que as avenidas corram ao longo do eixo Z (para a frente é -Z).
 * Os anéis e as linhas são listas planas `[x0, z0, x1, z1, ...]`; o anel de um
 * prédio não repete o primeiro ponto no fim.
 */
export interface CityBuilding {
    /** Altura do prédio, em metros, do chão ao telhado. */
    readonly height: number
    /** Pegada do prédio, em pares `x, z`. */
    readonly ring: readonly number[]
}

export interface CityRoad {
    /** Largura da pista, em metros. */
    readonly width: number
    /** Eixo da rua, em pares `x, z`. */
    readonly line: readonly number[]
}

export interface CityBounds {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
}

export interface City {
    readonly version: 1
    readonly name: string
    /** Crédito dos dados, exibido na tela do jogo. */
    readonly attribution: string
    readonly bounds: CityBounds
    readonly buildings: readonly CityBuilding[]
    readonly roads: readonly CityRoad[]
}
