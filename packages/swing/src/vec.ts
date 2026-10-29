/** Vetor 3D em metros: Y para cima, para a frente é -Z. */
export interface Vec3 {
    x: number
    y: number
    z: number
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)

/** Vetor unitário; o vetor nulo volta como está. */
export function normalize(a: Vec3): Vec3 {
    const size = length(a)
    return size === 0 ? a : scale(a, 1 / size)
}

/**
 * Direção para onde a câmera olha. Guinada 0 olha para -Z e a positiva vira para +X
 * (direita); inclinação positiva olha para cima.
 */
export function forwardFromAngles(yaw: number, pitch: number): Vec3 {
    const flat = Math.cos(pitch)
    return { x: Math.sin(yaw) * flat, y: Math.sin(pitch), z: -Math.cos(yaw) * flat }
}
