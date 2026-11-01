import * as THREE from 'three'
import { cameraLookQuaternion } from './cameraAim'

export type TargetBody = {
  id?: string
  name: string
  kind?: string
  object: THREE.Object3D
  /** Optional known radius in scene units (avoids Bounds thrash). */
  radius?: number
}

export type TargetLock = {
  current: TargetBody | null
  readonly aiming: boolean
  cycle: (direction?: 1 | -1) => void
  selectById: (id: string, opts?: { aim?: boolean }) => boolean
  setTargets: (next: TargetBody[]) => void
  update: (dt: number) => void
  dispose: () => void
}

export function createTargetLock(
  camera: THREE.PerspectiveCamera,
  initialTargets: TargetBody[],
): TargetLock {
  let targets = initialTargets
  let index = -1
  let aiming = false
  let aimElapsed = 0
  const aimDuration = 0.85
  const startQuat = new THREE.Quaternion()
  const endQuat = new THREE.Quaternion()
  const targetPos = new THREE.Vector3()
  const worldUp = new THREE.Vector3(0, 1, 0)

  const beginAim = (body: TargetBody) => {
    lock.current = body
    body.object.getWorldPosition(targetPos)
    startQuat.copy(camera.quaternion)
    cameraLookQuaternion(endQuat, camera.position, targetPos, worldUp)
    aiming = true
    aimElapsed = 0
  }

  const lock: TargetLock = {
    current: null,
    get aiming() {
      return aiming
    },
    setTargets(next: TargetBody[]) {
      const currentId = lock.current?.id ?? lock.current?.name
      targets = next
      if (!currentId) {
        index = -1
        return
      }
      const idx = targets.findIndex((t) => (t.id ?? t.name) === currentId)
      index = idx
      lock.current = idx >= 0 ? targets[idx] : null
    },
    cycle(direction: 1 | -1 = 1) {
      if (targets.length === 0) return
      if (index < 0) index = direction > 0 ? 0 : targets.length - 1
      else index = (index + direction + targets.length) % targets.length
      beginAim(targets[index])
    },
    selectById(id: string, opts: { aim?: boolean } = {}) {
      const idx = targets.findIndex((t) => (t.id ?? t.name) === id)
      if (idx < 0) return false
      index = idx
      if (opts.aim === false) {
        lock.current = targets[idx]
        aiming = false
        return true
      }
      beginAim(targets[idx])
      return true
    },
    update(dt: number) {
      if (!aiming) return
      aimElapsed += dt
      const t = Math.min(1, aimElapsed / aimDuration)
      const s = t * t * (3 - 2 * t)
      camera.quaternion.slerpQuaternions(startQuat, endQuat, s)
      if (t >= 1) aiming = false
    },
    dispose() {
      // no listeners owned here; main wires KeyT
    },
  }

  return lock
}
