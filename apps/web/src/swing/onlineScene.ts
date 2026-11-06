import { type SwingRoomState } from '@guess-my-move/swing'
import { CanvasTexture, Mesh, MeshBasicMaterial, Scene, SphereGeometry, Sprite, SpriteMaterial, TorusGeometry, Vector3 } from 'three'

/** Owns only the two-player overlay; reusable geometry is independent from city rendering. */
export function createOnlineScene(scene: Scene) {
    const resources: { dispose(): void }[] = []
    const track = <T extends { dispose(): void }>(item: T): T => { resources.push(item); return item }
    // Persistent geometry and materials: snapshots only update visibility and transforms.
    const peerGeometry = track(new SphereGeometry(1.1, 10, 8))
    const peerMaterial = track(new MeshBasicMaterial({ color: '#ffb84d' }))
    const peer = new Mesh(peerGeometry, peerMaterial)
    peer.visible = false
    scene.add(peer)
    const labelMaterial = track(new SpriteMaterial({ depthTest: false }))
    const label = new Sprite(labelMaterial)
    label.scale.set(12, 3, 1)
    label.visible = false
    scene.add(label)
    let peerName = ''
    let labelTexture: CanvasTexture | null = null
    let peerId: string | null = null
    const peerTarget = new Vector3()
    const objectiveGeometry = track(new TorusGeometry(2, 0.35, 6, 14))
    const objectiveMaterial = track(new MeshBasicMaterial({ color: '#7eff8c' }))
    const objectives = new Map<string, Mesh>()

    return {
        update(room: SwingRoomState | null, playerId: string | null, dt: number) {
            const other = room?.players.find((player) => player.id !== playerId)
            peer.visible = !!other
            label.visible = !!other
            if (other) {
                peerMaterial.color.set(room?.players[0]?.id === other.id ? '#00d5ff' : '#ffb84d')
                const position = other.state.position
                if (peerId !== other.id) peer.position.set(position.x, position.y, position.z)
                else peer.position.lerp(peerTarget.set(position.x, position.y, position.z), 1 - Math.exp(-Math.max(0, dt) * 15))
                peerId = other.id
                label.position.copy(peer.position)
                label.position.y += 3
                if (peerName !== other.nickname) {
                    const nameCanvas = document.createElement('canvas')
                    nameCanvas.width = 512
                    nameCanvas.height = 128
                    const context = nameCanvas.getContext('2d')
                    if (context) {
                        context.fillStyle = '#10202ee6'
                        context.fillRect(0, 0, 512, 128)
                        context.fillStyle = '#ffffff'
                        context.font = 'bold 40px sans-serif'
                        context.textAlign = 'center'
                        context.fillText(other.nickname, 256, 80, 490)
                        labelTexture?.dispose()
                        labelTexture = new CanvasTexture(nameCanvas)
                        labelMaterial.map = labelTexture
                        labelMaterial.needsUpdate = true
                    }
                    peerName = other.nickname
                }
            }
            const active = new Set<string>()
            for (const objective of room?.objectives ?? []) {
                active.add(objective.id)
                let mesh = objectives.get(objective.id)
                if (!mesh) {
                    mesh = new Mesh(objectiveGeometry, objectiveMaterial)
                    objectives.set(objective.id, mesh)
                    scene.add(mesh)
                }
                mesh.visible = objective.collectedBy === null
                mesh.position.set(objective.position.x, objective.position.y, objective.position.z)
            }
            for (const [id, mesh] of objectives) if (!active.has(id)) { scene.remove(mesh); objectives.delete(id) }
        },
        dispose() {
            labelTexture?.dispose()
            scene.remove(peer, label, ...objectives.values())
            objectives.clear()
            for (const resource of resources) resource.dispose()
        },
    }
}
