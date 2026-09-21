import { useEffect } from 'react'
import { Descriptions, Form, Input, Modal, Select, Space } from 'antd'
import { PARTICIPANT_ROLE_OPTIONS, PARTICIPANT_STATUS_OPTIONS } from '../types/discipline'
import type { DisciplineParticipant } from '../types/discipline'

interface DisciplineParticipantModalProps {
  open: boolean
  participant: DisciplineParticipant | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}

export function DisciplineParticipantModal({ open, participant, submitting, onCancel, onSubmit }: DisciplineParticipantModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open && participant) form.setFieldsValue(participant)
  }, [open, participant, form])

  if (!participant) return null
  const student = participant.Student

  return (
    <Modal
      title={`Katılımcı Bilgileri - ${student ? `${student.first_name} ${student.last_name}` : ''}`}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={680}
    >
      {student && (
        <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="TC Kimlik No">{student.national_id || '—'}</Descriptions.Item>
          <Descriptions.Item label="Doğum Tarihi">{student.birth_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Sınıf / No">
            {student.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : '—'} / {student.student_number || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Yatılı/Gündüzlü">{student.boarding_status || '—'}</Descriptions.Item>
        </Descriptions>
      )}
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Space.Compact block>
          <Form.Item name="role" label="Rol" style={{ flex: 1 }}>
            <Select options={PARTICIPANT_ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="status" label="Durum" style={{ flex: 1 }}>
            <Select options={PARTICIPANT_STATUS_OPTIONS} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="health_status" label="Sağlık Durumu">
          <Input />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="economic_status_mother" label="Anne Ekonomik Durumu" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="economic_status_father" label="Baba Ekonomik Durumu" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="family_together" label="Ailenin Birlikte Oturması" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="parents_alive" label="Anne-Baba Sağlığı" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="parents_biological" label="Anne-Baba Öz mü" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="raised_environment" label="Büyüdüğü Çevre">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="family_address" label="Ailenin Adresi">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="notes" label="Notlar">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
