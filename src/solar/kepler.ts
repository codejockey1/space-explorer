import * as THREE from 'three'
import { KM_PER_AU } from './units'

/** Classical orbital elements. Angles in radians; a in AU (heliocentric) or km (local). */
export type KeplerElements = {
  /** Semi-major axis */
  a: number
  /** Eccentricity */
  e: number
  /** Inclination */
  i: number
  /** Longitude of ascending node */
  Omega: number
  /** Argument of periapsis */
  omega: number
  /** Mean anomaly at epoch (J2000) */
  M0: number
  /** Mean motion (rad / day). If omitted, derived from a assuming solar GM for AU orbits. */
  n?: number
  /** Units for `a`: heliocentric AU or kilometers around a parent */
  aUnit: 'au' | 'km'
}

const TWO_PI = Math.PI * 2
/** Solar μ for n derivation: 2π / period_years / 365.25 — use Kepler's law n = 0.01720209895 / a^(3/2) rad/day (Gaussian). */
const GAUSS_K = 0.01720209895

export function meanMotionRadPerDay(el: KeplerElements): number {
  if (el.n != null) return el.n
  if (el.aUnit === 'au') {
    return GAUSS_K / Math.pow(Math.max(el.a, 1e-6), 1.5)
  }
  // Local orbits: approximate circular n from period if provided via n only
  return el.n ?? 0.1
}

/** Solve Kepler's equation M = E - e sin E for eccentric anomaly. */
export function solveEccentricAnomaly(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-8) break
  }
  return E
}

/** Position relative to the orbit focus (parent), in kilometers, at mean anomaly M. */
export function keplerPositionAtMeanAnomaly(
  el: KeplerElements,
  M: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  let m = M % TWO_PI
  if (m < 0) m += TWO_PI

  const E = solveEccentricAnomaly(m, el.e)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  const aKm = el.aUnit === 'au' ? el.a * KM_PER_AU : el.a
  const xv = aKm * (cosE - el.e)
  const yv = aKm * Math.sqrt(1 - el.e * el.e) * sinE

  // Rotate from perifocal to parent equatorial / ecliptic frame
  const cosO = Math.cos(el.Omega)
  const sinO = Math.sin(el.Omega)
  const cosw = Math.cos(el.omega)
  const sinw = Math.sin(el.omega)
  const cosi = Math.cos(el.i)
  const sini = Math.sin(el.i)

  const x =
    (cosO * cosw - sinO * sinw * cosi) * xv + (-cosO * sinw - sinO * cosw * cosi) * yv
  const y =
    (sinO * cosw + cosO * sinw * cosi) * xv + (-sinO * sinw + cosO * cosw * cosi) * yv
  const z = sinw * sini * xv + cosw * sini * yv

  return out.set(x, z, -y) // map ecliptic Y-up-ish → Three Y-up (swap y/z, flip)
}

/**
 * Position relative to the orbit focus (parent), in kilometers.
 * `day` = days since J2000.0
 */
export function keplerPositionKm(el: KeplerElements, day: number, out = new THREE.Vector3()): THREE.Vector3 {
  const n = meanMotionRadPerDay(el)
  let M = (el.M0 + n * day) % TWO_PI
  if (M < 0) M += TWO_PI
  return keplerPositionAtMeanAnomaly(el, M, out)
}

export function rotationAngleRad(dayLengthHours: number, day: number, offset = 0): number {
  if (!Number.isFinite(dayLengthHours) || Math.abs(dayLengthHours) < 1e-6) return offset
  const turns = (day * 24) / dayLengthHours
  return offset + turns * TWO_PI
}

/** Julian days since J2000.0 for a JS Date. */
export function daysSinceJ2000(date: Date): number {
  // J2000.0 = 2000-01-01 12:00 TT ≈ 2000-01-01 12:00 UTC for our purposes
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
  return (date.getTime() - j2000) / 86_400_000
}
