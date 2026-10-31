export interface RoadPaintLayer {
    role: 'sidewalk' | 'asphalt' | 'center-line'
    /** Largura em metros. */
    width: number
    color: string
    /** Traço em metros; ausente para linha contínua. */
    dashes?: readonly [number, number]
}

export const CITY_ATMOSPHERE = {
    fogNear: 140,
    fogFar: 1150,
} as const

/** Camadas procedurais da via. Ruas estreitas não ganham faixa central falsa. */
export function roadPaintLayers(width: number): readonly RoadPaintLayer[] {
    const base: RoadPaintLayer[] = [
        { role: 'sidewalk', width: width + 5, color: '#747067' },
        { role: 'asphalt', width, color: '#24262b' },
    ]
    if (width >= 12) {
        base.push({ role: 'center-line', width: 0.32, color: '#d7c98c', dashes: [10, 8] })
    }
    return base
}
