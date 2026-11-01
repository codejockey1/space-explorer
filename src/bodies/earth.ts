import * as THREE from 'three'
import { EARTH_POSITION, EARTH_RADIUS } from '../constants/scale'

export type EarthSystem = {
  group: THREE.Group
  update: (dt: number) => void
}

export function createEarth(textureLoader: THREE.TextureLoader): EarthSystem {
  const group = new THREE.Group()
  group.name = 'Earth'
  group.position.set(EARTH_POSITION.x, EARTH_POSITION.y, EARTH_POSITION.z)

  const maxAniso = 16
  const dayMap = textureLoader.load('/textures/earth_daymap.jpg')
  dayMap.colorSpace = THREE.SRGBColorSpace
  dayMap.anisotropy = maxAniso

  const specularMap = textureLoader.load('/textures/earth_specular.jpg')
  specularMap.anisotropy = maxAniso

  const cloudMap = textureLoader.load('/textures/earth_clouds.jpg')
  cloudMap.colorSpace = THREE.SRGBColorSpace
  cloudMap.anisotropy = maxAniso

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 96, 64),
    new THREE.MeshStandardMaterial({
      map: dayMap,
      roughnessMap: specularMap,
      roughness: 0.75,
      metalness: 0.05,
      emissive: new THREE.Color(0x112233),
      emissiveIntensity: 0.08,
    }),
  )
  globe.name = 'EarthGlobe'

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 96, 64),
    new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  )
  clouds.name = 'EarthClouds'

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 48),
    new THREE.MeshBasicMaterial({
      color: 0x6ecbff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )

  group.add(globe, clouds, atmosphere)

  return {
    group,
    update(dt: number) {
      globe.rotation.y += dt * 0.03
      clouds.rotation.y += dt * 0.038
    },
  }
}
