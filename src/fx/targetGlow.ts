import * as THREE from 'three'
import type { TargetBody } from '../controls/targetLock'

function createGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size * 0.5
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  // Neutral white falloff — tint comes from SpriteMaterial.color
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.88)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.38)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Sample a downscaled average RGB from a loaded texture image. */
function sampleImageAverage(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
): THREE.Color {
  const w = 24
  const h = 24
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return new THREE.Color(0xb0c4de)
  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0, w, h)
  } catch {
    return new THREE.Color(0xb0c4de)
  }
  const data = ctx.getImageData(0, 0, w, h).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue
    // Skip near-black space/padding so dark maps don't crush the tint
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
    if (lum < 12) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  if (n === 0) return new THREE.Color(0x9aa8b8)
  return new THREE.Color(r / (n * 255), g / (n * 255), b / (n * 255))
}

function isImageReady(image: unknown): image is HTMLImageElement | HTMLCanvasElement | ImageBitmap {
  if (!image) return false
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) return true
  if (image instanceof HTMLCanvasElement) return true
  if (image instanceof HTMLImageElement) return image.complete && image.naturalWidth > 0
  return false
}

/** Lift / saturate so additive glow stays readable against space. */
function liftForGlow(src: THREE.Color, out: THREE.Color): THREE.Color {
  out.copy(src)
  const hsl = { h: 0, s: 0, l: 0 }
  out.getHSL(hsl)
  hsl.s = Math.min(1, hsl.s * 1.4 + 0.14)
  hsl.l = THREE.MathUtils.clamp(hsl.l * 0.7 + 0.45, 0.48, 0.8)
  out.setHSL(hsl.h, hsl.s, hsl.l)
  return out
}

function resolveBodyColor(object: THREE.Object3D, fallback: THREE.Color): THREE.Color {
  let fromMap: THREE.Color | null = null
  let fromMat: THREE.Color | null = null

  object.traverse((obj) => {
    if (fromMap) return
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat) continue
      const std = mat as THREE.MeshStandardMaterial
      if (std.map?.image && isImageReady(std.map.image)) {
        fromMap = sampleImageAverage(std.map.image)
        return
      }
      const basic = mat as THREE.MeshBasicMaterial
      if (basic.map?.image && isImageReady(basic.map.image)) {
        fromMap = sampleImageAverage(basic.map.image)
        return
      }
      if (!fromMat && 'color' in mat && (mat as THREE.MeshBasicMaterial).color) {
        fromMat = (mat as THREE.MeshBasicMaterial).color.clone()
      }
    }
  })

  return fromMap ?? fromMat ?? fallback
}

export type TargetGlow = {
  update: (dt: number, target: TargetBody | null, camera: THREE.Camera) => void
  dispose: () => void
}

/**
 * Soft throbbing beacon on the locked target so it stays readable at any distance.
 */
export function createTargetGlow(scene: THREE.Scene): TargetGlow {
  const texture = createGlowTexture()
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: new THREE.Color(0xc4e0ff),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'TargetGlow'
  sprite.visible = false
  sprite.frustumCulled = false
  sprite.renderOrder = 10
  scene.add(sprite)

  const worldPos = new THREE.Vector3()
  const tint = new THREE.Color(0xc4e0ff)
  const scratch = new THREE.Color()
  const colorCache = new Map<string, THREE.Color>()
  let pulse = 0
  let lastId: string | null = null

  const applyTint = (target: TargetBody) => {
    const id = target.id ?? target.name
    const cached = colorCache.get(id)
    if (cached) {
      material.color.copy(cached)
      return
    }
    const raw = resolveBodyColor(target.object, scratch.set(0xb0c4de))
    // Only cache once a texture-backed sample is available (or solid-color mat)
    let hasMap = false
    target.object.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial
        if (m?.map?.image && isImageReady(m.map.image)) hasMap = true
      }
    })
    liftForGlow(raw, tint)
    material.color.copy(tint)
    if (hasMap || !usesPendingTexture(target.object)) {
      colorCache.set(id, tint.clone())
    }
  }

  return {
    update(dt, target, camera) {
      if (!target) {
        sprite.visible = false
        lastId = null
        return
      }

      const id = target.id ?? target.name
      if (id !== lastId) {
        lastId = id
        applyTint(target)
      } else if (!colorCache.has(id)) {
        // Texture may finish loading after lock — keep trying
        applyTint(target)
      }

      target.object.getWorldPosition(worldPos)
      sprite.position.copy(worldPos)

      const dist = Math.max(camera.position.distanceTo(worldPos), 0.01)
      const radius = Math.max(target.radius ?? 0.05, 0.02)
      const arriveAt = radius * 7
      const farAt = arriveAt * 2.8
      const presence = THREE.MathUtils.smoothstep(dist, arriveAt, farAt)
      if (presence <= 0.02) {
        sprite.visible = false
        return
      }

      pulse += dt * 2.1
      const throb = 0.5 + 0.5 * Math.sin(pulse)
      material.opacity = (0.5 + throb * 0.45) * presence
      const pulseScale = 0.92 + throb * 0.28

      // ~4° minimum on-screen size so distant locks stay obvious
      const minAngular = 0.07
      const bodyAngular = (radius * 2.5) / dist
      const angular = Math.max(bodyAngular, minAngular)
      const size = dist * angular * pulseScale
      sprite.scale.set(size, size, 1)
      sprite.visible = true
    },
    dispose() {
      scene.remove(sprite)
      material.dispose()
      texture.dispose()
      colorCache.clear()
    },
  }
}

function usesPendingTexture(object: THREE.Object3D): boolean {
  let pending = false
  object.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial
      if (m?.map && !isImageReady(m.map.image)) pending = true
    }
  })
  return pending
}
