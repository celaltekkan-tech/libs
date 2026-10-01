import type { ColorMode } from './ThemeContext'

/** Nesne zemini, ana yazı, ikincil yazı ve kenar. Açık zeminde yazı koyu, koyu zeminde yazı açık. */
export interface ObjectSwatch {
  bg: string
  text: string
  muted: string
  border: string
}

export type SwatchName =
  | 'selected'
  | 'blue'
  | 'geekblue'
  | 'cyan'
  | 'green'
  | 'gold'
  | 'orange'
  | 'volcano'
  | 'red'
  | 'purple'
  | 'magenta'
  | 'neutral'

type Pair = { light: ObjectSwatch; dark: ObjectSwatch }

/**
 * Nesne görünümleri (seçili satır, takvim işareti, ders kartı) için palet.
 * Her renk açık ve koyu temada ayrı zemin ve yazı tonu taşır.
 */
export const OBJECT_PALETTE: Record<SwatchName, Pair> = {
  selected: {
    light: { bg: '#fff7e6', text: '#0958d9', muted: '#003eb3', border: '#91caff' },
    dark: { bg: '#111d2c', text: '#91caff', muted: '#69b1ff', border: '#3c89e8' },
  },
  blue: {
    light: { bg: '#e6f4ff', text: '#003eb3', muted: '#0958d9', border: '#91caff' },
    dark: { bg: '#112a45', text: '#91caff', muted: '#69b1ff', border: '#3c89e8' },
  },
  geekblue: {
    light: { bg: '#f0f5ff', text: '#1d39c4', muted: '#2f54eb', border: '#adc6ff' },
    dark: { bg: '#131a2e', text: '#adc6ff', muted: '#85a5ff', border: '#2f54eb' },
  },
  cyan: {
    light: { bg: '#e6fffb', text: '#006d75', muted: '#08979c', border: '#87e8de' },
    dark: { bg: '#112a2e', text: '#87e8de', muted: '#5cdbd3', border: '#08979c' },
  },
  green: {
    light: { bg: '#f6ffed', text: '#237804', muted: '#389e0d', border: '#95de64' },
    dark: { bg: '#132a1c', text: '#95de64', muted: '#73d13d', border: '#237804' },
  },
  gold: {
    light: { bg: '#fffbe6', text: '#ad6800', muted: '#d48806', border: '#ffe58f' },
    dark: { bg: '#2b2111', text: '#ffd666', muted: '#ffc53d', border: '#ad8b00' },
  },
  orange: {
    light: { bg: '#fff7e6', text: '#d46b08', muted: '#fa8c16', border: '#ffd591' },
    dark: { bg: '#2b1d11', text: '#ffc069', muted: '#ffa940', border: '#d46b08' },
  },
  volcano: {
    light: { bg: '#fff2e8', text: '#d4380d', muted: '#fa541c', border: '#ffbb96' },
    dark: { bg: '#2b1611', text: '#ffbb96', muted: '#ff9c6e', border: '#d4380d' },
  },
  red: {
    light: { bg: '#fff2f0', text: '#a8071a', muted: '#cf1322', border: '#ffa39e' },
    dark: { bg: '#2a1215', text: '#ff7875', muted: '#ff4d4f', border: '#a61d24' },
  },
  purple: {
    light: { bg: '#f9f0ff', text: '#531dab', muted: '#722ed1', border: '#d3adf7' },
    dark: { bg: '#1a1325', text: '#d3adf7', muted: '#b37feb', border: '#642ab5' },
  },
  magenta: {
    light: { bg: '#fff0f6', text: '#c41d7f', muted: '#eb2f96', border: '#ffadd2' },
    dark: { bg: '#291321', text: '#ffadd2', muted: '#ff85c0', border: '#c41d7f' },
  },
  neutral: {
    light: { bg: '#f5f5f5', text: '#434343', muted: '#595959', border: '#d9d9d9' },
    dark: { bg: '#1f1f1f', text: '#d9d9d9', muted: '#bfbfbf', border: '#434343' },
  },
}

