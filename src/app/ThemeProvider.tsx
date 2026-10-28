import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
const KEY = 'iconnecto-theme'

interface ThemeApi {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') delete root.dataset.theme
  else root.dataset.theme = mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStored)

  useEffect(() => apply(mode), [mode])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try {
      if (m === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, m)
    } catch {
      /* storage unavailable (private mode): theme still applies for this session */
    }
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
