import { type City } from '@guess-my-move/swing'
import {
    CanvasTexture,
    CylinderGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    Shape,
    ShapeGeometry,
    type Scene,
} from 'three'

import { type StreetCorner, type StreetRef, findStreetCorners, plateArrowAngle, rowOrder } from './streetSigns.js'

/** Só as placas até esta distância (horizontal, em metros) são desenhadas. */
const SHOW_DISTANCE = 280
/** Perto demais a placa taparia a visão; some a esta distância (3D, em metros). */
const HIDE_DISTANCE = 22
const POLE_HEIGHT = 20
const PLATE_CENTER = 25
/** A placa é maior que uma de verdade para dar para ler em voo. */
const PLATE_SCALE = 1.5
const PLATE_WIDTH = 18
const ROW_HEIGHT = 2.8
const GAP = 0.5
const PLATE_HEIGHT = 2 * ROW_HEIGHT + 3 * GAP
const ROW_OFFSET = (ROW_HEIGHT + GAP) / 2
const ARROW_X = -PLATE_WIDTH / 2 + 2.3
const TEXT_LEFT = ARROW_X + 2.6
const TEXT_WIDTH = PLATE_WIDTH / 2 - GAP - TEXT_LEFT
const TEXT_X = TEXT_LEFT + TEXT_WIDTH / 2
const TEXT_PIXELS_W = 768
const TEXT_PIXELS_H = Math.round((TEXT_PIXELS_W * ROW_HEIGHT) / TEXT_WIDTH)

export interface StreetSigns {
    /** Atualiza as placas para a posição e a guinada da câmera. */
    update(position: { x: number; y: number; z: number }, yaw: number): void
    dispose(): void
}

interface Row {
    readonly street: StreetRef
    readonly group: Group
    readonly arrow: Mesh
}

interface Sign {
    readonly corner: StreetCorner
    readonly root: Group
    readonly plate: Group
    readonly rows: readonly [Row, Row]
}

/** Texto do nome da rua num fundo transparente, encolhido para caber na largura da placa. */
function nameTexture(name: string): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = TEXT_PIXELS_W
    canvas.height = TEXT_PIXELS_H
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D indisponível neste navegador.')
    const fontSize = Math.round(TEXT_PIXELS_H * 0.62)
    context.font = `700 ${fontSize}px sans-serif`
    context.textBaseline = 'middle'
    context.textAlign = 'left'
    context.fillStyle = '#ffffff'
    const room = TEXT_PIXELS_W - 24
    const measured = context.measureText(name).width
    const shrink = measured > room ? room / measured : 1
    context.save()
    context.translate(12, TEXT_PIXELS_H / 2 + fontSize * 0.04)
    context.scale(shrink, 1)
    context.fillText(name, 0, 0)
    context.restore()
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

