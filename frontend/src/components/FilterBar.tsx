import type { CSSProperties, ReactNode } from 'react'

interface FilterBarProps {
  children: ReactNode
  style?: CSSProperties
}

export function FilterBar({ children, style }: FilterBarProps) {
  return (
    <div className="app-filter-bar" style={style}>
      {children}
    </div>
  )
}
