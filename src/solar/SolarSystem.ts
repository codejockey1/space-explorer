import * as THREE from 'three'
import { SOLAR_CATALOG, type BodyDef } from './catalog'
import { createBodyMesh, type BodyMesh } from './createBodyMesh'
import { keplerPositionKm, rotationAngleRad } from './kepler'
import { createOrbitLines } from './orbitLines'
import {
  bodyRadiusScene,
  compressOrbitRadiusKm,
  type ScaleMode,
} from './units'
import { createDeathStar } from '../bodies/deathStar'

export type SolarTarget = {
  id: string
  name: string
  kind: BodyDef['kind']
  object: THREE.Object3D
}

export type SolarSystem = {
  root: THREE.Group
  scaleMode: ScaleMode
  setScaleMode: (mode: ScaleMode) => void
  update: (day: number) => void
  /** Swap mesh ↔ impostor based on screen size. */
  updateLod: (camera: THREE.Camera) => void
  getTargets: () => SolarTarget[]
  getBodyRadius: (id: string) => number
  getObstacles: () => { name: string; object: THREE.Object3D; radius: number }[]
  toggleOrbits: () => boolean
  orbitsVisible: () => boolean
  toggleEcliptic: () => boolean
  eclipticVisible: () => boolean
  /** Scene position of a body after last update. */
  getBodyPosition: (id: string, out?: THREE.Vector3) => THREE.Vector3 | null
}

type RuntimeBody = BodyMesh & {
  worldKm: THREE.Vector3
}

const scratch = new THREE.Vector3()
const parentScratch = new THREE.Vector3()

