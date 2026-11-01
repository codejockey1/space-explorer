import './style.css'
import * as THREE from 'three'
import { createScene } from './scene/createScene'
import { createFlightControls } from './controls/flightControls'
import { createTargetLock, type TargetBody } from './controls/targetLock'
import { createApproachControls } from './controls/approachTarget'
import { createOrbitHold } from './controls/orbitHold'
import { pickTargetInView } from './controls/pickTarget'
import { createKioskMode } from './controls/kioskMode'
import { createHud } from './ui/hud'
import { createTargetPicker } from './ui/targetPicker'
import { createBodyLabels } from './ui/bodyLabels'
import { createMinimap } from './ui/minimap'
import { createPauseMenu } from './ui/pauseMenu'
import { createTargetGlow } from './fx/targetGlow'
import { createSunGlare } from './fx/sunGlare'
import { createSpaceAudio } from './fx/spaceAudio'
import { createSimulationClock } from './time/simulationClock'
import { daysSinceJ2000 } from './solar/kepler'
import {
  cameraFarForScale,
  cameraNearForScale,
  frameEarthOpeningView,
  startPositionForScale,
} from './solar/SolarSystem'
import type { ScaleMode } from './solar/units'
import {
  loadBookmarks,
  loadSession,
  saveBookmarks,
  saveSession,
  type SessionSnapshot,
} from './persistence/sessionSave'

