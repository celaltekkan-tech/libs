import { useEffect, useMemo, useState } from 'react'
import { App, Button, Modal, Select, Space, Typography } from 'antd'
import { bulkRegistrationStatus } from '../api/students'
import { getErrorMessage } from '../api/client'
import type { ImportMissingClass, RegistrationStatus } from '../types/student'

const STATUS_OPTIONS: Array<{ value: Exclude<RegistrationStatus, 'aktif'>; label: string }> = [
  { value: 'nakil_giden', label: 'Nakil gitti' },
  { value: 'orgun_egitim_disi', label: 'Örgün eğitim dışına çıktı' },
]

interface StudentImportAbsenceModalProps {
  open: boolean
  groups: ImportMissingClass[]
  onClose: () => void
  onSaved: () => void
}

export function StudentImportAbsenceModal({ open, groups, onClose, onSaved }: StudentImportAbsenceModalProps) {
  const { message } = App.useApp()
  const [choices, setChoices] = useState<Record<number, Exclude<RegistrationStatus, 'aktif'> | undefined>>({})
  const [saving, setSaving] = useState(false)

  const total = useMemo(() => groups.reduce((sum, group) => sum + group.students.length, 0), [groups])

  useEffect(() => {
    if (open) setChoices({})
  }, [open, groups])

  const setClassStatus = (group: ImportMissingClass, status?: Exclude<RegistrationStatus, 'aktif'>) => {
    setChoices((current) => {
      const next = { ...current }
      for (const student of group.students) {
        if (status) next[student.id] = status
        else delete next[student.id]
      }
      return next
    })
  }

  const onSave = async () => {
    const updates = Object.entries(choices)
      .filter((entry): entry is [string, Exclude<RegistrationStatus, 'aktif'>] => Boolean(entry[1]))
      .map(([id, registration_status]) => ({ id: Number(id), registration_status }))
    if (updates.length === 0) {
      message.warning('En az bir öğrenci için durum seçin')
      return
    }
    setSaving(true)
    try {
      const result = await bulkRegistrationStatus(updates)
      message.success(`${result.updated} öğrencinin kayıt durumu güncellendi`)
      setChoices({})
      onSaved()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Excelde olmayan öğrenciler"
      open={open}
      onCancel={onClose}
      width={760}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Şimdilik işaretleme</Button>
          <Button type="primary" loading={saving} onClick={() => void onSave()}>
            Durumları kaydet
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        Dosyada geçen sınıflarda kayıtlı olup Excelde bulunmayan {total} aktif öğrenci var. Karar her sınıf
        için ayrı verilir. İşaretlenmeyen öğrenciler aktif kalır.
      </Typography.Paragraph>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {groups.map((group) => (
          <div key={group.classroom_id}>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
              <Typography.Text strong>
                {group.class_level}/{group.section} ({group.students.length})
              </Typography.Text>
              <Select
                allowClear
                placeholder="Bu sınıfın tümü"
                style={{ width: 240 }}
                options={STATUS_OPTIONS}
                onChange={(value) => setClassStatus(group, value)}
              />
            </Space>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {group.students.map((student) => (
                <Space key={student.id} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <span>
                    {student.first_name} {student.last_name}
                    {student.student_number ? ` · ${student.student_number}` : ''}
                  </span>
                  <Select
                    allowClear
                    placeholder="Durum seç"
                    style={{ width: 240 }}
                    options={STATUS_OPTIONS}
                    value={choices[student.id]}
                    onChange={(value) =>
                      setChoices((current) => {
                        const next = { ...current }
                        if (value) next[student.id] = value
                        else delete next[student.id]
                        return next
                      })
                    }
                  />
                </Space>
              ))}
            </Space>
          </div>
        ))}
      </Space>
    </Modal>
  )
}
