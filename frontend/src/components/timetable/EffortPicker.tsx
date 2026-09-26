import { Radio, Slider } from 'antd'

const PRESETS = [
  { key: 'kisa', label: 'Kısa', seconds: 30 },
  { key: 'orta', label: 'Orta', seconds: 90 },
  { key: 'uzun', label: 'Uzun', seconds: 180 },
] as const

export function EffortPicker({ value, onChange }: { value?: number; onChange?: (seconds: number) => void }) {
  const seconds = value && value >= 30 ? value : 90
  const preset = PRESETS.find((item) => item.seconds === seconds)?.key
  return (
    <div>
      <Radio.Group
        optionType="button"
        value={preset}
        onChange={(event) => {
          const next = PRESETS.find((item) => item.key === event.target.value)
          if (next) onChange?.(next.seconds)
        }}
        options={PRESETS.map((item) => ({ value: item.key, label: item.label }))}
      />
      <Slider
        style={{ marginTop: 12, maxWidth: 360 }}
        min={30}
        max={180}
        step={30}
        value={Math.min(180, Math.max(30, seconds))}
        onChange={(next) => onChange?.(next)}
        marks={{ 30: 'Kısa', 90: 'Orta', 180: 'Uzun' }}
        tooltip={{ formatter: () => '' }}
      />
    </div>
  )
}
