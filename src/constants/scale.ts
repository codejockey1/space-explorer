/** Playable compressed scale. Earth radius = 1 unit. */
export const EARTH_RADIUS = 1
export const MOON_RADIUS = 0.2727
/**
 * Real DS-1 radius ≈ 0.0125 Earth radii. Playable exaggeration keeps the
 * movie-accurate model readable as a size reference next to Earth.
 */
export const DEATH_STAR_RADIUS = 0.18

export const MOON_DISTANCE = 36
export const EARTH_POSITION = { x: 0, y: 0, z: 0 } as const
export const MOON_POSITION = { x: MOON_DISTANCE, y: 2, z: -8 } as const
/** Float off Earth's left limb in the opening view. */
export const DEATH_STAR_POSITION = { x: -1.55, y: 0.4, z: 0.2 } as const

export const START_POSITION = { x: 0, y: 0.35, z: 5.5 } as const

export const STARFIELD_COUNT = 36000
/** Large enough to sit outside playable Neptune; camera-followed so distance never matters. */
export const STARFIELD_RADIUS = 2400