/** Ders ve sınav nesnelerine sabit sırayla dağıtılan renkler. */
export const SWATCH_SETTINGS: Array<{ name: SwatchName; label: string; usage: string }> = [
  { name: 'selected', label: 'Seçili satır', usage: 'Listede seçili kişi' },
  { name: 'blue', label: 'Mavi', usage: 'Rapor, takvim, tatil' },
  { name: 'green', label: 'Yeşil', usage: 'İzin' },
  { name: 'purple', label: 'Mor', usage: 'Görevli' },
  { name: 'gold', label: 'Altın', usage: 'Mazeret ve izin yoğunluğu' },
  { name: 'red', label: 'Kırmızı', usage: 'Devamsız' },
  { name: 'cyan', label: 'Turkuaz', usage: 'Ders kartı' },
  { name: 'orange', label: 'Turuncu', usage: 'Ders kartı' },
  { name: 'volcano', label: 'Kiremit', usage: 'Ders kartı' },
  { name: 'magenta', label: 'Pembe', usage: 'Ders kartı' },
  { name: 'geekblue', label: 'Lacivert', usage: 'Ders kartı' },
  { name: 'neutral', label: 'Nötr', usage: 'Duraklatılmış takvim kaydı' },
]

export const SWATCH_FIELDS: Array<{ key: keyof ObjectSwatch; label: string }> = [
  { key: 'bg', label: 'Zemin' },
  { key: 'text', label: 'Yazı' },
  { key: 'muted', label: 'İkincil yazı' },
  { key: 'border', label: 'Kenar' },
]

export const OBJECT_SWATCH_CYCLE: SwatchName[] = [
  'blue',
  'cyan',
  'green',
  'gold',
  'orange',
  'volcano',
  'red',
  'magenta',
  'purple',
  'geekblue',
]

export function objectSwatch(name: SwatchName, mode: ColorMode): ObjectSwatch {
  return OBJECT_PALETTE[name][mode]
}

export function objectSwatchForId(id: number, mode: ColorMode): ObjectSwatch {
  const name = OBJECT_SWATCH_CYCLE[Math.abs(id) % OBJECT_SWATCH_CYCLE.length]
  return objectSwatch(name, mode)
}

export type PaletteOverrides = {
  light?: Partial<Record<SwatchName, Partial<ObjectSwatch>>>
  dark?: Partial<Record<SwatchName, Partial<ObjectSwatch>>>
}

export type ResolvedPalette = Record<SwatchName, Pair>

const SWATCH_NAMES = Object.keys(OBJECT_PALETTE) as SwatchName[]
const SWATCH_KEYS: Array<keyof ObjectSwatch> = ['bg', 'text', 'muted', 'border']

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function readPaletteOverrides(raw: string | null): PaletteOverrides {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PaletteOverrides
    const out: PaletteOverrides = {}
    for (const mode of ['light', 'dark'] as const) {
      const block = parsed?.[mode]
      if (!block || typeof block !== 'object') continue
      const next: Partial<Record<SwatchName, Partial<ObjectSwatch>>> = {}
      for (const name of SWATCH_NAMES) {
        const row = block[name]
        if (!row || typeof row !== 'object') continue
        const part: Partial<ObjectSwatch> = {}
        for (const key of SWATCH_KEYS) {
          if (isHex(row[key])) part[key] = row[key]
        }
        if (Object.keys(part).length) next[name] = part
      }
      if (Object.keys(next).length) out[mode] = next
    }
    return out
  } catch {
    return {}
  }
}

export function resolvePalette(overrides: PaletteOverrides): ResolvedPalette {
  const out = {} as ResolvedPalette
  for (const name of SWATCH_NAMES) {
    out[name] = {
      light: { ...OBJECT_PALETTE[name].light, ...overrides.light?.[name] },
      dark: { ...OBJECT_PALETTE[name].dark, ...overrides.dark?.[name] },
    }
  }
  return out
}

/** Oran arttıkça zemin koyulaşır; yazı seçilen tonda kalır. */
export function heatAppearance(
  tone: ObjectSwatch,
  name: 'red' | 'gold',
  ratio: number,
  mode: ColorMode,
): { bg?: string; text: string; border: string } {
  const clamped = Math.min(1, Math.max(0, ratio))
  if (clamped <= 0) return { bg: undefined, text: tone.text, border: tone.border }
  const hue = name === 'red' ? 0 : 32
  const lightness = mode === 'dark' ? 16 + clamped * 24 : 94 - clamped * 50
  const saturation = mode === 'dark' ? 52 : 75
  return {
    bg: `hsl(${hue} ${saturation}% ${lightness}%)`,
    text: tone.text,
    border: tone.border,
  }
}
