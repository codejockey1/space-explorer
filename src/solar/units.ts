/** Scene unit conventions and dual-scale helpers. */

export const KM_PER_AU = 149_597_870.7
export const EARTH_RADIUS_KM = 6_371

/** True-scale: 1 scene unit = 1,000 km */
export const TRUE_KM_PER_UNIT = 1_000

/** Playable orbit scale: 1 AU ≈ this many scene units (after compression curve). */
export const PLAYABLE_AU_UNITS = 48

/** Minimum rendered radius in playable mode so tiny moons/sats stay visible. */
export const PLAYABLE_MIN_RADIUS = 0.035

export type ScaleMode = 'playable' | 'true'

export function kmToTrueUnits(km: number): number {
  return km / TRUE_KM_PER_UNIT
}

export function trueUnitsToKm(units: number): number {
  return units * TRUE_KM_PER_UNIT
}

/** Compress heliocentric radius for playable flying while preserving direction. */
export function compressOrbitRadiusKm(radiusKm: number): number {
  const au = Math.max(radiusKm / KM_PER_AU, 1e-9)
  // Mild power compression: Mercury→Neptune still ordered and flyable
  return Math.pow(au, 0.72) * PLAYABLE_AU_UNITS
}

export function bodyRadiusScene(radiusKm: number, mode: ScaleMode): number {
  if (mode === 'true') return Math.max(kmToTrueUnits(radiusKm), 0.0005)
  // Playable: exaggerate small bodies, keep giants readable vs orbits
  const trueR = kmToTrueUnits(radiusKm)
  const exaggerated = Math.pow(Math.max(trueR, 1e-6), 0.55) * 0.85
  return Math.max(exaggerated, PLAYABLE_MIN_RADIUS)
}