/** Seta de duas pontas ao longo de +X, centrada na origem. */
function arrowShape(): Shape {
    const shape = new Shape()
    const points: [number, number][] = [
        [-1.8, 0],
        [-0.75, 0.7],
        [-0.75, 0.26],
        [0.75, 0.26],
        [0.75, 0.7],
        [1.8, 0],
        [0.75, -0.7],
        [0.75, -0.26],
        [-0.75, -0.26],
        [-0.75, -0.7],
    ]
    points.forEach(([x, y], index) => {
        if (index === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
    })
    shape.closePath()
    return shape
}

const NO_SIGNS: StreetSigns = { update() {}, dispose() {} }

/**
 * Placas de rua nas esquinas: um poste e uma placa voltada para a câmera, com o nome das duas
 * ruas e uma seta de duas pontas por rua. A seta gira com a câmera (para cima é a rua que segue
 * para a frente) e a rua mais alinhada com a frente ocupa a linha de cima. Mapas sem nomes de
 * rua não criam nada.
 */
export function createStreetSigns(
    city: City,
    scene: Scene,
    isClear: (x: number, z: number) => boolean,
): StreetSigns {
    const corners = findStreetCorners(city, isClear)
    if (corners.length === 0) return NO_SIGNS

    const disposables: { dispose(): void }[] = []
    const track = <T extends { dispose(): void }>(item: T): T => {
        disposables.push(item)
        return item
    }

    const poleGeometry = track(new CylinderGeometry(0.25, 0.3, POLE_HEIGHT, 8))
    const poleMaterial = track(new MeshBasicMaterial({ color: 0x8a8f98 }))
    const borderGeometry = track(new PlaneGeometry(PLATE_WIDTH + 0.7, PLATE_HEIGHT + 0.7))
    const borderMaterial = track(new MeshBasicMaterial({ color: 0xf4f4f0, fog: false }))
    const faceGeometry = track(new PlaneGeometry(PLATE_WIDTH, PLATE_HEIGHT))
    const faceMaterial = track(new MeshBasicMaterial({ color: 0x0f4a38, fog: false }))
    const textGeometry = track(new PlaneGeometry(TEXT_WIDTH, ROW_HEIGHT))
    const arrowGeometry = track(new ShapeGeometry(arrowShape()))
    const arrowMaterial = track(
        new MeshBasicMaterial({ color: 0xffd54a, side: DoubleSide, fog: false }),
    )
    const textMaterials = new Map<string, MeshBasicMaterial>()
    const materialFor = (name: string): MeshBasicMaterial => {
        const known = textMaterials.get(name)
        if (known) return known
        const texture = track(nameTexture(name))
        const material = track(
            new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }),
        )
        textMaterials.set(name, material)
        return material
    }

    const makeRow = (street: StreetRef): Row => {
        const group = new Group()
        const text = new Mesh(textGeometry, materialFor(street.name))
        text.position.set(TEXT_X, 0, 0.12)
        text.renderOrder = 2
        const arrow = new Mesh(arrowGeometry, arrowMaterial)
        arrow.position.set(ARROW_X, 0, 0.12)
        group.add(text, arrow)
        return { street, group, arrow }
    }

    const signs: Sign[] = corners.map((corner) => {
        const root = new Group()
        root.position.set(corner.post.x, 0, corner.post.z)
        const pole = new Mesh(poleGeometry, poleMaterial)
        pole.position.y = POLE_HEIGHT / 2
        const plate = new Group()
        plate.position.y = PLATE_CENTER
        plate.scale.setScalar(PLATE_SCALE)
        const border = new Mesh(borderGeometry, borderMaterial)
        border.position.z = -0.02
        const face = new Mesh(faceGeometry, faceMaterial)
        face.position.z = 0.04
        const rows: [Row, Row] = [makeRow(corner.streets[0]), makeRow(corner.streets[1])]
        plate.add(border, face, rows[0].group, rows[1].group)
        root.add(pole, plate)
        root.visible = false
        scene.add(root)
        return { corner, root, plate, rows }
    })

    return {
        update(position, yaw) {
            for (const sign of signs) {
                const dx = sign.corner.post.x - position.x
                const dz = sign.corner.post.z - position.z
                const near = dx * dx + dz * dz <= SHOW_DISTANCE * SHOW_DISTANCE
                sign.root.visible = near
                if (!near) continue
                const dy = PLATE_CENTER - position.y
                sign.plate.visible = dx * dx + dy * dy + dz * dz > HIDE_DISTANCE * HIDE_DISTANCE
                if (!sign.plate.visible) continue
                // Paralela ao plano da câmera: a direita da placa é a direita da câmera.
                sign.plate.rotation.y = -yaw
                const [top] = rowOrder(sign.corner.streets[0], sign.corner.streets[1], yaw)
                for (const row of sign.rows) {
                    row.group.position.y = row.street === top ? ROW_OFFSET : -ROW_OFFSET
                    row.arrow.rotation.z = plateArrowAngle(row.street.dx, row.street.dz, yaw)
                }
            }
        },

        dispose() {
            for (const sign of signs) scene.remove(sign.root)
            for (const item of disposables) item.dispose()
        },
    }
}
