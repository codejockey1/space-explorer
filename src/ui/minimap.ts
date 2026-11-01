import type { ScaleMode } from '../solar/units'

export type MinimapBody = {
  id: string
  name: string
  kind: string
  x: number
  z: number
}

export type Minimap = {
  setVisible: (v: boolean) => void
  toggle: () => boolean
  update: (opts: {
    bodies: MinimapBody[]
    ship: { x: number; z: number }
    targetId: string | null
    mode: ScaleMode
  }) => void
  dispose: () => void
}

export function createMinimap(parent: HTMLElement): Minimap {
  const root = document.createElement('div')
  root.id = 'minimap'
  root.innerHTML = `<canvas width="180" height="180"></canvas><div class="minimap-title">SYSTEM</div>`
  parent.appendChild(root)
  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!

  let visible = true

  return {
    setVisible(v) {
      visible = v
      root.hidden = !v
    },
    toggle() {
      visible = !visible
      root.hidden = !visible
      return visible
    },
    update({ bodies, ship, targetId, mode }) {
      if (!visible) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(4, 10, 22, 0.72)'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(140, 180, 255, 0.25)'
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1)

      // Autoscale around ship + planets (ignore far voyagers for framing)
      const focus = bodies.filter((b) => b.kind === 'planet' || b.kind === 'star' || b.id === 'moon')
      let maxR = 1
      for (const b of focus) {
        maxR = Math.max(maxR, Math.hypot(b.x - ship.x, b.z - ship.z))
      }
      maxR *= 1.25
      const scale = (w * 0.42) / maxR
      const cx = w / 2
      const cy = h / 2
      const sx = (x: number) => cx + (x - ship.x) * scale
      const sy = (z: number) => cy + (z - ship.z) * scale

      // Orbit rings approx for planets
      ctx.strokeStyle = 'rgba(120, 160, 220, 0.12)'
      for (const b of focus) {
        if (b.kind !== 'planet') continue
        const r = Math.hypot(b.x, b.z) * scale
        ctx.beginPath()
        ctx.arc(cx - ship.x * scale, cy - ship.z * scale, r, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const b of bodies) {
        if (b.kind === 'moon' || b.kind === 'satellite') continue
        const x = sx(b.x)
        const y = sy(b.z)
        if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue
        ctx.beginPath()
        const r = b.kind === 'star' ? 3.2 : b.kind === 'planet' ? 2.2 : 1.4
        ctx.fillStyle =
          b.id === targetId
            ? '#9ec5ff'
            : b.kind === 'star'
              ? '#ffcc66'
              : b.kind === 'planet'
                ? '#c8d6ea'
                : '#8a9aaa'
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Ship
      ctx.fillStyle = '#7dffb0'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4)
      ctx.lineTo(cx + 3.5, cy + 3)
      ctx.lineTo(cx - 3.5, cy + 3)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = 'rgba(170,190,220,0.55)'
      ctx.font = '9px ui-monospace, monospace'
      ctx.fillText(mode === 'true' ? 'TRUE' : 'PLAY', 6, h - 6)
    },
    dispose() {
      root.remove()
    },
  }
}
