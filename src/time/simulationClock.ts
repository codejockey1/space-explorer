export type SimulationClock = {
  /** Days since J2000.0 */
  day: number
  /** Effective multiplier applied to real dt (0 when paused). */
  timeScale: number
  /** Stored scale ignoring pause. */
  rawTimeScale: number
  paused: boolean
  setTimeScale: (scale: number) => void
  cycleTimeScale: (direction: 1 | -1) => void
  togglePause: () => void
  reverse: () => void
  update: (dtSeconds: number) => void
  label: () => string
}

const SCALE_STEPS = [1, 10, 60, 100, 365, 1000]

export function createSimulationClock(initialDay: number): SimulationClock {
  let day = initialDay
  let timeScale = 1
  let paused = false
  let stepIndex = 0

  const clock: SimulationClock = {
    get day() {
      return day
    },
    set day(v: number) {
      day = v
    },
    get timeScale() {
      return paused ? 0 : timeScale
    },
    set timeScale(v: number) {
      timeScale = v === 0 ? 1 : v
      paused = false
    },
    get rawTimeScale() {
      return timeScale
    },
    get paused() {
      return paused
    },
    set paused(v: boolean) {
      paused = v
    },
    setTimeScale(scale: number) {
      timeScale = scale === 0 ? 1 : scale
      paused = false
      const abs = Math.abs(timeScale)
      const idx = SCALE_STEPS.findIndex((s) => s === abs)
      if (idx >= 0) stepIndex = idx
    },
    cycleTimeScale(direction: 1 | -1) {
      stepIndex = (stepIndex + direction + SCALE_STEPS.length) % SCALE_STEPS.length
      const sign = timeScale < 0 ? -1 : 1
      timeScale = sign * SCALE_STEPS[stepIndex]
      paused = false
    },
    togglePause() {
      paused = !paused
    },
    reverse() {
      timeScale = -timeScale || -1
      paused = false
    },
    update(dtSeconds: number) {
      if (paused) return
      day += (dtSeconds * timeScale) / 86_400
    },
    label() {
      if (paused) return 'PAUSED'
      const sign = timeScale < 0 ? '-' : ''
      return `${sign}${Math.abs(timeScale)}×`
    },
  }

  return clock
}
