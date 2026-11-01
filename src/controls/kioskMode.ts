import * as THREE from 'three'
import type { TargetBody } from './targetLock'

export type KioskHooks = {
  getBodies: () => TargetBody[]
  getCurrentId: () => string | null
  /** World position used to rank “nearby” candidates (usually the camera). */
  getOrigin: () => THREE.Vector3
  lockAndApproach: (body: TargetBody) => boolean
  startOrbit: (body: TargetBody) => void
  stopTravel: () => void
  onStatus: (text: string) => void
}

/** Dwell options for how long to stay before the next hop. */
export const KIOSK_CYCLE_OPTIONS_MS = [30_000, 60_000, 120_000] as const

export type KioskMode = {
  readonly active: boolean
  readonly cycleMs: number
  /** Human label for the current dwell (e.g. "30s", "1m", "2m"). */
  readonly cycleLabel: string
  start: () => void
  stop: () => void
  toggle: () => boolean
  /** Call when approach arrives at a body. */
  notifyArrived: (body: TargetBody) => void
  update: (nowMs: number) => void
  /** Ms until the next target hop, or null when inactive. */
  msUntilNext: (nowMs: number) => number | null
  /** Jump immediately to the next tour target. */
  skipToNext: () => void
  /** Cycle dwell through 30s → 1m → 2m → 30s. Returns the new label. */
  cycleDwell: () => string
}

/** Remember recent stops so the tour doesn't bounce around the same cluster. */
const RECENT_LIMIT = 8
const LOCAL_POOL = 8
const REGIONAL_POOL = 18

const SKIP = new Set(['sun']) // sun is huge / blinding as a kiosk stop

const _pos = new THREE.Vector3()

type Scored = { body: TargetBody; dist: number; id: string }

export function formatKioskCycleLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const mins = ms / 60_000
  return Number.isInteger(mins) ? `${mins}m` : `${mins.toFixed(1)}m`
}

function minOrbitMs(cycleMs: number): number {
  // Keep a short look even on 30s dwells; cap so 2m tours still linger
  return Math.min(18_000, Math.max(6_000, cycleMs * 0.4))
}

function scoreBodies(
  bodies: TargetBody[],
  origin: THREE.Vector3,
  avoidId: string | null,
): Scored[] {
  const scored: Scored[] = []
  for (const body of bodies) {
    const id = body.id ?? body.name
    if (SKIP.has(id)) continue
    if (avoidId && id === avoidId) continue
    body.object.getWorldPosition(_pos)
    scored.push({ body, dist: origin.distanceTo(_pos), id })
  }
  scored.sort((a, b) => a.dist - b.dist)
  return scored
}

function pickFrom(pool: Scored[]): TargetBody | null {
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)].body
}

/**
 * Mix short hops with mid-range and system-wide picks so kiosk tours
 * leave the starting neighborhood instead of looping Earth satellites.
 */
function pickTourTarget(
  bodies: TargetBody[],
  origin: THREE.Vector3,
  avoidId: string | null,
  recentIds: string[],
): TargetBody | null {
  const scored = scoreBodies(bodies, origin, avoidId)
  if (scored.length === 0) return null

  const fresh = scored.filter((s) => !recentIds.includes(s.id))
  const pool = fresh.length > 0 ? fresh : scored

  const local = pool.slice(0, Math.min(LOCAL_POOL, pool.length))
  const regional = pool.slice(
    Math.min(3, pool.length - 1),
    Math.min(REGIONAL_POOL, pool.length),
  )
  const far = pool.slice(Math.min(LOCAL_POOL, pool.length))
  // Always allow a full-catalog draw so distant planets stay in play
  const anywhere = pool

  const roll = Math.random()
  let pick: TargetBody | null = null
  if (roll < 0.28) {
    pick = pickFrom(local)
  } else if (roll < 0.55) {
    pick = pickFrom(regional.length > 0 ? regional : local)
  } else if (roll < 0.78) {
    pick = pickFrom(far.length > 0 ? far : anywhere)
  } else {
    pick = pickFrom(anywhere)
  }
  return pick ?? pickFrom(scored)
}

