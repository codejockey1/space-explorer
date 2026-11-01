export type TargetPickerItem = {
  id: string
  name: string
  kind: string
}

export type TargetPicker = {
  setItems: (items: TargetPickerItem[]) => void
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  dispose: () => void
}

export function createTargetPicker(
  parent: HTMLElement,
  onSelect: (id: string) => void,
  onOpenChange?: (open: boolean) => void,
): TargetPicker {
  let items: TargetPickerItem[] = []
  let openState = false
  let activeIndex = 0

  const root = document.createElement('div')
  root.id = 'target-picker'
  root.hidden = true
  root.innerHTML = `
    <div class="picker-panel">
      <div class="picker-header">
        <span>TARGET SELECT</span>
        <span class="picker-hint"><kbd>/</kbd> · Esc</span>
      </div>
      <input id="picker-input" type="search" placeholder="Search bodies…" autocomplete="off" spellcheck="false" />
      <div id="picker-list" class="picker-list" role="listbox"></div>
    </div>
  `
  parent.appendChild(root)

  const input = root.querySelector('#picker-input') as HTMLInputElement
  const list = root.querySelector('#picker-list') as HTMLDivElement

  const filtered = () => {
    const q = input.value.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        it.kind.toLowerCase().includes(q),
    )
  }

  const render = () => {
    const rows = filtered()
    if (activeIndex >= rows.length) activeIndex = Math.max(0, rows.length - 1)
    list.innerHTML = rows
      .map(
        (it, i) => `
      <button type="button" class="picker-item${i === activeIndex ? ' active' : ''}" data-id="${it.id}" role="option">
        <span class="picker-name">${it.name}</span>
        <span class="picker-kind">${it.kind}</span>
      </button>`,
      )
      .join('')
    const active = list.querySelector('.picker-item.active') as HTMLElement | null
    active?.scrollIntoView({ block: 'nearest' })
  }

  const selectActive = () => {
    const rows = filtered()
    const it = rows[activeIndex]
    if (!it) return
    onSelect(it.id)
    api.close()
  }

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.picker-item') as HTMLElement | null
    if (!btn?.dataset.id) return
    onSelect(btn.dataset.id)
    api.close()
  })

  input.addEventListener('input', () => {
    activeIndex = 0
    render()
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if (!openState) return
    if (e.code === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      api.close()
      return
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      activeIndex++
      render()
      return
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      activeIndex = Math.max(0, activeIndex - 1)
      render()
      return
    }
    if (e.code === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      selectActive()
    }
  }

  const api: TargetPicker = {
    setItems(next) {
      items = next
      if (openState) render()
    },
    open() {
      openState = true
      root.hidden = false
      activeIndex = 0
      input.value = ''
      render()
      requestAnimationFrame(() => input.focus())
      window.addEventListener('keydown', onKeyDown, true)
      onOpenChange?.(true)
    },
    close() {
      openState = false
      root.hidden = true
      input.blur()
      window.removeEventListener('keydown', onKeyDown, true)
      onOpenChange?.(false)
    },
    toggle() {
      if (openState) api.close()
      else api.open()
    },
    isOpen() {
      return openState
    },
    dispose() {
      api.close()
      root.remove()
    },
  }

  return api
}
