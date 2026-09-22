import { useEffect, useMemo, useState } from 'react'
import { App, DatePicker, Modal, Select, Space, TimePicker, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { scheduleSorumlulukSubject } from '../api/exams'
import type { ScheduleTeacherOption } from '../api/schedule'
import { getErrorMessage } from '../api/client'
import type { CommitteeMember } from '../types/exam'
import { sorumlulukSubjectLabel } from '../types/exam'
import {
  dutyCounts,
  isDualSubject,
  proctorCount,
  roleLabel,
  suggestMembers,
  suggestProctors,
  type SchoolLanguages,
} from '../utils/sorumlulukExam'
import type { SorumlulukSubjectSlot } from './SorumlulukExamPlanner'

interface SorumlulukExamCommitteeModalProps {
  open: boolean
  slot: SorumlulukSubjectSlot | null
  examDate: string | null
  teachers: ScheduleTeacherOption[]
  principalName: string | null
  principalTeacherId: number | null
  languages: SchoolLanguages
  slots: SorumlulukSubjectSlot[]
  onCancel: () => void
  onSaved: () => void
}

function teacherOptionLabel(teacher: ScheduleTeacherOption, duties: Map<number, number>): string {
  const count = duties.get(teacher.id) || 0
  const branch = teacher.subject_names[0]
  const duty = count > 0 ? ` · ${count} görev` : ''
  return branch
    ? `${teacher.first_name} ${teacher.last_name} (${branch})${duty}`
    : `${teacher.first_name} ${teacher.last_name}${duty}`
}

function toDay(value: string | null | undefined): Dayjs | null {
  return value ? dayjs(value) : null
}

function toTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map((part) => Number(part))
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0)
}

