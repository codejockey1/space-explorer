import type { ScaleMode } from '../solar/units'

export type SessionSnapshot = {
  version: 1
  day: number
  timeScale: number
  paused: boolean
  scaleMode: ScaleMode
  targetId: string | null
  camera: {
    position: [number, number, number]
    quaternion: [number, number, number, number]
  }
}

const KEY = 'space-explorer.session.v1'

export function saveSession(snap: SessionSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* ignore quota */
  }
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SessionSnapshot
    if (data?.version !== 1) return null
    return data
  } catch {
    return null
  }
}

export type Bookmark = {
  id: string
  name: string
  snap: SessionSnapshot
}

const BOOK_KEY = 'space-explorer.bookmarks.v1'

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(BOOK_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as Bookmark[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveBookmarks(list: Bookmark[]): void {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(list.slice(0, 12)))
  } catch {
    /* ignore */
  }
}
