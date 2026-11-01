import type { KeplerElements } from './kepler'

export type BodyKind =
  | 'star'
  | 'planet'
  | 'dwarf'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'satellite'
  | 'fictional'

export type BodyDef = {
  id: string
  name: string
  kind: BodyKind
  /** Parent body id; omit / 'sun' for heliocentric */
  parent?: string
  radiusKm: number
  /** Sidereal rotation period in hours (negative = retrograde) */
  dayHours: number
  axialTiltDeg?: number
  orbit?: KeplerElements
  /** Texture path under /textures/solar, or solid color fallback */
  texture?: string
  cloudTexture?: string
  ringTexture?: string
  /** Ring inner/outer in body radii */
  ring?: { inner: number; outer: number }
  color?: number
  emissive?: number
  /** Artificial / small craft scale exaggeration in true mode display only handled in mesh factory */
  craft?: boolean
}

const deg = (d: number) => (d * Math.PI) / 180

/**
 * Curated solar-system catalog (approx J2000 mean elements).
 * Orbits are good enough for visualization, not navigation-grade ephemerides.
 */
export const SOLAR_CATALOG: BodyDef[] = [
  // —— Star ——
  {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    radiusKm: 695_700,
    dayHours: 609.12,
    texture: '/textures/solar/sun.jpg',
    emissive: 0xffcc66,
  },

  // —— Planets ——
  {
    id: 'mercury',
    name: 'Mercury',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 2_439.7,
    dayHours: 1407.6,
    axialTiltDeg: 0.034,
    texture: '/textures/solar/mercury.jpg',
    orbit: { a: 0.387098, e: 0.20563, i: deg(7.005), Omega: deg(48.331), omega: deg(29.124), M0: deg(174.796), aUnit: 'au' },
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 6_051.8,
    dayHours: -5832.6,
    axialTiltDeg: 177.4,
    texture: '/textures/solar/venus.jpg',
    cloudTexture: '/textures/solar/venus_atmosphere.jpg',
    orbit: { a: 0.723332, e: 0.006772, i: deg(3.39458), Omega: deg(76.68), omega: deg(54.884), M0: deg(50.115), aUnit: 'au' },
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 6_371,
    dayHours: 23.934,
    axialTiltDeg: 23.44,
    texture: '/textures/solar/earth.jpg',
    cloudTexture: '/textures/solar/earth_clouds.jpg',
    orbit: { a: 1.000001, e: 0.016708, i: deg(0.00005), Omega: deg(-11.26), omega: deg(114.21), M0: deg(358.617), aUnit: 'au' },
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 3_389.5,
    dayHours: 24.622,
    axialTiltDeg: 25.19,
    texture: '/textures/solar/mars.jpg',
    orbit: { a: 1.523679, e: 0.0934, i: deg(1.85), Omega: deg(49.558), omega: deg(286.502), M0: deg(19.373), aUnit: 'au' },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 69_911,
    dayHours: 9.925,
    axialTiltDeg: 3.13,
    texture: '/textures/solar/jupiter.jpg',
    orbit: { a: 5.2044, e: 0.0489, i: deg(1.303), Omega: deg(100.464), omega: deg(273.867), M0: deg(20.02), aUnit: 'au' },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 58_232,
    dayHours: 10.55,
    axialTiltDeg: 26.73,
    texture: '/textures/solar/saturn.jpg',
    ringTexture: '/textures/solar/saturn_ring.png',
    ring: { inner: 1.2, outer: 2.3 },
    orbit: { a: 9.5826, e: 0.0565, i: deg(2.485), Omega: deg(113.665), omega: deg(339.392), M0: deg(317.02), aUnit: 'au' },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 25_362,
    dayHours: -17.24,
    axialTiltDeg: 97.77,
    texture: '/textures/solar/uranus.jpg',
    orbit: { a: 19.2184, e: 0.0463, i: deg(0.773), Omega: deg(74.006), omega: deg(96.998), M0: deg(142.24), aUnit: 'au' },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    kind: 'planet',
    parent: 'sun',
    radiusKm: 24_622,
    dayHours: 16.11,
    axialTiltDeg: 28.32,
    texture: '/textures/solar/neptune.jpg',
    orbit: { a: 30.1104, e: 0.0095, i: deg(1.768), Omega: deg(131.784), omega: deg(273.187), M0: deg(256.23), aUnit: 'au' },
  },

  // —— Dwarf planets ——
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    parent: 'sun',
    radiusKm: 1_188.3,
    dayHours: -153.29,
    axialTiltDeg: 122.5,
    texture: '/textures/solar/moons/pluto.jpg',
    orbit: { a: 39.482, e: 0.2488, i: deg(17.16), Omega: deg(110.3), omega: deg(113.8), M0: deg(14.53), aUnit: 'au' },
  },
  {
    id: 'ceres',
    name: 'Ceres',
    kind: 'dwarf',
    parent: 'sun',
    radiusKm: 469.7,
    dayHours: 9.074,
    texture: '/textures/solar/ceres.jpg',
    orbit: { a: 2.7675, e: 0.0758, i: deg(10.59), Omega: deg(80.3), omega: deg(73.6), M0: deg(95.99), aUnit: 'au' },
  },
  {
    id: 'eris',
    name: 'Eris',
    kind: 'dwarf',
    parent: 'sun',
    radiusKm: 1_163,
    dayHours: 25.9,
    color: 0xd8d4cc,
    orbit: { a: 67.864, e: 0.4407, i: deg(44.04), Omega: deg(35.95), omega: deg(151.64), M0: deg(204.16), aUnit: 'au' },
  },
  {
    id: 'haumea',
    name: 'Haumea',
    kind: 'dwarf',
    parent: 'sun',
    radiusKm: 780,
    dayHours: 3.915,
    texture: '/textures/solar/haumea.jpg',
    orbit: { a: 43.116, e: 0.1913, i: deg(28.21), Omega: deg(121.9), omega: deg(239.3), M0: deg(218.2), aUnit: 'au' },
  },
  {
    id: 'makemake',
    name: 'Makemake',
    kind: 'dwarf',
    parent: 'sun',
    radiusKm: 715,
    dayHours: 22.83,
    color: 0xe0c0a0,
    orbit: { a: 45.079, e: 0.1596, i: deg(28.98), Omega: deg(79.3), omega: deg(297.2), M0: deg(165.0), aUnit: 'au' },
  },

  // —— Asteroids / comet ——
  {
    id: 'vesta',
    name: 'Vesta',
    kind: 'asteroid',
    parent: 'sun',
    radiusKm: 262.7,
    dayHours: 5.342,
    color: 0x9a8f7f,
    orbit: { a: 2.3617, e: 0.0887, i: deg(7.14), Omega: deg(103.85), omega: deg(151.2), M0: deg(278.5), aUnit: 'au' },
  },
  {
    id: 'eros',
    name: 'Eros',
    kind: 'asteroid',
    parent: 'sun',
    radiusKm: 8.42,
    dayHours: 5.27,
    color: 0xb08a6a,
    orbit: { a: 1.458, e: 0.2227, i: deg(10.83), Omega: deg(304.3), omega: deg(178.8), M0: deg(320.6), aUnit: 'au' },
  },
  {
    id: 'halley',
    name: "Halley's Comet",
    kind: 'comet',
    parent: 'sun',
    radiusKm: 5.5,
    dayHours: 52.8,
    color: 0xaaccff,
    emissive: 0x6688aa,
    orbit: { a: 17.834, e: 0.9671, i: deg(162.26), Omega: deg(58.42), omega: deg(111.33), M0: deg(38.38), aUnit: 'au' },
  },

  // —— Earth system ——
  {
    id: 'moon',
    name: 'Moon',
    kind: 'moon',
    parent: 'earth',
    radiusKm: 1_737.4,
    dayHours: 655.72,
    texture: '/textures/solar/moon.jpg',
    orbit: { a: 384_399, e: 0.0549, i: deg(5.145), Omega: deg(125.08), omega: deg(318.15), M0: deg(135.27), n: (2 * Math.PI) / 27.321661, aUnit: 'km' },
  },
  {
    id: 'deathstar',
    name: 'Death Star',
    kind: 'fictional',
    parent: 'earth',
    radiusKm: 80, // ~DS-1 radius; parked, not ephemeris-based
    dayHours: 24,
    color: 0x888888,
  },

  // —— Mars moons ——
  {
    id: 'phobos',
    name: 'Phobos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 11.27,
    dayHours: 7.66,
    texture: '/textures/solar/moons/phobos.jpg',
    orbit: { a: 9_376, e: 0.0151, i: deg(1.093), Omega: deg(0), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 0.31891, aUnit: 'km' },
  },
  {
    id: 'deimos',
    name: 'Deimos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 6.2,
    dayHours: 30.3,
    texture: '/textures/solar/moons/deimos.jpg',
    orbit: { a: 23_463, e: 0.00033, i: deg(0.93), Omega: deg(0), omega: deg(0), M0: deg(90), n: (2 * Math.PI) / 1.263, aUnit: 'km' },
  },

  // —— Galilean moons ——
  {
    id: 'io',
    name: 'Io',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1_821.6,
    dayHours: 42.46,
    texture: '/textures/solar/moons/io.jpg',
    orbit: { a: 421_700, e: 0.0041, i: deg(0.05), Omega: deg(0), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 1.769, aUnit: 'km' },
  },
  {
    id: 'europa',
    name: 'Europa',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1_560.8,
    dayHours: 85.22,
    texture: '/textures/solar/moons/europa.jpg',
    orbit: { a: 671_034, e: 0.009, i: deg(0.47), Omega: deg(0), omega: deg(0), M0: deg(60), n: (2 * Math.PI) / 3.551, aUnit: 'km' },
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2_634.1,
    dayHours: 171.71,
    texture: '/textures/solar/moons/ganymede.jpg',
    orbit: { a: 1_070_412, e: 0.0013, i: deg(0.2), Omega: deg(0), omega: deg(0), M0: deg(120), n: (2 * Math.PI) / 7.155, aUnit: 'km' },
  },
  {
    id: 'callisto',
    name: 'Callisto',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2_410.3,
    dayHours: 400.54,
    texture: '/textures/solar/moons/callisto.jpg',
    orbit: { a: 1_882_709, e: 0.0074, i: deg(0.28), Omega: deg(0), omega: deg(0), M0: deg(180), n: (2 * Math.PI) / 16.69, aUnit: 'km' },
  },

  // —— Saturn major moons ——
  {
    id: 'mimas',
    name: 'Mimas',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 198.2,
    dayHours: 22.6,
    texture: '/textures/solar/moons/mimas.jpg',
    orbit: { a: 185_539, e: 0.0196, i: deg(1.57), Omega: deg(0), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 0.942, aUnit: 'km' },
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 252.1,
    dayHours: 32.9,
    texture: '/textures/solar/moons/enceladus.jpg',
    orbit: { a: 237_948, e: 0.0047, i: deg(0.02), Omega: deg(0), omega: deg(0), M0: deg(40), n: (2 * Math.PI) / 1.37, aUnit: 'km' },
  },
  {
    id: 'tethys',
    name: 'Tethys',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 531.1,
    dayHours: 45.3,
    texture: '/textures/solar/moons/tethys.jpg',
    orbit: { a: 294_619, e: 0.0001, i: deg(1.12), Omega: deg(0), omega: deg(0), M0: deg(80), n: (2 * Math.PI) / 1.888, aUnit: 'km' },
  },
  {
    id: 'dione',
    name: 'Dione',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 561.4,
    dayHours: 65.7,
    texture: '/textures/solar/moons/dione.jpg',
    orbit: { a: 377_396, e: 0.0022, i: deg(0.02), Omega: deg(0), omega: deg(0), M0: deg(120), n: (2 * Math.PI) / 2.737, aUnit: 'km' },
  },
  {
    id: 'rhea',
    name: 'Rhea',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 763.8,
    dayHours: 108.4,
    texture: '/textures/solar/moons/rhea.jpg',
    orbit: { a: 527_108, e: 0.001, i: deg(0.35), Omega: deg(0), omega: deg(0), M0: deg(160), n: (2 * Math.PI) / 4.518, aUnit: 'km' },
  },
  {
    id: 'titan',
    name: 'Titan',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 2_574.7,
    dayHours: 382.7,
    texture: '/textures/solar/moons/titan.jpg',
    orbit: { a: 1_221_870, e: 0.0288, i: deg(0.35), Omega: deg(0), omega: deg(0), M0: deg(200), n: (2 * Math.PI) / 15.945, aUnit: 'km' },
  },
  {
    id: 'iapetus',
    name: 'Iapetus',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 734.5,
    dayHours: 1903.9,
    texture: '/textures/solar/moons/iapetus.jpg',
    orbit: { a: 3_560_820, e: 0.0283, i: deg(15.47), Omega: deg(0), omega: deg(0), M0: deg(240), n: (2 * Math.PI) / 79.32, aUnit: 'km' },
  },

  // —— Uranus moons (major) ——
  {
    id: 'miranda',
    name: 'Miranda',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 235.8,
    dayHours: 33.9,
    texture: '/textures/solar/moons/miranda.jpg',
    orbit: { a: 129_390, e: 0.0013, i: deg(4.34), Omega: deg(0), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 1.413, aUnit: 'km' },
  },
  {
    id: 'ariel',
    name: 'Ariel',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 578.9,
    dayHours: 60.5,
    texture: '/textures/solar/moons/ariel.jpg',
    orbit: { a: 191_020, e: 0.0012, i: deg(0.26), Omega: deg(0), omega: deg(0), M0: deg(50), n: (2 * Math.PI) / 2.52, aUnit: 'km' },
  },
  {
    id: 'umbriel',
    name: 'Umbriel',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 584.7,
    dayHours: 99.5,
    texture: '/textures/solar/moons/umbriel.jpg',
    orbit: { a: 266_000, e: 0.0039, i: deg(0.13), Omega: deg(0), omega: deg(0), M0: deg(100), n: (2 * Math.PI) / 4.144, aUnit: 'km' },
  },
  {
    id: 'titania',
    name: 'Titania',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 788.9,
    dayHours: 208.7,
    texture: '/textures/solar/moons/titania.jpg',
    orbit: { a: 435_910, e: 0.0011, i: deg(0.08), Omega: deg(0), omega: deg(0), M0: deg(150), n: (2 * Math.PI) / 8.706, aUnit: 'km' },
  },
  {
    id: 'oberon',
    name: 'Oberon',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 761.4,
    dayHours: 323.1,
    texture: '/textures/solar/moons/oberon.jpg',
    orbit: { a: 583_520, e: 0.0014, i: deg(0.07), Omega: deg(0), omega: deg(0), M0: deg(200), n: (2 * Math.PI) / 13.46, aUnit: 'km' },
  },

  // —— Neptune ——
  {
    id: 'triton',
    name: 'Triton',
    kind: 'moon',
    parent: 'neptune',
    radiusKm: 1_353.4,
    dayHours: -141.3,
    texture: '/textures/solar/moons/triton.jpg',
    orbit: { a: 354_759, e: 0.000016, i: deg(156.89), Omega: deg(0), omega: deg(0), M0: deg(0), n: (-2 * Math.PI) / 5.877, aUnit: 'km' },
  },

  // —— Pluto moon ——
  {
    id: 'charon',
    name: 'Charon',
    kind: 'moon',
    parent: 'pluto',
    radiusKm: 606,
    dayHours: 153.29,
    texture: '/textures/solar/moons/charon.jpg',
    orbit: { a: 19_591, e: 0.0002, i: deg(0.0), Omega: deg(0), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 6.387, aUnit: 'km' },
  },

  // —— Famous artificial satellites / probes (~10) ——
  {
    id: 'iss',
    name: 'ISS',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.05,
    dayHours: 1.5,
    color: 0xddddff,
    craft: true,
    orbit: { a: 6_778, e: 0.0006, i: deg(51.64), Omega: deg(20), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 0.0639, aUnit: 'km' },
  },
  {
    id: 'hubble',
    name: 'Hubble',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.007,
    dayHours: 1.6,
    color: 0xaaccff,
    craft: true,
    orbit: { a: 6_920, e: 0.0003, i: deg(28.47), Omega: deg(80), omega: deg(0), M0: deg(40), n: (2 * Math.PI) / 0.066, aUnit: 'km' },
  },
  {
    id: 'jwst',
    name: 'James Webb',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.01,
    dayHours: 24,
    color: 0xffeecc,
    craft: true,
    // Approx SEL2 halo — modeled as large Earth-leading orbit for viz
    orbit: { a: 1_500_000, e: 0.1, i: deg(5), Omega: deg(0), omega: deg(0), M0: deg(10), n: (2 * Math.PI) / 180, aUnit: 'km' },
  },
  {
    id: 'tiangong',
    name: 'Tiangong',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.03,
    dayHours: 1.5,
    color: 0xffdddd,
    craft: true,
    orbit: { a: 6_778, e: 0.0008, i: deg(41.5), Omega: deg(140), omega: deg(0), M0: deg(90), n: (2 * Math.PI) / 0.064, aUnit: 'km' },
  },
  {
    id: 'gps',
    name: 'GPS IIF-1',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.008,
    dayHours: 12,
    color: 0xccddee,
    craft: true,
    orbit: { a: 26_560, e: 0.01, i: deg(55), Omega: deg(60), omega: deg(0), M0: deg(0), n: (2 * Math.PI) / 0.5, aUnit: 'km' },
  },
  {
    id: 'starlink',
    name: 'Starlink-1007',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.003,
    dayHours: 1.6,
    color: 0xffffff,
    craft: true,
    orbit: { a: 6_928, e: 0.0002, i: deg(53), Omega: deg(200), omega: deg(0), M0: deg(180), n: (2 * Math.PI) / 0.066, aUnit: 'km' },
  },
  {
    id: 'voyager1',
    name: 'Voyager 1',
    kind: 'satellite',
    parent: 'sun',
    radiusKm: 0.01,
    dayHours: 24,
    color: 0xffe0a0,
    craft: true,
    orbit: { a: 162, e: 0.88, i: deg(35.1), Omega: deg(180), omega: deg(0), M0: deg(200), aUnit: 'au' },
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    kind: 'satellite',
    parent: 'sun',
    radiusKm: 0.01,
    dayHours: 24,
    color: 0xffd090,
    craft: true,
    orbit: { a: 135, e: 0.87, i: deg(33.2), Omega: deg(220), omega: deg(20), M0: deg(210), aUnit: 'au' },
  },
  {
    id: 'newhorizons',
    name: 'New Horizons',
    kind: 'satellite',
    parent: 'sun',
    radiusKm: 0.01,
    dayHours: 24,
    color: 0xa0ffc0,
    craft: true,
    orbit: { a: 60, e: 0.85, i: deg(2.5), Omega: deg(100), omega: deg(0), M0: deg(40), aUnit: 'au' },
  },
  {
    id: 'terra',
    name: 'Terra',
    kind: 'satellite',
    parent: 'earth',
    radiusKm: 0.01,
    dayHours: 1.65,
    color: 0x99ffcc,
    craft: true,
    orbit: { a: 7_078, e: 0.0001, i: deg(98.2), Omega: deg(300), omega: deg(0), M0: deg(270), n: (2 * Math.PI) / 0.0687, aUnit: 'km' },
  },
]

export function catalogById(): Map<string, BodyDef> {
  return new Map(SOLAR_CATALOG.map((b) => [b.id, b]))
}
