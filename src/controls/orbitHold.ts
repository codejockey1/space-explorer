import * as THREE from 'three'
import type { TargetBody } from './targetLock'
import { cameraLookQuaternion } from './cameraAim'

const tmp = new THREE.Vector3()
const look = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)
const center = new THREE.Vector3()
const radial = new THREE.Vector3()

export type OrbitHoldOptions = {
  /** Multiply arrival distance (1 = stay at approach framing). */
  distanceScale?: number
}

export type OrbitHold = {
  readonly active: boolean
  start: (target: TargetBody, opts?: OrbitHoldOptions) => void
  cancel: () => void
  update: (dt: number) => void
}

/** Gentle circular hold around the locked target after approach. */
export function createOrbitHold(camera: THREE.PerspectiveCamera): OrbitHold {
  let active = false
  let target: TargetBody | null = null
  let angle = 0
  let radius = 10
  let height = 0
  let minRadius = 1
  const basisRight = new THREE.Vector3()
  const basisFwd = new THREE.Vector3()

  return {
    get active() {
      return active
    },
    start(next: TargetBody, opts: OrbitHoldOptions = {}) {
      target = next
      next.object.getWorldPosition(center)
      radial.copy(camera.position).sub(center)
      const distScale = opts.distanceScale ?? 1
      const framed = Math.max(radial.length() * distScale, (next.radius ?? 1) * 2.4)
      radius = framed
      minRadius = (next.radius ?? 1) * 2.4
      height = radial.y * distScale
      // Build orbit plane from current radial × world up
      basisFwd.copy(radial).setY(0)
      if (basisFwd.lengthSq() < 1e-6) basisFwd.set(1, 0, 0)
      basisFwd.normalize()
      basisRight.crossVectors(up, basisFwd).normalize()
      if (basisRight.lengthSq() < 1e-6) basisRight.set(1, 0, 0)
      angle = Math.atan2(radial.dot(basisRight), radial.dot(basisFwd))
      active = true
    },
    cancel() {
      active = false
      target = null
    },
    update(dt: number) {
      if (!active || !target) return
      target.object.getWorldPosition(center)
      const r = Math.max(radius, minRadius)
      // ~one rev every ~90s at framing distance feel
      const omega = 0.07 * Math.sqrt(10 / Math.max(r, 1))
      angle += omega * dt
      tmp
        .copy(center)
        .addScaledVector(basisFwd, Math.cos(angle) * r)
        .addScaledVector(basisRight, Math.sin(angle) * r)
      tmp.y = center.y + height * 0.85
      camera.position.lerp(tmp, Math.min(1, dt * 2.5))
      cameraLookQuaternion(look, camera.position, center, up)
      camera.quaternion.slerp(look, Math.min(1, dt * 3))
    },
  }
}
