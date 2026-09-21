import { Button, Checkbox, Dropdown, theme } from 'antd'
import { ControlOutlined } from '@ant-design/icons'

export interface FilterFieldOption<T extends string> {
  key: T
  label: string
  kind?: 'select' | 'dateRange'
}

interface FilterFieldsPickerProps<T extends string> {
  options: readonly FilterFieldOption<T>[]
  value: readonly T[]
  onChange: (next: T[]) => void
}

export function FilterFieldsPicker<T extends string>({
  options,
  value,
  onChange,
}: FilterFieldsPickerProps<T>) {
  const { token } = theme.useToken()
  const selected = new Set(value)

  return (
    <Dropdown
      trigger={['click']}
      popupRender={() => (
        <div
          style={{
            minWidth: 260,
            maxHeight: 360,
            overflow: 'auto',
            padding: 10,
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox.Group
            value={[...value]}
            onChange={(keys) => onChange(keys as T[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {options.map((option) => (
              <Checkbox key={option.key} value={option.key} checked={selected.has(option.key)}>
                {option.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      )}
    >
      <Button icon={<ControlOutlined />}>Filtre alanları</Button>
    </Dropdown>
  )
}
