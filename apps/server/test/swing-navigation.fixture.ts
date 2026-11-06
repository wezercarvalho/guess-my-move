import { type Vec3, type CityIndex } from '@guess-my-move/swing'

/** Test navigator plans through free ground; all movement still goes through server input. */
export function routeTo(index: CityIndex, start: Vec3, goal: Vec3): Vec3[] {
    const stride = 4
    const queue: Array<{ x: number; z: number; previous: number }> = [
        { x: start.x, z: start.z, previous: -1 },
    ]
    const seen = new Set(['0:0'])
    for (let cursor = 0; cursor < queue.length && cursor < 30_000; cursor++) {
        const node = queue[cursor]
        if (Math.hypot(node.x - goal.x, node.z - goal.z) < 4) {
            const result: Vec3[] = []
            let i = cursor
            while (i > 0) {
                const part = queue[i]
                result.push({ x: part.x, y: 1.7, z: part.z })
                i = part.previous
            }
            return result.reverse()
        }
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const x = node.x + dx * stride,
                z = node.z + dz * stride
            const key = `${Math.round((x - start.x) / stride)}:${Math.round((z - start.z) / stride)}`
            if (
                seen.has(key) ||
                Math.abs(x - start.x) > 300 ||
                Math.abs(z - start.z) > 300 ||
                x < index.playBounds.minX + 3 ||
                x > index.playBounds.maxX - 3 ||
                z < index.playBounds.minZ + 3 ||
                z > index.playBounds.maxZ - 3
            )
                continue
            seen.add(key)
            if (
                index.clearance(x, z, 3.2) < 3.2 ||
                index.clearance((x + node.x) / 2, (z + node.z) / 2, 2) < 2
            )
                continue
            queue.push({ x, z, previous: cursor })
        }
    }
    throw new Error(
        `Sem rota: ${JSON.stringify({ start, goal, visited: queue.length })}`,
    )
}
