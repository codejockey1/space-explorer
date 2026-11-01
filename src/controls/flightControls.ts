import * as THREE from 'three'

const FORWARD = new THREE.Vector3()
const RIGHT = new THREE.Vector3()
const UP = new THREE.Vector3()
const DESIRED = new THREE.Vector3()
const DELTA = new THREE.Vector3()

export type FlightControls = {
  speed: number
  thrustMultiplier: number
  /** 0–1 from current thrust input (keys/stick), independent of built-up speed. */
  readonly thrustInput: number
  /** Current velocity in scene units/sec (copy). */
  getVelocity: () => THREE.Vector3
  /** Blend in residual velocity (e.g. soft approach abort). */
  injectVelocity: (v: THREE.Vector3, weight?: number) => void
  setEnabled: (enabled: boolean) => void
  setMouseLookEnabled: (enabled: boolean) => void
  /** Align camera "up" toward a world-space up hint (local-up mode). */
  setReferenceUp: (up: THREE.Vector3 | null) => void
  update: (dt: number, opts?: { allowSteer?: boolean }) => void
  dispose: () => void
}

export function createFlightControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLElement,
): FlightControls {
  const keys = new Set<string>()
  let speed = 0
  let thrustInput = 0
  let thrustMultiplier = 1
  let enabled = true
  let mouseLook = false
  let pointerLocked = false
  const velocity = new THREE.Vector3()
  const referenceUp = new THREE.Vector3(0, 1, 0)
  let useReferenceUp = false
  const mouseDelta = { x: 0, y: 0 }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return
    keys.add(e.code)
    if (e.code.startsWith('Arrow') || e.code === 'KeyR' || e.code === 'KeyF') {
      e.preventDefault()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!pointerLocked || !mouseLook || !enabled) return
    mouseDelta.x += e.movementX
    mouseDelta.y += e.movementY
  }

  const onClick = () => {
    if (!enabled || !mouseLook) return
    if (!pointerLocked) canvas.requestPointerLock()
  }

  const onPointerLockChange = () => {
    pointerLocked = document.pointerLockElement === canvas
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('click', onClick)
  document.addEventListener('pointerlockchange', onPointerLockChange)

  const baseCruise = 1.6
  const boostMul = 2.5
  const turnRate = 1.35
  const rollRate = 1.6
  const mouseSensitivity = 0.0016
  const accelSeconds = 7.5
  const decelSeconds = 5.5

  const readGamepad = (out: {
    yaw: number
    pitch: number
    roll: number
    thrust: THREE.Vector3
    boost: boolean
  }) => {
    out.yaw = 0
    out.pitch = 0
    out.roll = 0
    out.thrust.set(0, 0, 0)
    out.boost = false
    const pads = navigator.getGamepads?.() ?? []
    const pad = pads.find((p) => p && p.connected)
    if (!pad) return false
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v)
    out.yaw = -dead(pad.axes[2] ?? pad.axes[0] ?? 0)
    out.pitch = dead(pad.axes[3] ?? pad.axes[1] ?? 0)
    out.roll = (pad.buttons[4]?.pressed ? 1 : 0) + (pad.buttons[5]?.pressed ? -1 : 0)
    const lx = dead(pad.axes[0] ?? 0)
    const ly = dead(pad.axes[1] ?? 0)
    out.thrust.set(lx, 0, -ly)
    if (pad.buttons[0]?.pressed) out.thrust.y += 1
    if (pad.buttons[1]?.pressed) out.thrust.y -= 1
    out.boost = !!(pad.buttons[7]?.pressed || pad.buttons[6]?.pressed)
    return true
  }

  const gpThrust = new THREE.Vector3()
  const gp = { yaw: 0, pitch: 0, roll: 0, thrust: gpThrust, boost: false }

  return {
    get speed() {
      return speed
    },
    set speed(v: number) {
      speed = v
    },
    get thrustInput() {
      return thrustInput
    },
    get thrustMultiplier() {
      return thrustMultiplier
    },
    set thrustMultiplier(v: number) {
      thrustMultiplier = Math.max(0.01, v)
    },
    getVelocity() {
      return velocity.clone()
    },
    injectVelocity(v, weight = 1) {
      velocity.lerp(v, Math.min(1, Math.max(0, weight)))
      speed = velocity.length()
    },
    setEnabled(next: boolean) {
      enabled = next
      if (!next) {
        keys.clear()
        mouseDelta.x = 0
        mouseDelta.y = 0
        if (pointerLocked) document.exitPointerLock()
      }
    },
    setMouseLookEnabled(next: boolean) {
      mouseLook = next
      if (!next && pointerLocked) document.exitPointerLock()
    },
    setReferenceUp(up: THREE.Vector3 | null) {
      useReferenceUp = !!up
      if (up) referenceUp.copy(up).normalize()
    },
    update(dt: number, opts: { allowSteer?: boolean } = {}) {
      if (!enabled) {
        speed = 0
        thrustInput = 0
        return
      }
      const allowSteer = opts.allowSteer !== false
      const hasPad = readGamepad(gp)

      if (allowSteer) {
        if (keys.has('ArrowLeft')) camera.rotateY(turnRate * dt)
        if (keys.has('ArrowRight')) camera.rotateY(-turnRate * dt)
        if (keys.has('ArrowUp')) camera.rotateX(turnRate * dt)
        if (keys.has('ArrowDown')) camera.rotateX(-turnRate * dt)
        if (keys.has('KeyQ')) camera.rotateZ(rollRate * dt)
        if (keys.has('KeyE')) camera.rotateZ(-rollRate * dt)

        if (mouseLook && pointerLocked) {
          camera.rotateY(-mouseDelta.x * mouseSensitivity)
          camera.rotateX(-mouseDelta.y * mouseSensitivity)
          mouseDelta.x = 0
          mouseDelta.y = 0
        }

        if (hasPad) {
          camera.rotateY(gp.yaw * turnRate * 1.4 * dt)
          camera.rotateX(gp.pitch * turnRate * 1.4 * dt)
          camera.rotateZ(gp.roll * rollRate * dt)
        }

        if (useReferenceUp) {
          camera.up.lerp(referenceUp, Math.min(1, dt * 1.5)).normalize()
        } else {
          camera.up.set(0, 1, 0)
        }
      }

      camera.getWorldDirection(FORWARD)
      RIGHT.set(1, 0, 0).applyQuaternion(camera.quaternion)
      UP.set(0, 1, 0).applyQuaternion(camera.quaternion)

      const boost =
        keys.has('ShiftLeft') || keys.has('ShiftRight') || gp.boost ? boostMul : 1
      const cruise = baseCruise * boost * thrustMultiplier
      const accel = cruise / accelSeconds
      const decel = cruise / decelSeconds

      DESIRED.set(0, 0, 0)
      if (keys.has('KeyW')) DESIRED.addScaledVector(FORWARD, 1)
      if (keys.has('KeyS')) DESIRED.addScaledVector(FORWARD, -1)
      if (keys.has('KeyD')) DESIRED.addScaledVector(RIGHT, 0.75)
      if (keys.has('KeyA')) DESIRED.addScaledVector(RIGHT, -0.75)
      if (keys.has('KeyR')) DESIRED.addScaledVector(UP, 0.75)
      if (keys.has('KeyF')) DESIRED.addScaledVector(UP, -0.75)
      if (hasPad && gp.thrust.lengthSq() > 1e-6) {
        DESIRED.addScaledVector(RIGHT, gp.thrust.x * 0.75)
        DESIRED.addScaledVector(FORWARD, gp.thrust.z)
        DESIRED.addScaledVector(UP, gp.thrust.y * 0.75)
      }

      const hasInput = DESIRED.lengthSq() > 1e-8
      // Immediate engine cue: input strength (+ boost), not waited-for speed
      thrustInput = hasInput ? Math.min(1, (boost > 1 ? 1 : 0.72) * Math.min(1, DESIRED.length())) : 0
      if (hasInput) {
        DESIRED.setLength(cruise)
        DELTA.subVectors(DESIRED, velocity)
        const maxStep = accel * dt
        if (DELTA.lengthSq() > maxStep * maxStep) DELTA.setLength(maxStep)
        velocity.add(DELTA)
      } else if (velocity.lengthSq() > 1e-10) {
        const spill = Math.min(velocity.length(), decel * dt)
        const next = velocity.length() - spill
        if (next <= cruise * 0.001) velocity.set(0, 0, 0)
        else velocity.setLength(next)
      }

      camera.position.addScaledVector(velocity, dt)
      speed = velocity.length()
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      if (pointerLocked) document.exitPointerLock()
    },
  }
}
