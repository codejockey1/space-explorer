import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

export type DeathStarSystem = {
  group: THREE.Group
}

function normalizeToRadius(root: THREE.Object3D, targetRadius: number) {
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.scale.set(1, 1, 1)
  root.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  root.position.sub(center)
  const currentRadius = Math.max(size.x, size.y, size.z) * 0.5 || 1
  root.scale.setScalar(targetRadius / currentRadius)
  root.updateMatrixWorld(true)
}

function polishMaterials(root: THREE.Object3D, anisotropy: number) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = false
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      const std = mat as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial) continue
      std.metalness = 0.12
      std.roughness = 0.92
      std.envMapIntensity = 0.25
      if (std.emissiveMap) {
        std.emissive = new THREE.Color(0x101214)
        std.emissiveIntensity = 0.15
      } else {
        std.emissive = new THREE.Color(0x000000)
        std.emissiveIntensity = 0
      }
      if (std.normalMap) std.normalScale.set(1.35, 1.35)
      if (std.aoMap) std.aoMapIntensity = 1.15
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) {
        const tex = std[key]
        if (!tex) continue
        tex.anisotropy = anisotropy
        tex.colorSpace = key === 'map' || key === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace
        tex.needsUpdate = true
      }
      std.needsUpdate = true
    }
  })
}

/** Loads DS-1 GLB normalized to radius 1; caller parents/scales/positions it. */
export async function createDeathStar(
  _textureLoader: THREE.TextureLoader,
  renderer: THREE.WebGLRenderer,
): Promise<DeathStarSystem> {
  const group = new THREE.Group()
  group.name = 'DeathStarModel'

  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy())
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  const gltf = await loader.loadAsync('/models/deathstar/death_star_4k.glb')
  const model = gltf.scene
  normalizeToRadius(model, 1)
  polishMaterials(model, anisotropy)
  group.add(model)

  return { group }
}