export async function createSolarSystem(
  loader: THREE.TextureLoader,
  renderer: THREE.WebGLRenderer,
): Promise<SolarSystem> {
  const root = new THREE.Group()
  root.name = 'SolarSystem'

  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy())
  const bodies = new Map<string, RuntimeBody>()
  let scaleMode: ScaleMode = 'playable'

  for (const def of SOLAR_CATALOG) {
    if (def.id === 'deathstar') continue // loaded as GLB below
    const mesh = createBodyMesh(def, loader, anisotropy)
    bodies.set(def.id, { ...mesh, worldKm: new THREE.Vector3() })
    root.add(mesh.root)
  }

  // Death Star GLB, parented under a pivot that follows Earth
  const deathPivot = new THREE.Group()
  deathPivot.name = 'deathstar'
  root.add(deathPivot)
  const death = await createDeathStar(loader, renderer)
  deathPivot.add(death.group)
  bodies.set('deathstar', {
    root: deathPivot,
    spin: death.group,
    def: SOLAR_CATALOG.find((b) => b.id === 'deathstar')!,
    worldKm: new THREE.Vector3(),
  })

  const sunLight = new THREE.PointLight(0xfff2dd, 2.8, 0, 0)
  sunLight.name = 'SunPointLight'
  bodies.get('sun')?.root.add(sunLight)

  const orbits = createOrbitLines()
  root.add(orbits.root)

  const ecliptic = new THREE.GridHelper(4000, 80, 0x3a5080, 0x1a2838)
  ecliptic.name = 'Ecliptic'
  ecliptic.visible = false
  ecliptic.material.transparent = true
  if (Array.isArray(ecliptic.material)) {
    for (const m of ecliptic.material) {
      m.transparent = true
      m.opacity = 0.35
    }
  } else {
    const mat = ecliptic.material as THREE.Material & { opacity?: number }
    mat.transparent = true
    mat.opacity = 0.35
  }
  root.add(ecliptic)

  const lodCam = new THREE.Vector3()
  const lodBody = new THREE.Vector3()

  function craftRadiusFloor(): number {
    // Unit craft models (~radius 1) need a solid floor or approaches leave them tiny
    return scaleMode === 'true' ? 0.22 : 0.26
  }

  function applyScaleToBody(body: RuntimeBody) {
    const r = bodyRadiusScene(body.def.radiusKm, scaleMode)
    // Crafts need extra exaggeration or they vanish
    let scale = body.def.craft ? Math.max(r, craftRadiusFloor()) : r
    // Death Star is ~80 km; keep a mild cinematic floor so it reads near Earth
    if (body.def.id === 'deathstar') {
      scale = Math.max(scale, scaleMode === 'true' ? 0.45 : 0.12)
    }
    body.spin.scale.setScalar(scale)
  }

  function placeBody(body: RuntimeBody, day: number) {
    const def = body.def

    if (def.id === 'sun') {
      body.worldKm.set(0, 0, 0)
      body.root.position.set(0, 0, 0)
      applyScaleToBody(body)
      body.spin.rotation.y = rotationAngleRad(def.dayHours, day)
      return
    }

    if (def.id === 'deathstar') {
      const earth = bodies.get('earth')
      if (!earth) return
      // Park ~2.5 Earth radii from Earth center on the near side
      scratch.set(earth.def.radiusKm * 2.6, earth.def.radiusKm * 0.4, earth.def.radiusKm * 0.2)
      body.worldKm.copy(earth.worldKm).add(scratch)
      applyScaleToBody(body)
      body.spin.rotation.y = rotationAngleRad(def.dayHours, day)
      return
    }

    if (!def.orbit) {
      body.worldKm.set(0, 0, 0)
      return
    }

    keplerPositionKm(def.orbit, day, scratch)
    const parentId = def.parent ?? 'sun'
    if (parentId !== 'sun') {
      const parent = bodies.get(parentId)
      if (parent) {
        parentScratch.copy(parent.worldKm)
        scratch.add(parentScratch)
      }
    }
    body.worldKm.copy(scratch)
    applyScaleToBody(body)
    body.spin.rotation.y = rotationAngleRad(def.dayHours, day)
  }

  function worldKmToScene(worldKm: THREE.Vector3, out: THREE.Vector3) {
    if (scaleMode === 'true') {
      return out.copy(worldKm).multiplyScalar(1 / 1000) // TRUE_KM_PER_UNIT
    }
    const r = worldKm.length()
    if (r < 1e-6) return out.set(0, 0, 0)
    const compressed = compressOrbitRadiusKm(r)
    return out.copy(worldKm).multiplyScalar(compressed / r)
  }

  function refreshScenePositions() {
    for (const body of bodies.values()) {
      worldKmToScene(body.worldKm, scratch)
      body.root.position.copy(scratch)
    }
  }

  // Initial layout
  for (const body of bodies.values()) applyScaleToBody(body)

  const api: SolarSystem = {
    root,
    get scaleMode() {
      return scaleMode
    },
    setScaleMode(mode: ScaleMode) {
      scaleMode = mode
      for (const body of bodies.values()) applyScaleToBody(body)
      refreshScenePositions()
      orbits.rebuild(bodies, scaleMode)
    },
    update(day: number) {
      // Parents before children: catalog order is mostly fine; do two passes
      for (const body of bodies.values()) {
        if (!body.def.parent || body.def.parent === 'sun' || body.def.id === 'sun') {
          placeBody(body, day)
        }
      }
      for (const body of bodies.values()) {
        if (body.def.parent && body.def.parent !== 'sun') {
          placeBody(body, day)
        }
      }
      refreshScenePositions()
      orbits.rebuild(bodies, scaleMode)
    },
    toggleOrbits() {
      const on = orbits.toggle()
      if (on) orbits.rebuild(bodies, scaleMode)
      return on
    },
    orbitsVisible() {
      return orbits.visible
    },
    getTargets() {
      return [...bodies.values()].map((b) => ({
        id: b.def.id,
        name: b.def.name,
        kind: b.def.kind,
        object: b.root,
      }))
    },
    getBodyRadius(id: string) {
      const b = bodies.get(id)
      if (!b) return 1
      let r = bodyRadiusScene(b.def.radiusKm, scaleMode) * (b.def.craft ? 2 : 1)
      // Match cinematic mesh floor so approach/collision use the visible size
      if (b.def.craft) r = Math.max(r, craftRadiusFloor())
      if (b.def.id === 'deathstar') {
        r = Math.max(r, scaleMode === 'true' ? 0.45 : 0.12)
      }
      return r
    },
    getObstacles() {
      return [...bodies.values()]
        .filter((b) => b.def.kind !== 'satellite' && b.def.kind !== 'comet')
        .map((b) => ({
          name: b.def.name,
          object: b.root,
          radius: bodyRadiusScene(b.def.radiusKm, scaleMode),
        }))
    },
    toggleEcliptic() {
      ecliptic.visible = !ecliptic.visible
      return ecliptic.visible
    },
    eclipticVisible() {
      return ecliptic.visible
    },
    updateLod(camera: THREE.Camera) {
      camera.getWorldPosition(lodCam)
      for (const body of bodies.values()) {
        if (!body.impostor) continue
        body.root.getWorldPosition(lodBody)
        const dist = lodCam.distanceTo(lodBody)
        const r = bodyRadiusScene(body.def.radiusKm, scaleMode)
        const angular = r / Math.max(dist, 1e-3)
        const far = angular < 0.0022
        body.spin.visible = !far
        body.impostor.visible = far
        if (far) {
          const size = Math.max(dist * 0.0035, r * 2)
          body.impostor.scale.set(size, size, 1)
        }
      }
    },
    getBodyPosition(id: string, out = new THREE.Vector3()) {
      const b = bodies.get(id)
      if (!b) return null
      return b.root.getWorldPosition(out)
    },
  }

  return api
}

