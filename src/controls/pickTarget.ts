import * as THREE from 'three'
import type { TargetBody } from './targetLock'

const world = new THREE.Vector3()
const toBody = new THREE.Vector3()
const forward = new THREE.Vector3()

/** Pick the body closest to view center (within FOV cone), else nearest overall. */
export function pickTargetInView(
  camera: THREE.PerspectiveCamera,
  bodies: TargetBody[],
  opts: { maxAngleRad?: number } = {},
): TargetBody | null {
  if (bodies.length === 0) return null
  const maxAngle = opts.maxAngleRad ?? THREE.MathUtils.degToRad(28)
  camera.getWorldDirection(forward)

  let bestView: TargetBody | null = null
  let bestViewScore = Infinity
  let bestNear: TargetBody | null = null
  let bestNearDist = Infinity

  for (const body of bodies) {
    body.object.getWorldPosition(world)
    toBody.copy(world).sub(camera.position)
    const dist = toBody.length()
    if (dist < 1e-4) continue
    toBody.multiplyScalar(1 / dist)
    const angle = Math.acos(THREE.MathUtils.clamp(forward.dot(toBody), -1, 1))
    if (dist < bestNearDist) {
      bestNearDist = dist
      bestNear = body
    }
    if (angle <= maxAngle) {
      // Prefer centered + nearer
      const score = angle * 2 + dist * 1e-6
      if (score < bestViewScore) {
        bestViewScore = score
        bestView = body
      }
    }
  }

  return bestView ?? bestNear
}
