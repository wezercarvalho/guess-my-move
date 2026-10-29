import {
    type City,
    DEFAULT_SWING,
    type SwingState,
    type Vec3,
    forwardFromAngles,
} from '@guess-my-move/swing'
import {
    BackSide,
    BufferGeometry,
    CanvasTexture,
    Color,
    CylinderGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Fog,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    RepeatWrapping,
    SRGBColorSpace,
    Scene,
    SphereGeometry,
    Uint32BufferAttribute,
    Vector3,
    WebGLRenderer,
} from 'three'

import { type MeshData, buildRoofs, buildWalls } from './cityGeometry.js'
import { type ScreenPoint } from './reticle.js'

/** O que a tela precisa do desenho 3D: tamanho, um quadro por estado e liberação. */
export interface SwingRenderer {
    resize(width: number, height: number): void
    render(state: SwingState): void
    /** Onde um ponto do mundo cai no quadro atual (0 a 1), ou `null` antes do primeiro desenho. */
    project?(point: Vec3): ScreenPoint | null
    dispose(): void
}

export type CreateSwingRenderer = (canvas: HTMLCanvasElement, city: City) => SwingRenderer

const FOV_STILL = 70
const FOV_FAST = 100
const MAX_SPEED = DEFAULT_SWING.maxSpeed
const HORIZON = new Color(0.93, 0.62, 0.4)
const ZENITH = new Color(0.1, 0.15, 0.33)
const MIDDLE = new Color(0.5, 0.46, 0.6)
const GROUND_PAD = 200
const GROUND_PIXELS = 2048

/** Gerador pseudoaleatório fixo: as janelas acesas são sempre as mesmas. */
function lcg(seed: number): () => number {
    let value = seed
    return () => {
        value = (value * 1664525 + 1013904223) % 4294967296
        return value / 4294967296
    }
}

function canvasOf(size: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D indisponível neste navegador.')
    return { canvas, context }
}

/** Fachada: pedra clara com 4 x 8 janelas, algumas acesas. Colorida depois pelo prédio. */
function facadeTexture(): CanvasTexture {
    const { canvas, context } = canvasOf(256)
    const random = lcg(7)
    context.fillStyle = '#d8d2c6'
    context.fillRect(0, 0, 256, 256)
    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 4; column++) {
            const lit = random() < 0.22
            context.fillStyle = lit ? '#ffd18a' : '#2b3550'
            context.fillRect(column * 64 + 10, row * 32 + 7, 44, 18)
        }
    }
    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

/** Chão: calçada escura com as ruas do mapa desenhadas por cima. */
function groundTexture(city: City): { texture: CanvasTexture; size: number; cx: number; cz: number } {
    const { bounds } = city
    const size = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 2 * GROUND_PAD
    const cx = (bounds.minX + bounds.maxX) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2
    const { canvas, context } = canvasOf(GROUND_PIXELS)
    const pixelsPerMeter = GROUND_PIXELS / size
    context.fillStyle = '#34322f'
    context.fillRect(0, 0, GROUND_PIXELS, GROUND_PIXELS)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    const toPixel = (x: number, z: number): [number, number] => [
        (x - (cx - size / 2)) * pixelsPerMeter,
        (z - (cz - size / 2)) * pixelsPerMeter,
    ]
    for (const [extra, color] of [
        [4, '#6a665d'],
        [0, '#1d1d20'],
    ] as const) {
        context.strokeStyle = color
        for (const road of city.roads) {
            context.lineWidth = (road.width + extra) * pixelsPerMeter
            context.beginPath()
            for (let i = 0; i < road.line.length; i += 2) {
                const [px, pz] = toPixel(road.line[i] ?? 0, road.line[i + 1] ?? 0)
                if (i === 0) context.moveTo(px, pz)
                else context.lineTo(px, pz)
            }
            context.stroke()
        }
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return { texture, size, cx, cz }
}

function geometryOf(data: MeshData): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(data.colors, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(data.uvs, 2))
    geometry.setIndex(new Uint32BufferAttribute(data.indices, 1))
    return geometry
}

