import { Empty, Typography } from 'antd'

interface DisciplineMiniBarChartProps {
  data: Array<{ label: string; value: number }>
  color?: string
}

export function DisciplineMiniBarChart({ data, color = '#1677ff' }: DisciplineMiniBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <Empty description="Veri yok" image={Empty.PRESENTED_IMAGE_SIMPLE} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Text style={{ width: 220, flexShrink: 0 }} ellipsis={{ tooltip: row.label }}>
            {row.label}
          </Typography.Text>
          <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', height: 20 }}>
            <div
              style={{
                width: `${(row.value / max) * 100}%`,
                background: color,
                height: '100%',
                minWidth: row.value > 0 ? 4 : 0,
                borderRadius: 4,
              }}
            />
          </div>
          <Typography.Text strong style={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
            {row.value}
          </Typography.Text>
        </div>
      ))}
    </div>
  )
}
