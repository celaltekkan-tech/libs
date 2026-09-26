import { Fragment, useMemo } from 'react'
import { DAY_LABELS } from '../../types/scheduleEntry'
import type { ConstraintSlot } from '../../types/timetable'

interface Props {
  days: number[]
  periods: number
  value?: ConstraintSlot[]
  onChange?: (value: ConstraintSlot[]) => void
}

function toCells(slots: ConstraintSlot[] | undefined, periods: number): Set<string> {
  const cells = new Set<string>()
  for (const s of slots || []) {
    const ps = s.periods?.length ? s.periods : Array.from({ length: periods }, (_, i) => i + 1)
    for (const p of ps) cells.add(`${s.day}:${p}`)
  }
  return cells
}

function toSlots(cells: Set<string>, days: number[], periods: number): ConstraintSlot[] {
  const out: ConstraintSlot[] = []
  for (const d of days) {
    const ps: number[] = []
    for (let p = 1; p <= periods; p++) if (cells.has(`${d}:${p}`)) ps.push(p)
    if (!ps.length) continue
    out.push({ day: d, periods: ps.length === periods ? [] : ps })
  }
  return out
}

/** Gün x ders saati ızgarasından hücre seçimi. Gün başlığı tüm günü, saat numarası tüm satırı seçer. */
export function SlotPicker({ days, periods, value, onChange }: Props) {
  const cells = useMemo(() => toCells(value, periods), [value, periods])
  const periodList = Array.from({ length: periods }, (_, i) => i + 1)

  const commit = (next: Set<string>) => onChange?.(toSlots(next, days, periods))

  const toggleMany = (keys: string[]) => {
    const next = new Set(cells)
    const allOn = keys.every((k) => next.has(k))
    for (const k of keys) {
      if (allOn) next.delete(k)
      else next.add(k)
    }
    commit(next)
  }

  const cellStyle = (on: boolean): React.CSSProperties => ({
    height: 28,
    borderRadius: 4,
    border: '1px solid #d9d9d9',
    background: on ? '#ff4d4f' : '#fff',
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `40px repeat(${days.length}, minmax(44px, 1fr))`,
        gap: 3,
        userSelect: 'none',
      }}
    >
      <div />
      {days.map((d) => (
        <button
          type="button"
          key={d}
          onClick={() => toggleMany(periodList.map((p) => `${d}:${p}`))}
          style={{ border: 'none', background: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 2 }}
        >
          {DAY_LABELS[d]?.slice(0, 3) || d}
        </button>
      ))}
      {periodList.map((p) => (
        <Fragment key={p}>
          <button
            type="button"
            onClick={() => toggleMany(days.map((d) => `${d}:${p}`))}
            style={{ border: 'none', background: 'none', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}
          >
            {p}.
          </button>
          {days.map((d) => {
            const key = `${d}:${p}`
            return (
              <div
                key={key}
                role="checkbox"
                aria-checked={cells.has(key)}
                onClick={() => toggleMany([key])}
                style={cellStyle(cells.has(key))}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
