import { useCallback, useEffect, useState } from 'react'
import { App, Button, Calendar, InputNumber, List, Modal, Select, Space, Tag, Typography } from 'antd'
import type { CalendarProps } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { fetchAbsenceCalendar } from '../api/absences'
import type { AbsenceCalendarDay } from '../api/absences'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import { FilterBar } from './FilterBar'
import { ABSENCE_TYPE_COLORS, ABSENCE_TYPE_LABELS } from '../types/studentAbsence'
import type { Student } from '../types/student'
import { useObjectColors } from '../theme/ObjectPaletteContext'
import { type SwatchName } from '../theme/objectPalette'

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

const ABSENCE_TYPE_SWATCH: Record<string, SwatchName> = {
  mazeretsiz: 'red',
  mazeretli: 'blue',
  raporlu: 'purple',
  yarim_gun: 'gold',
}

export function AbsenceCalendarView() {
  const { message } = App.useApp()
  const colors = useObjectColors()

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [panelDate, setPanelDate] = useState<Dayjs>(dayjs())
  const [days, setDays] = useState<Map<string, AbsenceCalendarDay>>(new Map())
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<AbsenceCalendarDay | null>(null)

  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch((err) => message.error(getErrorMessage(err)))
  }, [message])

  const loadMonth = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAbsenceCalendar(panelDate.year(), panelDate.month() + 1, selectedStudentId)
      const map = new Map<string, AbsenceCalendarDay>()
      result.days.forEach((d) => map.set(d.date, d))
      setDays(map)
      setTotalStudents(result.total_students)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [panelDate, selectedStudentId, message])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  const onSelect = (date: Dayjs) => {
    const info = days.get(date.format('YYYY-MM-DD'))
    setSelectedDay(
      info || {
        date: date.format('YYYY-MM-DD'), day: date.date(), is_holiday: false, holiday_name: null,
        absent_count: 0, total_students: totalStudents, absent_ratio: 0, students: [],
      },
    )
  }

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return info.originNode
    const key = current.format('YYYY-MM-DD')
    const dayInfo = days.get(key)
    let bg: string | undefined
    let text = colors.swatch('red').text
    if (dayInfo) {
      if (selectedStudentId) {
        const entry = dayInfo.students.find((s) => s.student_id === selectedStudentId)
        if (entry) {
          const tone = colors.swatch(ABSENCE_TYPE_SWATCH[entry.absence_type] || 'red')
          bg = tone.bg
          text = tone.text
        }
      } else {
        const heat = colors.heat('red', dayInfo.absent_ratio)
        bg = heat.bg
        text = heat.text
      }
    }
    const holiday = colors.swatch('blue')
    return (
      <div
        style={{
          background: bg,
          borderRadius: 6,
          padding: '2px 4px',
          minHeight: 46,
          border: dayInfo?.is_holiday ? `1px solid ${holiday.border}` : undefined,
        }}
      >
        {dayInfo?.is_holiday && (
          <div style={{ fontSize: 10, color: holiday.text, fontWeight: 600, lineHeight: 1.2 }}>{dayInfo.holiday_name}</div>
        )}
        {selectedStudentId
          ? dayInfo && dayInfo.students.length > 0 && (
              <div style={{ fontSize: 11, color: text, fontWeight: 600 }}>
                {ABSENCE_TYPE_LABELS[dayInfo.students[0].absence_type] || dayInfo.students[0].absence_type}
              </div>
            )
          : dayInfo &&
            dayInfo.absent_count > 0 && (
              <div style={{ fontSize: 11, color: text, fontWeight: 600 }}>{dayInfo.absent_count} devamsız</div>
            )}
      </div>
    )
  }

  return (
    <div>
      <FilterBar style={{ marginBottom: 12 }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Tüm öğrenciler (genel görünüm)"
          value={selectedStudentId ?? undefined}
          onChange={(v) => setSelectedStudentId(v ?? null)}
          options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name} (${s.student_number || '—'})` }))}
          style={{ width: 300 }}
        />
        {!selectedStudentId && <Typography.Text type="secondary">Toplam öğrenci: {totalStudents}</Typography.Text>}
      </FilterBar>

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
            <InputNumber value={value.year()} onChange={(y) => y && onChange(value.year(Number(y)))} style={{ width: 90 }} />
          </Space>
        )}
      />
      {loading && <Typography.Text type="secondary">Yükleniyor...</Typography.Text>}

      <Modal
        title={selectedDay ? `${selectedDay.date} — Devamsız Öğrenciler` : ''}
        open={!!selectedDay}
        onCancel={() => setSelectedDay(null)}
        footer={<Button onClick={() => setSelectedDay(null)}>Kapat</Button>}
      >
        {selectedDay?.is_holiday && <Tag color="blue" style={{ marginBottom: 12 }}>Resmi Tatil: {selectedDay.holiday_name}</Tag>}
        {selectedDay && selectedDay.students.length === 0 ? (
          <Typography.Text type="secondary">Bu gün devamsız öğrenci bulunmuyor.</Typography.Text>
        ) : (
          <List
            dataSource={selectedDay?.students || []}
            renderItem={(s) => (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Space>
                    <span>{s.student_name || '—'}</span>
                    <Tag color={ABSENCE_TYPE_COLORS[s.absence_type]}>{ABSENCE_TYPE_LABELS[s.absence_type] || s.absence_type}</Tag>
                  </Space>
                  {s.reason && <Typography.Text type="secondary">{s.reason}</Typography.Text>}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}
