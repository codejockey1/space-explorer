import * as THREE from 'three'
import { createSolarSystem, type SolarSystem } from '../solar/SolarSystem'
import { STARFIELD_COUNT, STARFIELD_RADIUS } from '../constants/scale'

export type SpaceScene = {
  scene: THREE.Scene
  solar: SolarSystem
  /** Keep sky/stars centered on the camera so they stay visible while flying. */
  followCamera: (camera: THREE.Camera) => void
  update: (day: number) => void
}

function createStarfield(): THREE.Points {
  const positions = new Float32Array(STARFIELD_COUNT * 3)
  const colors = new Float32Array(STARFIELD_COUNT * 3)

  for (let i = 0; i < STARFIELD_COUNT; i++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    // Thin shell at infinity — parallax-free when camera-followed
    const r = STARFIELD_RADIUS * (0.92 + Math.random() * 0.08)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

    const roll = Math.random()
    if (roll < 0.12) {
      colors[i * 3] = 0.75
      colors[i * 3 + 1] = 0.88
      colors[i * 3 + 2] = 1
    } else if (roll > 0.9) {
      colors[i * 3] = 1
      colors[i * 3 + 1] = 0.82
      colors[i * 3 + 2] = 0.55
    } else {
      const b = 0.55 + Math.random() * 0.45
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = b
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(200,220,255,0.35)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const sprite = new THREE.CanvasTexture(canvas)

  // Screen-space sizes so stars stay crisp at any travel distance
  const material = new THREE.PointsMaterial({
    size: 2.8,
    sizeAttenuation: false,
    vertexColors: true,
    map: sprite,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = -2
  return points
}

function createSky(textureLoader: THREE.TextureLoader): THREE.Mesh {
  const map = textureLoader.load('/textures/stars_milky_way.jpg')
  map.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({
    map,
    side: THREE.BackSide,
    depthWrite: false,
    // Lift milky-way so it reads against the black clear color while flying
    color: new THREE.Color(1.35, 1.35, 1.45),
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(STARFIELD_RADIUS * 1.15, 64, 48), mat)
  sky.renderOrder = -3
  sky.frustumCulled = false
  return sky
}

export async function createScene(
  textureLoader: THREE.TextureLoader,
  renderer: THREE.WebGLRenderer,
): Promise<SpaceScene> {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x010208)

  scene.add(new THREE.AmbientLight(0x445566, 0.55))
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x08060a, 0.35))

  const skyRig = new THREE.Group()
  skyRig.name = 'SkyRig'
  skyRig.add(createSky(textureLoader))
  skyRig.add(createStarfield())
  scene.add(skyRig)

  const solar = await createSolarSystem(textureLoader, renderer)
  scene.add(solar.root)
  solar.update(0)

  return {
    scene,
    solar,
    followCamera(camera: THREE.Camera) {
      skyRig.position.copy(camera.position)
    },
    update(day: number) {
      solar.update(day)
    },
  }
}
