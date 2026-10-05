import { useMemo, useState } from 'react'
import { Calendar, InputNumber, List, Modal, Select, Space, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { mebItemsOnDay, type MebCalendarItem } from '../data/mebWorkCalendar2026'
import { useObjectColors } from '../theme/ObjectPaletteContext'

const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

function rangeLabel(item: MebCalendarItem): string {
  const start = dayjs(item.start).format('DD.MM.YYYY')
  if (item.start === item.end) return start
  return `${start} – ${dayjs(item.end).format('DD.MM.YYYY')}`
}

export function MebWorkCalendar() {
  const colors = useObjectColors()
  const tone = colors.swatch('blue')
  const [panelDate, setPanelDate] = useState<Dayjs>(() => dayjs())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const selectedItems = useMemo(
    () => (selectedDay ? mebItemsOnDay(selectedDay) : []),
    [selectedDay],
  )

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Millî Eğitim Bakanlığının 2026-2027 eğitim öğretim yılı çalışma takvimi. Ara tatil, yarıyıl ve sınav
        tarihleri bu takvimdedir.
      </Typography.Paragraph>
      <Calendar
        value={panelDate}
        onPanelChange={(date) => setPanelDate(date)}
        onSelect={(date, info) => {
          setPanelDate(date)
          if (info?.source === 'date') setSelectedDay(date.format('YYYY-MM-DD'))
        }}
        cellRender={(current, info) => {
          if (info.type !== 'date') return info.originNode
          const items = mebItemsOnDay(current.format('YYYY-MM-DD'))
          if (items.length === 0) return null
          const visible = items.slice(0, 2)
          const more = items.length - visible.length
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visible.map((item) => (
                <div
                  key={item.title}
                  title={item.title}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.3,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: tone.bg,
                    color: tone.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </div>
              ))}
              {more > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  +{more} daha
                </Typography.Text>
              )}
            </div>
          )
        }}
        headerRender={({ value, onChange }) => (
          <Space style={{ padding: 8 }}>
            <Select
              value={value.month()}
              onChange={(month) => {
                setSelectedDay(null)
                onChange(value.month(month))
              }}
              options={MONTH_NAMES.map((name, index) => ({ value: index, label: name }))}
              style={{ width: 120 }}
            />
            <InputNumber
              value={value.year()}
              onChange={(year) => {
                if (!year) return
                setSelectedDay(null)
                onChange(value.year(Number(year)))
              }}
              style={{ width: 90 }}
            />
          </Space>
        )}
      />
      <Modal
        title={selectedDay ? `${dayjs(selectedDay).format('DD.MM.YYYY')} — Çalışma takvimi` : ''}
        open={!!selectedDay}
        onCancel={() => setSelectedDay(null)}
        footer={null}
        width={560}
      >
        {selectedItems.length === 0 ? (
          <Typography.Text type="secondary">Bu günde MEB çalışma takvimi kaydı yok.</Typography.Text>
        ) : (
          <List
            dataSource={selectedItems}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <span>{item.title}</span>
                      <Tag style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
                        MEB
                      </Tag>
                    </Space>
                  }
                  description={rangeLabel(item)}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}
