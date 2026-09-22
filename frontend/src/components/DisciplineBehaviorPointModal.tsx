import { useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select } from 'antd'
import type { Student } from '../types/student'

interface DisciplineBehaviorPointModalProps {
  open: boolean
  students: Student[]
  academicYear: string
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: {
    student_id: number
    academic_year: string
    points_deducted: number
    points_restored: number
    restore_date?: string
    reason?: string
  }) => void
}

export function DisciplineBehaviorPointModal({ open, students, academicYear, submitting, onCancel, onSubmit }: DisciplineBehaviorPointModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ academic_year: academicYear, points_deducted: 0, points_restored: 0 })
    }
  }, [open, academicYear, form])

  return (
    <Modal
      title="Davranış Puanı Kaydı"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="student_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçiniz' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}${s.student_number ? ` (${s.student_number})` : ''}` }))}
          />
        </Form.Item>
        <Form.Item name="academic_year" label="Öğretim Yılı" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="points_deducted" label="Kırılan Puan">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="points_restored" label="İade Edilen Puan">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="restore_date" label="İade Tarihi">
          <Input type="date" />
        </Form.Item>
        <Form.Item name="reason" label="Açıklama">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
