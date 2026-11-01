import * as THREE from 'three'
import type { BodyDef } from './catalog'
import { keplerPositionAtMeanAnomaly } from './kepler'
import { compressOrbitRadiusKm, TRUE_KM_PER_UNIT, type ScaleMode } from './units'

const SEGMENTS = 160
const TWO_PI = Math.PI * 2

const KIND_COLOR: Record<BodyDef['kind'], number> = {
  star: 0xffcc66,
  planet: 0x6ec8ff,
  dwarf: 0xd4a574,
  moon: 0x8aa0c8,
  asteroid: 0xa0a890,
  comet: 0x88ccee,
  satellite: 0x667788,
  fictional: 0xaa88ff,
}

export type OrbitLineSystem = {
  root: THREE.Group
  visible: boolean
  setVisible: (v: boolean) => void
  toggle: () => boolean
  rebuild: (
    bodies: Map<string, { def: BodyDef; worldKm: THREE.Vector3 }>,
    scaleMode: ScaleMode,
  ) => void
  dispose: () => void
}

type LineEntry = {
  def: BodyDef
  line: THREE.Line
  positions: Float32Array
  relKm: THREE.Vector3[]
}

export function createOrbitLines(): OrbitLineSystem {
  const root = new THREE.Group()
  root.name = 'OrbitLines'
  root.visible = false

  const entries: LineEntry[] = []
  const scratch = new THREE.Vector3()
  const world = new THREE.Vector3()

  function worldKmToScene(worldKm: THREE.Vector3, scaleMode: ScaleMode, out: THREE.Vector3) {
    if (scaleMode === 'true') {
      return out.copy(worldKm).multiplyScalar(1 / TRUE_KM_PER_UNIT)
    }
    const r = worldKm.length()
    if (r < 1e-6) return out.set(0, 0, 0)
    const compressed = compressOrbitRadiusKm(r)
    return out.copy(worldKm).multiplyScalar(compressed / r)
  }

  function ensureEntries(bodies: Map<string, { def: BodyDef; worldKm: THREE.Vector3 }>) {
    if (entries.length > 0) return
    for (const { def } of bodies.values()) {
      if (!def.orbit) continue
      const relKm: THREE.Vector3[] = []
      for (let i = 0; i <= SEGMENTS; i++) {
        const M = (i / SEGMENTS) * TWO_PI
        relKm.push(keplerPositionAtMeanAnomaly(def.orbit, M, new THREE.Vector3()))
      }
      const positions = new Float32Array((SEGMENTS + 1) * 3)
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.LineBasicMaterial({
        color: KIND_COLOR[def.kind] ?? 0x88aacc,
        transparent: true,
        opacity: def.kind === 'satellite' ? 0.22 : def.kind === 'moon' ? 0.35 : 0.45,
        depthWrite: false,
      })
      const line = new THREE.Line(geom, mat)
      line.frustumCulled = false
      line.name = `orbit-${def.id}`
      root.add(line)
      entries.push({ def, line, positions, relKm })
    }
  }

  const api: OrbitLineSystem = {
    root,
    get visible() {
      return root.visible
    },
    setVisible(v: boolean) {
      root.visible = v
    },
    toggle() {
      root.visible = !root.visible
      return root.visible
    },
    rebuild(bodies, scaleMode) {
      ensureEntries(bodies)
      if (!root.visible) return
      for (const entry of entries) {
        const parentId = entry.def.parent ?? 'sun'
        const parent = parentId === 'sun' ? null : bodies.get(parentId)
        for (let i = 0; i < entry.relKm.length; i++) {
          if (parent) world.copy(parent.worldKm).add(entry.relKm[i])
          else world.copy(entry.relKm[i])
          worldKmToScene(world, scaleMode, scratch)
          const o = i * 3
          entry.positions[o] = scratch.x
          entry.positions[o + 1] = scratch.y
          entry.positions[o + 2] = scratch.z
        }
        const attr = entry.line.geometry.getAttribute('position') as THREE.BufferAttribute
        attr.needsUpdate = true
        entry.line.geometry.computeBoundingSphere()
      }
    },
    dispose() {
      for (const entry of entries) {
        entry.line.geometry.dispose()
        ;(entry.line.material as THREE.Material).dispose()
      }
      entries.length = 0
      root.clear()
    },
  }

  return api
}
