/** Chat colours and wallpaper. Stored on this phone only (localStorage), so they never need the database. */
export interface ChatTheme { id: string; label: string; from: string; to: string }
export interface ChatWallpaper { id: string; label: string; css: string }

export const CHAT_THEMES: ChatTheme[] = [
  { id: 'default', label: 'iConnecto', from: '', to: '' },
  { id: 'ocean', label: 'Ocean', from: '#0ea5e9', to: '#2563eb' },
  { id: 'forest', label: 'Forest', from: '#10b981', to: '#047857' },
  { id: 'sunset', label: 'Sunset', from: '#f97316', to: '#db2777' },
  { id: 'grape', label: 'Grape', from: '#8b5cf6', to: '#6d28d9' },
  { id: 'rose', label: 'Rose', from: '#f43f5e', to: '#be123c' },
]

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  { id: 'default', label: 'Default', css: '' },
  { id: 'mist', label: 'Mist', css: 'linear-gradient(160deg, rgba(186,230,253,0.35), rgba(221,214,254,0.35))' },
  { id: 'peach', label: 'Peach', css: 'linear-gradient(160deg, rgba(254,215,170,0.4), rgba(251,207,232,0.4))' },
  { id: 'mint', label: 'Mint', css: 'linear-gradient(160deg, rgba(187,247,208,0.4), rgba(165,243,252,0.35))' },
  { id: 'dusk', label: 'Dusk', css: 'linear-gradient(160deg, rgba(99,102,241,0.25), rgba(236,72,153,0.2))' },
  { id: 'paper', label: 'Paper', css: 'linear-gradient(0deg, rgba(120,113,108,0.08), rgba(120,113,108,0.08))' },
]

const KEY_THEME = 'ic.chat.theme'
const KEY_WALL = 'ic.chat.wallpaper'

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? 'default'
  } catch {
    return 'default'
  }
}
function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* private mode: the choice just won't be remembered */
  }
}

export const getThemeId = () => read(KEY_THEME)
export const getWallpaperId = () => read(KEY_WALL)
export const setThemeId = (id: string) => write(KEY_THEME, id)
export const setWallpaperId = (id: string) => write(KEY_WALL, id)

/** Inline style for the chat screen. */
export function chatLookStyle(): Record<string, string> {
  const t = CHAT_THEMES.find((x) => x.id === getThemeId())
  const w = CHAT_WALLPAPERS.find((x) => x.id === getWallpaperId())
  const style: Record<string, string> = {}
  if (t?.from) {
    style['--bubble-from'] = t.from
    style['--bubble-to'] = t.to
  }
  if (w?.css) style['--chat-wall'] = w.css
  return style
}
