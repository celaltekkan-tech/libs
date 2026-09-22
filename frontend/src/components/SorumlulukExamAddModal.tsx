import { useEffect, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { createSorumlulukItem } from '../api/exams'
import { listStudents } from '../api/students'
import { listSubjects } from '../api/subjects'
import { getErrorMessage } from '../api/client'
import type { Student } from '../types/student'
import type { Subject } from '../types/subject'

const GRADE_OPTIONS = ['5', '6', '7', '8', '9', '10', '11', '12'].map((level) => ({
  value: level,
  label: `${level}. sınıf`,
}))

interface SorumlulukExamAddModalProps {
  open: boolean
  onCancel: () => void
  onCreated: () => void
}

function studentLabel(student: Student): string {
  const klass =
    student.class_level && student.section ? `${student.class_level}/${student.section}` : ''
  const no = student.student_number ? `${student.student_number} · ` : ''
  return `${no}${student.first_name} ${student.last_name}${klass ? ` · ${klass}` : ''}`
}

export function SorumlulukExamAddModal({ open, onCancel, onCreated }: SorumlulukExamAddModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    setLoading(true)
    void Promise.all([listStudents(), listSubjects({ is_active: true })])
      .then(([studentRows, subjectRows]) => {
        setStudents(studentRows)
        setSubjects(subjectRows)
      })
      .catch((err) => message.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [open, form, message])

  const onOk = async () => {
    const values = await form.validateFields()
    const subjectName = String(values.subject_name || '').trim()
    if (!values.subject_id && !subjectName) {
      message.warning('Katalogdan ders seçin veya yeni ders adı yazın')
      return
    }
    setSaving(true)
    try {
      await createSorumlulukItem({
        student_id: values.student_id,
        subject_class_level: values.subject_class_level,
        subject_id: subjectName ? null : values.subject_id,
        subject_name: subjectName || null,
      })
      message.success('Sorumluluk kaydı eklendi')
      onCreated()
      onCancel()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Sorumluluk kaydı ekle"
      open={open}
      onCancel={onCancel}
      onOk={() => void onOk()}
      okText="Ekle"
      cancelText="Vazgeç"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={loading}>
        <Form.Item name="student_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçin' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="No veya ad soyad"
            options={students.map((s) => ({ value: s.id, label: studentLabel(s) }))}
            onChange={(id) => {
              const student = students.find((s) => s.id === id)
              const current = form.getFieldValue('subject_class_level')
              const level = Number.parseInt(student?.class_level || '', 10)
              if (!current && level > 5) {
                form.setFieldValue('subject_class_level', String(level - 1))
              }
            }}
          />
        </Form.Item>
        <Form.Item
          name="subject_class_level"
          label="Sorumlu olduğu sınıf"
          rules={[{ required: true, message: 'Sınıf seviyesi seçin' }]}
        >
          <Select options={GRADE_OPTIONS} placeholder="Örn. 9. sınıf" />
        </Form.Item>
        <Form.Item name="subject_id" label="Ders">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Katalogdan seçin"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <Form.Item name="subject_name" label="Katalogda yoksa ders adı">
          <Input placeholder="Yeni ders adı yazılırsa kataloga eklenir" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
