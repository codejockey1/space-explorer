import * as THREE from 'three'
import type { BodyDef } from './catalog'
import { createCraftModel } from '../bodies/craftModels'

const textureCache = new Map<string, THREE.Texture>()

function loadTexture(loader: THREE.TextureLoader, url: string, anisotropy: number): THREE.Texture {
  let tex = textureCache.get(url)
  if (tex) return tex
  tex = loader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  textureCache.set(url, tex)
  return tex
}

function atmosphereMesh(id: string, color: number, scale: number, intensity: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      void main() {
        float rim = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
        gl_FragColor = vec4(glowColor, clamp(rim * intensity, 0.0, 0.85));
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(scale, 48, 32), mat)
  mesh.name = `${id}_atmosphere`
  return mesh
}

/** Procedural ring alpha with Cassini Division dip. */
function makeSaturnRingTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 4
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1)
    // Cassini Division ~0.55–0.62 of A–B span in our simplified UV
    const inCassini = t > 0.52 && t < 0.6
    const band = 0.55 + 0.45 * Math.sin(t * Math.PI * 18) ** 2
    const a = inCassini ? 0.05 : Math.pow(band, 0.8) * (0.35 + 0.65 * (1 - Math.abs(t - 0.45)))
    const r = 210 + (inCassini ? 0 : 20)
    const g = 190 + (inCassini ? 0 : 15)
    const b = 150
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = Math.floor(THREE.MathUtils.clamp(a, 0, 1) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

export type BodyMesh = {
  root: THREE.Group
  spin: THREE.Object3D
  def: BodyDef
  /** Optional far-field impostor sprite */
  impostor?: THREE.Sprite
}

export function createBodyMesh(
  def: BodyDef,
  loader: THREE.TextureLoader,
  anisotropy: number,
): BodyMesh {
  const root = new THREE.Group()
  root.name = def.id
  const spin = new THREE.Group()
  spin.name = `${def.id}_spin`
  root.add(spin)

  if (def.axialTiltDeg) {
    spin.rotation.z = THREE.MathUtils.degToRad(def.axialTiltDeg)
  }

  if (def.craft) {
    const model = createCraftModel(def.id)
    spin.add(model)
    return { root, spin, def }
  }

  const segments = def.kind === 'star' || def.kind === 'planet' ? 64 : 32
  const geometry = new THREE.SphereGeometry(1, segments, Math.max(12, segments / 2))

  let material: THREE.Material
  if (def.kind === 'star') {
    const map = def.texture ? loadTexture(loader, def.texture, anisotropy) : null
    material = new THREE.MeshBasicMaterial({
      map,
      color: map ? 0xffffff : def.emissive ?? 0xffcc66,
    })
  } else {
    const map = def.texture ? loadTexture(loader, def.texture, anisotropy) : null
    const mat = new THREE.MeshStandardMaterial({
      map,
      color: map ? 0xffffff : def.color ?? 0x888888,
      roughness: 0.85,
      metalness: 0.05,
      emissive: def.emissive ? new THREE.Color(def.emissive) : new THREE.Color(0x111111),
      emissiveIntensity: def.emissive ? 0.35 : 0.04,
    })
    if (def.id === 'earth') {
      const night = loadTexture(loader, '/textures/solar/earth_night.jpg', anisotropy)
      mat.emissiveMap = night
      mat.emissive = new THREE.Color(0xffffff)
      mat.emissiveIntensity = 0.85
    }
    material = mat
  }

  const globe = new THREE.Mesh(geometry, material)
  globe.name = `${def.id}_globe`
  spin.add(globe)

  if (def.cloudTexture) {
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, segments, Math.max(12, segments / 2)),
      new THREE.MeshStandardMaterial({
        map: loadTexture(loader, def.cloudTexture, anisotropy),
        transparent: true,
        opacity: def.id === 'venus' ? 0.85 : 0.45,
        depthWrite: false,
        roughness: 1,
      }),
    )
    clouds.name = `${def.id}_clouds`
    spin.add(clouds)
  }

  if (def.id === 'earth') spin.add(atmosphereMesh('earth', 0x4ea0ff, 1.045, 1.35))
  if (def.id === 'venus') spin.add(atmosphereMesh('venus', 0xe8c878, 1.06, 1.1))
  if (def.id === 'titan') spin.add(atmosphereMesh('titan', 0xd4a060, 1.08, 1.0))

  if (def.ring) {
    const ringMap =
      def.id === 'saturn'
        ? makeSaturnRingTexture()
        : def.ringTexture
          ? loadTexture(loader, def.ringTexture, anisotropy)
          : makeSaturnRingTexture()
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(def.ring.inner, def.ring.outer, 192),
      new THREE.MeshBasicMaterial({
        map: ringMap,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    )
    ring.rotation.x = Math.PI / 2
    ring.name = `${def.id}_ring`
    spin.add(ring)
  }

  if (def.kind === 'comet') {
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 4, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    tail.position.z = 2.2
    tail.rotation.x = Math.PI / 2
    spin.add(tail)
  }

  // Far impostor — soft disc matching average color
  let impostor: THREE.Sprite | undefined
  if (def.kind === 'planet' || def.kind === 'moon' || def.kind === 'dwarf') {
    const approx: Record<string, number> = {
      mercury: 0x9a9590,
      venus: 0xc8b890,
      earth: 0x3a6ea5,
      mars: 0xc1440e,
      jupiter: 0xc4a070,
      saturn: 0xe0c898,
      uranus: 0x9ad0d8,
      neptune: 0x3a64d8,
      moon: 0xb0b0b0,
      titan: 0xc8a050,
      io: 0xe8d060,
      europa: 0xc8c0b0,
      ganymede: 0xa09080,
      callisto: 0x6a6058,
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    const c = new THREE.Color(def.color ?? approx[def.id] ?? 0x8899aa)
    g.addColorStop(0, `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`)
    g.addColorStop(0.55, `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(canvas)
    impostor = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    )
    impostor.name = `${def.id}_impostor`
    impostor.visible = false
    root.add(impostor)
  }

  return { root, spin, def, impostor }
}
