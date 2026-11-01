import * as THREE from 'three'

const lookMatrix = new THREE.Matrix4()

/**
 * Quaternion that aims a Camera (looks down -Z) from `eye` toward `target`.
 * Do not use Object3D.lookAt for this — mesh lookAt is inverted vs cameras.
 */
export function cameraLookQuaternion(
  out: THREE.Quaternion,
  eye: THREE.Vector3,
  target: THREE.Vector3,
  up: THREE.Vector3,
): THREE.Quaternion {
  lookMatrix.lookAt(eye, target, up)
  return out.setFromRotationMatrix(lookMatrix)
}
