import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ColorMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
  toggleMode: () => void
}

const STORAGE_KEY = 'okul-idare-color-mode'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): ColorMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

function applyDocumentTheme(mode: ColorMode) {
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(() => {
    const initial = readStoredMode()
    applyDocumentTheme(initial)
    return initial
  })

  const setMode = (next: ColorMode) => {
    setModeState(next)
    applyDocumentTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    applyDocumentTheme(mode)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>{children}</ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider')
  return ctx
}
