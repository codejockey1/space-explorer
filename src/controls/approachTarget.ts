import * as THREE from 'three'
import type { TargetBody } from './targetLock'
import { cameraLookQuaternion } from './cameraAim'

const tmpCenter = new THREE.Vector3()
const tmpSize = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpSide = new THREE.Vector3()
const tmpUp = new THREE.Vector3(0, 1, 0)
const tmpLookQuat = new THREE.Quaternion()
const tmpA = new THREE.Vector3()
const tmpClosest = new THREE.Vector3()
const tmpOffset = new THREE.Vector3()
const tmpTravel = new THREE.Vector3()
const tmpCross = new THREE.Vector3()
const curvedPos = new THREE.Vector3()

type Obstacle = {
  id?: string
  name: string
  object: THREE.Object3D
  radius: number
  center: THREE.Vector3
}

/**
 * Soft accel at the start, long settle near the target.
 * Peak speed sits mid-early; the opening seconds crawl so the kick-off isn't jarring.
 */
function approachProgress(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  const easeIn = Math.pow(x, 5) // slow pull-away
  const easeOut = 1 - Math.pow(1 - x, 6) // long soft arrival
  const w = THREE.MathUtils.smoothstep(x, 0.2, 0.58)
  return THREE.MathUtils.lerp(easeIn, easeOut, w)
}

/** Distance where the body diameter fills ~fill of the vertical FOV, still fully outside the surface. */
function framingDistance(
  camera: THREE.PerspectiveCamera,
  radius: number,
  fill = 0.62,
  standoff = 2.4,
): number {
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
  const dist = radius / Math.tan(halfFov * fill)
  // Always stand off outside the body (important for exaggerated meshes like Death Star)
  return Math.max(dist, radius * standoff)
}

function isCraftTarget(target: TargetBody): boolean {
  return target.kind === 'satellite' || target.kind === 'comet'
}

function bodyRadius(object: THREE.Object3D): number {
  object.updateWorldMatrix(true, true)
  // Prefer the spin/globe mesh — far-field impostor sprites inflate world bounds
  const spin = object.getObjectByName(`${object.name}_spin`) ?? object
  const box = new THREE.Box3()
  let hasMesh = false
  spin.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    if (child.name.includes('impostor')) return
    box.expandByObject(child)
    hasMesh = true
  })
  if (!hasMesh) {
    box.setFromObject(object)
  }
  box.getSize(tmpSize)
  return Math.max(tmpSize.x, tmpSize.y, tmpSize.z) * 0.5 || 1
}

/** Catalog radius wins when mesh bounds look like an inflated impostor. */
function resolveApproachRadius(target: TargetBody): number {
  const floor = isCraftTarget(target) ? 0.18 : 0.05
  const catalogR = Math.max(target.radius ?? 0, floor)
  const meshR = bodyRadius(target.object)
  // Impostor sprites can inflate bounds; crafts use their exaggerated mesh size
  if (!isCraftTarget(target) && meshR > catalogR * 12) return catalogR
  return Math.max(catalogR, meshR)
}

/** Closest point on segment AB to point P, plus distance and t in [0,1]. */
function closestOnSegment(
  a: THREE.Vector3,
  b: THREE.Vector3,
  p: THREE.Vector3,
  out: THREE.Vector3,
): { dist: number; t: number } {
  tmpTravel.subVectors(b, a)
  const lenSq = tmpTravel.lengthSq()
  let t = 0
  if (lenSq > 1e-12) {
    t = THREE.MathUtils.clamp(tmpClosest.subVectors(p, a).dot(tmpTravel) / lenSq, 0, 1)
  }
  out.copy(a).addScaledVector(tmpTravel, t)
  return { dist: out.distanceTo(p), t }
}

/**
 * If segment AB comes closer than `safeRadius` to a sphere, return a flyby waypoint
 * that skims outside the body instead of punching through it.
 */
function flybyWaypoint(
  a: THREE.Vector3,
  b: THREE.Vector3,
  center: THREE.Vector3,
  safeRadius: number,
): THREE.Vector3 | null {
  const { dist, t } = closestOnSegment(a, b, center, tmpClosest)
  if (dist >= safeRadius - 1e-4) return null
  if (t < 0.04 || t > 0.96) return null

  tmpOffset.subVectors(tmpClosest, center)
  if (tmpOffset.lengthSq() < 1e-8) {
    tmpTravel.subVectors(b, a).normalize()
    tmpCross.crossVectors(tmpTravel, tmpUp)
    if (tmpCross.lengthSq() < 1e-8) tmpCross.set(1, 0, 0)
    tmpOffset.copy(tmpCross)
  }
  tmpOffset.normalize()
  tmpOffset.addScaledVector(tmpUp, 0.35).normalize()

  const waypoint = center.clone().addScaledVector(tmpOffset, safeRadius)
  tmpTravel.subVectors(b, a).normalize()
  waypoint.addScaledVector(tmpTravel, safeRadius * 0.15)
  return waypoint
}

