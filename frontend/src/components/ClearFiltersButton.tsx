import { Button } from 'antd'
import { ClearOutlined } from '@ant-design/icons'

interface ClearFiltersButtonProps {
  active: boolean
  onClick: () => void
}

export function ClearFiltersButton({ active, onClick }: ClearFiltersButtonProps) {
  if (!active) return null
  return (
    <Button icon={<ClearOutlined />} onClick={onClick}>
      Filtreleri temizle
    </Button>
  )
}
