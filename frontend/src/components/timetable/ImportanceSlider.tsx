import { Slider } from 'antd'

/** Çubuğun her durağına karşılık gelen çözücü ağırlığı. Kullanıcı sayıyı görmez. */
const LEVELS = [0, 5, 15, 40, 100] as const
const LABELS = ['Kapalı', 'Az', 'Orta', 'Çok', 'En çok'] as const

const MARKS = LABELS.reduce<Record<number, { style: React.CSSProperties; label: string }>>(
  (acc, label, index) => {
    acc[index] = { style: { fontSize: 11, whiteSpace: 'nowrap' }, label }
    return acc
  },
  {},
)

/** Ağırlıklar birbirine göre kıyaslandığı için en yakın durak oransal olarak bulunur. */
function levelFromWeight(weight?: number): number {
  const value = Number(weight ?? 0)
  if (!(value > 0)) return 0
  let best = 1
  let bestDistance = Infinity
  LEVELS.forEach((level, index) => {
    if (index === 0) return
    const distance = Math.abs(Math.log(value / level))
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}

export function ImportanceSlider({
  value,
  onChange,
}: {
  value?: number
  onChange?: (weight: number) => void
}) {
  return (
    <Slider
      min={0}
      max={LEVELS.length - 1}
      step={1}
      dots
      value={levelFromWeight(value)}
      onChange={(next) => onChange?.(LEVELS[next] ?? 0)}
      marks={MARKS}
      tooltip={{ formatter: (index) => (index == null ? '' : LABELS[index]) }}
      style={{ marginTop: 0, marginBottom: 20 }}
    />
  )
}
