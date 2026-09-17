import { useEffect, useState } from 'react'
import { App, Checkbox, DatePicker, Form, Input, Modal, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { downloadTeacherDocument, updateTeacher } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { downloadBlob } from '../utils/download'
import { addSalaryFormDeparture } from '../utils/salaryFormAutoEntry'
import type { Teacher } from '../types/teacher'

interface FormValues {
  leave_date: Dayjs
  leave_reason?: string
  add_to_salary_form: boolean
}

interface PersonnelDepartureModalProps {
  teacher: Teacher | null
  onClose: () => void
  onDone: () => void
}

/**
 * "Ayrılış Yazısı" akışı: ayrılma tarihini personel kaydına işler, isteğe bağlı olarak
 * ilgili ayın Maaş Değişikliği Bildirim Formu taslağına (B - Ayrılan Personel) satır ekler
 * ve ayrılış yazısını indirir. Hem Öğretmenler hem Diğer Personeller sayfasında kullanılır.
 */
export function PersonnelDepartureModal({ teacher, onClose, onDone }: PersonnelDepartureModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (teacher) {
      form.resetFields()
      form.setFieldsValue({ leave_date: dayjs(), add_to_salary_form: true })
    }
  }, [teacher, form])

  const onFinish = async (values: FormValues) => {
    if (!teacher) return
    setSubmitting(true)
    try {
      const leaveDateStr = values.leave_date.format('YYYY-MM-DD')
      await updateTeacher(teacher.id, { contract_end_date: leaveDateStr })

      if (values.add_to_salary_form) {
        await addSalaryFormDeparture(values.leave_date, {
          personnel_no: teacher.personnel_no || undefined,
          full_name: `${teacher.first_name} ${teacher.last_name}`,
          national_id: teacher.national_id || undefined,
          leave_date: leaveDateStr,
          leave_reason: values.leave_reason || undefined,
        })
      }

      try {
        const blob = await downloadTeacherDocument(teacher.id, 'ayrilis')
        downloadBlob(blob, `ayrilis-${teacher.personnel_no || teacher.id}.docx`)
      } catch (err) {
        message.warning('Ayrılış işlendi ancak yazı indirilemedi: ' + getErrorMessage(err))
      }

      message.success('Ayrılış işlendi')
      onDone()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={teacher ? `Ayrılış Ver — ${teacher.first_name} ${teacher.last_name}` : 'Ayrılış Ver'}
      open={Boolean(teacher)}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Ayrılışı İşle ve Yazıyı İndir"
      cancelText="Vazgeç"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="leave_date" label="Ayrılma Tarihi" rules={[{ required: true, message: 'Zorunlu' }]}>
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>
        <Form.Item name="leave_reason" label="Ayrılma Nedeni">
          <Input placeholder="Örn. Naklen tayin, istifa, emeklilik" />
        </Form.Item>
        <Form.Item name="add_to_salary_form" valuePropName="checked">
          <Checkbox>Maaş Değişikliği Bildirim Formuna ekle (B - Ayrılan Personel)</Checkbox>
        </Form.Item>
        <Typography.Text type="secondary">
          Ayrılma tarihi personel kaydına işlenir; işaretliyse ilgili ayın form taslağına satır eklenir.
        </Typography.Text>
      </Form>
    </Modal>
  )
}
