import * as THREE from 'three'

function glareTexture(): THREE.CanvasTexture {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,250,230,1)')
  g.addColorStop(0.2, 'rgba(255,220,150,0.7)')
  g.addColorStop(0.55, 'rgba(255,180,80,0.2)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export type SunGlare = {
  update: (camera: THREE.Camera, sun: THREE.Object3D | null) => void
  dispose: () => void
}

export function createSunGlare(scene: THREE.Scene): SunGlare {
  const tex = glareTexture()
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xffe6b0,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 20
  sprite.frustumCulled = false
  sprite.visible = false
  scene.add(sprite)

  const sunPos = new THREE.Vector3()
  const camDir = new THREE.Vector3()
  const toSun = new THREE.Vector3()

  return {
    update(camera, sun) {
      if (!sun) {
        sprite.visible = false
        return
      }
      sun.getWorldPosition(sunPos)
      camera.getWorldDirection(camDir)
      toSun.copy(sunPos).sub(camera.position)
      const dist = toSun.length()
      if (dist < 1e-3) {
        sprite.visible = false
        return
      }
      toSun.multiplyScalar(1 / dist)
      const align = camDir.dot(toSun) // 1 = looking at sun
      const strength = THREE.MathUtils.smoothstep(align, 0.82, 0.995)
      if (strength <= 0.01) {
        sprite.visible = false
        return
      }
      // Place glare on screen along sun direction, just in front of camera
      sprite.position.copy(camera.position).addScaledVector(toSun, Math.min(dist * 0.5, 80))
      const size = 12 + strength * 55
      sprite.scale.set(size, size, 1)
      mat.opacity = strength * 0.85
      sprite.visible = true
    },
    dispose() {
      scene.remove(sprite)
      mat.dispose()
      tex.dispose()
    },
  }
}
