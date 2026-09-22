import { useEffect } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { INFO_SOURCE_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineInfoRequest, DisciplineParticipant } from '../types/discipline'

const FIELD_CONFIG: Record<string, Array<{ key: string; label: string }>> = {
  ogretmen: [
    { key: 'ders_tutum', label: 'Dersimdeki Tutumu' },
    { key: 'ders_disi', label: 'Ders Dışı Faaliyetleri' },
    { key: 'arkadas_iliski', label: 'Arkadaşları İle İlişkisi' },
  ],
  rehberlik: [
    { key: 'kisisel', label: 'Kişisel Özellikleri' },
    { key: 'sosyal', label: 'Sosyal Özellikleri' },
  ],
  arkadas: [
    { key: 'ders', label: 'Dersteki Davranışları' },
    { key: 'teneffus', label: 'Teneffüslerdeki Davranışları' },
    { key: 'okul_disi', label: 'Okul Dışındaki Davranışları' },
  ],
  genel: [
    { key: 'bilgi', label: 'Konu İle İlgili Bilgilerim' },
    { key: 'arkadas_gorus', label: 'Arkadaşım Hakkındaki Görüşlerim' },
  ],
}

interface DisciplineInfoRequestModalProps {
  open: boolean
  participant: DisciplineParticipant | null
  editing: DisciplineInfoRequest | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: { source_type: string; source_name?: string; source_branch?: string; content: Record<string, string>; response_date?: string }) => void
}

export function DisciplineInfoRequestModal({ open, participant, editing, submitting, onCancel, onSubmit }: DisciplineInfoRequestModalProps) {
  const [form] = Form.useForm()
  const sourceType = Form.useWatch('source_type', form) || 'ogretmen'

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        source_type: editing.source_type,
        source_name: editing.source_name,
        source_branch: editing.source_branch,
        response_date: editing.response_date,
        ...editing.content,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ source_type: 'ogretmen' })
    }
  }, [open, editing, form])

  const fields = FIELD_CONFIG[sourceType] || FIELD_CONFIG.genel
  const studentName = participant?.Student ? `${participant.Student.first_name} ${participant.Student.last_name}` : '—'

  const handleFinish = (values: Record<string, string>) => {
    const { source_type, source_name, source_branch, response_date, ...rest } = values
    const content: Record<string, string> = {}
    fields.forEach((f) => {
      content[f.key] = rest[f.key] || ''
    })
    onSubmit({ source_type, source_name, source_branch, response_date, content })
  }

  return (
    <Modal
      title={`Bilgi Toplama Formu - ${studentName}`}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item name="source_type" label="Kimden" rules={[{ required: true }]}>
          <Select options={INFO_SOURCE_TYPE_OPTIONS} disabled={!!editing} />
        </Form.Item>
        <Form.Item name="source_name" label={sourceType === 'arkadas' ? 'Öğrenci Adı Soyadı' : 'Adı Soyadı'}>
          <Input />
        </Form.Item>
        {(sourceType === 'ogretmen' || sourceType === 'rehberlik') && (
          <Form.Item name="source_branch" label="Branşı">
            <Input />
          </Form.Item>
        )}
        {fields.map((f) => (
          <Form.Item key={f.key} name={f.key} label={f.label}>
            <Input.TextArea rows={3} />
          </Form.Item>
        ))}
        <Form.Item name="response_date" label="Tarih">
          <Input type="date" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
