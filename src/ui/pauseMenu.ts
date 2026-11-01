import { daysSinceJ2000 } from '../solar/kepler'

export type PauseMenuHandlers = {
  onResume: () => void
  onToggleHelp: () => void
  onSave: () => void
  onLoad: () => void
  onBookmark: (name: string) => void
  onJumpDate: (day: number) => void
  onToggleEcliptic: () => void
  onToggleLabels: () => void
  onToggleMinimap: () => void
  onToggleKiosk: () => void
}

export type PauseMenu = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  dispose: () => void
}

export function createPauseMenu(parent: HTMLElement, handlers: PauseMenuHandlers): PauseMenu {
  let openState = false
  const root = document.createElement('div')
  root.id = 'pause-menu'
  root.hidden = true
  root.innerHTML = `
    <div class="pause-panel">
      <h2>PAUSED</h2>
      <p class="pause-sub">Controls & session</p>
      <div class="pause-actions">
        <button type="button" data-act="resume">Resume <kbd>Esc</kbd></button>
        <button type="button" data-act="help">Toggle help overlay</button>
        <button type="button" data-act="labels">Toggle labels</button>
        <button type="button" data-act="minimap">Toggle minimap</button>
        <button type="button" data-act="ecliptic">Toggle ecliptic plane</button>
        <button type="button" data-act="kiosk">Toggle kiosk tour <kbd>I</kbd></button>
        <button type="button" data-act="save">Save session</button>
        <button type="button" data-act="load">Load session</button>
        <button type="button" data-act="bookmark">Bookmark this view</button>
      </div>
      <label class="pause-date">Jump to date
        <input type="date" id="pause-date" />
      </label>
      <div class="pause-cheats">
        <div><kbd>WASD</kbd> thrust · <kbd>R/F</kbd> up/down · <kbd>Arrows</kbd> look · <kbd>Q/E</kbd> roll</div>
        <div><kbd>Click</kbd> mouse look · <kbd>V</kbd> pick in view · <kbd>H</kbd> orbit hold</div>
        <div><kbd>/</kbd> search · <kbd>G</kbd> approach · <kbd>N</kbd> nearest · <kbd>M</kbd> scale</div>
        <div><kbd>K</kbd> bookmark · <kbd>L</kbd> labels · <kbd>I</kbd> kiosk · <kbd>U</kbd> local-up</div>
        <div><kbd>B</kbd> engine · <kbd>X</kbd> kiosk skip · <kbd>C</kbd> kiosk dwell 30s/1m/2m</div>
      </div>
    </div>
  `
  parent.appendChild(root)

  const dateInput = root.querySelector('#pause-date') as HTMLInputElement
  const today = new Date()
  dateInput.value = today.toISOString().slice(0, 10)

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!btn?.dataset.act) return
    switch (btn.dataset.act) {
      case 'resume':
        api.close()
        handlers.onResume()
        break
      case 'help':
        handlers.onToggleHelp()
        break
      case 'labels':
        handlers.onToggleLabels()
        break
      case 'minimap':
        handlers.onToggleMinimap()
        break
      case 'ecliptic':
        handlers.onToggleEcliptic()
        break
      case 'kiosk':
        handlers.onToggleKiosk()
        break
      case 'save':
        handlers.onSave()
        break
      case 'load':
        handlers.onLoad()
        break
      case 'bookmark': {
        const name = window.prompt('Bookmark name', 'View') || 'View'
        handlers.onBookmark(name)
        break
      }
    }
  })

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return
    const d = new Date(dateInput.value + 'T12:00:00Z')
    handlers.onJumpDate(daysSinceJ2000(d))
  })

  const api: PauseMenu = {
    open() {
      openState = true
      root.hidden = false
    },
    close() {
      openState = false
      root.hidden = true
    },
    toggle() {
      if (openState) api.close()
      else api.open()
    },
    isOpen() {
      return openState
    },
    dispose() {
      root.remove()
    },
  }
  return api
}
