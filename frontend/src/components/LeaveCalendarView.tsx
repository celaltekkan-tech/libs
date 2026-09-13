import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Calendar,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { CalendarProps } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { fetchLeaveCalendar } from '../api/leaves'
import { createHoliday, deleteHoliday, listHolidays, seedDefaultHolidays } from '../api/holidays'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { LEAVE_TYPE_LABELS } from '../types/leaveRecord'
import type { LeaveCalendarDay } from '../types/leaveCalendar'
import type { Holiday } from '../types/holiday'

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

interface HolidayFormValues {
  name: string
  date_range: [Dayjs, Dayjs]
  recurring?: boolean
}

// İzinli personel oranına göre gün hücresinin taban rengi hesaplanır: oran
// arttıkça renk koyulaşır (0 => renksiz, 1 => en koyu ton).
function leaveBackgroundColor(ratio: number): string | undefined {
  if (ratio <= 0) return undefined
  const clamped = Math.min(1, ratio)
  const lightness = 92 - clamped * 52 // %92 (açık) -> %40 (koyu)
  return `hsl(28, 85%, ${lightness}%)`
}

export function LeaveCalendarView() {
  const { message } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [panelDate, setPanelDate] = useState<Dayjs>(dayjs())
  const [days, setDays] = useState<Map<string, LeaveCalendarDay>>(new Map())
  const [totalPersonnel, setTotalPersonnel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<LeaveCalendarDay | null>(null)
  const [holidayModalOpen, setHolidayModalOpen] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<HolidayFormValues>()
  const dateRange = Form.useWatch('date_range', form)
  const isSingleDay = !!(dateRange?.[0] && dateRange?.[1] && dateRange[0].isSame(dateRange[1], 'day'))

  const canManageHolidays = hasPermission('leaves.create')

  const loadMonth = useCallback(
    async (date: Dayjs) => {
      setLoading(true)
      try {
        const result = await fetchLeaveCalendar(date.year(), date.month() + 1)
        const map = new Map<string, LeaveCalendarDay>()
        result.days.forEach((d) => map.set(d.date, d))
        setDays(map)
        setTotalPersonnel(result.total_personnel)
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    void loadMonth(panelDate)
  }, [panelDate, loadMonth])

  const loadHolidays = useCallback(async () => {
    try {
      setHolidays(await listHolidays())
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [message])

  useEffect(() => {
    void loadHolidays()
  }, [loadHolidays])

  const onSelect = (date: Dayjs) => {
    const info = days.get(date.format('YYYY-MM-DD'))
    setSelectedDay(info || { date: date.format('YYYY-MM-DD'), day: date.date(), is_holiday: false, holiday_name: null, leave_count: 0, leave_ratio: 0, teachers: [] })
  }

  const onSeedDefaults = async () => {
    setSubmitting(true)
    try {
      await seedDefaultHolidays()
      message.success('Varsayılan resmi tatiller tanımlandı (mevcut kayıtlar tekrar eklenmez)')
      void loadHolidays()
      void loadMonth(panelDate)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onAddHoliday = async (values: HolidayFormValues) => {
    if (!session) return
    const [start, end] = values.date_range
    setSubmitting(true)
    try {
      const result = await createHoliday(session.user.tenant_id, {
        name: values.name,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        recurring: isSingleDay ? !!values.recurring : false,
      })
      const created = result.meta?.created ?? (Array.isArray(result.data) ? result.data.length : 1)
      const skipped = result.meta?.skipped ?? 0
      if (skipped > 0) {
        message.success(`${created} gün eklendi, ${skipped} gün zaten tanımlı olduğu için atlandı`)
      } else {
        message.success(created > 1 ? `${created} gün resmi tatil olarak eklendi` : 'Resmi tatil eklendi')
      }
      form.resetFields()
      void loadHolidays()
      void loadMonth(panelDate)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteHoliday = async (holiday: Holiday) => {
    try {
      await deleteHoliday(holiday.id)
      message.success('Silindi')
      void loadHolidays()
      void loadMonth(panelDate)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const key = current.format('YYYY-MM-DD')
    const dayInfo = days.get(key)
    const bg = dayInfo ? leaveBackgroundColor(dayInfo.leave_ratio) : undefined
    return (
      <div
        style={{
          background: bg,
          borderRadius: 6,
          padding: '2px 4px',
          minHeight: 46,
          border: dayInfo?.is_holiday ? '1px solid #1677ff' : undefined,
        }}
      >
        {dayInfo?.is_holiday && (
          <div style={{ fontSize: 10, color: '#1677ff', fontWeight: 600, lineHeight: 1.2 }}>
            {dayInfo.holiday_name}
          </div>
        )}
        {dayInfo && dayInfo.leave_count > 0 && (
          <div style={{ fontSize: 11, color: '#7c4a03', fontWeight: 600 }}>
            {dayInfo.leave_count} izinli
          </div>
        )}
      </div>
    )
  }

  const legend = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, color: leaveBackgroundColor(ratio) })),
    [],
  )

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Space wrap align="center">
          <Typography.Text type="secondary">Toplam personel: {totalPersonnel}</Typography.Text>
          <Space size={4} align="center">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              İzinli oranı:
            </Typography.Text>
            {legend.map(({ ratio, color }) => (
              <div
                key={ratio}
                title={`%${Math.round(ratio * 100)}`}
                style={{ width: 18, height: 18, background: color || '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4 }}
              />
            ))}
          </Space>
        </Space>
        {canManageHolidays && (
          <Button size="small" onClick={() => setHolidayModalOpen(true)}>
            Resmi Tatilleri Yönet
          </Button>
        )}
      </Space>

      <Calendar
        value={panelDate}
        onPanelChange={(date) => setPanelDate(date)}
        onSelect={onSelect}
        cellRender={cellRender}
        headerRender={({ value, onChange }) => (
          <Space style={{ padding: 8 }}>
            <Select
              value={value.month()}
              onChange={(m) => onChange(value.month(m))}
              options={MONTH_NAMES.map((name, idx) => ({ value: idx, label: name }))}
              style={{ width: 120 }}
            />
            <InputNumber
              value={value.year()}
              onChange={(y) => y && onChange(value.year(Number(y)))}
              style={{ width: 90 }}
            />
          </Space>
        )}
      />
      {loading && <Typography.Text type="secondary">Yükleniyor...</Typography.Text>}

      <Modal
        title={selectedDay ? `${selectedDay.date} — İzinli Personel` : ''}
        open={!!selectedDay}
        onCancel={() => setSelectedDay(null)}
        footer={<Button onClick={() => setSelectedDay(null)}>Kapat</Button>}
      >
        {selectedDay?.is_holiday && <Tag color="blue" style={{ marginBottom: 12 }}>Resmi Tatil: {selectedDay.holiday_name}</Tag>}
        {selectedDay && selectedDay.teachers.length === 0 ? (
          <Typography.Text type="secondary">Bu gün izinli personel bulunmuyor.</Typography.Text>
        ) : (
          <List
            dataSource={selectedDay?.teachers || []}
            renderItem={(t) => (
              <List.Item>
                <Space>
                  <span>{t.teacher_name || '—'}</span>
                  <Tag>{LEAVE_TYPE_LABELS[t.leave_type] || t.leave_type}</Tag>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>

      <Modal
        title="Resmi Tatiller"
        open={holidayModalOpen}
        onCancel={() => setHolidayModalOpen(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button size="small" onClick={() => void onSeedDefaults()} loading={submitting}>
            Varsayılan Resmi Tatilleri Tanımla
          </Button>
          <List
            dataSource={holidays}
            renderItem={(h) => (
              <List.Item
                actions={
                  canManageHolidays
                    ? [<Button key="del" size="small" danger icon={<DeleteOutlined />} onClick={() => void onDeleteHoliday(h)} />]
                    : []
                }
              >
                <span>
                  {h.day}.{h.month} {h.year ? `(${h.year})` : '(her yıl)'} — {h.name}
                </span>
              </List.Item>
            )}
          />
          {canManageHolidays && (
            <Form form={form} layout="vertical" onFinish={onAddHoliday} style={{ marginTop: 12 }}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Bayram gibi çok günlük tatiller için tarih aralığı seçin; tek gün de seçebilirsiniz.
              </Typography.Text>
              <Form.Item name="name" label="Tatil adı" rules={[{ required: true, message: 'Ad zorunludur' }]}>
                <Input placeholder="ör. Kurban Bayramı" />
              </Form.Item>
              <Form.Item
                name="date_range"
                label="Tarih / aralık"
                rules={[{ required: true, message: 'Tarih seçin' }]}
              >
                <DatePicker.RangePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
              </Form.Item>
              {isSingleDay && (
                <Form.Item name="recurring" valuePropName="checked" initialValue={false}>
                  <Checkbox>Her yıl tekrarla (yılbaşı, 23 Nisan vb.)</Checkbox>
                </Form.Item>
              )}
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={submitting} block>
                  Ekle
                </Button>
              </Form.Item>
            </Form>
          )}
        </Space>
      </Modal>
    </div>
  )
}
