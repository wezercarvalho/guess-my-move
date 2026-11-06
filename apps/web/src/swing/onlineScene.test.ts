import { createSwingState, type SwingRoomState } from '@guess-my-move/swing'
import { Mesh, Scene, Sprite } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOnlineScene } from './onlineScene.js'
const state = createSwingState({ x: 0, y: 90, z: 0 })
const room: SwingRoomState = { roomCode: 'ABC123', cityId: 'aurora', cityVersion: 1, round: 1, tick: 1, status: 'playing', players: [{ id: 'one', nickname: 'Ana', connected: true, ready: true, rematchReady: false, state }, { id: 'two', nickname: 'Bia', connected: true, ready: true, rematchReady: false, state: { ...state, position: { x: 10, y: 90, z: 0 } } }], objectives: [{ id: 'signal', position: { x: 0, y: 100, z: 0 }, collectedBy: null }] }
afterEach(() => vi.restoreAllMocks())
describe('Persistent cooperative renderer overlay', () => {
    it('interpolates peer and reuses geometry and label texture for repeated snapshots', () => {
        const fillText = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), fillText } as unknown as CanvasRenderingContext2D)
        const scene = new Scene(), online = createOnlineScene(scene)
        online.update(room, 'one', 0.016)
        const [peer, label, objective] = scene.children as [Mesh, Sprite, Mesh]
        const geometry = peer.geometry, texture = label.material.map
        expect(peer.position.x).toBe(10); expect(peer.visible).toBe(true)
        expect(fillText).toHaveBeenCalledWith('Bia', 256, 80, 490)
        const moved = { ...room, players: [room.players[0], { ...room.players[1], state: { ...state, position: { x: 30, y: 90, z: 0 } } }] }
        online.update(moved, 'one', 0.016)
        expect(peer.position.x).toBeGreaterThan(10); expect(peer.position.x).toBeLessThan(30)
        expect(peer.geometry).toBe(geometry); expect(label.material.map).toBe(texture); expect(fillText).toHaveBeenCalledTimes(1)
        online.update({ ...moved, objectives: [{ ...room.objectives[0], collectedBy: 'two' }] }, 'one', 0.016)
        expect(objective.visible).toBe(false)
        if (!texture) throw new Error('Textura do apelido não criada')
        const disposeGeometry = vi.spyOn(geometry, 'dispose'), disposeTexture = vi.spyOn(texture, 'dispose')
        online.dispose()
        expect(scene.children).toHaveLength(0); expect(disposeGeometry).toHaveBeenCalledOnce(); expect(disposeTexture).toHaveBeenCalledOnce()
    })
    it('hides peers and removes objectives when the room is cleared', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        const scene = new Scene(), online = createOnlineScene(scene)
        online.update(room, 'one', 0.016); expect(scene.children).toHaveLength(3)
        online.update(null, null, 0.016)
        expect(scene.children).toHaveLength(2); expect(scene.children.every((child) => !child.visible)).toBe(true)
        online.dispose()
    })
})
