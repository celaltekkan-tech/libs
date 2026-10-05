import type { CSSProperties, ReactNode } from 'react'

interface FilterBarProps {
  children: ReactNode
  style?: CSSProperties
  attention?: string
}

export function FilterBar({ children, style, attention }: FilterBarProps) {
  return (
    <div className="app-filter-bar" style={style} data-attention={attention}>
      {children}
    </div>
  )
}
