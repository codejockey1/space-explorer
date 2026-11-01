import * as THREE from 'three'
import { EARTH_POSITION, MOON_POSITION, MOON_RADIUS } from '../constants/scale'

export type MoonSystem = {
  group: THREE.Group
  update: () => void
}

export function createMoon(textureLoader: THREE.TextureLoader): MoonSystem {
  const group = new THREE.Group()
  group.name = 'Moon'
  group.position.set(MOON_POSITION.x, MOON_POSITION.y, MOON_POSITION.z)

  const map = textureLoader.load('/textures/moon.jpg')
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 16

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS, 80, 56),
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.95,
      metalness: 0,
      emissive: new THREE.Color(0x222222),
      emissiveIntensity: 0.06,
    }),
  )
  mesh.name = 'MoonGlobe'
  group.add(mesh)

  const earth = new THREE.Vector3(EARTH_POSITION.x, EARTH_POSITION.y, EARTH_POSITION.z)

  return {
    group,
    update() {
      // Tidally locked: near side faces Earth
      group.lookAt(earth)
    },
  }
}