/** Céu em degradê de fim de tarde: horizonte quente, topo azul-escuro. */
function skyDome(): Mesh {
    const geometry = new SphereGeometry(1500, 24, 16)
    const positions = geometry.getAttribute('position')
    const colors: number[] = []
    const color = new Color()
    for (let i = 0; i < positions.count; i++) {
        const height = Math.max(0, positions.getY(i) / 1500)
        if (height < 0.35) color.copy(HORIZON).lerp(MIDDLE, height / 0.35)
        else color.copy(MIDDLE).lerp(ZENITH, (height - 0.35) / 0.65)
        colors.push(color.r, color.g, color.b)
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    const material = new MeshBasicMaterial({
        vertexColors: true,
        side: BackSide,
        fog: false,
        depthWrite: false,
    })
    return new Mesh(geometry, material)
}

/** Desenho 3D em primeira pessoa da cidade (Three.js), sem luzes: cor por vértice e névoa. */
export const createThreeRenderer: CreateSwingRenderer = (canvas, city) => {
    const renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    const scene = new Scene()
    scene.fog = new Fog(HORIZON.clone(), 120, 1000)
    const camera = new PerspectiveCamera(FOV_STILL, 1, 0.3, 2200)
    camera.rotation.order = 'YXZ'

    const disposables: { dispose(): void }[] = [renderer]
    const track = <T extends { dispose(): void }>(item: T): T => {
        disposables.push(item)
        return item
    }

    const sky = skyDome()
    track(sky.geometry)
    track(sky.material as MeshBasicMaterial)
    scene.add(sky)

    const facade = track(facadeTexture())
    const wallMaterial = track(
        new MeshBasicMaterial({ map: facade, vertexColors: true, side: DoubleSide }),
    )
    const roofMaterial = track(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }))
    const walls = new Mesh(track(geometryOf(buildWalls(city))), wallMaterial)
    const roofs = new Mesh(track(geometryOf(buildRoofs(city))), roofMaterial)
    scene.add(walls, roofs)

    const ground = groundTexture(city)
    track(ground.texture)
    const streets = new Mesh(
        track(new PlaneGeometry(ground.size, ground.size)),
        track(new MeshBasicMaterial({ map: ground.texture })),
    )
    streets.rotation.x = -Math.PI / 2
    streets.position.set(ground.cx, 0, ground.cz)
    const base = new Mesh(
        track(new PlaneGeometry(8000, 8000)),
        track(new MeshBasicMaterial({ color: new Color(0.15, 0.15, 0.17) })),
    )
    base.rotation.x = -Math.PI / 2
    base.position.y = -0.1
    scene.add(base, streets)

    // Uma corda por lado (esquerda, centro, direita), que dividem a geometria e o material.
    const ropeGeometry = track(new CylinderGeometry(0.025, 0.025, 1, 6))
    const ropeMaterial = track(new MeshBasicMaterial({ color: 0xf2f2ff, fog: false }))
    const ropes = [-1, 0, 1].map(() => {
        const rope = new Mesh(ropeGeometry, ropeMaterial)
        rope.visible = false
        scene.add(rope)
        return rope
    })

    const projected = new Vector3()
    const up = new Vector3(0, 1, 0)
    const from = new Vector3()
    const to = new Vector3()
    const direction = new Vector3()
    const orientation = new Quaternion()

    return {
        resize(width, height) {
            renderer.setSize(width, height, false)
            camera.aspect = width / Math.max(1, height)
            camera.updateProjectionMatrix()
        },

        render(state) {
            const { position, velocity, yaw, pitch, webs } = state
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
            const fov = FOV_STILL + (FOV_FAST - FOV_STILL) * Math.min(1, speed / MAX_SPEED)
            if (Math.abs(camera.fov - fov) > 0.05) {
                camera.fov = fov
                camera.updateProjectionMatrix()
            }
            // Inclina o corpo para o lado em que a corda o leva.
            const sideways = velocity.x * Math.cos(yaw) + velocity.z * Math.sin(yaw)
            const roll = webs.length > 0 ? -Math.max(-1, Math.min(1, sideways / MAX_SPEED)) * 0.15 : 0
            camera.position.set(position.x, position.y, position.z)
            camera.rotation.set(pitch, -yaw, roll, 'YXZ')
            sky.position.copy(camera.position)

            const ahead = forwardFromAngles(yaw, pitch)
            ropes.forEach((rope, slot) => {
                const web = webs.find((candidate) => candidate.side === slot - 1)
                if (!web) {
                    rope.visible = false
                    return
                }
                // A corda sai do pulso do lado que lançou (centro: pela direita, como antes).
                const lateral = web.side ? web.side * 0.55 : 0.45
                from.set(
                    position.x + ahead.x * 0.6 + Math.cos(yaw) * lateral,
                    position.y + ahead.y * 0.6 - 0.35,
                    position.z + ahead.z * 0.6 + Math.sin(yaw) * lateral,
                )
                to.set(web.anchor.x, web.anchor.y, web.anchor.z)
                direction.subVectors(to, from)
                const length = direction.length()
                rope.visible = length > 0.01
                rope.position.copy(from).addScaledVector(direction, 0.5)
                rope.scale.set(1, length, 1)
                rope.quaternion.copy(orientation.setFromUnitVectors(up, direction.normalize()))
            })
            renderer.render(scene, camera)
        },

        project(point) {
            camera.updateMatrixWorld()
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
            const inCamera = projected.set(point.x, point.y, point.z).applyMatrix4(camera.matrixWorldInverse)
            const behind = inCamera.z > 0
            const ndc = projected.set(point.x, point.y, point.z).project(camera)
            return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2, behind }
        },

        dispose() {
            for (const item of disposables) item.dispose()
        },
    }
}