export function createKioskMode(hooks: KioskHooks): KioskMode {
  let active = false
  let phase: 'approach' | 'orbit' = 'approach'
  let cycleStarted = 0
  let orbitStarted = 0
  let cycleIndex = KIOSK_CYCLE_OPTIONS_MS.indexOf(120_000)
  if (cycleIndex < 0) cycleIndex = KIOSK_CYCLE_OPTIONS_MS.length - 1
  let visiting: TargetBody | null = null
  const recentIds: string[] = []

  const currentCycleMs = () => KIOSK_CYCLE_OPTIONS_MS[cycleIndex]

  const remember = (body: TargetBody) => {
    const id = body.id ?? body.name
    const idx = recentIds.indexOf(id)
    if (idx >= 0) recentIds.splice(idx, 1)
    recentIds.push(id)
    while (recentIds.length > RECENT_LIMIT) recentIds.shift()
  }

  const beginCycle = (nowMs: number) => {
    hooks.stopTravel()
    const next = pickTourTarget(
      hooks.getBodies(),
      hooks.getOrigin(),
      visiting?.id ?? hooks.getCurrentId(),
      recentIds,
    )
    if (!next) {
      hooks.onStatus('Kiosk: no targets available')
      return
    }
    visiting = next
    remember(next)
    cycleStarted = nowMs
    orbitStarted = 0
    phase = 'approach'
    if (hooks.lockAndApproach(next)) {
      hooks.onStatus(`Kiosk → ${next.name}`)
    } else {
      hooks.onStatus(`Kiosk: failed to approach ${next.name}`)
    }
  }

  const api: KioskMode = {
    get active() {
      return active
    },
    get cycleMs() {
      return currentCycleMs()
    },
    get cycleLabel() {
      return formatKioskCycleLabel(currentCycleMs())
    },
    start() {
      active = true
      beginCycle(performance.now())
    },
    stop() {
      active = false
      visiting = null
      phase = 'approach'
      recentIds.length = 0
      hooks.onStatus('Kiosk mode off')
    },
    toggle() {
      if (active) api.stop()
      else api.start()
      return active
    },
    notifyArrived(body) {
      if (!active) return
      visiting = body
      phase = 'orbit'
      orbitStarted = performance.now()
      hooks.startOrbit(body)
      hooks.onStatus(`Kiosk orbiting ${body.name}`)
    },
    update(nowMs) {
      if (!active) return
      const cycleMs = currentCycleMs()
      const elapsed = nowMs - cycleStarted
      const orbitFor = orbitStarted > 0 ? nowMs - orbitStarted : 0

      if (phase === 'orbit') {
        if (elapsed >= cycleMs && orbitFor >= minOrbitMs(cycleMs)) {
          beginCycle(nowMs)
        }
        return
      }

      // Long system hops can take a while; only bail if something is stuck
      if (phase === 'approach' && elapsed >= Math.max(cycleMs * 3, 180_000)) {
        beginCycle(nowMs)
      }
    },
    msUntilNext(nowMs) {
      if (!active || cycleStarted <= 0) return null
      const cycleMs = currentCycleMs()
      const untilCycle = cycleMs - (nowMs - cycleStarted)
      if (phase === 'orbit' && orbitStarted > 0) {
        const untilMinOrbit = minOrbitMs(cycleMs) - (nowMs - orbitStarted)
        return Math.max(0, untilCycle, untilMinOrbit)
      }
      // Still inbound — countdown to cycle end (orbit may hold a bit longer after arrival)
      return Math.max(0, untilCycle)
    },
    skipToNext() {
      if (!active) return
      beginCycle(performance.now())
    },
    cycleDwell() {
      cycleIndex = (cycleIndex + 1) % KIOSK_CYCLE_OPTIONS_MS.length
      return api.cycleLabel
    },
  }

  return api
}
