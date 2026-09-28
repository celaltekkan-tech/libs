import { useMemo, useState } from 'react'
import { Alert, App, Checkbox, Modal, Select, Table, Typography, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import {
  importProgram,
  previewProgramImport,
  type ProgramImportGap,
  type ProgramImportOverrides,
  type ProgramImportPreview,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_LABELS } from '../../types/scheduleEntry'
import type { Classroom } from '../../types/classroom'
import type { Subject } from '../../types/subject'
import type { Teacher } from '../../types/teacher'
import { shortClassroom, teacherFullName } from './shared'

export function ProgramImportModal({
  projectId,
  open,
  subjects,
  teachers,
  classrooms,
  onClose,
  onImported,
}: {
  projectId: number
  open: boolean
  subjects: Subject[]
  teachers: Teacher[]
  classrooms: Classroom[]
  onClose: () => void
  onImported: () => void
}) {
  const { message } = App.useApp()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [fixes, setFixes] = useState<Record<string, number>>({})

  const subjectOptions = useMemo(
    () =>
      [...subjects]
        .map((row) => ({ value: row.id, label: row.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr')),
    [subjects],
  )
  const teacherOptions = useMemo(
    () =>
      [...teachers]
        .map((row) => ({ value: row.id, label: teacherFullName(row) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr')),
    [teachers],
  )
  const classroomOptions = useMemo(
    () =>
      [...classrooms]
        .map((row) => ({ value: row.id, label: shortClassroom(row) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr', { numeric: true })),
    [classrooms],
  )

  const reset = () => {
    setFile(null)
    setPreview(null)
    setReading(false)
    setReplaceExisting(true)
    setFixes({})
  }

  const close = () => {
    reset()
    onClose()
  }

  const readFile = async (next: File) => {
    setFile(next)
    setPreview(null)
    setFixes({})
    setReading(true)
    try {
      setPreview(await previewProgramImport(projectId, next))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setReading(false)
    }
  }

  const save = async () => {
    if (!file) return
    setSaving(true)
    try {
      const overrides: ProgramImportOverrides = { subjects: {}, teachers: {}, classrooms: {} }
      for (const gap of preview?.gaps || []) {
        const id = fixes[`${gap.kind}:${gap.raw}`]
        if (!id) continue
        if (gap.kind === 'subject') overrides.subjects![gap.raw] = id
        else if (gap.kind === 'teacher') overrides.teachers![gap.raw] = id
        else overrides.classrooms![gap.raw] = id
      }
      const result = await importProgram(projectId, file, replaceExisting, overrides)
      message.success(`${result.lessons} ders saati programa yerleşti`)
      reset()
      onImported()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Ders programını içe aktar"
      open={open}
      onCancel={close}
      okText="İçe aktar"
      cancelText="Vazgeç"
      onOk={() => void save()}
      okButtonProps={{
        disabled: !preview || (!preview.matched && !preview.gaps.some((gap) => gap.kind !== 'teacher' && fixes[`${gap.kind}:${gap.raw}`])),
        loading: saving,
      }}
      width={860}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        Bilsan öğretmen ders programı PDF’i, e-Okul şube ders programı PDF’i, günlerin sütun olduğu bir Excel çizelgesi
        veya her satırda sınıf, ders, öğretmen, gün ve ders saati bulunan bir Excel liste kabul edilir. Eşleşen dersler
        kilitli olarak yerleşir.
      </Typography.Paragraph>
      <Upload.Dragger
        accept=".pdf,.xls,.xlsx"
        maxCount={1}
        showUploadList={false}
        beforeUpload={(next) => {
          void readFile(next)
          return false
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{file ? file.name : 'PDF veya Excel dosyasını bırakın'}</p>
      </Upload.Dragger>
      {reading && (
        <Typography.Paragraph style={{ marginTop: 12 }}>Dosya okunuyor…</Typography.Paragraph>
      )}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <Alert
            type={preview.matched ? 'info' : 'warning'}
            showIcon
            message={preview.format_label}
            description={`${preview.matched} ders saati eşleşti${
              preview.teacher_count ? `, ${preview.teacher_count} öğretmen` : ''
            }${preview.classroom_count ? `, ${preview.classroom_count} şube` : ''}. Dosyada ${preview.slot_count} saat var.`}
          />
          {preview.gaps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Typography.Text strong>Kontrol edilecek kayıtlar</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                Ders veya sınıf seçilmeyen saatler yazılmaz. Öğretmeni boş bıraktığınız saatler öğretmensiz yerleşir.
              </Typography.Paragraph>
              <Table
                size="small"
                pagination={false}
                scroll={{ y: 220 }}
                rowKey={(gap) => `${gap.kind}:${gap.raw}`}
                dataSource={preview.gaps}
                columns={[
                  {
                    title: 'Dosyada',
                    dataIndex: 'raw',
                    ellipsis: true,
                    render: (raw: string, gap: ProgramImportGap) => (
                      <span>
                        {gap.kind === 'teacher' ? 'Öğretmen' : gap.kind === 'classroom' ? 'Sınıf' : 'Ders'}: {raw}
                      </span>
                    ),
                  },
                  { title: 'Saat', dataIndex: 'count', width: 64 },
                  {
                    title: 'Karşılığı',
                    width: 280,
                    render: (_: unknown, gap: ProgramImportGap) => (
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        placeholder={gap.kind === 'teacher' ? 'Öğretmen seçin' : gap.kind === 'classroom' ? 'Şube seçin' : 'Ders seçin'}
                        style={{ width: '100%' }}
                        options={gap.kind === 'teacher' ? teacherOptions : gap.kind === 'classroom' ? classroomOptions : subjectOptions}
                        value={fixes[`${gap.kind}:${gap.raw}`]}
                        onChange={(value) =>
                          setFixes((prev) => {
                            const next = { ...prev }
                            const key = `${gap.kind}:${gap.raw}`
                            if (value) next[key] = value
                            else delete next[key]
                            return next
                          })
                        }
                      />
                    ),
                  },
                ]}
              />
            </div>
          )}
          <Table
            style={{ marginTop: 12 }}
            size="small"
            pagination={false}
            scroll={{ y: 240 }}
            rowKey={(row) => `${row.classroom}-${row.day}-${row.period}-${row.subject}`}
            dataSource={preview.sample}
            columns={[
              { title: 'Öğretmen', dataIndex: 'teacher', ellipsis: true },
              { title: 'Şube', dataIndex: 'classroom', width: 80 },
              { title: 'Gün', dataIndex: 'day', width: 110, render: (day: number) => DAY_LABELS[day] || day },
              { title: 'Saat', dataIndex: 'period', width: 64 },
              { title: 'Ders', dataIndex: 'subject', ellipsis: true },
            ]}
          />
          <Checkbox style={{ marginTop: 12 }} checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)}>
            Bu projedeki yerleşmiş derslerin yerine yaz
          </Checkbox>
        </div>
      )}
    </Modal>
  )
}