export function SorumlulukExamCommitteeModal({
  open,
  slot,
  examDate,
  teachers,
  principalName,
  principalTeacherId,
  languages,
  slots,
  onCancel,
  onSaved,
}: SorumlulukExamCommitteeModalProps) {
  const { message } = App.useApp()
  const [memberIds, setMemberIds] = useState<[number | null, number | null]>([null, null])
  const [proctorIds, setProctorIds] = useState<number[]>([])
  const [writtenDate, setWrittenDate] = useState<Dayjs | null>(null)
  const [writtenTime, setWrittenTime] = useState<Dayjs | null>(null)
  const [oralDate, setOralDate] = useState<Dayjs | null>(null)
  const [oralTime, setOralTime] = useState<Dayjs | null>(null)
  const [saving, setSaving] = useState(false)

  const duties = useMemo(() => dutyCounts(slots), [slots])
  const dual = slot ? isDualSubject(slot.subject_name) : false
  const neededProctors = slot ? proctorCount(slot.student_count) : 0
  const suggestions = slot
    ? suggestMembers(slot, teachers, principalTeacherId ? [principalTeacherId] : [], languages, 2)
    : []

  useEffect(() => {
    if (!open || !slot) return
    const savedMembers = (slot.committee_members || []).filter((member) => member.role === 'uye')
    const savedProctors = (slot.committee_members || [])
      .filter((member) => member.role === 'gozetmen')
      .map((member) => member.teacher_id)
    const suggested = suggestMembers(slot, teachers, principalTeacherId ? [principalTeacherId] : [], languages, 2)
    const first = savedMembers[0]?.teacher_id ?? suggested[0]?.id ?? null
    const second =
      savedMembers[1]?.teacher_id ?? suggested.find((teacher) => teacher.id !== first)?.id ?? null
    const chairId = principalTeacherId
    const exclude = [chairId, first, second].filter((id): id is number => !!id)
    const suggestedProctors = suggestProctors(slot, teachers, exclude, languages)
    setMemberIds([first, second])
    setProctorIds(savedProctors.length ? savedProctors : suggestedProctors.map((teacher) => teacher.id))
    const clickedWritten = examDate && examDate !== slot.oral_exam_date ? examDate : slot.exam_date
    setWrittenDate(toDay(clickedWritten))
    setWrittenTime(toTime(slot.start_time))
    setOralDate(toDay(slot.oral_exam_date))
    setOralTime(toTime(slot.oral_start_time))
  }, [open, slot, teachers, principalTeacherId, examDate, languages])

  const onOk = async () => {
    if (!slot) return
    if (!principalTeacherId) {
      message.error('Bu okulun müdür hesabı personel listesinde bulunamadı')
      return
    }
    const [firstMember, secondMember] = memberIds
    if (!firstMember || !secondMember) {
      message.warning('Komisyon için iki üye seçin')
      return
    }
    if (firstMember === secondMember) {
      message.warning('İki üye farklı olmalıdır')
      return
    }
    if (firstMember === principalTeacherId || secondMember === principalTeacherId) {
      message.warning('Üyeler, başkandan farklı olmalıdır')
      return
    }
    const written = writtenDate ? writtenDate.format('YYYY-MM-DD') : null
    const oral = dual && oralDate ? oralDate.format('YYYY-MM-DD') : null
    if (dual && written && oral && written === oral) {
      message.error('Yazılı ve sözlü sınav aynı güne konamaz')
      return
    }
    if (dual && written && !oral) {
      message.warning('Sözlü sınavın gününü de seçin')
      return
    }
    if (dual && oral && !written) {
      message.warning('Yazılı sınavın gününü de seçin')
      return
    }

    const committee_members: CommitteeMember[] = [
      { teacher_id: principalTeacherId, role: 'baskan' },
      { teacher_id: firstMember, role: 'uye' },
      { teacher_id: secondMember, role: 'uye' },
    ]
    for (const id of proctorIds) {
      if (id === principalTeacherId || id === firstMember || id === secondMember) continue
      committee_members.push({ teacher_id: id, role: 'gozetmen' })
    }

    setSaving(true)
    try {
      await scheduleSorumlulukSubject({
        subject_class_level: slot.subject_class_level,
        subject_name: slot.subject_name,
        exam_date: written,
        start_time: writtenTime ? writtenTime.format('HH:mm') : null,
        oral_exam_date: dual ? oral : null,
        oral_start_time: dual && oralTime ? oralTime.format('HH:mm') : null,
        teacher_id: principalTeacherId,
        committee_members,
      })
      message.success('Komisyon güncellendi')
      onSaved()
      onCancel()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const optionOf = (teacher: ScheduleTeacherOption) => ({
    value: teacher.id,
    label: teacherOptionLabel(teacher, duties),
  })

  return (
    <Modal
      title={slot ? `Komisyon belirle — ${sorumlulukSubjectLabel(slot)}` : 'Komisyon belirle'}
      open={open}
      onCancel={onCancel}
      onOk={() => void onOk()}
      okText="Kaydet"
      cancelText="Vazgeç"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            Başkan
          </Typography.Text>
          <Typography.Text>
            {principalName || 'Bu okul için müdür hesabı bulunamadı'}
            {principalTeacherId ? '' : principalName ? ' (personel kaydı eşleşmedi)' : ''}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            Önerilen öğretmen
          </Typography.Text>
          <Typography.Text>
            {suggestions.length
              ? suggestions
                  .map(
                    (teacher) =>
                      `${teacher.first_name} ${teacher.last_name}${
                        teacher.subject_names[0] ? ` — ${teacher.subject_names[0]}` : ''
                      }`,
                  )
                  .join(', ')
              : 'Bu dersin branşına uyan öğretmen bulunamadı'}
          </Typography.Text>
        </div>
        {([0, 1] as const).map((index) => (
          <div key={index}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
              Üye {index + 1}
            </Typography.Text>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={`Komisyon üyesi ${index + 1}`}
              style={{ width: '100%' }}
              value={memberIds[index] ?? undefined}
              onChange={(value) =>
                setMemberIds((current) => {
                  const next: [number | null, number | null] = [current[0], current[1]]
                  next[index] = value
                  return next
                })
              }
              options={teachers
                .filter((teacher) => teacher.id !== principalTeacherId && teacher.id !== memberIds[index === 0 ? 1 : 0])
                .map(optionOf)}
            />
          </div>
        ))}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
            Gözetmen
          </Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 6 }}>
            {slot
              ? `${slot.student_count} öğrenci için ${neededProctors} gözetmen önerilir. Önce dersin branşından farklı öğretmenler seçilir; yetmezse aynı branş da kullanılabilir. Sözlü sınavda gözetmen yoktur.`
              : ''}
          </Typography.Paragraph>
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Yazılı sınav gözetmenleri"
            style={{ width: '100%' }}
            value={proctorIds}
            onChange={setProctorIds}
            options={teachers
              .filter(
                (teacher) =>
                  teacher.id !== principalTeacherId &&
                  teacher.id !== memberIds[0] &&
                  teacher.id !== memberIds[1],
              )
              .map(optionOf)}
          />
        </div>
        {dual && (
          <Space wrap size={12}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Yazılı günü
              </Typography.Text>
              <DatePicker value={writtenDate} onChange={setWrittenDate} format="DD.MM.YYYY" />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Yazılı saati
              </Typography.Text>
              <TimePicker value={writtenTime} onChange={setWrittenTime} format="HH:mm" minuteStep={5} />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Sözlü günü
              </Typography.Text>
              <DatePicker
                value={oralDate}
                onChange={setOralDate}
                format="DD.MM.YYYY"
                disabledDate={(current) => !!writtenDate && current.isSame(writtenDate, 'day')}
              />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
                Sözlü saati
              </Typography.Text>
              <TimePicker value={oralTime} onChange={setOralTime} format="HH:mm" minuteStep={5} />
            </div>
          </Space>
        )}
        {slot && slot.committee_members && slot.committee_members.length > 0 && (
          <Typography.Text type="secondary">
            Kayıtlı komisyon:{' '}
            {slot.committee_members
              .map((member) => {
                const teacher = teachers.find((item) => item.id === member.teacher_id)
                const name = teacher ? `${teacher.first_name} ${teacher.last_name}` : `#${member.teacher_id}`
                return `${name} (${roleLabel(member.role)})`
              })
              .join(', ')}
          </Typography.Text>
        )}
      </Space>
    </Modal>
  )
}