export function cameraFarForScale(mode: ScaleMode): number {
  return mode === 'true' ? 5_000_000 : 8_000
}

export function cameraNearForScale(mode: ScaleMode): number {
  return mode === 'true' ? 0.01 : 0.01
}

export function startPositionForScale(mode: ScaleMode): THREE.Vector3 {
  // Fallback offset from Earth when a framed opening view isn't available
  if (mode === 'true') {
    return new THREE.Vector3(0, 12, 48)
  }
  return new THREE.Vector3(0, 8, 55)
}

const _earth = new THREE.Vector3()
const _moon = new THREE.Vector3()
const _sun = new THREE.Vector3()
const _ds = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _side = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _look = new THREE.Vector3()
const _toSun = new THREE.Vector3()

/**
 * Place the camera so Earth is the focus with the Sun, Moon, and Death Star
 * in the opening frame (works in both scale modes after bodies are updated).
 */
export function frameEarthOpeningView(
  camera: THREE.PerspectiveCamera,
  solar: SolarSystem,
): boolean {
  const targets = solar.getTargets()
  const earth = targets.find((t) => t.id === 'earth')
  const moon = targets.find((t) => t.id === 'moon')
  const sun = targets.find((t) => t.id === 'sun')
  const death = targets.find((t) => t.id === 'deathstar')
  if (!earth || !moon || !sun || !death) return false

  earth.object.getWorldPosition(_earth)
  moon.object.getWorldPosition(_moon)
  sun.object.getWorldPosition(_sun)
  death.object.getWorldPosition(_ds)

  const earthR = solar.getBodyRadius('earth')
  const moonSep = _earth.distanceTo(_moon)

  // Bias the look-at toward Earth so it reads as the subject, Moon still in frame
  _mid.copy(_earth).lerp(_moon, 0.22)
  // Nudge toward the Death Star so it sits on Earth's limb rather than behind us
  _side.subVectors(_ds, _earth)
  if (_side.lengthSq() > 1e-8) {
    _mid.addScaledVector(_side.normalize(), earthR * 0.9)
  }

  _axis.subVectors(_moon, _earth).normalize()
  _side.crossVectors(_axis, _up)
  if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0)
  _side.normalize()

  // Prefer the side that keeps the Sun in front of the camera
  _toSun.subVectors(_sun, _earth)
  if (_side.dot(_toSun) < 0) _side.negate()

  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
  // Fit Earth–Moon span with margin; clamp so Earth doesn't become a speck
  const fitDist = (moonSep * 0.52) / Math.tan(halfFov)
  const dist = THREE.MathUtils.clamp(fitDist, earthR * 14, moonSep * 1.35)

  camera.position
    .copy(_mid)
    .addScaledVector(_side, dist)
    .addScaledVector(_up, dist * 0.18)

  // If Sun ended up behind the camera, flip to the other side of the Earth–Moon axis
  _look.subVectors(_mid, camera.position)
  _toSun.subVectors(_sun, camera.position)
  if (_look.dot(_toSun) < 0) {
    camera.position
      .copy(_mid)
      .addScaledVector(_side, -dist)
      .addScaledVector(_up, dist * 0.18)
  }

  camera.up.copy(_up)
  camera.lookAt(_mid)
  return true
}
