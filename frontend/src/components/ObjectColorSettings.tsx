import { useState } from 'react'
import { Button, Card, ColorPicker, Segmented, Space, Typography } from 'antd'
import type { Color } from 'antd/es/color-picker'
import { SWATCH_FIELDS, SWATCH_SETTINGS } from '../theme/objectPalette'
import { useObjectPalette } from '../theme/ObjectPaletteContext'
import type { ColorMode } from '../theme/ThemeContext'
import { useThemeMode } from '../theme/ThemeContext'

function hexOf(color: Color) {
  const hex = color.toHexString()
  return hex.length > 7 ? hex.slice(0, 7) : hex
}

export function ObjectColorSettings() {
  const { mode } = useThemeMode()
  const { palette, setPart, resetSwatch, resetAll } = useObjectPalette()
  const [editMode, setEditMode] = useState<ColorMode>(mode)

  return (
    <Card title="Nesne renkleri">
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Ek ders, ders programı, sınav, takvim, devamsızlık ve izin görünümlerindeki renkler buradan
        seçilir. Açık ve koyu tema ayrı tutulur. Tercih bu cihazda saklanır.
      </Typography.Paragraph>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Segmented
          value={editMode}
          onChange={(value) => setEditMode(value as ColorMode)}
          options={[
            { label: 'Açık tema renkleri', value: 'light' },
            { label: 'Koyu tema renkleri', value: 'dark' },
          ]}
        />
        {SWATCH_SETTINGS.map((item) => {
          const tone = palette[item.name][editMode]
          return (
            <div
              key={item.name}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  minWidth: 180,
                  background: tone.bg,
                  color: tone.text,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontWeight: 600,
                }}
              >
                {item.label}
                <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: tone.muted }}>
                  {item.usage}
                </span>
              </span>
              {SWATCH_FIELDS.map((field) => (
                <Space key={field.key} size={6} align="center">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {field.label}
                  </Typography.Text>
                  <ColorPicker
                    value={tone[field.key]}
                    format="hex"
                    disabledAlpha
                    onChange={(color) => setPart(editMode, item.name, field.key, hexOf(color))}
                  />
                </Space>
              ))}
              <Button type="link" onClick={() => resetSwatch(editMode, item.name)}>
                Bu rengi sıfırla
              </Button>
            </div>
          )
        })}
        <Button onClick={resetAll}>Tüm renkleri varsayılana döndür</Button>
      </Space>
    </Card>
  )
}
