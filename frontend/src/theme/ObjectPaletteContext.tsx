import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ColorMode } from './ThemeContext'
import { useThemeMode } from './ThemeContext'
import {
  OBJECT_PALETTE,
  OBJECT_SWATCH_CYCLE,
  heatAppearance,
  readPaletteOverrides,
  resolvePalette,
  type ObjectSwatch,
  type PaletteOverrides,
  type ResolvedPalette,
  type SwatchName,
} from './objectPalette'

const STORAGE_KEY = 'okul-idare-object-colors'

interface ObjectPaletteContextValue {
  palette: ResolvedPalette
  setPart: (mode: ColorMode, name: SwatchName, key: keyof ObjectSwatch, hex: string) => void
  resetSwatch: (mode: ColorMode, name: SwatchName) => void
  resetAll: () => void
}

const ObjectPaletteContext = createContext<ObjectPaletteContextValue | null>(null)

function readStored(): PaletteOverrides {
  try {
    return readPaletteOverrides(localStorage.getItem(STORAGE_KEY))
  } catch {
    return {}
  }
}

function writeStored(overrides: PaletteOverrides) {
  try {
    if (!overrides.light && !overrides.dark) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    /* ignore */
  }
}

export function ObjectPaletteProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<PaletteOverrides>(readStored)
  const palette = useMemo(() => resolvePalette(overrides), [overrides])

  const setPart = (mode: ColorMode, name: SwatchName, key: keyof ObjectSwatch, hex: string) => {
    const normalized = hex.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return
    setOverrides((prev) => {
      const next: PaletteOverrides = {}
      if (prev.light) next.light = { ...prev.light }
      if (prev.dark) next.dark = { ...prev.dark }
      const row = { ...next[mode]?.[name] }
      if (normalized === OBJECT_PALETTE[name][mode][key]) delete row[key]
      else row[key] = normalized
      if (Object.keys(row).length) next[mode] = { ...next[mode], [name]: row }
      else if (next[mode]) {
        const block = { ...next[mode] }
        delete block[name]
        if (Object.keys(block).length) next[mode] = block
        else delete next[mode]
      }
      writeStored(next)
      return next
    })
  }

  const resetSwatch = (mode: ColorMode, name: SwatchName) => {
    setOverrides((prev) => {
      const block = { ...prev[mode] }
      delete block[name]
      const next: PaletteOverrides = { ...prev }
      if (Object.keys(block).length) next[mode] = block
      else delete next[mode]
      writeStored(next)
      return next
    })
  }

  const resetAll = () => {
    writeStored({})
    setOverrides({})
  }

  return (
    <ObjectPaletteContext.Provider value={{ palette, setPart, resetSwatch, resetAll }}>
      {children}
    </ObjectPaletteContext.Provider>
  )
}

export function useObjectPalette() {
  const ctx = useContext(ObjectPaletteContext)
  if (!ctx) throw new Error('useObjectPalette must be used within ObjectPaletteProvider')
  return ctx
}

export function useObjectColors() {
  const { mode } = useThemeMode()
  const { palette } = useObjectPalette()
  return {
    swatch(name: SwatchName): ObjectSwatch {
      return palette[name][mode]
    },
    swatchForId(id: number): ObjectSwatch {
      const name = OBJECT_SWATCH_CYCLE[Math.abs(id) % OBJECT_SWATCH_CYCLE.length]
      return palette[name][mode]
    },
    heat(name: 'red' | 'gold', ratio: number) {
      return heatAppearance(palette[name][mode], name, ratio, mode)
    },
  }
}
