import type { SwingRoomState, Vec3 } from '@guess-my-move/swing'
import type { SwingCity } from './city-catalog.js'

/** Bounded deterministic selection, independent of room membership and clocks. */
export function createCooperativeObjectives(
    city: SwingCity,
    origin: Readonly<Vec3>,
): SwingRoomState['objectives'] {
    const candidates: Array<{ x: number; y: number; z: number }> = []
    const bounds = city.index.playBounds
    const queue = [{ x: origin.x, z: origin.z }]
    const visited = new Set(['0:0'])
    const stride = 4
    // Ground-connected free space also remains accessible without mastering flight.
    // The bounded search runs once per round; city collision indexes are cached.
    for (let cursor = 0; cursor < queue.length && cursor < 12_000; cursor++) {
        const node = queue[cursor]
        if (
            Math.hypot(node.x - origin.x, node.z - origin.z) >= 22 &&
            city.index.clearance(node.x, node.z, 8) >= 8 &&
            candidates.every(
                (previous) =>
                    Math.hypot(previous.x - node.x, previous.z - node.z) >= 20,
            )
        ) {
            candidates.push({
                x: node.x,
                y: city.config.eyeHeight + 2,
                z: node.z,
            })
            if (candidates.length === 5) break
        }
        for (const [dx, dz] of [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
        ]) {
            const x = node.x + dx * stride,
                z = node.z + dz * stride
            const key = `${Math.round((x - origin.x) / stride)}:${Math.round((z - origin.z) / stride)}`
            if (
                visited.has(key) ||
                Math.abs(x - origin.x) > 175 ||
                Math.abs(z - origin.z) > 175 ||
                x <= bounds.minX + 5 ||
                x >= bounds.maxX - 5 ||
                z <= bounds.minZ + 5 ||
                z >= bounds.maxZ - 5
            )
                continue
            visited.add(key)
            if (
                city.index.clearance(x, z, 3.2) < 3.2 ||
                city.index.clearance((x + node.x) / 2, (z + node.z) / 2, 2) < 2
            )
                continue
            queue.push({ x, z })
        }
    }
    if (candidates.length < 3)
        throw new Error('Cidade sem área livre suficiente para os objetivos.')
    return candidates.map((position, i) => ({
        id: `objective-${i + 1}`,
        position,
        collectedBy: null,
    }))
}