function collectObstacles(bodies: TargetBody[]): Obstacle[] {
  const list: Obstacle[] = []
  for (const body of bodies) {
    body.object.getWorldPosition(tmpCenter)
    list.push({
      id: body.id,
      name: body.name,
      object: body.object,
      radius: resolveApproachRadius(body),
      center: tmpCenter.clone(),
    })
  }
  return list
}

function refreshObstacleCenters(obstacles: Obstacle[]) {
  for (const obstacle of obstacles) {
    obstacle.object.getWorldPosition(obstacle.center)
  }
}

/**
 * Build a polyline from start→end that near-flybys around any blocking spheres
 * instead of intersecting them.
 */
function buildAvoidanceWaypoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  obstacles: Obstacle[],
  clearance = 1.25,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [start.clone()]
  let from = start.clone()
  const goal = end.clone()

  for (let iter = 0; iter < 10; iter++) {
    let blocker: { obstacle: Obstacle; waypoint: THREE.Vector3; penetration: number } | null =
      null

    for (const obstacle of obstacles) {
      const safe = obstacle.radius * clearance
      const endDist = goal.distanceTo(obstacle.center)
      if (endDist <= safe * 1.02 && from.distanceTo(goal) < safe * 3) continue

      const waypoint = flybyWaypoint(from, goal, obstacle.center, safe)
      if (!waypoint) continue

      const { dist } = closestOnSegment(from, goal, obstacle.center, tmpClosest)
      const penetration = safe - dist
      if (!blocker || penetration > blocker.penetration) {
        blocker = { obstacle, waypoint, penetration }
      }
    }

    if (!blocker) break

    if (blocker.waypoint.distanceTo(from) > blocker.obstacle.radius * 0.05) {
      points.push(blocker.waypoint)
      from = blocker.waypoint.clone()
    } else {
      break
    }
  }

  points.push(goal)
  return points
}

function pathLength(points: THREE.Vector3[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) len += points[i - 1].distanceTo(points[i])
  return len
}

export type ApproachOptions = {
  bodies?: TargetBody[]
  /** Scene-units per second cruise speed (true-scale should be huge). */
  cruiseSpeed?: number
}

export type ApproachControls = {
  readonly active: boolean
  readonly speed: number
  /** Time progress of the approach (0→1). Matches HUD APR; path easing is separate. */
  readonly progress: number
  /** Target just arrived at this frame (cleared when read). */
  consumeArrival: () => TargetBody | null
  /** Begin a curved tween toward the current target. Returns false if nothing targeted. */
  go: (target: TargetBody | null, options?: ApproachOptions) => boolean
  /** Abort approach; returns residual world velocity for a soft handoff to flight. */
  cancel: () => THREE.Vector3
  update: (dt: number) => void
}

