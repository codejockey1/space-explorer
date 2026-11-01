import type { ScaleMode } from '../solar/units'
import { KM_PER_AU, TRUE_KM_PER_UNIT } from '../solar/units'

export type Hud = {
  setSpeed: (speed: number, mode: ScaleMode) => void
  setTarget: (name: string | null) => void
  setStatus: (text: string | null) => void
  setTimeScale: (label: string) => void
  setScaleMode: (mode: string) => void
  setApproachProgress: (progress: number | null) => void
  setTargetDistance: (distance: number | null, mode: ScaleMode) => void
  setRelativeSpeed: (speed: number | null, mode: ScaleMode) => void
  /** Kiosk countdown to next target in ms, or null when not in kiosk. */
  setKioskCountdown: (msRemaining: number | null, dwellLabel?: string | null) => void
  setHelpVisible: (visible: boolean) => void
  toggleHelp: () => boolean
  root: HTMLDivElement
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSpeed(speed: number, mode: ScaleMode): string {
  if (mode === 'true') {
    const kmPerSec = speed * TRUE_KM_PER_UNIT
    if (kmPerSec >= 10_000) return `${(kmPerSec / 1000).toFixed(0)}k km/s`
    if (kmPerSec >= 100) return `${kmPerSec.toFixed(0)} km/s`
    if (kmPerSec >= 10) return `${kmPerSec.toFixed(1)} km/s`
    if (kmPerSec >= 0.1) return `${kmPerSec.toFixed(2)} km/s`
    return `${(kmPerSec * 1000).toFixed(0)} m/s`
  }
  if (speed >= 100) return `${speed.toFixed(0)} u/s`
  if (speed >= 10) return `${speed.toFixed(1)} u/s`
  return `${speed.toFixed(2)} u/s`
}

function formatDistance(distance: number, mode: ScaleMode): string {
  if (mode === 'true') {
    const km = distance * TRUE_KM_PER_UNIT
    const au = km / KM_PER_AU
    if (au >= 10) return `${au.toFixed(1)} AU`
    if (au >= 0.1) return `${au.toFixed(3)} AU`
    if (au >= 0.01) return `${au.toFixed(4)} AU`
    if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)} M km`
    if (km >= 10_000) return `${(km / 1000).toFixed(0)}k km`
    if (km >= 100) return `${km.toFixed(0)} km`
    if (km >= 1) return `${km.toFixed(1)} km`
    return `${(km * 1000).toFixed(0)} m`
  }
  if (distance >= 1000) return `${distance.toFixed(0)} u`
  if (distance >= 100) return `${distance.toFixed(1)} u`
  if (distance >= 10) return `${distance.toFixed(2)} u`
  return `${distance.toFixed(3)} u`
}

export function createHud(parent: HTMLElement): Hud {
  const root = document.createElement('div')
  root.id = 'hud'
  root.innerHTML = `
    <div class="hud-panel hud-top">
      <div class="brand">SPACE EXPLORER</div>
      <div class="readout"><span>SPD</span> <strong id="hud-speed">0.00 u/s</strong></div>
      <div class="readout"><span>TGT</span> <strong id="hud-target">—</strong></div>
      <div class="readout" id="hud-range-row" hidden><span>RNG</span> <strong id="hud-range">—</strong></div>
      <div class="readout" id="hud-rel-row" hidden><span>REL</span> <strong id="hud-rel">—</strong></div>
      <div class="readout" id="hud-approach-row" hidden><span>APR</span> <strong id="hud-approach">—</strong></div>
      <div class="readout" id="hud-kiosk-row" hidden><span>NEXT</span> <strong id="hud-kiosk">—</strong></div>
      <div class="readout"><span>TIME</span> <strong id="hud-time">1×</strong></div>
      <div class="readout"><span>SCALE</span> <strong id="hud-scale">playable</strong></div>
      <div class="readout status" id="hud-status" hidden><span>MSG</span> <strong></strong></div>
    </div>
    <div class="hud-panel hud-help">
      <div>WASD thrust · R/F up/down · Arrows / mouse look · Q/E roll · Shift boost · Gamepad OK</div>
      <div><kbd>/</kbd> search · <kbd>V</kbd>/<kbd>N</kbd> pick · <kbd>G</kbd> approach · <kbd>H</kbd> orbit · <kbd>I</kbd> kiosk</div>
      <div><kbd>B</kbd> engine · <kbd>X</kbd> kiosk skip · <kbd>C</kbd> kiosk dwell · <kbd>O</kbd> orbits · <kbd>L</kbd> labels</div>
      <div><kbd>;</kbd> map · <kbd>U</kbd> local-up · <kbd>Esc</kbd> menu · <kbd>M</kbd> scale</div>
    </div>
  `
  parent.appendChild(root)

  const speedEl = root.querySelector('#hud-speed') as HTMLElement
  const targetEl = root.querySelector('#hud-target') as HTMLElement
  const rangeRow = root.querySelector('#hud-range-row') as HTMLElement
  const rangeEl = root.querySelector('#hud-range') as HTMLElement
  const relRow = root.querySelector('#hud-rel-row') as HTMLElement
  const relEl = root.querySelector('#hud-rel') as HTMLElement
  const approachRow = root.querySelector('#hud-approach-row') as HTMLElement
  const approachEl = root.querySelector('#hud-approach') as HTMLElement
  const kioskRow = root.querySelector('#hud-kiosk-row') as HTMLElement
  const kioskEl = root.querySelector('#hud-kiosk') as HTMLElement
  const timeEl = root.querySelector('#hud-time') as HTMLElement
  const scaleEl = root.querySelector('#hud-scale') as HTMLElement
  const statusRow = root.querySelector('#hud-status') as HTMLElement
  const statusEl = statusRow.querySelector('strong') as HTMLElement
  const helpPanel = root.querySelector('.hud-help') as HTMLElement

  return {
    root,
    setSpeed(speed: number, mode: ScaleMode) {
      speedEl.textContent = formatSpeed(speed, mode)
    },
    setTarget(name: string | null) {
      targetEl.textContent = name ?? '—'
      if (!name) {
        rangeRow.hidden = true
        relRow.hidden = true
      }
    },
    setTargetDistance(distance: number | null, mode: ScaleMode) {
      if (distance == null) {
        rangeRow.hidden = true
        rangeEl.textContent = '—'
        return
      }
      rangeRow.hidden = false
      rangeEl.textContent = formatDistance(distance, mode)
    },
    setRelativeSpeed(speed: number | null, mode: ScaleMode) {
      if (speed == null) {
        relRow.hidden = true
        relEl.textContent = '—'
        return
      }
      relRow.hidden = false
      relEl.textContent = formatSpeed(speed, mode)
    },
    setTimeScale(label: string) {
      timeEl.textContent = label
    },
    setScaleMode(mode: string) {
      scaleEl.textContent = mode
    },
    setApproachProgress(progress: number | null) {
      if (progress == null) {
        approachRow.hidden = true
        approachEl.textContent = '—'
        return
      }
      approachRow.hidden = false
      const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
      approachEl.textContent = `${pct}%`
    },
    setKioskCountdown(msRemaining: number | null, dwellLabel: string | null = null) {
      if (msRemaining == null) {
        kioskRow.hidden = true
        kioskEl.textContent = '—'
        return
      }
      kioskRow.hidden = false
      const clock = formatCountdown(msRemaining)
      kioskEl.textContent = dwellLabel ? `${clock} / ${dwellLabel}` : clock
    },
    setHelpVisible(visible: boolean) {
      helpPanel.hidden = !visible
    },
    toggleHelp() {
      helpPanel.hidden = !helpPanel.hidden
      return !helpPanel.hidden
    },
    setStatus(text: string | null) {
      if (!text) {
        statusRow.hidden = true
        statusEl.textContent = ''
        return
      }
      statusRow.hidden = false
      statusEl.textContent = text
    },
  }
}