async function boot() {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) throw new Error('#app missing')
  app.innerHTML = ''

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.45
  app.appendChild(renderer.domElement)

  let scaleMode: ScaleMode = 'true'
  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    cameraNearForScale(scaleMode),
    cameraFarForScale(scaleMode),
  )
  camera.position.copy(startPositionForScale(scaleMode))
  camera.lookAt(0, 0, 0)

  const textureLoader = new THREE.TextureLoader()
  const space = await createScene(textureLoader, renderer)
  space.solar.setScaleMode(scaleMode)
  space.solar.update(daysSinceJ2000(new Date()))

  if (!frameEarthOpeningView(camera, space.solar)) {
    const earth = space.solar.getTargets().find((t) => t.id === 'earth')
    if (earth) {
      const earthPos = new THREE.Vector3()
      earth.object.getWorldPosition(earthPos)
      camera.position.copy(earthPos).add(startPositionForScale(scaleMode))
      camera.lookAt(earthPos)
    }
  }

  const clock = createSimulationClock(daysSinceJ2000(new Date()))
  const flight = createFlightControls(camera, renderer.domElement)
  flight.thrustMultiplier = scaleMode === 'true' ? 55 : 1
  flight.setMouseLookEnabled(true)

  const toTargetBodies = (): TargetBody[] =>
    space.solar.getTargets().map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      object: t.object,
      radius: space.solar.getBodyRadius(t.id),
    }))

  const targetLock = createTargetLock(camera, toTargetBodies())
  targetLock.selectById('earth', { aim: false })
  const targetGlow = createTargetGlow(space.scene)
  const sunGlare = createSunGlare(space.scene)
  const approach = createApproachControls(camera)
  const orbitHold = createOrbitHold(camera)
  const audio = createSpaceAudio()
  const unlockAudio = () => audio.unlock()
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })

  const hud = createHud(app)
  const labels = createBodyLabels(app)
  const minimap = createMinimap(app)
  let labelsOn = true
  let localUp = false

  hud.setTimeScale(clock.label())
  hud.setScaleMode(scaleMode)
  hud.setTarget('Earth')

  const softAbortApproach = () => {
    const residual = approach.cancel()
    if (residual.lengthSq() > 1e-8) flight.injectVelocity(residual, 1)
    hud.setApproachProgress(null)
  }

  const cruiseSpeedForMode = () => (scaleMode === 'true' ? 95_000 : 32)

  const kiosk = createKioskMode({
    getBodies: toTargetBodies,
    getCurrentId: () => targetLock.current?.id ?? null,
    getOrigin: () => camera.position,
    lockAndApproach(body) {
      softAbortApproach()
      orbitHold.cancel()
      if (!body.id) return false
      // Fresh radius/object from live catalog (avoids stale picks)
      const live = toTargetBodies().find((b) => b.id === body.id) ?? body
      targetLock.selectById(live.id!, { aim: false })
      hud.setTarget(live.name)
      const bodies = toTargetBodies()
      const ok = approach.go(live, { bodies, cruiseSpeed: cruiseSpeedForMode() })
      if (ok) hud.setApproachProgress(0)
      return ok
    },
    startOrbit(body) {
      // Stay at approach framing distance (don't back out)
      orbitHold.start(body, { distanceScale: 1 })
    },
    stopTravel() {
      softAbortApproach()
      orbitHold.cancel()
    },
    onStatus(text) {
      hud.setStatus(text)
    },
  })

  const syncKioskUi = (on: boolean) => {
    if (!on) hud.setKioskCountdown(null)
  }

  const snapshot = (): SessionSnapshot => ({
    version: 1,
    day: clock.day,
    timeScale: clock.rawTimeScale,
    paused: clock.paused,
    scaleMode,
    targetId: targetLock.current?.id ?? null,
    camera: {
      position: camera.position.toArray() as [number, number, number],
      quaternion: camera.quaternion.toArray() as [number, number, number, number],
    },
  })

  const applySnapshot = (snap: SessionSnapshot) => {
    softAbortApproach()
    orbitHold.cancel()
    scaleMode = snap.scaleMode
    space.solar.setScaleMode(scaleMode)
    camera.near = cameraNearForScale(scaleMode)
    camera.far = cameraFarForScale(scaleMode)
    camera.updateProjectionMatrix()
    flight.thrustMultiplier = scaleMode === 'true' ? 55 : 1
    clock.day = snap.day
    clock.setTimeScale(snap.timeScale)
    clock.paused = snap.paused
    space.solar.update(clock.day)
    camera.position.fromArray(snap.camera.position)
    camera.quaternion.fromArray(snap.camera.quaternion)
    targetLock.setTargets(toTargetBodies())
    if (snap.targetId) targetLock.selectById(snap.targetId, { aim: false })
    hud.setScaleMode(scaleMode)
    hud.setTimeScale(clock.label())
    hud.setTarget(targetLock.current?.name ?? null)
  }

  const picker = createTargetPicker(
    app,
    (id) => {
      if (kiosk.active) kiosk.stop()
      softAbortApproach()
      orbitHold.cancel()
      if (targetLock.selectById(id)) {
        hud.setTarget(targetLock.current?.name ?? null)
        hud.setStatus(`Locked ${targetLock.current?.name}`)
      }
    },
    (open) => flight.setEnabled(!open && !kiosk.active),
  )
  picker.setItems(
    space.solar.getTargets().map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
  )

  const pauseMenu = createPauseMenu(app, {
    onResume: () => {
      flight.setEnabled(true)
    },
    onToggleHelp: () => {
      const on = hud.toggleHelp()
      hud.setStatus(on ? 'Help shown' : 'Help hidden')
    },
    onToggleLabels: () => {
      labelsOn = !labelsOn
      labels.setVisible(labelsOn)
      hud.setStatus(labelsOn ? 'Labels on' : 'Labels off')
    },
    onToggleMinimap: () => {
      const on = minimap.toggle()
      hud.setStatus(on ? 'Minimap on' : 'Minimap off')
    },
    onToggleEcliptic: () => {
      const on = space.solar.toggleEcliptic()
      hud.setStatus(on ? 'Ecliptic on' : 'Ecliptic off')
    },
    onToggleKiosk: () => {
      const on = kiosk.toggle()
      flight.setEnabled(!on)
      flight.setMouseLookEnabled(!on)
      if (!on) {
        softAbortApproach()
        orbitHold.cancel()
      }
      syncKioskUi(on)
      hud.setStatus(on ? 'Kiosk mode on' : 'Kiosk mode off')
    },
    onSave: () => {
      saveSession(snapshot())
      hud.setStatus('Session saved')
    },
    onLoad: () => {
      const snap = loadSession()
      if (!snap) {
        hud.setStatus('No saved session')
        return
      }
      applySnapshot(snap)
      hud.setStatus('Session loaded')
    },
    onBookmark: (name) => {
      const list = loadBookmarks()
      list.unshift({ id: `${Date.now()}`, name, snap: snapshot() })
      saveBookmarks(list)
      hud.setStatus(`Bookmarked “${name}”`)
    },
    onJumpDate: (day) => {
      clock.day = day
      space.solar.update(day)
      hud.setStatus('Date jumped')
    },
  })

  const findAnchorBodyId = () => {
    let bestId: string | null = null
    let best = Infinity
    const p = new THREE.Vector3()
    for (const t of space.solar.getTargets()) {
      if (t.kind === 'satellite' || t.kind === 'comet') continue
      t.object.getWorldPosition(p)
      const d = camera.position.distanceTo(p) / Math.max(space.solar.getBodyRadius(t.id), 0.01)
      if (d < best) {
        best = d
        bestId = t.id
      }
    }
    return bestId
  }

  const applyScaleMode = (mode: ScaleMode) => {
    const anchorId = findAnchorBodyId()
    const offset = new THREE.Vector3()
    const anchorPos = new THREE.Vector3()
    if (anchorId) {
      space.solar.getBodyPosition(anchorId, anchorPos)
      offset.copy(camera.position).sub(anchorPos)
    }

    scaleMode = mode
    space.solar.setScaleMode(mode)
    camera.near = cameraNearForScale(mode)
    camera.far = cameraFarForScale(mode)
    camera.updateProjectionMatrix()
    flight.thrustMultiplier = mode === 'true' ? 55 : 1
    space.solar.update(clock.day)
    targetLock.setTargets(toTargetBodies())

    if (anchorId) {
      space.solar.getBodyPosition(anchorId, anchorPos)
      // Preserve direction; rescale offset length by body radius ratio feel
      const len = offset.length()
      if (len > 1e-6) {
        offset.setLength(Math.max(space.solar.getBodyRadius(anchorId) * 4, len * (mode === 'true' ? 8 : 0.2)))
      }
      camera.position.copy(anchorPos).add(offset)
      camera.lookAt(anchorPos)
    }

    hud.setScaleMode(mode)
    hud.setStatus(mode === 'true' ? 'True scale (AU-accurate)' : 'Playable compressed scale')
  }

  const lockBody = (body: TargetBody | null) => {
    if (!body?.id) return
    if (kiosk.active) kiosk.stop()
    softAbortApproach()
    orbitHold.cancel()
    targetLock.selectById(body.id)
    hud.setTarget(body.name)
    hud.setStatus(`Locked ${body.name}`)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return

    if (e.code === 'Escape') {
      if (picker.isOpen()) {
        picker.close()
        return
      }
      if (approach.active) {
        softAbortApproach()
        hud.setStatus('Approach aborted')
        return
      }
      if (orbitHold.active) {
        orbitHold.cancel()
        hud.setStatus('Orbit hold off')
        return
      }
      pauseMenu.toggle()
      flight.setEnabled(!pauseMenu.isOpen())
      if (pauseMenu.isOpen()) clock.paused = true
      return
    }

    if (pauseMenu.isOpen() || picker.isOpen()) {
      if (e.code === 'Slash' && !picker.isOpen() && !pauseMenu.isOpen()) {
        /* fallthrough blocked */
      }
      if (picker.isOpen()) return
      if (pauseMenu.isOpen()) return
    }

    if (e.code === 'Slash') {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        picker.open()
        return
      }
    }

    if (e.code === 'KeyT') {
      if (kiosk.active) kiosk.stop()
      softAbortApproach()
      orbitHold.cancel()
      targetLock.cycle(1)
      hud.setTarget(targetLock.current?.name ?? null)
      return
    }
    if (e.code === 'KeyY') {
      if (kiosk.active) kiosk.stop()
      softAbortApproach()
      orbitHold.cancel()
      targetLock.cycle(-1)
      hud.setTarget(targetLock.current?.name ?? null)
      return
    }
    if (e.code === 'KeyV' || e.code === 'KeyN') {
      const bodies = toTargetBodies()
      const pick =
        e.code === 'KeyV'
          ? pickTargetInView(camera, bodies)
          : [...bodies].sort((a, b) => {
              const pa = new THREE.Vector3()
              const pb = new THREE.Vector3()
              a.object.getWorldPosition(pa)
              b.object.getWorldPosition(pb)
              return camera.position.distanceTo(pa) - camera.position.distanceTo(pb)
            })[0]
      lockBody(pick ?? null)
      return
    }

    if (e.code === 'KeyG') {
      if (kiosk.active) kiosk.stop()
      orbitHold.cancel()
      const bodies = toTargetBodies()
      if (
        approach.go(targetLock.current, {
          bodies,
          cruiseSpeed: cruiseSpeedForMode(),
        })
      ) {
        hud.setStatus(`Approaching ${targetLock.current?.name}`)
        hud.setApproachProgress(0)
      } else {
        hud.setStatus('Select a target with / or T / Y first')
      }
      return
    }

    if (e.code === 'KeyH') {
      if (kiosk.active) kiosk.stop()
      if (orbitHold.active) {
        orbitHold.cancel()
        hud.setStatus('Orbit hold off')
      } else if (targetLock.current) {
        softAbortApproach()
        orbitHold.start(targetLock.current)
        hud.setStatus(`Orbiting ${targetLock.current.name}`)
      }
      return
    }

    if (e.code === 'KeyI') {
      const on = kiosk.toggle()
      flight.setEnabled(!on)
      if (on) {
        flight.setMouseLookEnabled(false)
        hud.setStatus(`Kiosk mode on — dwell ${kiosk.cycleLabel}`)
      } else {
        flight.setMouseLookEnabled(true)
        softAbortApproach()
        orbitHold.cancel()
      }
      syncKioskUi(on)
      return
    }

    if (e.code === 'KeyB') {
      const muted = audio.toggleMuted()
      audio.unlock()
      hud.setStatus(muted ? 'Engine sound off' : 'Engine sound on')
      return
    }

    if (e.code === 'KeyX') {
      if (!kiosk.active) {
        hud.setStatus('Kiosk skip — enable kiosk with I first')
        return
      }
      kiosk.skipToNext()
      return
    }

    if (e.code === 'KeyC') {
      const label = kiosk.cycleDwell()
      hud.setStatus(`Kiosk dwell ${label}`)
      return
    }

    if (e.code === 'KeyO') {
      const on = space.solar.toggleOrbits()
      hud.setStatus(on ? 'Orbit lines on' : 'Orbit lines off')
      return
    }
    if (e.code === 'KeyL') {
      labelsOn = !labelsOn
      labels.setVisible(labelsOn)
      hud.setStatus(labelsOn ? 'Labels on' : 'Labels off')
      return
    }
    if (e.code === 'Semicolon') {
      const on = minimap.toggle()
      hud.setStatus(on ? 'Minimap on' : 'Minimap off')
      return
    }
    if (e.code === 'KeyU') {
      localUp = !localUp
      if (!localUp) flight.setReferenceUp(null)
      hud.setStatus(localUp ? 'Local-up on' : 'Local-up off')
      return
    }
    if (e.code === 'KeyK') {
      const name = window.prompt('Bookmark name', targetLock.current?.name ?? 'View') || 'View'
      const list = loadBookmarks()
      list.unshift({ id: `${Date.now()}`, name, snap: snapshot() })
      saveBookmarks(list)
      hud.setStatus(`Bookmarked “${name}”`)
      return
    }

    if (e.code === 'BracketRight') {
      clock.cycleTimeScale(1)
      hud.setTimeScale(clock.label())
      return
    }
    if (e.code === 'BracketLeft') {
      clock.cycleTimeScale(-1)
      hud.setTimeScale(clock.label())
      return
    }
    if (e.code === 'KeyP') {
      clock.togglePause()
      hud.setTimeScale(clock.label())
      return
    }
    if (e.code === 'Backslash') {
      clock.reverse()
      hud.setTimeScale(clock.label())
      return
    }
    if (e.code === 'KeyM') {
      applyScaleMode(scaleMode === 'playable' ? 'true' : 'playable')
      return
    }

    if (
      approach.active &&
      (e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'KeyR' ||
        e.code === 'KeyF')
    ) {
      softAbortApproach()
      hud.setStatus('Approach aborted')
    }
  }
  window.addEventListener('keydown', onKeyDown)

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  let last = performance.now()
  const targetWorldPos = new THREE.Vector3()
  const prevTargetPos = new THREE.Vector3()
  const targetVel = new THREE.Vector3()
  const relUp = new THREE.Vector3()
  let hasPrevTarget = false

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    if (!pauseMenu.isOpen()) clock.update(dt)
    space.update(clock.day)
    targetLock.setTargets(toTargetBodies())

    targetLock.update(dt)
    targetGlow.update(dt, targetLock.current, camera)

    const wasApproaching = approach.active
    approach.update(dt)
    const arrived = approach.consumeArrival()
    if (arrived) {
      if (kiosk.active) {
        kiosk.notifyArrived(arrived)
      } else {
        hud.setStatus(`Arrived at ${arrived.name} — orbit hold`)
        orbitHold.start(arrived)
      }
    } else if (wasApproaching && !approach.active && !kiosk.active) {
      hud.setStatus(null)
    }

    kiosk.update(now)
    hud.setKioskCountdown(
      kiosk.active ? kiosk.msUntilNext(now) : null,
      kiosk.active ? kiosk.cycleLabel : null,
    )
    if (orbitHold.active) orbitHold.update(dt)

    if (localUp && targetLock.current) {
      targetLock.current.object.getWorldPosition(targetWorldPos)
      relUp.copy(camera.position).sub(targetWorldPos).normalize()
      flight.setReferenceUp(relUp)
    }

    if (!document.hidden) {
      if (!approach.active && !orbitHold.active && !picker.isOpen() && !pauseMenu.isOpen()) {
        flight.update(dt, { allowSteer: !targetLock.aiming })
      }
      space.followCamera(camera)
      space.solar.updateLod(camera)

      const sun = space.solar.getTargets().find((t) => t.id === 'sun')
      sunGlare.update(camera, sun?.object ?? null)

      hud.setSpeed(
        approach.active ? approach.speed : orbitHold.active ? 0 : flight.speed,
        scaleMode,
      )
      hud.setApproachProgress(approach.active ? approach.progress : null)
      // Same rumble for WASD and approach; kiosk stays very quiet
      if (pauseMenu.isOpen() || picker.isOpen() || orbitHold.active) {
        audio.setThrust(0)
      } else if (kiosk.active && approach.active) {
        audio.setThrust(0.12)
      } else if (approach.active) {
        audio.setThrust(0.4)
      } else if (kiosk.active) {
        audio.setThrust(0)
      } else {
        audio.setThrust(flight.thrustInput)
      }

      if (targetLock.current) {
        targetLock.current.object.getWorldPosition(targetWorldPos)
        const range = camera.position.distanceTo(targetWorldPos)
        hud.setTargetDistance(range, scaleMode)
        if (hasPrevTarget) {
          targetVel.copy(targetWorldPos).sub(prevTargetPos).multiplyScalar(1 / Math.max(dt, 1e-4))
          const shipSpeed = approach.active
            ? approach.speed
            : orbitHold.active
              ? targetVel.length()
              : flight.speed
          // Closing rate approximation: ship speed vs target motion magnitude
          const rel = Math.abs(shipSpeed - targetVel.length())
          hud.setRelativeSpeed(rel, scaleMode)
        } else {
          hud.setRelativeSpeed(0, scaleMode)
        }
        prevTargetPos.copy(targetWorldPos)
        hasPrevTarget = true
      } else {
        hud.setTargetDistance(null, scaleMode)
        hud.setRelativeSpeed(null, scaleMode)
        hasPrevTarget = false
      }

      if (labelsOn) {
        labels.update(
          camera,
          toTargetBodies().map((t) => ({
            id: t.id ?? t.name,
            name: t.name,
            object: t.object,
            radius: t.radius ?? 1,
          })),
          targetLock.current?.id ?? null,
          scaleMode,
        )
      }

      const ship = camera.position
      minimap.update({
        mode: scaleMode,
        ship: { x: ship.x, z: ship.z },
        targetId: targetLock.current?.id ?? null,
        bodies: space.solar.getTargets().map((t) => {
          const p = new THREE.Vector3()
          t.object.getWorldPosition(p)
          return { id: t.id, name: t.name, kind: t.kind, x: p.x, z: p.z }
        }),
      })

      hud.setTimeScale(clock.label())
      renderer.render(space.scene, camera)
    }
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('resize', onResize)
      flight.dispose()
      targetLock.dispose()
      targetGlow.dispose()
      sunGlare.dispose()
      audio.dispose()
      picker.dispose()
      labels.dispose()
      minimap.dispose()
      pauseMenu.dispose()
      renderer.dispose()
    })
  }
}

boot().catch((err) => {
  console.error(err)
  const app = document.querySelector('#app')
  if (app) {
    app.innerHTML = `<pre style="color:#f88;padding:2rem;font:14px/1.4 ui-monospace,monospace">Failed to start: ${String(err)}</pre>`
  }
})
