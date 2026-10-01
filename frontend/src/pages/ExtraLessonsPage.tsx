import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Calendar, Card, Form, Input, List, Modal, Select, Space, Tabs, Tag, Typography, theme } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
import { AppLayout } from '../components/AppLayout'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import { useAuth } from '../auth/AuthContext'
import { deleteExtraLessonAbsence, listExtraLessonAbsences, saveExtraLessonAbsence } from '../api/extraLessons'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { EXTRA_LESSON_ABSENCE_REASONS, type ExtraLessonAbsence, type ExtraLessonAbsenceReason } from '../types/extraLesson'
import type { Teacher } from '../types/teacher'

dayjs.locale('tr')

const now = dayjs()

const REASON_LABEL = Object.fromEntries(EXTRA_LESSON_ABSENCE_REASONS.map((item) => [item.value, item.label]))

function personName(teacher: Teacher) {
  return `${teacher.first_name} ${teacher.last_name}`
}

export function ExtraLessonsPage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { hasPermission } = useAuth()
  const { activeSchoolId } = useActiveSchool()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [absences, setAbsences] = useState<ExtraLessonAbsence[]>([])
  const [tab, setTab] = useState<'ucretli' | 'dis'>('ucretli')
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [cursor, setCursor] = useState(now.startOf('month'))
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ reason: ExtraLessonAbsenceReason; note?: string }>()
  const canUpdate = hasPermission('payroll.update') || hasPermission('payroll.create')
  const canDelete = hasPermission('payroll.delete')

  const loadTeachers = useCallback(async () => {
    const rows = await listTeachers({
      scope: 'teachers',
      school_id: activeSchoolId ?? undefined,
    })
    setTeachers(rows)
  }, [activeSchoolId])

  const loadAbsences = useCallback(async () => {
    setLoading(true)
    try {
      setAbsences(await listExtraLessonAbsences(cursor.year(), cursor.month() + 1, teacherId ?? undefined))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [cursor, teacherId, message])

  useEffect(() => {
    void loadTeachers().catch((err) => message.error(getErrorMessage(err)))
  }, [loadTeachers, message])

  useEffect(() => {
    void loadAbsences()
  }, [loadAbsences])

  const visibleTeachers = useMemo(() => {
    const rows = teachers.filter((teacher) =>
      tab === 'ucretli' ? teacher.employment_type === 'ucretli' : Boolean(teacher.duty_assignment_type),
    )
    return [...rows].sort((a, b) => personName(a).localeCompare(personName(b), 'tr'))
  }, [teachers, tab])

  useEffect(() => {
    if (!visibleTeachers.some((teacher) => teacher.id === teacherId)) {
      setTeacherId(visibleTeachers[0]?.id ?? null)
    }
  }, [visibleTeachers, teacherId])

  const byDate = useMemo(() => {
    const map = new Map<string, ExtraLessonAbsence>()
    for (const row of absences) {
      if (teacherId && row.teacher_id !== teacherId) continue
      map.set(String(row.absence_date).slice(0, 10), row)
    }
    return map
  }, [absences, teacherId])

  const openDay = (value: Dayjs) => {
    if (!teacherId || !canUpdate) return
    const key = value.format('YYYY-MM-DD')
    const existing = byDate.get(key)
    setDay(key)
    form.setFieldsValue({
      reason: existing?.reason || 'rapor',
      note: existing?.note || undefined,
    })
  }

  const onSave = async (values: { reason: ExtraLessonAbsenceReason; note?: string }) => {
    if (!teacherId || !day) return
    setSaving(true)
    try {
      await saveExtraLessonAbsence({
        teacher_id: teacherId,
        absence_date: day,
        reason: values.reason,
        note: values.note?.trim() || null,
      })
      message.success('Devamsızlık kaydedildi')
      setDay(null)
      await loadAbsences()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onRemove = async () => {
    if (!day) return
    const existing = byDate.get(day)
    if (!existing) {
      setDay(null)
      return
    }
    setSaving(true)
    try {
      await deleteExtraLessonAbsence(existing.id)
      message.success('Devamsızlık silindi')
      setDay(null)
      await loadAbsences()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Ek Ders ve Ücret Puantajı">
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Ek Ders ve Ücret Puantajı
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Ücretli öğretmenler ve dış kurum görevlendirmesi burada izlenir. Kendi kadrolu personel için puantaj tutulmaz.
        Aylık takvimde güne tıklayıp devamsızlığı ve nedenini yazın. Puantaj çıktısı örnek form geldikten sonra eklenecek.
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as 'ucretli' | 'dis')}
        items={[
          { key: 'ucretli', label: 'Ücretli' },
          { key: 'dis', label: 'Dış kurum' },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        <Card size="small" title={tab === 'ucretli' ? 'Ücretli öğretmenler' : 'Dış kurum görevlendirmesi'} loading={loading}>
          <List
            size="small"
            dataSource={visibleTeachers}
            locale={{ emptyText: 'Bu grupta personel yok' }}
            renderItem={(teacher) => {
              const selected = teacher.id === teacherId
              return (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: selected ? '#fff7e6' : undefined,
                    borderRadius: selected ? 8 : undefined,
                  }}
                  onClick={() => setTeacherId(teacher.id)}
                >
                  <Space direction="vertical" size={0}>
                    <span style={{ color: selected ? '#0958d9' : token.colorText, fontWeight: selected ? 600 : 400 }}>
                      {personName(teacher)}
                    </span>
                    <span style={{ fontSize: 12, color: selected ? '#003eb3' : token.colorTextSecondary }}>
                      {teacher.brans || '—'}
                    </span>
                  </Space>
                </List.Item>
              )
            }}
          />
        </Card>
        <Card size="small">
          <Calendar
            value={cursor}
            onPanelChange={(value) => setCursor(value.startOf('month'))}
            onSelect={(value) => {
              if (value.month() !== cursor.month() || value.year() !== cursor.year()) {
                setCursor(value.startOf('month'))
                return
              }
              openDay(value)
            }}
            cellRender={(value) => {
              const row = byDate.get(value.format('YYYY-MM-DD'))
              if (!row) return null
              return <Tag color="orange">{REASON_LABEL[row.reason] || row.reason}</Tag>
            }}
          />
        </Card>
      </div>
      <Modal
        title={day ? dayjs(day).format('D MMMM YYYY') : 'Devamsızlık'}
        open={Boolean(day)}
        onCancel={() => setDay(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Kaydet"
        cancelText="Vazgeç"
        okButtonProps={{ disabled: !canUpdate }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space>
            {canDelete && byDate.get(day || '') && (
              <Button danger loading={saving} onClick={() => void onRemove()}>
                Sil
              </Button>
            )}
            <CancelBtn />
            <OkBtn />
          </Space>
        )}
      >
        <Form form={form} layout="vertical" onFinish={(values) => void onSave(values)}>
          <Form.Item name="reason" label="Neden" rules={[{ required: true, message: 'Neden seçin' }]}>
            <Select options={EXTRA_LESSON_ABSENCE_REASONS.map((item) => ({ value: item.value, label: item.label }))} />
          </Form.Item>
          <Form.Item name="note" label="Açıklama">
            <Input.TextArea rows={3} maxLength={300} placeholder="İsteğe bağlı" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