export function createApproachControls(camera: THREE.PerspectiveCamera): ApproachControls {
  let active = false
  let elapsed = 0
  let duration = 1
  let speed = 0
  /** Display / time progress 0→1 (not the eased curve parameter). */
  let progress = 0
  /** Eased parameter along the Catmull-Rom path. */
  let pathU = 0
  let prevPos = new THREE.Vector3()
  let tracked: TargetBody | null = null
  let targetCenter = new THREE.Vector3()
  let plannedObstacles: Obstacle[] = []
  /** Path points in the target's frame so the approach rides with the orbit. */
  let localWaypoints: THREE.Vector3[] = []
  const worldPoints: THREE.Vector3[] = []
  let curve: THREE.CatmullRomCurve3 | null = null
  let arrived: TargetBody | null = null
  const residual = new THREE.Vector3()
  const tangent = new THREE.Vector3()

  const rebuildWorldCurve = () => {
    if (localWaypoints.length < 2) return
    while (worldPoints.length < localWaypoints.length) worldPoints.push(new THREE.Vector3())
    worldPoints.length = localWaypoints.length
    for (let i = 0; i < localWaypoints.length; i++) {
      worldPoints[i].copy(targetCenter).add(localWaypoints[i])
    }
    if (!curve) {
      curve = new THREE.CatmullRomCurve3(worldPoints, false, 'catmullrom', 0.18)
    } else {
      curve.points = worldPoints
      curve.updateArcLengths()
    }
  }

  const finish = () => {
    active = false
    speed = 0
    progress = 0
    pathU = 0
    tracked = null
    curve = null
    localWaypoints = []
    plannedObstacles = []
  }

  const controls: ApproachControls = {
    get active() {
      return active
    },
    get speed() {
      return speed
    },
    get progress() {
      return progress
    },
    consumeArrival() {
      const a = arrived
      arrived = null
      return a
    },
    go(target: TargetBody | null, options: ApproachOptions = {}) {
      arrived = null
      if (!target) return false
      const bodies = options.bodies ?? []
      const cruiseSpeed = options.cruiseSpeed ?? 35

      tracked = target
      target.object.getWorldPosition(targetCenter)
      const radius = resolveApproachRadius(target)
      // Satellites/probes: pull in tight so the craft fills the view
      const dist = isCraftTarget(target)
        ? framingDistance(camera, radius, 0.92, 1.55)
        : framingDistance(camera, radius)

      // Approach from the current side of the body (don't tunnel through the target)
      tmpDir.copy(camera.position).sub(targetCenter)
      if (tmpDir.lengthSq() < 1e-8) {
        camera.getWorldDirection(tmpDir).multiplyScalar(-1)
      }
      tmpDir.normalize()

      const start = camera.position.clone()
      const end = targetCenter.clone().addScaledVector(tmpDir, dist)

      plannedObstacles = collectObstacles(bodies.length > 0 ? bodies : [target])
      const waypoints = buildAvoidanceWaypoints(start, end, plannedObstacles, 1.28)

      // Ensure a little shape even on clear paths (subtle banked approach)
      if (waypoints.length === 2) {
        tmpSide.crossVectors(tmpDir, tmpUp)
        if (tmpSide.lengthSq() < 1e-8) tmpSide.set(1, 0, 0)
        tmpSide.normalize()
        const travel = start.distanceTo(end)
        const mid = start.clone().lerp(end, 0.5).addScaledVector(tmpSide, travel * 0.06)
        mid.y += travel * 0.03
        waypoints.splice(1, 0, mid)
      }

      // Bake into target-local space so the corridor translates with the orbit
      localWaypoints = waypoints.map((p) => p.clone().sub(targetCenter))
      curve = null
      rebuildWorldCurve()

      const travel = Math.max(pathLength(waypoints), start.distanceTo(end))
      duration = THREE.MathUtils.clamp((travel / Math.max(cruiseSpeed, 1)) * 1.9, 4.5, 160)
      elapsed = 0
      prevPos.copy(start)
      speed = 0
      progress = 0
      pathU = 0
      active = true
      return true
    },
    cancel() {
      residual.set(0, 0, 0)
      if (active && curve) {
        curve.getTangentAt(Math.min(0.999, Math.max(0.001, pathU)), tangent)
        residual.copy(tangent).multiplyScalar(speed)
      }
      finish()
      return residual.clone()
    },
    update(dt: number) {
      if (!active || !tracked || localWaypoints.length < 2) {
        speed = 0
        progress = 0
        pathU = 0
        return
      }

      elapsed += dt
      const t = Math.min(1, elapsed / duration)
      // Soft path easing for motion; HUD APR tracks real time so it doesn't
      // sit at ~100% through the long settle of the ease-out curve.
      pathU = approachProgress(t)
      progress = t

      // Follow the target's orbit: re-anchor the local path each frame
      tracked.object.getWorldPosition(targetCenter)
      rebuildWorldCurve()
      refreshObstacleCenters(plannedObstacles)

      if (!curve) return
      curve.getPointAt(pathU, curvedPos)
      camera.position.copy(curvedPos)

      // Soft safety against moving bodies (Catmull-Rom can bow into a sphere)
      for (const obstacle of plannedObstacles) {
        const meshPad = bodyRadius(obstacle.object)
        const minDist = Math.max(obstacle.radius, meshPad) * 1.25
        tmpA.subVectors(camera.position, obstacle.center)
        const d = tmpA.length()
        if (d < minDist && d > 1e-6) {
          camera.position.copy(obstacle.center).addScaledVector(tmpA.normalize(), minDist)
        }
      }

      cameraLookQuaternion(tmpLookQuat, camera.position, targetCenter, tmpUp)
      const lookRate = THREE.MathUtils.lerp(1.8, 3.8, pathU)
      camera.quaternion.slerp(tmpLookQuat, Math.min(1, dt * lookRate))

      const instant = camera.position.distanceTo(prevPos) / Math.max(dt, 1e-4)
      speed = THREE.MathUtils.lerp(speed, instant, Math.min(1, dt * 8))
      prevPos.copy(camera.position)

      if (t >= 1) {
        curve.getPointAt(1, camera.position)
        for (const obstacle of plannedObstacles) {
          const meshPad = bodyRadius(obstacle.object)
          const minDist = Math.max(obstacle.radius, meshPad) * 1.25
          tmpA.subVectors(camera.position, obstacle.center)
          const d = tmpA.length()
          if (d < minDist && d > 1e-6) {
            camera.position.copy(obstacle.center).addScaledVector(tmpA.normalize(), minDist)
          }
        }
        cameraLookQuaternion(camera.quaternion, camera.position, targetCenter, tmpUp)
        arrived = tracked
        finish()
      }
    },
  }

  return controls
}
