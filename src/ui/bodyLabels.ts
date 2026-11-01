import * as THREE from 'three'
import type { ScaleMode } from '../solar/units'
import { KM_PER_AU, TRUE_KM_PER_UNIT } from '../solar/units'

export type LabelBody = {
  id: string
  name: string
  object: THREE.Object3D
  radius: number
}

function formatRange(distance: number, mode: ScaleMode): string {
  if (mode === 'true') {
    const km = distance * TRUE_KM_PER_UNIT
    const au = km / KM_PER_AU
    if (au >= 0.1) return `${au.toFixed(2)} AU`
    if (km >= 10_000) return `${(km / 1000).toFixed(0)}k km`
    return `${km.toFixed(0)} km`
  }
  return `${distance.toFixed(1)} u`
}

export type BodyLabels = {
  setVisible: (visible: boolean) => void
  update: (
    camera: THREE.Camera,
    bodies: LabelBody[],
    lockedId: string | null,
    mode: ScaleMode,
  ) => void
  dispose: () => void
}

export function createBodyLabels(parent: HTMLElement): BodyLabels {
  const root = document.createElement('div')
  root.id = 'body-labels'
  parent.appendChild(root)
  const nodes = new Map<string, HTMLDivElement>()
  const world = new THREE.Vector3()
  const ndc = new THREE.Vector3()
  let visible = true

  const ensure = (id: string) => {
    let el = nodes.get(id)
    if (el) return el
    el = document.createElement('div')
    el.className = 'body-label'
    el.innerHTML = `<span class="body-label-name"></span><span class="body-label-range"></span>`
    root.appendChild(el)
    nodes.set(id, el)
    return el
  }

  return {
    setVisible(next: boolean) {
      visible = next
      root.hidden = !next
      if (!next) {
        for (const el of nodes.values()) el.hidden = true
      }
    },
    update(camera, bodies, lockedId, mode) {
      if (!visible) {
        root.hidden = true
        return
      }
      root.hidden = false
      const seen = new Set<string>()
      for (const body of bodies) {
        body.object.getWorldPosition(world)
        const dist = camera.position.distanceTo(world)
        const angular = body.radius / Math.max(dist, 1e-3)
        const isLocked = body.id === lockedId
        // Show locked always (if on screen), others when reasonably near/large
        if (!isLocked && angular < 0.004 && dist > body.radius * 40) continue

        ndc.copy(world).project(camera)
        if (ndc.z > 1 || ndc.x < -1.15 || ndc.x > 1.15 || ndc.y < -1.15 || ndc.y > 1.15) {
          continue
        }

        const el = ensure(body.id)
        seen.add(body.id)
        el.classList.toggle('locked', isLocked)
        ;(el.querySelector('.body-label-name') as HTMLElement).textContent = body.name
        ;(el.querySelector('.body-label-range') as HTMLElement).textContent = formatRange(dist, mode)
        const x = (ndc.x * 0.5 + 0.5) * window.innerWidth
        const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight
        el.style.transform = `translate(-50%, -120%) translate(${x}px, ${y}px)`
        el.hidden = false
      }
      for (const [id, el] of nodes) {
        if (!seen.has(id)) el.hidden = true
      }
    },
    dispose() {
      root.remove()
      nodes.clear()
    },
  }
}
